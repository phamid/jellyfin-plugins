'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    FREQUENCIES,
    PRESETS,
    VISUALIZERS,
    clamp,
    normalizeSettings,
    formatFrequency,
    presetLabel,
    createAudioGraph,
    getOrCreateAudioGraph,
    shouldPreferCaptureStream,
    toggleFullscreen,
    renderVisualizerFrame
} = require('../plugins/y2k-equalizer/src/y2k-equalizer.js');

test('defines a conventional ten-band equalizer', () => {
    assert.deepEqual(FREQUENCIES, [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
    for (const gains of Object.values(PRESETS)) {
        assert.equal(gains.length, FREQUENCIES.length);
        assert.ok(gains.every((gain) => gain >= -12 && gain <= 12));
    }
});

test('normalizes untrusted persisted settings', () => {
    assert.deepEqual(normalizeSettings({
        enabled: false,
        panelOpen: false,
        preset: 'not-real',
        preamp: 99,
        gains: [-99, -8, -4, 0, 2, 4, 8, 12, 22, 'bad']
    }), {
        enabled: false,
        panelOpen: false,
        preset: 'flat',
        visualizerMode: 'winamp-spectrum',
        preamp: 6,
        gains: [-12, -8, -4, 0, 2, 4, 8, 12, 12, 0]
    });
});

test('falls back safely for malformed settings', () => {
    const settings = normalizeSettings(null);
    assert.equal(settings.enabled, true);
    assert.equal(settings.panelOpen, true);
    assert.equal(settings.preset, 'flat');
    assert.equal(settings.visualizerMode, 'winamp-spectrum');
    assert.equal(settings.preamp, 0);
    assert.deepEqual(settings.gains, PRESETS.flat);
});

test('preserves a custom curve across browser reloads', () => {
    const gains = [-1, 0, 1, 2, 3, 4, 3, 2, 1, 0];
    const settings = normalizeSettings({ preset: 'custom', gains });
    assert.equal(settings.preset, 'custom');
    assert.deepEqual(settings.gains, gains);
});

test('formats labels for the compact interface', () => {
    assert.equal(formatFrequency(125), '125');
    assert.equal(formatFrequency(1000), '1k');
    assert.equal(formatFrequency(16000), '16k');
    assert.equal(presetLabel('winamp-classic'), 'Winamp Classic');
});

test('accepts only supported visualizer modes', () => {
    assert.deepEqual(Object.keys(VISUALIZERS), [
        'winamp-spectrum',
        'windows-media-bars',
        'itunes-waveform',
        'radial-spectrum',
        'neon-ribbons',
        'particle-orbit',
        'retro-tunnel',
        'synthwave-highway',
        'laser-dancefloor',
        'arcade-starfield'
    ]);
    for (const visualizerMode of Object.keys(VISUALIZERS)) {
        const persisted = JSON.parse(JSON.stringify(normalizeSettings({ visualizerMode })));
        assert.equal(normalizeSettings(persisted).visualizerMode, visualizerMode);
    }
    assert.equal(normalizeSettings({ visualizerMode: 'unknown' }).visualizerMode, 'winamp-spectrum');
});

function recordFrame(mode, width, height, level, timestamp = 1200) {
    const calls = [];
    const record = (name) => (...args) => {
        for (const value of args) {
            if (typeof value === 'number') {
                assert.ok(Number.isFinite(value), `${mode}: ${name} must have finite coordinates`);
            }
        }
        calls.push([name, ...args]);
    };
    const context = Object.fromEntries([
        'save', 'restore', 'clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo',
        'stroke', 'closePath', 'arc', 'fill'
    ].map((name) => [name, record(name)]));
    context.createLinearGradient = () => ({ addColorStop: record('addColorStop') });
    const reads = [];
    const graph = {
        frequencyData: new Uint8Array(128),
        timeData: new Uint8Array(256),
        analyser: {
            getByteFrequencyData(values) {
                reads.push('frequency');
                values.fill(level);
            },
            getByteTimeDomainData(values) {
                reads.push('time');
                values.forEach((_, index) => {
                    values[index] = 128 + Math.round(Math.sin(index / 8) * level / 2);
                });
            }
        }
    };
    renderVisualizerFrame(context, graph, { width, height }, mode, timestamp);
    return { calls, reads };
}

test('renders every mode at compact, mobile, fullscreen and minimum canvas sizes', () => {
    for (const mode of Object.keys(VISUALIZERS)) {
        for (const [width, height] of [[640, 224], [320, 112], [2880, 1800], [1, 1]]) {
            for (const level of [0, 128, 255]) {
                const { calls, reads } = recordFrame(mode, width, height, level);
                assert.deepEqual(reads, [
                    mode === 'itunes-waveform' || mode === 'neon-ribbons' ? 'time' : 'frequency'
                ]);
                assert.deepEqual(calls[0], ['save']);
                assert.deepEqual(calls.at(-1), ['restore']);
                assert.deepEqual(calls.filter(([name]) => name === 'clearRect'),
                    [['clearRect', 0, 0, width, height]]);
                assert.ok(calls.some(([name]) => ['stroke', 'fill', 'fillRect'].includes(name)));
                assert.ok(calls.length < 1200, 'drawing work must remain bounded');
            }
        }
    }
});

test('new modes react to audio and animate with elapsed time', () => {
    for (const mode of [
        'radial-spectrum', 'neon-ribbons', 'particle-orbit', 'retro-tunnel',
        'synthwave-highway', 'laser-dancefloor', 'arcade-starfield'
    ]) {
        const quiet = recordFrame(mode, 640, 224, 0).calls;
        const loud = recordFrame(mode, 640, 224, 255).calls;
        const later = recordFrame(mode, 640, 224, 255, 2400).calls;
        assert.notDeepEqual(quiet, loud, `${mode} must react to audio`);
        assert.notDeepEqual(loud, later, `${mode} must animate over time`);
        assert.deepEqual(loud, recordFrame(mode, 640, 224, 255).calls,
            'the same timestamp must render identically regardless of frame rate');
    }
});

test('each new mode has distinct drawing geometry', () => {
    const count = (mode, operation) => recordFrame(mode, 640, 224, 128).calls
        .filter(([name]) => name === operation).length;
    assert.equal(count('radial-spectrum', 'stroke'), 64);
    assert.equal(count('neon-ribbons', 'stroke'), 3);
    assert.equal(count('particle-orbit', 'arc'), 80);
    assert.equal(count('retro-tunnel', 'closePath'), 12);
    assert.equal(count('synthwave-highway', 'arc'), 1);
    assert.equal(count('laser-dancefloor', 'stroke'), 24);
    assert.equal(count('arcade-starfield', 'stroke'), 96);
});

test('clamps numeric and invalid values', () => {
    assert.equal(clamp(20, -12, 12), 12);
    assert.equal(clamp(-20, -12, 12), -12);
    assert.equal(clamp('4.5', -12, 12), 4.5);
    assert.equal(clamp('invalid', -12, 12), 0);
});

test('builds the Web Audio graph in frequency order', () => {
    const nodes = [];
    const makeNode = () => {
        const node = {
            connections: [],
            connect(target) {
                this.connections.push(target);
                return target;
            }
        };
        nodes.push(node);
        return node;
    };
    const context = {
        destination: makeNode(),
        createMediaElementSource: (media) => {
            assert.equal(media.id, 'player');
            return makeNode();
        },
        createGain: () => ({ ...makeNode(), gain: { value: 1 } }),
        createAnalyser: () => ({
            ...makeNode(),
            fftSize: 0,
            smoothingTimeConstant: 0,
            frequencyBinCount: 128
        }),
        createBiquadFilter: () => ({
            ...makeNode(),
            frequency: { value: 0 },
            Q: { value: 0 },
            gain: { value: 0 }
        })
    };

    const graph = createAudioGraph(context, { id: 'player' }, PRESETS['winamp-classic']);

    assert.equal(graph.filters.length, 10);
    assert.equal(graph.filters[0].type, 'lowshelf');
    assert.equal(graph.filters[9].type, 'highshelf');
    assert.deepEqual(graph.filters.map((filter) => filter.frequency.value), FREQUENCIES);
    assert.deepEqual(graph.filters.map((filter) => filter.gain.value), PRESETS['winamp-classic']);
    assert.equal(graph.source.connections[0], graph.preamp);
    assert.equal(graph.filters[9].connections[0], graph.analyser);
    assert.equal(graph.analyser.connections[0], context.destination);
    assert.equal(graph.analyser.fftSize, 256);
    assert.equal(graph.analyser.smoothingTimeConstant, 0.78);
    assert.equal(graph.equalizerAvailable, true);
    assert.equal(graph.frequencyData.length, 128);
    assert.equal(graph.timeData.length, 256);
});

test('reuses one source graph per persistent Jellyfin media element', () => {
    let sourceCreations = 0;
    const makeNode = () => ({
        connect(target) {
            return target;
        }
    });
    const context = {
        destination: makeNode(),
        createMediaElementSource: () => {
            sourceCreations += 1;
            return makeNode();
        },
        createGain: () => ({ ...makeNode(), gain: { value: 1 } }),
        createAnalyser: () => ({
            ...makeNode(),
            fftSize: 0,
            smoothingTimeConstant: 0,
            frequencyBinCount: 128
        }),
        createBiquadFilter: () => ({
            ...makeNode(),
            frequency: { value: 0 },
            Q: { value: 0 },
            gain: { value: 0 }
        })
    };
    const graphs = new Map();
    const audio = { kind: 'audio' };
    const video = { kind: 'video' };

    const firstAudioGraph = getOrCreateAudioGraph(context, graphs, audio, PRESETS.flat);
    getOrCreateAudioGraph(context, graphs, video, PRESETS.flat);
    const resumedAudioGraph = getOrCreateAudioGraph(context, graphs, audio, PRESETS.flat);

    assert.equal(sourceCreations, 2);
    assert.equal(resumedAudioGraph, firstAudioGraph);
    assert.equal(graphs.size, 2);
});

test('falls back to captureStream when Jellyfin already owns the media source', () => {
    const makeNode = () => ({
        connections: [],
        connect(target) {
            this.connections.push(target);
            return target;
        }
    });
    const capturedStream = { id: 'captured-audio' };
    const media = { captureStream: () => capturedStream };
    const context = {
        destination: makeNode(),
        createMediaElementSource: () => {
            const error = new Error('already connected');
            error.name = 'InvalidStateError';
            throw error;
        },
        createMediaStreamSource: (stream) => {
            assert.equal(stream, capturedStream);
            return makeNode();
        },
        createGain: () => ({ ...makeNode(), gain: { value: 1 } }),
        createAnalyser: () => ({
            ...makeNode(),
            fftSize: 0,
            smoothingTimeConstant: 0,
            frequencyBinCount: 128
        })
    };

    const graph = createAudioGraph(context, media, PRESETS.flat);

    assert.equal(graph.equalizerAvailable, false);
    assert.equal(graph.filters.length, 0);
    assert.equal(graph.silentOutput.gain.value, 0);
    assert.equal(graph.analyser.connections[0], graph.silentOutput);
    assert.equal(graph.silentOutput.connections[0], context.destination);
});

test('prefers the silent capture path on Firefox to prevent duplicate audio', () => {
    let mediaElementSourceCreations = 0;
    let mediaStreamSourceCreations = 0;
    const makeNode = () => ({
        connect(target) {
            return target;
        }
    });
    const context = {
        destination: makeNode(),
        createMediaElementSource: () => {
            mediaElementSourceCreations += 1;
            return makeNode();
        },
        createMediaStreamSource: () => {
            mediaStreamSourceCreations += 1;
            return makeNode();
        },
        createGain: () => ({ ...makeNode(), gain: { value: 1 } }),
        createAnalyser: () => ({
            ...makeNode(),
            fftSize: 0,
            smoothingTimeConstant: 0,
            frequencyBinCount: 128
        })
    };
    const media = { captureStream: () => ({}) };

    const graph = createAudioGraph(context, media, PRESETS.flat, true);

    assert.equal(shouldPreferCaptureStream('Mozilla/5.0 Firefox/142.0'), true);
    assert.equal(shouldPreferCaptureStream('Mozilla/5.0 Chrome/140.0'), false);
    assert.equal(mediaElementSourceCreations, 0);
    assert.equal(mediaStreamSourceCreations, 1);
    assert.equal(graph.equalizerAvailable, false);
    assert.equal(graph.silentOutput.gain.value, 0);
});

test('toggles visualizer fullscreen using standard browser APIs', async () => {
    let entered = 0;
    let exited = 0;
    const element = {
        async requestFullscreen() {
            entered += 1;
        }
    };
    const documentObject = {
        fullscreenElement: null,
        async exitFullscreen() {
            exited += 1;
        }
    };

    assert.equal(await toggleFullscreen(element, documentObject), true);
    documentObject.fullscreenElement = element;
    assert.equal(await toggleFullscreen(element, documentObject), false);
    assert.equal(entered, 1);
    assert.equal(exited, 1);
});

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
    getOrCreateAudioGraph
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
        'itunes-waveform'
    ]);
    assert.equal(normalizeSettings({ visualizerMode: 'itunes-waveform' }).visualizerMode, 'itunes-waveform');
    assert.equal(normalizeSettings({ visualizerMode: 'unknown' }).visualizerMode, 'winamp-spectrum');
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

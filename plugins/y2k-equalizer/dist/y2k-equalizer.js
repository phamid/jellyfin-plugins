/* Jellyfin Y2K Equalizer v0.2.0 | MIT License | https://github.com/phamid/jellyfin-plugins */
(function () {
    'use strict';

    const VERSION = '0.2.0';
    const STORAGE_KEY = 'phamid.jellyfin.y2k-equalizer.v1';
    const FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const PRESETS = Object.freeze({
        flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        'winamp-classic': [6, 5, 3, 1, -1, -2, 0, 2, 4, 5],
        'windows-media-player': [4, 3, 1, 0, -1, 0, 1, 3, 4, 3],
        'itunes-dance': [5, 4, 1, 0, 0, -2, -1, 2, 4, 5],
        bass: [7, 6, 5, 3, 1, 0, -1, -2, -2, -2],
        vocal: [-3, -2, -1, 1, 3, 5, 4, 2, 0, -2],
        treble: [-3, -3, -2, -1, 0, 1, 3, 5, 6, 7]
    });
    const VISUALIZERS = Object.freeze({
        'winamp-spectrum': 'Winamp Spectrum',
        'windows-media-bars': 'Windows Media Bars',
        'itunes-waveform': 'iTunes Waveform'
    });

    function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, Number(value) || 0));
    }

    function normalizeSettings(value) {
        const source = value && typeof value === 'object' ? value : {};
        const gains = Array.isArray(source.gains) && source.gains.length === FREQUENCIES.length
            ? source.gains.map((gain) => clamp(gain, -12, 12))
            : [...PRESETS.flat];

        return {
            enabled: source.enabled !== false,
            panelOpen: source.panelOpen !== false,
            preset: source.preset === 'custom' || Object.prototype.hasOwnProperty.call(PRESETS, source.preset)
                ? source.preset
                : 'flat',
            visualizerMode: Object.prototype.hasOwnProperty.call(VISUALIZERS, source.visualizerMode)
                ? source.visualizerMode
                : 'winamp-spectrum',
            preamp: clamp(source.preamp, -12, 6),
            gains
        };
    }

    function formatFrequency(frequency) {
        return frequency >= 1000 ? `${frequency / 1000}k` : String(frequency);
    }

    function presetLabel(key) {
        const labels = {
            flat: 'Flat',
            'winamp-classic': 'Winamp Classic',
            'windows-media-player': 'Windows Media Player',
            'itunes-dance': 'iTunes Dance',
            bass: 'Bass Booster',
            vocal: 'Vocal',
            treble: 'Treble Booster'
        };
        return labels[key] || key;
    }

    function createAudioGraph(context, media, gains) {
        const source = context.createMediaElementSource(media);
        const preamp = context.createGain();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;
        const filters = FREQUENCIES.map((frequency, index) => {
            const filter = context.createBiquadFilter();
            filter.type = index === 0 ? 'lowshelf' : index === FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
            filter.frequency.value = frequency;
            filter.Q.value = 1.1;
            filter.gain.value = gains[index];
            return filter;
        });

        source.connect(preamp);
        filters.reduce((previous, filter) => previous.connect(filter), preamp)
            .connect(analyser)
            .connect(context.destination);
        return {
            source,
            preamp,
            filters,
            analyser,
            frequencyData: new Uint8Array(analyser.frequencyBinCount),
            timeData: new Uint8Array(analyser.fftSize)
        };
    }

    function getOrCreateAudioGraph(context, graphs, media, gains) {
        let graph = graphs.get(media);
        if (!graph) {
            graph = createAudioGraph(context, media, gains);
            graphs.set(media, graph);
        }
        return graph;
    }

    const testApi = {
        FREQUENCIES,
        PRESETS,
        VISUALIZERS,
        clamp,
        normalizeSettings,
        formatFrequency,
        presetLabel,
        createAudioGraph,
        getOrCreateAudioGraph
    };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = testApi;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    if (window.JellyfinY2KEqualizer) {
        window.JellyfinY2KEqualizer.open();
        return;
    }

    const state = {
        settings: loadSettings(),
        context: null,
        source: null,
        media: null,
        preamp: null,
        filters: [],
        graphs: new Map(),
        panel: null,
        launcher: null,
        status: null,
        observer: null,
        visualizerFrame: null
    };

    function loadSettings() {
        try {
            return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));
        } catch {
            return normalizeSettings();
        }
    }

    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    }

    function setStatus(message, kind) {
        if (!state.status) {
            return;
        }

        state.status.textContent = message;
        state.status.dataset.kind = kind || 'normal';
    }

    function currentMediaElement() {
        const candidates = [...document.querySelectorAll('audio, video')]
            .filter((element) => element.isConnected);
        return candidates.find((element) => !element.paused && !element.ended)
            || candidates.find((element) => element.currentSrc || element.src)
            || candidates[0]
            || null;
    }

    async function attachAudio() {
        const media = currentMediaElement();
        let createdContext = false;
        let pendingContext = null;
        if (!media) {
            setStatus('Start playback to connect', 'warning');
            return false;
        }

        if (state.media === media && state.context) {
            await state.context.resume();
            setStatus('Connected to Jellyfin playback', 'success');
            return true;
        }

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error('This browser does not support the Web Audio API.');
            }

            const context = state.context || new AudioContextClass();
            createdContext = !state.context;
            pendingContext = context;
            const { source, preamp, filters } = getOrCreateAudioGraph(
                context,
                state.graphs,
                media,
                state.settings.gains
            );

            state.context = context;
            state.source = source;
            state.media = media;
            state.preamp = preamp;
            state.filters = filters;
            applyAudioSettings();
            await context.resume();
            startVisualizer();
            setStatus('Connected to Jellyfin playback', 'success');
            return true;
        } catch (error) {
            if (createdContext && !state.context) {
                if (pendingContext && typeof pendingContext.close === 'function') {
                    try {
                        await pendingContext.close();
                    } catch (closeError) {
                        console.warn('[Y2K Equalizer] Could not close an unused audio context.', closeError);
                    }
                }
            }
            console.error('[Y2K Equalizer] Could not connect to playback.', error);
            const message = error && error.name === 'InvalidStateError'
                ? 'Playback already uses Web Audio; disable Jellyfin normalization'
                : error.message || 'Unable to connect to playback';
            setStatus(message, 'error');
            return false;
        }
    }

    function applyAudioSettings() {
        if (!state.context || !state.preamp) {
            return;
        }

        const now = state.context.currentTime;
        const preampGain = state.settings.enabled ? Math.pow(10, state.settings.preamp / 20) : 1;
        state.graphs.forEach((graph) => {
            graph.preamp.gain.setTargetAtTime(preampGain, now, 0.015);
            graph.filters.forEach((filter, index) => {
                const gain = state.settings.enabled ? state.settings.gains[index] : 0;
                filter.gain.setTargetAtTime(gain, now, 0.015);
            });
        });
    }

    function setPreset(name) {
        if (!Object.prototype.hasOwnProperty.call(PRESETS, name)) {
            return;
        }

        state.settings.preset = name;
        state.settings.gains = [...PRESETS[name]];
        updateControls();
        applyAudioSettings();
        saveSettings();
    }

    function setGain(index, value) {
        state.settings.gains[index] = clamp(value, -12, 12);
        state.settings.preset = 'custom';
        applyAudioSettings();
        saveSettings();
        updateReadout(index);
        const select = state.panel.querySelector('[data-eq-preset]');
        select.value = 'custom';
    }

    function updateReadout(index) {
        const output = state.panel.querySelector(`[data-eq-output="${index}"]`);
        if (output) {
            const gain = state.settings.gains[index];
            output.textContent = `${gain > 0 ? '+' : ''}${gain.toFixed(1)}`;
        }
    }

    function updateControls() {
        if (!state.panel) {
            return;
        }

        state.panel.querySelector('[data-eq-enabled]').checked = state.settings.enabled;
        state.panel.querySelector('[data-visualizer-mode]').value = state.settings.visualizerMode;
        state.panel.querySelector('[data-eq-preamp]').value = state.settings.preamp;
        state.panel.querySelector('[data-eq-preamp-output]').textContent =
            `${state.settings.preamp > 0 ? '+' : ''}${state.settings.preamp.toFixed(1)} dB`;

        const select = state.panel.querySelector('[data-eq-preset]');
        if (state.settings.preset === 'custom') {
            if (!select.querySelector('[value="custom"]')) {
                select.add(new Option('Custom', 'custom'));
            }
            select.value = 'custom';
        } else {
            select.value = state.settings.preset;
        }

        state.settings.gains.forEach((gain, index) => {
            state.panel.querySelector(`[data-eq-band="${index}"]`).value = gain;
            updateReadout(index);
        });
        state.panel.classList.toggle('y2k-eq--bypassed', !state.settings.enabled);
    }

    function buildPanel() {
        const style = document.createElement('style');
        style.id = 'y2k-equalizer-styles';
        style.textContent = `
            #y2k-equalizer { --eq-bg:#15171c; --eq-panel:#222731; --eq-edge:#58616f; --eq-text:#e6edf4;
                --eq-muted:#8f9baa; --eq-lime:#9be22d; --eq-cyan:#44c9e8; --eq-orange:#ff9d2e;
                position:fixed; right:18px; bottom:78px; z-index:99999; width:min(620px,calc(100vw - 24px));
                color:var(--eq-text); background:linear-gradient(145deg,#303744,#0f1115 68%);
                border:1px solid #697483; border-radius:8px; box-shadow:0 18px 55px #000b;
                font:12px/1.3 Verdana,Tahoma,sans-serif; user-select:none; }
            #y2k-equalizer[hidden] { display:none; }
            #y2k-equalizer .y2k-eq-title { display:flex; align-items:center; gap:10px; padding:7px 9px;
                background:linear-gradient(90deg,#29455d,#55758a 48%,#253341); border-bottom:1px solid #87939e;
                border-radius:7px 7px 0 0; font-weight:700; letter-spacing:.04em; cursor:move; }
            #y2k-equalizer .y2k-eq-led { width:8px; height:8px; border-radius:50%; background:var(--eq-lime);
                box-shadow:0 0 8px var(--eq-lime); }
            #y2k-equalizer .y2k-eq-title button { margin-left:auto; border:1px solid #aab3bc; border-radius:2px;
                width:23px; height:19px; color:#101215; background:linear-gradient(#f0f0f0,#858b92); font-weight:700; }
            #y2k-equalizer .y2k-eq-toolbar { display:grid; grid-template-columns:auto 1fr auto; gap:10px;
                align-items:center; padding:10px; background:#151a21; border-bottom:1px solid #46505b; }
            #y2k-equalizer select,#y2k-equalizer button { font:inherit; }
            #y2k-equalizer select { min-width:170px; padding:5px 7px; color:var(--eq-text); background:#252c35;
                border:1px solid #596675; border-radius:3px; }
            #y2k-equalizer .y2k-eq-toggle { display:flex; align-items:center; gap:6px; font-weight:700; }
            #y2k-equalizer .y2k-eq-status { overflow:hidden; color:var(--eq-cyan); text-align:right;
                text-overflow:ellipsis; white-space:nowrap; }
            #y2k-equalizer .y2k-eq-status[data-kind="error"] { color:#ff6b6b; }
            #y2k-equalizer .y2k-eq-status[data-kind="warning"] { color:var(--eq-orange); }
            #y2k-equalizer .y2k-eq-status[data-kind="success"] { color:var(--eq-lime); }
            #y2k-equalizer .y2k-visualizer { padding:8px 10px 4px; background:#090c0f; border-bottom:1px solid #46505b; }
            #y2k-equalizer .y2k-visualizer-head { display:flex; align-items:center; gap:9px; margin-bottom:6px; }
            #y2k-equalizer .y2k-visualizer-head strong { color:var(--eq-cyan); letter-spacing:.08em; }
            #y2k-equalizer .y2k-visualizer-head select { margin-left:auto; min-width:180px; }
            #y2k-equalizer canvas { display:block; width:100%; height:112px; border:1px inset #3b4650;
                background:#030504; image-rendering:pixelated; }
            #y2k-equalizer .y2k-eq-deck { display:grid; grid-template-columns:54px 1fr; gap:7px; padding:12px 10px 9px;
                background:repeating-linear-gradient(0deg,#191d23,#191d23 19px,#1d2229 20px); }
            #y2k-equalizer .y2k-eq-band { display:grid; grid-template-rows:25px 150px 20px; justify-items:center; }
            #y2k-equalizer .y2k-eq-bands { display:grid; grid-template-columns:repeat(10,minmax(30px,1fr)); gap:4px; }
            #y2k-equalizer output { color:var(--eq-orange); font:10px "Courier New",monospace; }
            #y2k-equalizer .y2k-eq-frequency { color:var(--eq-muted); font:10px "Courier New",monospace; }
            #y2k-equalizer input[type="range"].vertical { width:140px; height:25px; margin:62px -57px;
                transform:rotate(-90deg); accent-color:var(--eq-lime); }
            #y2k-equalizer .y2k-eq-preamp { border-right:1px solid #46505b; }
            #y2k-equalizer .y2k-eq-preamp input { accent-color:var(--eq-cyan)!important; }
            #y2k-equalizer .y2k-eq-footer { display:flex; gap:9px; align-items:center; padding:8px 10px;
                color:var(--eq-muted); background:#11151a; border-top:1px solid #3d4650; border-radius:0 0 7px 7px; }
            #y2k-equalizer .y2k-eq-footer button { padding:4px 9px; color:var(--eq-text); background:#2b333d;
                border:1px solid #596675; border-radius:3px; }
            #y2k-equalizer .y2k-eq-footer span { margin-left:auto; font:10px "Courier New",monospace; }
            #y2k-equalizer.y2k-eq--bypassed .y2k-eq-deck { opacity:.45; }
            #y2k-equalizer-launcher { position:fixed; right:18px; bottom:18px; z-index:99998; width:58px; height:48px;
                border:1px solid #7b8795; border-radius:50%; color:#121419; background:linear-gradient(#b6ed52,#6fa816);
                box-shadow:0 7px 22px #0009; font:700 13px Verdana,sans-serif; }
            @media (max-width:640px) {
                #y2k-equalizer { right:12px; bottom:74px; overflow-x:auto; }
                #y2k-equalizer .y2k-eq-toolbar { grid-template-columns:1fr auto; }
                #y2k-equalizer .y2k-eq-status { grid-column:1/-1; text-align:left; }
                #y2k-equalizer .y2k-eq-deck { min-width:570px; }
            }`;
        document.head.appendChild(style);

        const panel = document.createElement('section');
        panel.id = 'y2k-equalizer';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Y2K ten-band equalizer');
        panel.innerHTML = `
            <header class="y2k-eq-title">
                <span class="y2k-eq-led" aria-hidden="true"></span>
                JELLYFIN Y2K EQ + VISUALIZER
                <button type="button" data-eq-close aria-label="Close equalizer">×</button>
            </header>
            <div class="y2k-eq-toolbar">
                <label class="y2k-eq-toggle"><input type="checkbox" data-eq-enabled> EQ ON</label>
                <select data-eq-preset aria-label="Equalizer preset">
                    ${Object.keys(PRESETS).map((key) => `<option value="${key}">${presetLabel(key)}</option>`).join('')}
                </select>
                <span class="y2k-eq-status" data-eq-status>Start playback, then connect</span>
            </div>
            <div class="y2k-visualizer">
                <div class="y2k-visualizer-head">
                    <strong>VISUALIZER</strong>
                    <select data-visualizer-mode aria-label="Visualizer style">
                        ${Object.entries(VISUALIZERS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}
                    </select>
                </div>
                <canvas data-visualizer-canvas aria-label="Audio visualization"></canvas>
            </div>
            <div class="y2k-eq-deck">
                <label class="y2k-eq-band y2k-eq-preamp">
                    <output data-eq-preamp-output>0.0 dB</output>
                    <input class="vertical" type="range" min="-12" max="6" step="0.5" value="0" data-eq-preamp aria-label="Preamp">
                    <span class="y2k-eq-frequency">PRE</span>
                </label>
                <div class="y2k-eq-bands">
                    ${FREQUENCIES.map((frequency, index) => `
                        <label class="y2k-eq-band">
                            <output data-eq-output="${index}">0.0</output>
                            <input class="vertical" type="range" min="-12" max="12" step="0.5" value="0"
                                data-eq-band="${index}" aria-label="${formatFrequency(frequency)} hertz">
                            <span class="y2k-eq-frequency">${formatFrequency(frequency)}</span>
                        </label>`).join('')}
                </div>
            </div>
            <footer class="y2k-eq-footer">
                <button type="button" data-eq-connect>Connect</button>
                <button type="button" data-eq-reset>Reset</button>
                <span>WEB AUDIO DSP · v${VERSION}</span>
            </footer>`;
        document.body.appendChild(panel);

        const launcher = document.createElement('button');
        launcher.id = 'y2k-equalizer-launcher';
        launcher.type = 'button';
        launcher.textContent = 'EQ/VIS';
        launcher.setAttribute('aria-label', 'Open Y2K equalizer and visualizer');
        launcher.title = 'Select an equalizer preset or visualizer';
        document.body.appendChild(launcher);

        state.panel = panel;
        state.launcher = launcher;
        state.status = panel.querySelector('[data-eq-status]');
        panel.hidden = !state.settings.panelOpen;

        panel.querySelector('[data-eq-close]').addEventListener('click', close);
        launcher.addEventListener('click', () => {
            open();
            void attachAudio();
        });
        panel.querySelector('[data-eq-connect]').addEventListener('click', attachAudio);
        panel.querySelector('[data-eq-reset]').addEventListener('click', () => setPreset('flat'));
        panel.querySelector('[data-eq-enabled]').addEventListener('change', (event) => {
            state.settings.enabled = event.target.checked;
            panel.classList.toggle('y2k-eq--bypassed', !state.settings.enabled);
            applyAudioSettings();
            saveSettings();
        });
        panel.querySelector('[data-eq-preset]').addEventListener('change', (event) => {
            if (event.target.value !== 'custom') {
                setPreset(event.target.value);
            }
        });
        panel.querySelector('[data-visualizer-mode]').addEventListener('change', (event) => {
            state.settings.visualizerMode = event.target.value;
            saveSettings();
            startVisualizer();
        });
        panel.querySelector('[data-eq-preamp]').addEventListener('input', (event) => {
            state.settings.preamp = clamp(event.target.value, -12, 6);
            panel.querySelector('[data-eq-preamp-output]').textContent =
                `${state.settings.preamp > 0 ? '+' : ''}${state.settings.preamp.toFixed(1)} dB`;
            applyAudioSettings();
            saveSettings();
        });
        panel.querySelectorAll('[data-eq-band]').forEach((input) => {
            input.addEventListener('input', (event) => setGain(Number(event.target.dataset.eqBand), event.target.value));
        });

        updateControls();
        refreshLauncherVisibility();
    }

    function open() {
        state.settings.panelOpen = true;
        state.panel.hidden = false;
        startVisualizer();
        saveSettings();
    }

    function close() {
        state.settings.panelOpen = false;
        state.panel.hidden = true;
        stopVisualizer();
        saveSettings();
    }

    function drawSpectrum(context, analyser, values, canvas, mode) {
        const width = canvas.width;
        const height = canvas.height;
        analyser.getByteFrequencyData(values);
        context.clearRect(0, 0, width, height);

        const barCount = mode === 'windows-media-bars' ? 48 : 32;
        const gap = Math.max(1, Math.floor(width / 180));
        const barWidth = Math.max(2, Math.floor((width - gap * (barCount - 1)) / barCount));
        const gradient = context.createLinearGradient(0, height, 0, 0);
        if (mode === 'windows-media-bars') {
            gradient.addColorStop(0, '#1264c4');
            gradient.addColorStop(0.55, '#43c6f4');
            gradient.addColorStop(1, '#eefcff');
        } else {
            gradient.addColorStop(0, '#43a51d');
            gradient.addColorStop(0.68, '#b5ed35');
            gradient.addColorStop(0.84, '#ffbe35');
            gradient.addColorStop(1, '#ff5335');
        }
        context.fillStyle = gradient;

        for (let index = 0; index < barCount; index += 1) {
            const sourceIndex = Math.floor((index / barCount) ** 1.65 * values.length);
            const magnitude = values[Math.min(sourceIndex, values.length - 1)] / 255;
            const barHeight = Math.max(2, Math.floor(magnitude * height));
            const x = index * (barWidth + gap);
            if (mode === 'windows-media-bars') {
                const center = height / 2;
                context.fillRect(x, center - barHeight / 2, barWidth, barHeight);
            } else {
                context.fillRect(x, height - barHeight, barWidth, barHeight);
            }
        }
    }

    function drawWaveform(context, analyser, values, canvas) {
        analyser.getByteTimeDomainData(values);
        const width = canvas.width;
        const height = canvas.height;
        context.clearRect(0, 0, width, height);
        context.lineWidth = Math.max(2, width / 320);
        context.strokeStyle = '#70d8ef';
        context.shadowBlur = 10;
        context.shadowColor = '#44c9e8';
        context.beginPath();
        values.forEach((value, index) => {
            const x = index / (values.length - 1) * width;
            const y = value / 255 * height;
            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        });
        context.stroke();
        context.shadowBlur = 0;
    }

    function drawVisualizer() {
        state.visualizerFrame = null;
        if (!state.panel || state.panel.hidden || !state.media || state.media.paused || state.media.ended) {
            return;
        }

        const graph = state.graphs.get(state.media);
        const canvas = state.panel.querySelector('[data-visualizer-canvas]');
        const context = canvas && canvas.getContext('2d');
        if (!graph || !context) {
            return;
        }

        const scale = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.floor(canvas.clientWidth * scale));
        const height = Math.max(1, Math.floor(canvas.clientHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        if (state.settings.visualizerMode === 'itunes-waveform') {
            drawWaveform(context, graph.analyser, graph.timeData, canvas);
        } else {
            drawSpectrum(context, graph.analyser, graph.frequencyData, canvas, state.settings.visualizerMode);
        }
        state.visualizerFrame = window.requestAnimationFrame(drawVisualizer);
    }

    function startVisualizer() {
        if (!state.visualizerFrame) {
            state.visualizerFrame = window.requestAnimationFrame(drawVisualizer);
        }
    }

    function stopVisualizer() {
        if (state.visualizerFrame) {
            window.cancelAnimationFrame(state.visualizerFrame);
            state.visualizerFrame = null;
        }
    }

    function refreshLauncherVisibility() {
        if (state.launcher) {
            state.launcher.hidden = !currentMediaElement();
        }
    }

    function watchPlayback() {
        state.observer = new MutationObserver(() => {
            if (state.media && !state.media.isConnected) {
                state.media = null;
                setStatus('Playback changed — reconnect', 'warning');
            }
            refreshLauncherVisibility();
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('play', (event) => {
            refreshLauncherVisibility();
            if (state.graphs.has(event.target)) {
                state.media = event.target;
                startVisualizer();
            }
            if (!state.context) {
                setStatus('Playback found — select EQ to connect', 'normal');
            }
        }, true);
        const stopForInactiveMedia = (event) => {
            if (event.target === state.media) {
                stopVisualizer();
            }
        };
        document.addEventListener('pause', stopForInactiveMedia, true);
        document.addEventListener('ended', stopForInactiveMedia, true);
        document.addEventListener('emptied', refreshLauncherVisibility, true);
    }

    function initialize() {
        buildPanel();
        watchPlayback();
        window.JellyfinY2KEqualizer = {
            version: VERSION,
            open,
            close,
            connect: attachAudio,
            reset: () => setPreset('flat'),
            setVisualizer: (mode) => {
                if (Object.prototype.hasOwnProperty.call(VISUALIZERS, mode)) {
                    state.settings.visualizerMode = mode;
                    updateControls();
                    saveSettings();
                    startVisualizer();
                }
            }
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
}());

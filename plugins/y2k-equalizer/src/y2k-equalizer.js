(function () {
    'use strict';

    const VERSION = '0.1.0';
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
            .connect(context.destination);
        return { source, preamp, filters };
    }

    const testApi = {
        FREQUENCIES,
        PRESETS,
        clamp,
        normalizeSettings,
        formatFrequency,
        presetLabel,
        createAudioGraph
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
        panel: null,
        status: null,
        observer: null
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
        if (!media) {
            setStatus('Start playback to connect', 'warning');
            return false;
        }

        if (state.media === media && state.context) {
            await state.context.resume();
            setStatus('Connected to Jellyfin playback', 'success');
            return true;
        }

        if (state.context) {
            await state.context.close();
            state.context = null;
            state.source = null;
            state.filters = [];
        }

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error('This browser does not support the Web Audio API.');
            }

            const context = new AudioContextClass();
            const { source, preamp, filters } = createAudioGraph(context, media, state.settings.gains);

            state.context = context;
            state.source = source;
            state.media = media;
            state.preamp = preamp;
            state.filters = filters;
            applyAudioSettings();
            await context.resume();
            setStatus('Connected to Jellyfin playback', 'success');
            return true;
        } catch (error) {
            console.error('[Y2K Equalizer] Could not connect to playback.', error);
            setStatus(error.message || 'Unable to connect to playback', 'error');
            return false;
        }
    }

    function applyAudioSettings() {
        if (!state.context || !state.preamp) {
            return;
        }

        const now = state.context.currentTime;
        const preampGain = state.settings.enabled ? Math.pow(10, state.settings.preamp / 20) : 1;
        state.preamp.gain.setTargetAtTime(preampGain, now, 0.015);
        state.filters.forEach((filter, index) => {
            const gain = state.settings.enabled ? state.settings.gains[index] : 0;
            filter.gain.setTargetAtTime(gain, now, 0.015);
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
            #y2k-equalizer-launcher { position:fixed; right:18px; bottom:18px; z-index:99998; width:48px; height:48px;
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
                JELLYFIN Y2K EQUALIZER
                <button type="button" data-eq-close aria-label="Close equalizer">×</button>
            </header>
            <div class="y2k-eq-toolbar">
                <label class="y2k-eq-toggle"><input type="checkbox" data-eq-enabled> EQ ON</label>
                <select data-eq-preset aria-label="Equalizer preset">
                    ${Object.keys(PRESETS).map((key) => `<option value="${key}">${presetLabel(key)}</option>`).join('')}
                </select>
                <span class="y2k-eq-status" data-eq-status>Start playback, then connect</span>
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
        launcher.textContent = 'EQ';
        launcher.setAttribute('aria-label', 'Open Y2K equalizer');
        document.body.appendChild(launcher);

        state.panel = panel;
        state.status = panel.querySelector('[data-eq-status]');
        panel.hidden = !state.settings.panelOpen;

        panel.querySelector('[data-eq-close]').addEventListener('click', close);
        launcher.addEventListener('click', open);
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
    }

    function open() {
        state.settings.panelOpen = true;
        state.panel.hidden = false;
        saveSettings();
    }

    function close() {
        state.settings.panelOpen = false;
        state.panel.hidden = true;
        saveSettings();
    }

    function watchPlayback() {
        state.observer = new MutationObserver(() => {
            if (state.media && !state.media.isConnected) {
                state.media = null;
                setStatus('Playback changed — reconnect', 'warning');
            }
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('play', () => {
            if (!state.context) {
                setStatus('Playback found — press Connect', 'normal');
            }
        }, true);
    }

    function initialize() {
        buildPanel();
        watchPlayback();
        window.JellyfinY2KEqualizer = {
            version: VERSION,
            open,
            close,
            connect: attachAudio,
            reset: () => setPreset('flat')
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
}());

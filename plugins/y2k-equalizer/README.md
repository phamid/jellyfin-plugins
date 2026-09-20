# Jellyfin Y2K Equalizer + Visualizer

A dependency-free 10-band Web Audio equalizer and real-time visualizer for
Jellyfin Web, inspired by Windows Media Player, iTunes, and Winamp interfaces
from the late 1990s and 2000s.

## Features

- Ten bands from 32 Hz to 16 kHz, each adjustable from -12 dB to +12 dB.
- Preamp from -12 dB to +6 dB.
- Flat, Winamp Classic, Windows Media Player, iTunes Dance, bass, vocal, and
  treble presets.
- Bypass switch, persistent settings, compact mobile layout, and automatic
  detection of Jellyfin audio and video elements.
- An **EQ/VIS** playback control that appears when Jellyfin has active media;
  selecting it opens the preset list and connects the equalizer.
- Winamp-style spectrum, Windows Media Player-style mirrored bars, and
  iTunes-style waveform visualizers selectable during playback.
- Double-click the visualizer canvas for fullscreen mode; double-click again
  or press **Escape** to return.
- No network requests, analytics, dependencies, or server-side media changes.

The names Windows Media Player, iTunes, and Winamp identify the interfaces that
inspired the presets. This project is independent and is not affiliated with
or endorsed by Microsoft, Apple, or Nullsoft.

## Install

The recommended installation is through the Jellyfin plugin catalog. It uses
the established File Transformation plugin to add the authenticated browser
extension without modifying Jellyfin Web files.

1. Add `https://www.iamparadox.dev/jellyfin/plugins/manifest.json` to
   **Dashboard → Plugins → Repositories**, then install **File Transformation**.
2. Add this repository:
   `https://raw.githubusercontent.com/phamid/jellyfin-plugins/main/manifest.json`.
3. Install **Y2K Equalizer + Visualizer** and restart Jellyfin once.
4. Refresh Jellyfin Web and start music playback.
5. Select the **EQ/VIS** button, then choose an equalizer preset, visualizer
   style, or tune individual bands.

Browsers require a user gesture before Web Audio can start, which is why the
equalizer connects when **EQ/VIS** is selected. Settings are stored only in
that browser's `localStorage`.

## Compatibility

- Designed for Jellyfin Web served from the same origin as its media streams.
- Requires a browser with the Web Audio API.
- Jellyfin's **Track gain** or **Album gain** playback normalization can already
  own the browser's Web Audio source. Chromium and Firefox can fall back to
  `captureStream` for visualization; set playback normalization to **None** if
  you also want the custom equalizer. Safari may require normalization set to
  **None** for both features.
- A native Jellyfin mobile, television, or desktop client that does not render
  the injected web interface will not show the equalizer.
- Only the browser's playback is affected. Transcoding and source media remain
  unchanged.

## Remove or roll back

Disable or uninstall **Y2K Equalizer + Visualizer**, restart Jellyfin, and
refresh the browser. No media or library database content is modified.

## Development

```sh
npm run check
```

Edit `src/y2k-equalizer.js`; `npm run build` writes the browser artifact.
`scripts/package-plugin.sh` builds the Jellyfin 12 plugin ZIP.

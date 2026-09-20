# Jellyfin Y2K Equalizer

A dependency-free 10-band Web Audio equalizer for Jellyfin Web, with presets
inspired by the Windows Media Player, iTunes, and Winamp equalizers of the
late 1990s and 2000s.

## Features

- Ten bands from 32 Hz to 16 kHz, each adjustable from -12 dB to +12 dB.
- Preamp from -12 dB to +6 dB.
- Flat, Winamp Classic, Windows Media Player, iTunes Dance, bass, vocal, and
  treble presets.
- Bypass switch, persistent settings, compact mobile layout, and automatic
  detection of Jellyfin audio and video elements.
- No network requests, analytics, dependencies, or server-side media changes.

The names Windows Media Player, iTunes, and Winamp identify the interfaces that
inspired the presets. This project is independent and is not affiliated with
or endorsed by Microsoft, Apple, or Nullsoft.

## Install

This first release is distributed as a script for the
[Jellyfin JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector).

1. Install JavaScript Injector from its Jellyfin plugin repository.
2. Open **Dashboard → Plugins → JavaScript Injector**.
3. Add a script named **Y2K Equalizer**.
4. Copy the complete contents of [`dist/y2k-equalizer.js`](dist/y2k-equalizer.js)
   into the script field, enable it, and save.
5. Refresh Jellyfin Web, start playback, open **EQ**, and press **Connect**.

Browsers require a user gesture before Web Audio can start, which is why the
first connection is explicit. Settings are stored only in that browser's
`localStorage`.

## Compatibility

- Designed for Jellyfin Web served from the same origin as its media streams.
- Requires a browser with the Web Audio API.
- Jellyfin's **Track gain** or **Album gain** playback normalization can already
  own the browser's Web Audio source. If **Connect** reports that playback is
  already using Web Audio, set Jellyfin's client playback normalization to
  **None**, restart playback, and refresh the page.
- A native Jellyfin mobile, television, or desktop client that does not render
  the injected web interface will not show the equalizer.
- Only the browser's playback is affected. Transcoding and source media remain
  unchanged.

## Remove or roll back

Disable or delete the **Y2K Equalizer** entry in JavaScript Injector and refresh
the browser. No media, server configuration, or database content is modified.

## Development

```sh
npm run check
```

Edit `src/y2k-equalizer.js`; `npm run build` writes the publishable `dist`
artifact.

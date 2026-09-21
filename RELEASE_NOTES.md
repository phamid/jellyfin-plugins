# Jellyfin Plugins 0.4.0 Release

**Release date:** 2026-09-21  
**Release type:** Minor  
**Audience:** Jellyfin Web users

## Summary

Seven new audio-reactive visualizers bring the total to ten, including three
80s-inspired styles. This is a plugin catalog and downloadable-package release;
it does not update or restart any Jellyfin server.

## What's new

- Radial Spectrum: rotating frequency spokes.
- Neon Ribbons: three layered, audio-reactive waveforms.
- Particle Orbit: frequency-driven orbital particles.
- Retro Tunnel: bass-reactive moving hexagons.
- 80s Synthwave Highway: a striped sunset above a moving neon road grid.
- 80s Laser Dancefloor: sweeping lasers above audio-lit tiles.
- 80s Arcade Starfield: cyan and magenta pixel stars with reactive trails.
- All ten modes use the existing selector, persist the browser's selection,
  support double-click fullscreen, and stop rendering when playback pauses.
- The browser loader uses a new versioned cache key for this update.

## Compatibility and migrations

The package requires **Jellyfin 12 / .NET 10** and the File Transformation
plugin. It will not install on Jellyfin 10.11.x. Adding or refreshing the
repository does not upgrade the server. No data migration, new dependency,
or media-library change is included. Existing equalizer settings are retained.

## Security and privacy

- The browser extension makes no third-party network requests and collects no
  telemetry. Its only request is to the authenticated same-origin plugin
  endpoint that serves the embedded script.
- Settings remain in browser `localStorage`.
- The plugin artifact is built from the tagged repository release.

## Known issues

- The equalizer affects Jellyfin Web only, not native clients.
- Browsers require the user to select **EQ/VIS** after playback starts so the
  equalizer can connect within a user gesture.
- Cross-origin media without suitable CORS headers may not be processable by
  the Web Audio API.
- With Jellyfin Track gain or Album gain normalization enabled, supported
  Chromium and Firefox browsers provide visualization through `captureStream`;
  equalization still requires playback normalization set to **None**.
- Firefox deliberately uses the silent visualization-only capture path because
  it permits multiple Web Audio owners and could otherwise duplicate playback.
- The interface intentionally uses a bespoke retro visual style rather than
  the InstaHost application theme.

## Install and update

Follow [`plugins/y2k-equalizer/README.md`](plugins/y2k-equalizer/README.md).

## Rollback

Disable or uninstall **Y2K Equalizer + Visualizer**, restart Jellyfin, and
refresh Jellyfin Web. The plugin does not modify media or library database
content. The catalog retains version 0.3.1.0 and its immutable download for
reinstallation on a compatible server; new visualizer selections safely fall
back to Winamp Spectrum in that version.

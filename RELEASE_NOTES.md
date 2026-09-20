# Jellyfin Plugins 0.3.0 Release

**Release date:** 2026-09-21  
**Release type:** Minor  
**Audience:** Jellyfin Web users

## Summary

This release makes Y2K Equalizer + Visualizer installable and updateable from a
standard Jellyfin plugin repository.

## What's new

- Ten adjustable bands from 32 Hz to 16 kHz.
- Adjustable preamp, bypass, reset, and browser-local persistence.
- Presets inspired by classic Winamp, Windows Media Player, and iTunes
  equalizers, plus bass, vocal, and treble profiles.
- Automatic discovery of active Jellyfin audio and video playback.
- An **EQ/VIS** control available during playback that opens and connects the
  preset and visualizer selectors in one action.
- Winamp-inspired spectrum, Windows Media Player-inspired mirrored bars, and
  iTunes-inspired waveform modes.
- The visualizer stops its animation loop when playback pauses or ends.
- A native Jellyfin 12 plugin serves the browser code only after authentication.
- A public catalog manifest supports normal Jellyfin install and update flows.

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
- Jellyfin Track gain and Album gain normalization may conflict because a
  browser permits only one Web Audio source per media element. Select **None**
  for playback normalization before connecting the equalizer.
- The interface intentionally uses a bespoke retro visual style rather than
  the InstaHost application theme.

## Install and update

Follow [`plugins/y2k-equalizer/README.md`](plugins/y2k-equalizer/README.md).

## Rollback

Disable or uninstall **Y2K Equalizer + Visualizer**, restart Jellyfin, and
refresh Jellyfin Web. The plugin does not modify media or library database
content.

# Jellyfin Plugins 0.3.1 Release

**Release date:** 2026-09-21  
**Release type:** Minor  
**Audience:** Jellyfin Web users

## Summary

This patch fixes blank visualizers when Jellyfin already owns the media
element's primary Web Audio source and adds fullscreen visualization.

## Fixed

- When Jellyfin playback normalization already owns the media element, the
  plugin now uses `captureStream` to provide visualization without duplicating
  audible output.
- Status text now clearly reports when visualization is available but
  equalization remains controlled by Jellyfin.

## What's new

- Double-click the visualizer canvas to enter fullscreen mode.
- Double-click again or press **Escape** to leave fullscreen.

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
content.

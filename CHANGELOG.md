# Changelog

All notable changes to this repository are documented here.

## [0.3.1] - 2026-09-21

### Fixed

- Added a visualization-only `captureStream` fallback for Jellyfin sessions
  that already own the media element's primary Web Audio source.
- Stopped the equalizer controls from claiming availability when the fallback
  visualization path is active.

### Added

- Double-click the visualizer to enter or leave fullscreen mode.

## [0.3.0] - 2026-09-21

### Added

- A native Jellyfin 12 server plugin that serves the browser extension only to
  authenticated users.
- A Jellyfin catalog manifest for straightforward installation and updates.
- Automated Node.js and .NET validation for pull requests and `main`.

### Changed

- File Transformation replaces JavaScript Injector as the only runtime
  dependency.

## [0.2.0] - 2026-09-21

### Added

- A selectable real-time visualizer integrated into the equalizer's existing
  Web Audio graph.
- Winamp-inspired spectrum, Windows Media Player-inspired mirrored bars, and
  iTunes-inspired waveform modes.
- Persistent visualizer selection and an **EQ/VIS** playback launcher.
- Playback-aware rendering that stops animation work while media is paused or
  ended.

## [0.1.0] - 2026-09-21

### Added

- Initial public repository structure for Jellyfin plugins.
- Y2K Equalizer with ten Web Audio bands, preamp, bypass, persisted settings,
  responsive controls, and seven presets.
- Presets inspired by Windows Media Player, iTunes, and Winamp equalizers.
- Dependency-free build and unit checks.

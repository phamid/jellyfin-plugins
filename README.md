# phamid Jellyfin Plugins

Open source enhancements for Jellyfin.

## Plugins

| Plugin | Status | Description |
|---|---|---|
| [Y2K Equalizer + Visualizer](plugins/y2k-equalizer) | Experimental | A 10-band Web Audio equalizer and selectable real-time visualizer inspired by Windows Media Player, iTunes, and Winamp interfaces from the 2000s. |

## Installation

Add this URL under **Dashboard → Plugins → Repositories**:

```text
https://raw.githubusercontent.com/phamid/jellyfin-plugins/main/manifest.json
```

Each plugin has its own installation and compatibility notes. Y2K Equalizer +
Visualizer requires the File Transformation plugin and runs only in
authenticated Jellyfin Web sessions.

## Support and security

Open a GitHub issue with the Jellyfin version, browser, playback type, and
steps to reproduce. Do not include credentials, access tokens, private media
URLs, or personal library details.

## License

[MIT](LICENSE)

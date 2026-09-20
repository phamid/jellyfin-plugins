#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
project="$root/plugins/y2k-equalizer/Jellyfin.Plugin.Y2KEqualizer/Jellyfin.Plugin.Y2KEqualizer.csproj"
tests="$root/plugins/y2k-equalizer/Jellyfin.Plugin.Y2KEqualizer.Tests/Jellyfin.Plugin.Y2KEqualizer.Tests.csproj"
output="$root/artifacts"
publish="$output/publish"
archive="$output/Jellyfin.Plugin.Y2KEqualizer_12.0.0.zip"

rm -rf "$publish"
mkdir -p "$publish"
dotnet test "$tests" --configuration Release --nologo
dotnet publish "$project" --configuration Release --output "$publish" --nologo
touch -t 202609210035 "$publish/Jellyfin.Plugin.Y2KEqualizer.dll"
rm -f "$archive"
(cd "$publish" && zip -q -9 -X "$archive" Jellyfin.Plugin.Y2KEqualizer.dll)
printf '%s\n' "$archive"

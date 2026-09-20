'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));
const version = packageJson.version;
const fourPartVersion = `${version}.0`;
const source = fs.readFileSync(
    path.join(root, 'plugins', 'y2k-equalizer', 'src', 'y2k-equalizer.js'),
    'utf8'
);
const project = fs.readFileSync(
    path.join(
        root,
        'plugins',
        'y2k-equalizer',
        'Jellyfin.Plugin.Y2KEqualizer',
        'Jellyfin.Plugin.Y2KEqualizer.csproj'
    ),
    'utf8'
);
const manifest = require(path.join(root, 'manifest.json'));
const release = manifest[0].versions[0];
const archivePath = path.join(root, 'artifacts', 'Jellyfin.Plugin.Y2KEqualizer_12.0.0.zip');
const archive = fs.readFileSync(archivePath);
const checksum = crypto.createHash('md5').update(archive).digest('hex').toUpperCase();

const failures = [];
if (!source.includes(`const VERSION = '${version}';`)) {
    failures.push('browser script version');
}
if (!project.includes(`<Version>${fourPartVersion}</Version>`)) {
    failures.push('server plugin version');
}
const transformation = fs.readFileSync(
    path.join(
        root,
        'plugins',
        'y2k-equalizer',
        'Jellyfin.Plugin.Y2KEqualizer',
        'IndexTransformation.cs'
    ),
    'utf8'
);
if (!transformation.includes(`Y2KEqualizer/client.js?v=${version}`)) {
    failures.push('browser cache key');
}
if (release.version !== fourPartVersion) {
    failures.push('manifest version');
}
if (!release.sourceUrl.includes(`/v${version}/`)) {
    failures.push('manifest release URL');
}
if (release.checksum !== checksum) {
    failures.push('manifest checksum');
}

if (failures.length > 0) {
    throw new Error(`Release invariant failure: ${failures.join(', ')}`);
}

console.log(`Release ${version} verified; package MD5 ${checksum}`);

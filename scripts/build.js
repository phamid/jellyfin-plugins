'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'plugins', 'y2k-equalizer', 'src', 'y2k-equalizer.js');
const outputPath = path.join(root, 'plugins', 'y2k-equalizer', 'dist', 'y2k-equalizer.js');
const packageJson = require(path.join(root, 'package.json'));
const source = fs.readFileSync(sourcePath, 'utf8');
const banner = `/* Jellyfin Y2K Equalizer v${packageJson.version} | MIT License | https://github.com/phamid/jellyfin-plugins */\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, banner + source, 'utf8');
console.log(`Built ${path.relative(root, outputPath)}`);


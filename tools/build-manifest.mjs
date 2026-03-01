#!/usr/bin/env node
/**
 * build-manifest.mjs
 *
 * Generates manifest.json from manifest.base.json, injecting the version
 * from package.json so there is a single source of truth for the version.
 *
 * Usage:
 *   node tools/build-manifest.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const base = JSON.parse(readFileSync(resolve(root, 'manifest.base.json'), 'utf-8'));

const manifest = {
  ...base,
  version: pkg.version,
};

// Place version right after manifest_version for readability
const ordered = {};
for (const key of Object.keys(manifest)) {
  if (key === 'name') ordered.version = manifest.version;
  if (key !== 'version') ordered[key] = manifest[key];
}

writeFileSync(
  resolve(root, 'manifest.json'),
  JSON.stringify(ordered, null, 2) + '\n',
);

console.log(`✅ manifest.json generated (version: ${pkg.version})`);

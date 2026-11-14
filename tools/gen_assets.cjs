#!/usr/bin/env node
/**
 * Generate static assets the Mode B dashboard fetches at runtime:
 *  - public/patch.diff — real unified diff from the Exorcist healer
 *    (dist/engine/exorcist-healer.js must be built first: npm run build)
 *  - public/kiro-files.json — every .kiro/ file (9 core + incident records),
 *    for the Vault tab
 * Run: node tools/gen_assets.cjs   (also run by tools/deploy_possessed.py)
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');

const { synthesizePatch } = require(path.join(root, 'dist', 'engine', 'exorcist-healer.js'));
const patch = synthesizePatch('RACE_DOUBLE_CHARGE');
fs.writeFileSync(path.join(pub, 'patch.diff'), patch.unifiedDiff, 'utf8');
console.log('wrote public/patch.diff (' + patch.unifiedDiff.length + ' bytes)');

const kiroRoot = path.join(root, '.kiro');
const files = [];
(function walk(dir, prefix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walk(full, rel);
    else files.push({ path: rel, content: fs.readFileSync(full, 'utf8') });
  }
})(kiroRoot, '');
fs.writeFileSync(path.join(pub, 'kiro-files.json'), JSON.stringify({ files }, null, 2) + '\n', 'utf8');
console.log('wrote public/kiro-files.json (' + files.length + ' files)');

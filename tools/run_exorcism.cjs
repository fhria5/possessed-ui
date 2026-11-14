#!/usr/bin/env node
/**
 * Phase 3 PBT Exorcism runner.
 *
 *   1. Verify the CURRENT patched target: 100 fast-check runs per scenario
 *      (fixed seeds) with boundary-weighted arbitraries — hunt Demon Bugs.
 *   2. Shrink each demon to its minimal reproducible sequence.
 *   3. Apply the Exorcist Auto-Patch (healer templates — the patch, not
 *      the test, is fixed).
 *   4. Re-verify 100/100 per scenario against the re-patched target.
 *   5. If the re-verification still fails, quarantine exorcise_and_patch
 *      in the MCP registry and record it.
 *   6. Write .kiro/specs/incidents/exorcism-phase3-<stamp>.json and
 *      public/exorcism-report.json (consumed by the UI Exorcism Deck).
 *
 * Run: node tools/run_exorcism.cjs   (builds first: npm run build)
 * Every number printed here is real — seeds are fixed, runs are counted.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
process.chdir(root);

console.log('== Phase 3 exorcism: build ==');
execSync('npm run build', { stdio: 'inherit' });

const {
  runExorcismVerification,
  verifyImmunity,
  writeExorcismIncident,
  EXORCISM_RUNS,
} = require(path.join(root, 'dist', 'engine', 'exorcism-pbt.js'));
const { applyPatch } = require(path.join(root, 'dist', 'engine', 'exorcist-healer.js'));
const { quarantineTool, getQuarantine } = require(path.join(root, 'dist', 'engine', 'mcp-server.js'));

const SCENARIOS = ['RACE_DOUBLE_CHARGE', 'NETWORK_3G_CHAOS', 'STORAGE_XSS_SPECTER'];

(async () => {
  console.log(`== before: ${EXORCISM_RUNS} runs/scenario vs current patched target ==`);
  const report = await runExorcismVerification({ runs: EXORCISM_RUNS });
  for (const s of SCENARIOS) {
    const v = report.scenarios[s].before;
    console.log(`${s}: seed=${v.seed} runs=${v.runs} violations=${v.violations} status=${v.status}`);
    if (report.scenarios[s].demonBug) {
      const d = report.scenarios[s].demonBug;
      console.log(`  DEMON: ${d.name} — observed: ${d.observed.detail}`);
      console.log(`  shrunk to ${d.shrunkSequence.length} steps in ${d.shrinkSteps} shrink steps`);
    }
  }

  console.log('== Auto-Patch: apply Exorcist patch (healer templates) ==');
  for (const s of SCENARIOS) {
    if (report.scenarios[s].demonBug) {
      const out = applyPatch(s);
      console.log(`  ${s}: patched file rewritten → ${out.patchedFile}; incident ${out.incidentFile}`);
    }
  }

  console.log(`== after: ${EXORCISM_RUNS} runs/scenario vs re-patched target ==`);
  let quarantine = { quarantined: false };
  for (const s of SCENARIOS) {
    const after = await verifyImmunity(s, { runs: EXORCISM_RUNS });
    report.scenarios[s].after = after;
    console.log(`${s}: seed=${after.seed} runs=${after.runs} violations=${after.violations} status=${after.status}`);
    if (after.violations > 0) {
      const reason = `post-patch exorcism failed: ${after.violations}/${after.runs} runs still violate the invariant (seed ${after.seed})`;
      const entry = quarantineTool('exorcise_and_patch', reason);
      quarantine = { quarantined: true, tool: 'exorcise_and_patch', reason, incidentFile: entry.incidentFile };
      console.log('  QUARANTINED exorcise_and_patch: ' + reason);
    }
  }

  report.generatedAt = new Date().toISOString();
  report.quarantine = quarantine;
  const incidentFile = writeExorcismIncident(report);
  const publicReport = path.join(root, 'public', 'exorcism-report.json');
  fs.writeFileSync(publicReport, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('incident: ' + incidentFile);
  console.log('public report: public/exorcism-report.json');
  console.log('quarantine: ' + JSON.stringify(getQuarantine()));
  console.log('EXORCISM-DONE');
})().catch((e) => {
  console.error('EXORCISM FAILED:', e);
  process.exit(1);
});

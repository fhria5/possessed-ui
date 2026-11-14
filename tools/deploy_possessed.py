#!/usr/bin/env python3
"""Push Possessed UI Phase 1 files to fhria5/possessed-ui and enable GitHub Pages.
Uses the stored custom.github credential via the vault surrogate.
Run: python3 tools/deploy_possessed.py
Steps: npm run build -> node tools/gen_assets.cjs (patch.diff + kiro-files.json)
-> regenerate docs/ from public/ -> PUT all files -> enable Pages (main, /docs).
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import urllib.request
import urllib.error

sys.path.insert(0, '/opt/muse/skills/custom-connector-setup/bin')
import dynamic_credentials

OWNER, REPO, BRANCH = 'fhria5', 'possessed-ui', 'main'
BASE = '/home/hatch/workspace/possessed-ui/'
MESSAGE = 'Possessed UI Phase 2: 3 scenarios + real CDP capture + MCP + guardrail'

FILES = [
    '.nojekyll',
    'README.md',
    'rencana-per-phase.md',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'src/types/possessed.ts',
    'src/engine/poltergeist-pbt.ts',
    'src/engine/cdp-observer.ts',
    'src/engine/exorcist-healer.ts',
    'src/engine/mcp-server.ts',
    'src/engine/possess-service.ts',
    'src/server.ts',
    'target-app/phantom-pay.js',
    'target-app/phantom-pay.patched.js',
    'public/index.html',
    'public/styles.css',
    'public/app.js',
    'public/cdp-harness.html',
    'public/favicon.svg',
    'public/patch.diff',
    'public/kiro-files.json',
    'docs/index.html',
    'docs/styles.css',
    'docs/app.js',
    'docs/cdp-harness.html',
    'docs/favicon.svg',
    'docs/patch.diff',
    'docs/kiro-files.json',
    'tests/poltergeist.test.ts',
    'tests/healer.test.ts',
    'tests/observer.test.ts',
    'tests/mcp.test.ts',
    'tests/server.test.ts',
    'tests/cdp.test.ts',
    'tests/e2e-phase2.cjs',
    'tools/deploy_possessed.py',
    'tools/gen_assets.cjs',
    '.kiro/specs/possessed-engine/requirements.md',
    '.kiro/specs/possessed-engine/design.md',
    '.kiro/specs/possessed-engine/tasks.md',
    '.kiro/specs/incidents/.gitkeep',
    '.kiro/steering/frontend-resilience.md',
    '.kiro/steering/chaos-guardrails.md',
    '.kiro/steering/seance-ui-standards.md',
    '.kiro/hooks/possession-auto-heal.json',
    '.kiro/hooks/pbt-immunity-check.json',
    '.kiro/settings/mcp.json',
]


def req(method, path, body=None):
    r = urllib.request.Request(
        'https://api.github.com' + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Accept': 'application/vnd.github+json',
                 'Content-Type': 'application/json'},
    )
    dynamic_credentials.add_surrogate_to_request(
        r, 'custom.github', allowed_hosts=['api.github.com'])
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, path, e.read().decode()[:300])
        raise


# 0. Build + generate static assets, regenerate docs/ from public/
subprocess.run(['npm', 'run', 'build'], cwd=BASE, check=True)
subprocess.run(['node', 'tools/gen_assets.cjs'], cwd=BASE, check=True)
# Patched target must exist on disk before push (healer output).
subprocess.run(['node', '-e',
                "require('./dist/engine/exorcist-healer.js').applyPatch('RACE_DOUBLE_CHARGE')"],
               cwd=BASE, check=True)
os.makedirs(BASE + 'docs', exist_ok=True)
for _f in ('index.html', 'styles.css', 'app.js', 'cdp-harness.html', 'favicon.svg', 'patch.diff', 'kiro-files.json'):
    shutil.copyfile(BASE + 'public/' + _f, BASE + 'docs/' + _f)
open(BASE + '.nojekyll', 'a').close()
print('docs/ regenerated from public/')

# 1. Repo exists?
repo = req('GET', f'/repos/{OWNER}/{REPO}')
print('REPO EXISTS:', repo['full_name'], repo['html_url'])

# 2. Push files
for f in FILES:
    if not os.path.exists(BASE + f):
        print('SKIP (missing):', f)
        continue
    data = open(BASE + f, 'rb').read()
    try:
        cur = req('GET', f'/repos/{OWNER}/{REPO}/contents/{f}?ref={BRANCH}')
        sha = cur['sha']
    except urllib.error.HTTPError as e:
        if e.code == 404:
            sha = None
        else:
            raise
    body = {
        'message': MESSAGE,
        'content': base64.b64encode(data).decode(),
        'branch': BRANCH,
    }
    if sha:
        body['sha'] = sha
    req('PUT', f'/repos/{OWNER}/{REPO}/contents/{f}', body)
    print('OK', f)

# 3. Enable Pages (main, /docs)
try:
    pages = req('POST', f'/repos/{OWNER}/{REPO}/pages',
                {'source': {'branch': BRANCH, 'path': '/docs'}})
    print('PAGES ENABLED:', pages.get('html_url'))
except urllib.error.HTTPError as e:
    if e.code == 409:
        pages = req('GET', f'/repos/{OWNER}/{REPO}/pages')
        print('PAGES ALREADY ON:', pages.get('html_url'))
    else:
        raise

print('DEPLOY-DONE')

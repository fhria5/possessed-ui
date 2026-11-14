#!/usr/bin/env python3
"""Create fhria5/possessed-ui (public, MIT) and push Phase 0 files via GitHub Contents API.
No engine/UI code is pushed — only README, LICENSE, .gitignore, .kiro spec/steering/hooks,
target-app vulnerable fixture, SPEK.md, rencana-per-phase.md.
Uses the custom.github surrogate; token value is never printed."""
import sys, os, json, base64, urllib.request, urllib.error

sys.path.insert(0, '/opt/muse/skills/custom-connector-setup/bin')
import dynamic_credentials

BASE = 'https://api.github.com'
ROOT = os.path.expanduser('~/workspace/possessed-ui')

def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
        headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'muse-possessed-ui-setup'})
    dynamic_credentials.add_surrogate_to_request(req, 'custom.github', allowed_hosts=['api.github.com'])
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.load(r) if r.headers.get('Content-Type', '').startswith('application/json') else {}
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or '{}')

def put_file(repo_path, local_path):
    with open(os.path.join(ROOT, local_path), 'rb') as f:
        content = base64.b64encode(f.read()).decode()
    status, resp = call('PUT', f'/repos/fhria5/possessed-ui/contents/{repo_path}',
                        {'message': f'Add {repo_path} (Phase 0 spec, no engine/UI code)', 'content': content, 'branch': 'main'})
    print(f'PUT {repo_path}: {status} ' + (resp.get('content', {}).get('sha', '')[:12] if status in (200, 201) else json.dumps(resp)[:200]))
    return status in (200, 201)

status, resp = call('POST', '/user/repos', {
    'name': 'possessed-ui',
    'description': 'Possessed UI — Autonomous Paranormal Chaos-Testing & Self-Healing Agent (Kiroween 2026, Frankenstein)',
    'private': False, 'has_issues': True, 'has_wiki': False,
})
print('CREATE REPO:', status, resp.get('html_url', json.dumps(resp)[:200]))
if status == 422 and 'already exists' in json.dumps(resp):
    print('Repo already exists — continuing to push files.')
elif status not in (201,):
    sys.exit(1)

files = [
    ('README.md', 'README.md'),
    ('LICENSE', 'LICENSE'),
    ('.gitignore', '.gitignore'),
    ('SPEK.md', 'SPEK.md'),
    ('rencana-per-phase.md', 'rencana-per-phase.md'),
    ('.kiro/specs/possessed-engine/requirements.md', '.kiro/specs/possessed-engine/requirements.md'),
    ('.kiro/specs/possessed-engine/design.md', '.kiro/specs/possessed-engine/design.md'),
    ('.kiro/specs/possessed-engine/tasks.md', '.kiro/specs/possessed-engine/tasks.md'),
    ('.kiro/specs/incidents/.gitkeep', '.kiro/specs/incidents/.gitkeep'),
    ('.kiro/steering/frontend-resilience.md', '.kiro/steering/frontend-resilience.md'),
    ('.kiro/steering/chaos-guardrails.md', '.kiro/steering/chaos-guardrails.md'),
    ('.kiro/steering/seance-ui-standards.md', '.kiro/steering/seance-ui-standards.md'),
    ('.kiro/hooks/possession-auto-heal.json', '.kiro/hooks/possession-auto-heal.json'),
    ('.kiro/hooks/pbt-immunity-check.json', '.kiro/hooks/pbt-immunity-check.json'),
    ('.kiro/settings/mcp.json', '.kiro/settings/mcp.json'),
    ('target-app/phantom-pay.js', 'target-app/phantom-pay.js'),
    ('tools/create_repo.py', 'tools/create_repo.py'),
]
ok = all(put_file(rp, lp) for rp, lp in files)
print('ALL FILES OK' if ok else 'SOME FILES FAILED')
sys.exit(0 if ok else 1)

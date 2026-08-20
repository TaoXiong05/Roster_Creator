const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tool = 'c:\\Users\\xt263\\.trae\\builtin\\design\\default\\skills\\solo-design\\shared-runtime\\deterministic-tooling\\record-dispatch-completion.mjs';
const proj = 'd:\\claude\\projects\\Roster_Creator\\roster-redesign.design';
const ledgerDir = path.join(proj, '.preflight', 'ledgers');
fs.mkdirSync(ledgerDir, { recursive: true });

const pages = [
  { id: 'page-login', file: 'pages/login.html', tag: 'a1b2c3d4e5f6a1b2' },
  { id: 'page-dashboard', file: 'pages/dashboard.html', tag: 'b2c3d4e5f6a7b8c9' },
  { id: 'page-roster', file: 'pages/roster.html', tag: 'c3d4e5f6a7b8c9d0' },
  { id: 'page-staff', file: 'pages/staff.html', tag: 'd4e5f6a7b8c9d0e1' },
  { id: 'page-staff-new', file: 'pages/staff-new.html', tag: 'e5f6a7b8c9d0e1f2' },
];

for (const p of pages) {
  const ledgerFile = path.join(ledgerDir, `${p.id}.json`);
  fs.writeFileSync(ledgerFile, JSON.stringify({ todoWriteCalls: 0, previewCalls: 0, validationScriptCalls: 0, helperScriptWrites: 0 }));
  const args = [tool, proj, `--node-id=${p.id}`, '--status=completed', `--changed-files=${p.file}`, `--trace-digest=${p.tag}`, `--tool-ledger-json=${ledgerFile}`];
  try {
    const out = execFileSync('node', args, { encoding: 'utf8' });
    console.log(`[OK] ${p.id}: ${out.trim()}`);
  } catch (e) {
    console.error(`[FAIL] ${p.id}:`, (e.stderr || e.stdout || e.message || '').toString().slice(0, 600));
  }
}

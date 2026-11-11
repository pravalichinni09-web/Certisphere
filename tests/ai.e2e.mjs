/**
 * CertiSphere — AI features end-to-end test (demo mode, no API key)
 * ----------------------------------------------------------------------
 * Puts a test client at different workflow stages and checks that the
 * built-in AI shows up and works on every role's screens:
 *   dashboards (AI insights), workflow-step suggestions with 1-click apply,
 *   corrective-action drafting + quality check, Coordinator requirements /
 *   schedule suggestions, the AI pages reading real workflow data, QCSAI.
 *
 *   VITE_DEMO_MODE=true npm run test:ai
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const CLIENT = 'AI Test Co';
const CID = 990001;
const results = [];
const check = (id, title, ok, detail = '') => {
  results.push({ id, ok: !!ok });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${id.padEnd(5)} ${title}${detail ? `  — ${detail}` : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const app = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'ignore', shell: process.platform === 'win32', env: { ...process.env, VITE_DEMO_MODE: 'true' },
});
for (let i = 0; i < 60; i++) { await wait(1000); try { if ((await fetch(`${BASE}/login`)).ok) break; } catch { /* starting */ } }

const browser = await chromium.launch({ headless: !process.env.HEADED });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());

const login = async (role) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  if (!page.url().includes('/login')) {
    await page.getByRole('button', { name: /Logout/ }).first().click().catch(() => {});
    await wait(1000);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  }
  await page.locator('button').filter({ hasText: new RegExp(`^\\s*${role}\\s*$`) }).first().click();
  await wait(400);
  await page.locator('[role=dialog] button').filter({ hasText: /^\s*Sign in/ }).first().click();
  await wait(2500);
  await page.getByText("Let's get started").click({ timeout: 1500 }).catch(() => {});
};
const go = async (path) => { await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }); await wait(1200); };

/** Put the test client at a stage (with findings / schedule as needed). */
const seed = (stage, opts = {}) => page.evaluate(({ stage, opts, CID, CLIENT }) => {
  const J = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? f; } catch { return f; } };
  const regs = J('cms_client_registrations', []).filter((r) => Number(r.id) !== CID);
  regs.push({ id: CID, organizationName: CLIENT, standard: 'ISO 9001:2015', status: 'Pending', employees: 30, industry: 'Precision machining', address: 'Plot 7, Tirupati, India', registrationDate: new Date().toISOString() });
  localStorage.setItem('cms_client_registrations', JSON.stringify(regs));
  const ago = new Date(Date.now() - (opts.daysAgo || 0) * 86400000).toISOString();
  const wfs = J('cms_audit_workflow', []).filter((w) => Number(w.clientId) !== CID);
  wfs.push({ clientId: CID, currentStage: stage, assignedCoordinator: 'Cora Dinh', requirements: opts.req ? { scope: 'Machining', standards: ['ISO 9001:2015'], reviewedAt: ago } : undefined,
    schedule: opts.date ? { proposedDate: opts.date, leadAuditor: opts.lead, auditor: opts.aud, proposedAt: ago, decision: opts.decision || 'Pending' } : undefined,
    history: [{ stage, at: ago, by: 'Test' }], createdAt: ago, updatedAt: ago });
  localStorage.setItem('cms_audit_workflow', JSON.stringify(wfs));
  const f = J('cms_audit_findings_v1', {});
  f[String(CID)] = opts.findings || [];
  localStorage.setItem('cms_audit_findings_v1', JSON.stringify(f));
  const fl = J('cms_workflow_flags_v1', {}); fl[String(CID)] = opts.flags || {}; localStorage.setItem('cms_workflow_flags_v1', JSON.stringify(fl));
  window.dispatchEvent(new CustomEvent('cms-workflow-handoff'));
}, { stage, opts, CID, CLIENT });
const myRow = (title) => page.locator(`section[aria-label="Workflow step: ${title}"] > div > div`).filter({ has: page.locator('strong', { hasText: CLIENT }) }).first();
const future = (d) => { const x = new Date(Date.now() + d * 86400000); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };

/* ---------------- Management ---------------- */
console.log('\n▶ Management');
await login('Management');
await seed('Registration Submitted', { daysAgo: 9 });
await go('/management/dashboard');
const mgmtIns = await page.locator('[data-testid=role-ai-insights]').innerText().catch(() => '');
check('M1', 'Management dashboard shows AI insights', mgmtIns.includes('AI insights'));
check('M2', 'Insights flag the late client', mgmtIns.includes(CLIENT) && /late/i.test(mgmtIns), mgmtIns.split('\n').find((l) => l.includes(CLIENT)) || '');
await go('/management/client-onboarding');
const r1 = myRow('Approve client & assign an Audit Coordinator');
const sug1 = await r1.locator('[data-testid=ai-suggestion]').innerText().catch(() => '');
check('M3', 'Onboarding row shows an AI coordinator suggestion', /AI suggestion/i.test(sug1) && /Assign/.test(sug1), sug1.split('\n')[0]);
await r1.locator('[data-testid=ai-suggestion] button').first().click(); await wait(400);
const picked = await r1.locator('select').first().inputValue().catch(() => '');
check('M4', '1-click apply opens the assign box with the suggested coordinator', !!picked && sug1.includes(picked), picked);

/* ---------------- Audit Coordinator ---------------- */
console.log('\n▶ Audit Coordinator');
await login('Audit Coordinator');
await seed('Coordinator Assigned');
await go('/auditor-coordinator/audit-workflow');
await page.getByText(CLIENT, { exact: false }).first().click(); await wait(800);
const reqBox = page.locator('[data-testid=ai-requirements]');
check('C1', 'Requirements step shows AI documents & audit-day estimate', /audit day/i.test(await reqBox.innerText().catch(() => '')));
await reqBox.getByRole('button', { name: /Fill scope/ }).click(); await wait(300);
const docs = await page.locator('input[placeholder^="e.g. Quality Manual"]').inputValue().catch(() => '');
check('C2', 'Fill scope & documents fills the form', /Quality policy/.test(docs), docs.slice(0, 50));

await seed('Requirements Reviewed', { req: true });
await go('/auditor-coordinator/audit-workflow');
await page.getByText(CLIENT, { exact: false }).first().click(); await wait(800);
const schBox = page.locator('[data-testid=ai-schedule]');
await schBox.getByRole('button', { name: /Use this date/ }).click().catch(() => {}); await wait(300);
const dateVal = await page.locator('input[type=date]').first().inputValue().catch(() => '');
check('C3', 'Schedule step suggests a free weekday ≥ 2 weeks ahead', !!dateVal && new Date(dateVal).getTime() > Date.now() + 13 * 86400000 && ![0, 6].includes(new Date(dateVal).getDay()), dateVal);

await seed('Schedule Proposed', { req: true, date: future(20) });
await go('/auditor-coordinator/auditor-assignment');
const r2 = myRow('Assign the audit team');
const sug2 = await r2.locator('[data-testid=ai-suggestion]').innerText().catch(() => '');
check('C4', 'Team step suggests a Lead Auditor + Auditor', /Suggested team/.test(sug2), sug2.split('\n')[0]);
await r2.getByRole('button', { name: /Use suggested team/ }).click().catch(() => {}); await wait(400);
const selects = await r2.locator('select').evaluateAll((els) => els.map((e) => e.value));
check('C5', 'Use suggested team fills both pickers', selects.length >= 2 && selects.every(Boolean) && sug2.includes(selects[0]), selects.join(' + '));

await seed('Requirements Reviewed', { req: true });
await go('/auditor-coordinator/smart-scheduler');
await page.locator('button').filter({ hasText: /Generate|Schedule|Run/ }).first().click().catch(() => {}); await wait(1500);
check('C6', 'Smart Scheduler includes the real workflow client as a job', (await page.locator('body').innerText()).includes(CLIENT));

/* ---------------- Auditee ---------------- */
console.log('\n▶ Auditee');
await login('Auditee');
await seed('Audit findings', { req: true, date: future(-3), lead: 'Leo Ashford', aud: 'Aaron Diaz', decision: 'Approved',
  findings: [{ id: 'f1', severity: 'Major NC', clause: '7.5', description: 'Drawings issued without approval', createdAt: new Date().toISOString() },
             { id: 'f2', severity: 'Minor NC', clause: '9.2', description: 'Internal audit plan incomplete', createdAt: new Date().toISOString() }] });
await go('/audit-client/audit-actions');
const r3 = myRow('Submit corrective actions');
await r3.getByRole('button', { name: /Draft with AI for Drawings/ }).click(); await wait(300);
const drafted = await r3.locator('textarea').first().inputValue();
check('A1', 'Draft with AI fills a structured corrective action', /Root cause/.test(drafted) && /Effectiveness check/.test(drafted));
const badge = await r3.innerText();
check('A2', 'Live AI quality score shown for each answer', /AI quality \d+%/.test(badge));

/* ---------------- Auditor ---------------- */
console.log('\n▶ Auditor');
await login('Auditor');
await seed('Action items released to Auditor', { req: true, date: future(-10), lead: 'Leo Ashford', aud: 'Aaron Diaz', decision: 'Approved',
  findings: [{ id: 'f1', severity: 'Major NC', clause: '7.5', description: 'Drawings issued without approval', evidence: 'drawing_register.pdf', correctiveAction: 'Will fix.' },
             { id: 'f2', severity: 'Minor NC', clause: '9.2', description: 'Internal audit plan incomplete', correctiveAction: 'Root cause: plan template missing because the QA lead left. Corrective action: create and approve an annual audit plan, owner QA manager, by 30 Nov; effectiveness verified at next internal audit.' }] });
await go('/auditor/action-review');
const r4 = myRow('Review corrective actions');
const sug4 = await r4.locator('[data-testid=ai-suggestion]').innerText().catch(() => '');
check('U1', 'AI recommends returning weak corrective actions', /return to auditee/i.test(sug4), sug4.split('\n')[0]);
await r4.getByRole('button', { name: /Use as return reason/ }).click().catch(() => {}); await wait(300);
const reason = await r4.locator('input[type=text]').first().inputValue().catch(() => '');
check('U2', 'Use as return reason pre-fills the reason', /^Please improve/.test(reason), reason.slice(0, 60));
for (const [path, label, expect] of [['/auditor/anomaly-detection', 'Anomaly Detection', null], ['/auditor/evidence-validation', 'Evidence Validation', 'drawing_register.pdf'], ['/auditor/findings-categorization', 'Findings Categorization', 'Drawings issued without approval']]) {
  const before = errors.length;
  await go(path);
  await page.locator('button').filter({ hasText: /Run|Scan|Classify|Assess|Detect|Analy/ }).first().click().catch(() => {}); await wait(1500);
  const body = await page.locator('body').innerText();
  check('U3', expect ? `${label} works on the real workflow findings` : `${label} runs`, (expect ? body.includes(expect) : body.length > 200) && errors.length === before);
}
const dash = (await (async () => { await go('/auditor/dashboard'); return page.locator('[data-testid=role-ai-insights]').innerText().catch(() => ''); })());
check('U4', 'Auditor dashboard AI insights flag weak corrective actions', /look weak/.test(dash));

/* ---------------- QCSAI ---------------- */
console.log('\n▶ QCSAI');
await page.getByRole('button', { name: 'Open QCSAI' }).click(); await wait(600);
const box = page.locator('[aria-label="QCSAI"] input').last();
await box.fill('what should I do next'); await box.press('Enter'); await wait(1300);
check('Q1', 'QCSAI lists the Auditor\'s waiting tasks', /task\(s\) waiting for you/.test(await page.locator('[aria-label="QCSAI"]').innerText()));
await box.fill('check my corrective action: will fix'); await box.press('Enter'); await wait(1300);
check('Q2', 'QCSAI scores a corrective action', /AI quality score/.test(await page.locator('[aria-label="QCSAI"]').innerText()));

/* ---------------- every AI page opens ---------------- */
console.log('\n▶ AI pages');
const pages = {
  Auditor: ['/auditor/smart-checklist', '/auditor/audit-assistant'],
  Auditee: ['/audit-client/document-analysis', '/audit-client/smart-compliance', '/audit-client/ai-chat', '/audit-client/action-risk', '/audit-client/auto-report'],
  'Audit Coordinator': ['/auditor-coordinator/audit-intelligence'],
  'Lead Auditor': ['/lead-auditor/dashboard'],
  'Client Coordinator': ['/client-coordinator/dashboard'],
};
for (const [role, list] of Object.entries(pages)) {
  await login(role);
  for (const p of list) {
    const before = errors.length;
    await go(p);
    const txt = await page.locator('body').innerText();
    check('P1', `${role} ${p} renders`, txt.length > 200 && errors.length === before, errors.slice(before).join(' | ').slice(0, 120));
  }
}
check('Z1', 'No JavaScript errors', errors.length === 0, errors.slice(0, 2).join(' | ').slice(0, 160));

await browser.close(); app.kill();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${'═'.repeat(60)}\n${results.length - failed}/${results.length} AI checks passed ${failed ? '✖' : '✔'}`);
process.exit(failed ? 1 : 0);

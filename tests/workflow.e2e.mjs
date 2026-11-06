/**
 * CertiSphere — end-to-end workflow test
 * ----------------------------------------------------------------------
 * Drives a real browser through the full certification workflow, logging
 * in as each role and using the same screens and buttons a person would.
 * Checks every stage change, every hand-over and every loop-back.
 *
 *   npm run test:workflow                 (starts the app itself if needed)
 *   BASE_URL=https://your-site.vercel.app npm run test:workflow
 *   HEADED=1 npm run test:workflow        (watch it run in a visible browser)
 *
 * First time only:  npx playwright install chromium
 *
 * Exit code 0 = all checks passed, 1 = at least one failed.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const HEADED = !!process.env.HEADED;
const CLIENT = `Test Client ${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;

/* ------------------------------------------------------------------ */
/* Result tracking                                                     */
/* ------------------------------------------------------------------ */
const results = [];
let current = '';
const check = (id, title, ok, detail = '') => {
  results.push({ id, title, ok: !!ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${id.padEnd(6)} ${title}${detail ? `  — ${detail}` : ''}`);
};
const section = (name) => { current = name; console.log(`\n▶ ${name}`); };

/* ------------------------------------------------------------------ */
/* App server                                                          */
/* ------------------------------------------------------------------ */
const isUp = async () => {
  try { const r = await fetch(`${BASE_URL}/login`); return r.ok; } catch { return false; }
};
let devServer = null;
const ensureServer = async () => {
  if (await isUp()) return;
  if (process.env.BASE_URL) throw new Error(`${BASE_URL} is not reachable.`);
  console.log('Starting the app (npm run dev)…');
  devServer = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', '3000', '--strictPort'], {
    stdio: 'ignore', shell: process.platform === 'win32',
  });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isUp()) return;
  }
  throw new Error('The app did not start on port 3000 within 60 seconds.');
};

/* ------------------------------------------------------------------ */
/* Browser helpers                                                     */
/* ------------------------------------------------------------------ */
let page;
const dialogs = [];

const stage = () => page.evaluate((name) => {
  const regs = JSON.parse(localStorage.getItem('cms_client_registrations') || '[]');
  const c = regs.find((r) => r.organizationName === name);
  const wf = JSON.parse(localStorage.getItem('cms_audit_workflow') || '[]');
  const w = c && wf.find((x) => x.clientId === c.id);
  return w ? w.currentStage : '(not on workflow)';
}, CLIENT);

const history = () => page.evaluate((name) => {
  const regs = JSON.parse(localStorage.getItem('cms_client_registrations') || '[]');
  const c = regs.find((r) => r.organizationName === name);
  const wf = JSON.parse(localStorage.getItem('cms_audit_workflow') || '[]');
  const w = c && wf.find((x) => x.clientId === c.id);
  return w ? w.history.length : 0;
}, CLIENT);

const login = async (role) => {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  if (!page.url().includes('/login')) {
    await page.getByRole('button', { name: /Logout/ }).first().click();
    await page.waitForTimeout(1200);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  }
  await page.locator('button').filter({ hasText: new RegExp(`^\\s*${role}\\s*$`) }).first().click();
  await page.waitForTimeout(400);
  await page.locator('[role=dialog] button').filter({ hasText: /^\s*Sign in/ }).first().click();
  await page.waitForTimeout(2500);
  await page.getByText("Let's get started").click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(300);
};

const open = async (menuLabel) => {
  await page.locator('aside, nav, [class*=sidebar], [class*=Sidebar]').getByText(menuLabel, { exact: true }).first().click();
  await page.waitForTimeout(1300);
};

const panel = (title) => page.locator(`section[aria-label="Workflow step: ${title}"]`);
const row = (title) => panel(title).locator('div')
  .filter({ has: page.locator('strong', { hasText: CLIENT }) })
  .filter({ has: page.locator('button') }).last();
const panelMessage = async (title) =>
  (await panel(title).locator('[role=status]').innerText().catch(() => '')).replace(/\s+/g, ' ');
// Is the client listed as waiting in this panel? (checks the client rows only,
// not the green confirmation message, which also mentions the client's name)
const inPanel = async (title) =>
  (await panel(title).locator('strong', { hasText: CLIENT }).count().catch(() => 0)) > 0;

const click = async (title, button) => {
  await row(title).getByRole('button', { name: button }).first().click();
  await page.waitForTimeout(400);
};
const clickConfirm = async (title, label) => {
  await click(title, label);
  await row(title).getByRole('button', { name: new RegExp(`^Confirm: ${label}`) }).click();
  await page.waitForTimeout(400);
};
const withReason = async (title, label, reason) => {
  await click(title, label);
  await row(title).locator('input[type=text]').fill(reason);
  await row(title).getByRole('button', { name: new RegExp(`^Confirm: ${label}`) }).click();
  await page.waitForTimeout(400);
};

/* ------------------------------------------------------------------ */
/* Reusable workflow segments                                          */
/* ------------------------------------------------------------------ */
const assignTeamAndApproveDate = async (prefix) => {
  await login('Audit Coordinator'); await open('Auditor Assignment');
  check(`${prefix}a`, 'Client waits in Coordinator "Assign the audit team"', await inPanel('Assign the audit team'));
  await clickConfirm('Assign the audit team', 'Assign audit team');
  check(`${prefix}b`, 'Stage → Assigned Auditors', (await stage()).startsWith('Assigned Auditors'), await stage());
};

const coordinatorProposes = async (prefix, date, label) => {
  await login('Audit Coordinator'); await open('Audit Workflow');
  await page.getByText(CLIENT).first().click(); await page.waitForTimeout(500);
  await page.locator('input[type=date]').first().fill(date);
  await page.fill('input[placeholder="e.g. John Smith"]', 'Leo Ashford');
  await page.fill('input[placeholder="e.g. Jane Williams"]', 'Aaron Diaz');
  await page.getByRole('button', { name: /(Send Schedule Proposal|Re-propose Schedule)/ }).click();
  await page.waitForTimeout(400);
  check(prefix, label, (await stage()) === 'Schedule Proposed', await stage());
};

const auditeeSubmitsActions = async (prefix, text) => {
  await login('Auditee'); await open('Audit Actions');
  check(`${prefix}a`, 'Client waits in Auditee "Submit corrective actions"', await inPanel('Submit corrective actions'));
  await row('Submit corrective actions').locator('textarea').first().fill(text);
  await click('Submit corrective actions', 'Submit corrective actions');
  check(`${prefix}b`, 'Stage → Action items released to Auditor', (await stage()) === 'Action items released to Auditor', await stage());
};

const auditorForwards = async (prefix) => {
  await login('Auditor'); await open('Action Review');
  check(`${prefix}a`, 'Auditor sees the corrective action text', (await row('Review corrective actions').innerText().catch(() => '')).includes('calibration'));
  await click('Review corrective actions', /Reviewed — forward/);
  check(`${prefix}b`, 'Forwarded to Lead Auditor (stage unchanged, leaves Auditor list)',
    (await stage()) === 'Action items released to Auditor' && !(await inPanel('Review corrective actions')), await stage());
};

const leadAccepts = async (prefix) => {
  await login('Lead Auditor'); await open('Action Approval');
  check(`${prefix}a`, 'Client waits in Lead Auditor "Accept corrective actions"', await inPanel('Accept corrective actions'));
  await click('Accept corrective actions', /Accept & recommend/);
  check(`${prefix}b`, 'Stage → Review and Approval by Auditor', (await stage()) === 'Review and Approval by Auditor', await stage());
};

const coordinatorGenerates = async (prefix) => {
  await login('Audit Coordinator'); await open('Audit Certifications');
  check(`${prefix}a`, 'Client waits in Coordinator "Generate the certificate"', await inPanel('Generate the certificate'));
  await click('Generate the certificate', 'Generate certificate');
  const msg = await panelMessage('Generate the certificate');
  check(`${prefix}b`, 'Certificate generated, sent to Management', /certificate generated/i.test(msg), msg.slice(0, 80));
};

/* ------------------------------------------------------------------ */
/* The test                                                            */
/* ------------------------------------------------------------------ */
const run = async () => {
  await ensureServer();
  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 150 : 0 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

  console.log(`CertiSphere workflow test · ${BASE_URL} · client "${CLIENT}"`);

  /* Phase 1 – Registration */
  section('Phase 1 · Registration');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByText('New client? Register here').click(); await page.waitForTimeout(500);
  await page.fill('input[placeholder="Acme Industries Pvt Ltd"]', CLIENT);
  await page.fill('input[placeholder="Jane Doe"]', 'Test Contact');
  await page.fill('input[placeholder="contact@acme.com"]', 'test.contact@example.com');
  await page.getByRole('button', { name: /Submit Registration/ }).click(); await page.waitForTimeout(800);
  check('S2', 'Auditee registers → Registration Submitted', (await stage()) === 'Registration Submitted', await stage());
  check('S2b', 'Login details shown to the new client', /username/i.test(await page.locator('body').innerText()));

  await login('Management'); await open('Client Onboarding');
  check('S3a', 'Client waits in Management "Approve client & assign"', await inPanel('Approve client & assign an Audit Coordinator'));
  await clickConfirm('Approve client & assign an Audit Coordinator', 'Assign coordinator');
  check('S3b', 'Stage → Coordinator Assigned', (await stage()) === 'Coordinator Assigned', await stage());

  /* Refresh keeps the session */
  const before = page.url();
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  check('R1', 'Refresh (F5) keeps the user on the same page', page.url() === before, page.url().replace(BASE_URL, ''));

  /* Phase 2 – Planning & scheduling */
  section('Phase 2 · Planning & scheduling');
  await login('Audit Coordinator'); await open('Audit Workflow');
  await page.getByText(CLIENT).first().click(); await page.waitForTimeout(500);
  await page.fill('input[placeholder="e.g. Quality Manual, Process Maps, Risk Register"]', 'Quality Manual, Process Maps');
  await page.getByRole('button', { name: /Save Requirements Review/ }).click(); await page.waitForTimeout(400);
  check('S4', 'Requirements reviewed → Requirements Reviewed', (await stage()) === 'Requirements Reviewed', await stage());

  await coordinatorProposes('S5', '2026-12-01', 'Date proposed → Schedule Proposed');
  await assignTeamAndApproveDate('S6');

  // Loop-back 1: auditee declines the date
  await login('Auditee'); await open('Schedule Approvals');
  check('L1a', 'Client waits in Auditee "Approve the proposed audit date"', await inPanel('Approve the proposed audit date'));
  await withReason('Approve the proposed audit date', 'Decline', 'Please move to the following week');
  check('L1b', 'Decline removes it from the Auditee list', !(await inPanel('Approve the proposed audit date')));
  await coordinatorProposes('L1c', '2026-12-08', 'Coordinator re-proposes → Schedule Proposed');
  await assignTeamAndApproveDate('L1d');

  await login('Auditee'); await open('Schedule Approvals');
  await click('Approve the proposed audit date', 'Approve date');
  check('S7', 'Auditee approves → Schedule Approved by Auditee', (await stage()) === 'Schedule Approved by Auditee', await stage());

  await login('Lead Auditor'); await open('Audit Schedules');
  check('S8a', 'Client waits in Lead Auditor "Confirm the audit team"', await inPanel('Confirm the audit team'));
  await click('Confirm the audit team', 'Confirm team');
  check('S8b', 'Stage → Schedule Approved by Auditor', (await stage()) === 'Schedule Approved by Auditor', await stage());

  /* Phase 3 – Audit execution */
  section('Phase 3 · Audit execution');
  await login('Auditor'); await open('Conduct Audit');
  await page.getByText(CLIENT).first().click(); await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Start audit/ }).click(); await page.waitForTimeout(400);
  check('S9', 'Start audit → Audit In Progress', (await stage()) === 'Audit In Progress', await stage());
  await page.locator('input[placeholder*="lause" i]').first().fill('7.1.5');
  await page.locator('textarea, input[placeholder*="escri" i]').first().fill('Measuring equipment calibration overdue');
  await page.getByRole('button', { name: /Add finding/ }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Close out \+ release findings/ }).click(); await page.waitForTimeout(400);
  check('S10', 'Close out → Audit findings', (await stage()) === 'Audit findings', await stage());

  await open('Audit Report');
  await page.getByText(CLIENT).first().click().catch(() => {}); await page.waitForTimeout(400);
  await page.locator('textarea[placeholder^="Audit scope, sites visited"]').fill('Test audit of production.');
  await page.locator('textarea[placeholder^="Did the auditee meet"]').fill('Conforms subject to one minor NC.');
  await page.getByRole('button', { name: /Submit to Lead Auditor/ }).click(); await page.waitForTimeout(400);
  check('S11', 'Audit report submitted; stage stays Audit findings', (await stage()) === 'Audit findings', await stage());

  /* Phase 4 – Corrective actions & certification */
  section('Phase 4 · Corrective actions & certification');
  await login('Auditee'); await open('Audit Actions');
  await click('Submit corrective actions', 'Submit corrective actions');
  check('V1', 'Empty corrective action is blocked', /missing/i.test(await panelMessage('Submit corrective actions')), await panelMessage('Submit corrective actions'));
  check('V1b', 'Stage did not move', (await stage()) === 'Audit findings', await stage());

  await auditeeSubmitsActions('S12', 'Root cause: no schedule. Action: calibration done, monthly plan added.');

  // Loop-back 2: auditor returns the actions
  await login('Auditor'); await open('Action Review');
  await withReason('Review corrective actions', 'Return to auditee', 'Add evidence of the calibration certificate');
  check('L2', 'Auditor returns → back to Audit findings', (await stage()) === 'Audit findings', await stage());
  await auditeeSubmitsActions('L2b', 'Root cause: no schedule. Action: calibration done (certificate attached), monthly plan added.');

  await auditorForwards('S13');
  await leadAccepts('S14');
  await coordinatorGenerates('S15');

  // Loop-back 3: Management sends it back
  await login('Management'); await open('Dashboard');
  check('L3a', 'Client waits in Management "Approve the certificate"', await inPanel('Approve the certificate'));
  await withReason('Approve the certificate', 'Send back', 'Re-check evidence for clause 7.1.5');
  check('L3b', 'Send back → Action items released to Auditor', (await stage()) === 'Action items released to Auditor', await stage());
  await auditorForwards('L3c');
  await leadAccepts('L3d');
  await coordinatorGenerates('L3e');

  await login('Management'); await open('Dashboard');
  await click('Approve the certificate', 'Approve & release');
  check('S16', 'Management approves → Certification released', (await stage()) === 'Certification released', await stage());

  /* Phase 5 – After certification */
  section('Phase 5 · After certification');
  await login('Audit Coordinator'); await open('Certificate Delivery');
  check('S17a', 'Client waits in Coordinator "Deliver the certificate"', await inPanel('Deliver the certificate'));
  await click('Deliver the certificate', 'Mark as delivered');
  check('S17b', 'Marked as delivered', /delivered/i.test(await panelMessage('Deliver the certificate')));

  await login('Client Coordinator'); await open('Certifications View');
  const cc = await panel('Issued certificates').innerText().catch(() => '');
  check('S18', 'Client Coordinator sees the issued certificate', cc.includes(CLIENT) && /Certificate CS-\d{4}-\d+/.test(cc), (cc.match(/Certificate CS-[\d-]+/) || [''])[0]);

  check('H1', 'Every action is recorded in the client history', (await history()) >= 20, `${await history()} history entries`);
  check('E1', 'No JavaScript errors on any screen', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

  await browser.close();
};

/* ------------------------------------------------------------------ */
const main = async () => {
  let crashed = null;
  try {
    await run();
  } catch (e) {
    crashed = e;
    check('X', `Test stopped during "${current}"`, false, (e?.message || String(e)).split('\n')[0]);
  } finally {
    if (devServer) devServer.kill();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` · ${failed.length} FAILED` : ' · workflow OK ✔'}`);
  failed.forEach((f) => console.log(`  ✖ ${f.id} ${f.title}${f.detail ? ` — ${f.detail}` : ''}`));
  if (crashed && process.env.DEBUG) console.error(crashed);
  process.exit(failed.length ? 1 : 0);
};
main();

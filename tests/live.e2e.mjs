/**
 * CertiSphere — live-mode test (real accounts + shared data)
 * ----------------------------------------------------------------------
 * Starts a local stand-in for Supabase (tests/support/fake-supabase.mjs,
 * same API and same access rules as the SQL migration) and the app in live
 * mode, then checks sign-in, roles, client self-registration, Users &
 * Access, shared data between users, client data separation, attempts to
 * break the rules, refresh and sign-out.
 *
 *   npm run test:live            (HEADED=1 to watch)
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { server as fake, ANON_KEY, SERVICE_KEY } from './support/fake-supabase.mjs';

const SB_PORT = 54329, APP_PORT = 3107;
const SB = `http://127.0.0.1:${SB_PORT}`, APP = `http://127.0.0.1:${APP_PORT}`;
const results = [];
const check = (id, title, ok, detail = '') => {
  results.push({ id, ok: !!ok });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${id.padEnd(5)} ${title}${detail ? `  — ${detail}` : ''}`);
};
const section = (s) => console.log(`\n▶ ${s}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const dump = async () => (await fetch(`${SB}/__dump`)).json();
const rowsOf = async (store) => (await dump()).app_data.filter((r) => r.store === store);

let page, app;
const dialogs = [];

const open = async (label) => {
  await page.locator('aside, nav, [class*=sidebar], [class*=Sidebar]').getByText(label, { exact: true }).first().click();
  await page.waitForTimeout(1200);
};
const signIn = async (email, password) => {
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.fill('#live-email', email);
  await page.fill('#live-password', password);
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForTimeout(2500);
  await page.getByText("Let's get started").click({ timeout: 1000 }).catch(() => {});
};
const signOut = async () => {
  await page.getByRole('button', { name: /Logout/ }).first().click();
  await page.waitForTimeout(1800);
};
const localStore = (key) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, key);
const accessToken = () => page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
  try { return JSON.parse(localStorage.getItem(k)).access_token; } catch { return null; }
});
const register = async (org, contact, email, pw) => {
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.getByText('New client? Register here').click(); await page.waitForTimeout(400);
  await page.fill('input[placeholder="Acme Industries Pvt Ltd"]', org);
  await page.fill('input[placeholder="Jane Doe"]', contact);
  await page.fill('input[placeholder="contact@acme.com"]', email);
  await page.fill('#reg-pw', pw); await page.fill('#reg-pw2', pw);
  await page.getByRole('button', { name: /Submit Registration/ }).click();
  await page.waitForTimeout(1500);
  return page.locator('body').innerText();
};
const createUser = async (email, name, role, clientName) => {
  await page.fill('#ua-email', email);
  await page.fill('#ua-name', name);
  await page.selectOption('#ua-role', role);
  if (clientName) await page.selectOption('#ua-client', { label: clientName });
  await page.getByRole('button', { name: /Create account/ }).click();
  await page.waitForTimeout(800);
  return (await page.locator('code').last().innerText().catch(() => '')).trim();
};

const run = async () => {
  await new Promise((r) => fake.listen(SB_PORT, '127.0.0.1', r));
  app = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(APP_PORT), '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'ignore', shell: process.platform === 'win32',
    env: { ...process.env, VITE_SUPABASE_URL: SB, VITE_SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, VITE_DEMO_MODE: 'false' },
  });
  for (let i = 0; i < 60; i++) { await wait(1000); try { if ((await fetch(`${APP}/login`)).ok) break; } catch { /* starting */ } }
  await fetch(`${SB}/__reset`);
  await fetch(`${SB}/__seed-admin`, { method: 'POST', body: JSON.stringify({ email: 'admin@qmics.test', password: 'Admin@12345', fullName: 'QMICS Admin' }) });
  await fetch(`${SB}/__seed-admin`, { method: 'POST', body: JSON.stringify({ email: 'management@certisphere.test', password: 'Certi@Demo2026', fullName: 'Demo Management', demo: true }) });

  const browser = await chromium.launch({ headless: !process.env.HEADED });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

  section('Sign-in page');
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  const body = await page.locator('body').innerText();
  check('A1', 'Live sign-in form shown (email + password)', await page.locator('#live-email').isVisible() && await page.locator('#live-password').isVisible());
  check('A2', 'Old demo-mode role buttons and passwords are not on the live site', !/Demo accounts|SHOW DEMO LOGIN|AuditCoord@123/i.test(body));
  await page.fill('#live-email', 'admin@qmics.test'); await page.fill('#live-password', 'wrong-password');
  await page.getByRole('button', { name: /^Sign in$/ }).click(); await page.waitForTimeout(1200);
  check('A3', 'Wrong password is rejected with a message', /Incorrect email or password/.test(await page.locator('[role=alert]').innerText().catch(() => '')));
  check('A4', 'Demo credentials panel lists the demo logins from the server', (await page.locator('#live-demo-logins button').count()) === 1 && /Certi@Demo2026/.test(await page.locator('#live-demo-logins').innerText()));
  await page.locator('#live-demo-logins button', { hasText: 'Management' }).click();
  await page.waitForURL(/\/management\//, { timeout: 15000 }).catch(() => {});
  check('A5', 'Clicking a demo role signs in with the shared demo password', page.url().includes('/management/'), page.url().replace(APP, ''));
  await signOut();

  section('Management account & a clean start');
  await signIn('admin@qmics.test', 'Admin@12345');
  check('B1', 'Management signs in and lands on the Management dashboard', page.url().includes('/management/'), page.url().replace(APP, ''));
  check('B2', 'No demo data on the live site', ((await localStore('cms_client_registrations')) || []).length === 0);
  await page.goto(`${APP}/management/users`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  check('B3', 'Users & Access lists the admin account', (await page.locator('table').innerText()).includes('admin@qmics.test'));
  const pwCoord = await createUser('cora@qmics.test', 'Cora Dinh', 'Audit Coordinator');
  const pwLead = await createUser('leo@qmics.test', 'Leo Ashford', 'Lead Auditor');
  const pwAud = await createUser('aaron@qmics.test', 'Aaron Diaz', 'Auditor');
  check('B4', 'Management creates Coordinator, Lead Auditor and Auditor accounts', [pwCoord, pwLead, pwAud].every((p) => p.length >= 12), `${(await dump()).profiles.length} accounts`);
  // Users & Access → sign-in page demo credentials
  await page.fill('#ua-demo-pw', 'Demo@Pass99');
  await page.getByRole('button', { name: 'Login page for leo@qmics.test' }).click(); await wait(1200);
  await page.getByRole('button', { name: /Apply to all shown accounts/ }).click(); await wait(1500);
  check('B4a', 'Management puts accounts on the sign-in page and changes the demo password', /Password changed to "Demo@Pass99" for 2 demo logins/.test(await page.locator('[role=status]').innerText().catch(() => '')));
  await signOut();
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' }); await wait(800);
  const demoTxt = await page.locator('#live-demo-logins').innerText().catch(() => '');
  check('B4b', 'Sign-in page shows the edited demo credentials', /Demo@Pass99/.test(demoTxt) && /Lead Auditor/.test(demoTxt) && !/Certi@Demo2026/.test(demoTxt));
  await page.locator('#live-demo-logins button', { hasText: 'Lead Auditor' }).click();
  await page.waitForURL(/\/lead-auditor\//, { timeout: 15000 }).catch(() => {});
  check('B4c', 'Clicking the edited demo login signs in (real password changed too)', page.url().includes('/lead-auditor/'), page.url().replace(APP, ''));
  await signOut();
  check('B5', 'Sign-out wipes this browser\'s copy of the data', (await localStore('cms_client_registrations')) === null);

  section('Client self-registration');
  const reg1 = await register('Sunrise Textiles Pvt Ltd', 'Ravi Teja', 'ravi@sunrise.test', 'Sunrise@123');
  check('C1', 'Registration creates the client and its login', /Your account is ready/.test(reg1));
  const d1 = await dump();
  const c1 = d1.app_data.find((r) => r.store === 'cms_client_registrations' && r.data.organizationName === 'Sunrise Textiles Pvt Ltd');
  const p1 = d1.profiles.find((p) => p.email === 'ravi@sunrise.test');
  check('C2', 'Server stored client, workflow (Registration Submitted) and an Auditee login linked to it',
    !!c1 && d1.app_data.some((r) => r.store === 'cms_audit_workflow' && r.client_id === c1.client_id && r.data.currentStage === 'Registration Submitted') && p1?.role === 'Auditee' && p1.client_id === c1.client_id);
  const reg1b = await register('Copycat Ltd', 'Someone', 'ravi@sunrise.test', 'Another@123');
  check('C3', 'The same email cannot register twice', /already exists/.test(reg1b));
  await register('Lotus Agro Foods', 'Suresh Reddy', 'suresh@lotus.test', 'Lotus@1234');
  const c2 = (await dump()).app_data.find((r) => r.store === 'cms_client_registrations' && r.data.organizationName === 'Lotus Agro Foods');
  check('C4', 'A second client gets its own client number', !!c2 && c2.client_id !== c1.client_id, `#${c1?.client_id} and #${c2?.client_id}`);

  section('Shared data between people');
  await signIn('admin@qmics.test', 'Admin@12345');
  await page.goto(`${APP}/management/client-onboarding`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  const panel = page.locator('section[aria-label="Workflow step: Approve client & assign an Audit Coordinator"]');
  check('D1', 'Management sees both new clients waiting in Step 3', (await panel.innerText()).includes('Sunrise Textiles') && (await panel.innerText()).includes('Lotus Agro'));
  const rowSel = panel.locator('div').filter({ has: page.locator('strong', { hasText: 'Sunrise Textiles Pvt Ltd' }) }).filter({ has: page.locator('button') }).last();
  await rowSel.getByRole('button', { name: 'Assign coordinator' }).click();
  await rowSel.getByRole('button', { name: /Confirm: Assign coordinator/ }).click();
  await wait(1500);
  const wf1 = (await rowsOf('cms_audit_workflow')).find((r) => r.client_id === c1.client_id);
  check('D2', 'The change is saved on the server', wf1?.data.currentStage === 'Coordinator Assigned', wf1?.data.currentStage);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
  check('D3', 'Refresh keeps Management signed in on the same page', page.url().includes('/management/client-onboarding'));
  await signOut();

  await signIn('cora@qmics.test', pwCoord);
  check('D4', 'Coordinator signs in with the password Management issued', page.url().includes('/auditor-coordinator/'));
  const wfLocal = (await localStore('cms_audit_workflow')) || [];
  check('D5', 'Coordinator sees Management\'s change (shared, not per-browser)', wfLocal.some((w) => w.clientId === c1.client_id && w.currentStage === 'Coordinator Assigned'));
  await open('Audit Workflow');
  await page.getByText('Sunrise Textiles Pvt Ltd').first().click(); await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Save Requirements Review/ }).click(); await wait(1500);
  const wf1b = (await rowsOf('cms_audit_workflow')).find((r) => r.client_id === c1.client_id);
  check('D6', 'Coordinator\'s requirements review is saved on the server', wf1b?.data.currentStage === 'Requirements Reviewed', wf1b?.data.currentStage);
  const coordTok = await accessToken();
  const usersApi = await page.evaluate(async (t) => (await fetch('/api/users', { headers: { authorization: `Bearer ${t}` } })).status, coordTok);
  check('D7', 'A Coordinator cannot list or manage staff accounts', usersApi === 403, `HTTP ${usersApi}`);
  const promote = await page.evaluate(async (t) => (await fetch('/api/users', { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', email: 'evil@x.test', role: 'Management' }) })).status, coordTok);
  check('D8', 'A Coordinator cannot create a Management account', promote === 403, `HTTP ${promote}`);
  await signOut();

  section('Client data separation');
  await signIn('ravi@sunrise.test', 'Sunrise@123');
  check('E1', 'Auditee signs in to the Auditee workspace', page.url().includes('/audit-client/'));
  const regsSeen = ((await localStore('cms_client_registrations')) || []).map((r) => r.organizationName);
  check('E2', 'Auditee sees only their own company', regsSeen.length === 1 && regsSeen[0] === 'Sunrise Textiles Pvt Ltd', regsSeen.join(', '));
  const wfSeen = ((await localStore('cms_audit_workflow')) || []).map((w) => w.clientId);
  check('E3', 'Auditee sees only their own workflow, with the Coordinator\'s latest change',
    wfSeen.length === 1 && wfSeen[0] === c1.client_id && (await localStore('cms_audit_workflow'))[0].currentStage === 'Requirements Reviewed');
  const tok = await accessToken();
  const readOther = await page.evaluate(async ([sb, key, t, id]) => {
    const r = await fetch(`${sb}/rest/v1/app_data?select=*&client_id=eq.${id}`, { headers: { apikey: key, authorization: `Bearer ${t}` } });
    return (await r.json()).length;
  }, [SB, ANON_KEY, tok, c2.client_id]);
  check('E4', 'Reading another client\'s data directly returns nothing', readOther === 0);
  const writeOther = await page.evaluate(async ([sb, key, t, id]) => {
    const r = await fetch(`${sb}/rest/v1/app_data?on_conflict=store,row_key`, {
      method: 'POST', headers: { apikey: key, authorization: `Bearer ${t}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ store: 'cms_audit_workflow', row_key: String(id), kind: 'array', pos: 0, client_id: id, data: { clientId: id, currentStage: 'Certification released', history: [] } }]),
    });
    return r.status;
  }, [SB, ANON_KEY, tok, c2.client_id]);
  check('E5', 'Changing another client\'s workflow is refused', writeOther === 403, `HTTP ${writeOther}`);
  const selfPromote = await page.evaluate(async ([sb, key, t]) => {
    const r = await fetch(`${sb}/rest/v1/profiles`, { method: 'POST', headers: { apikey: key, authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'x', email: 'x', role: 'Management' }) });
    return r.status;
  }, [SB, ANON_KEY, tok]);
  check('E6', 'An Auditee cannot give themselves another role', selfPromote === 403, `HTTP ${selfPromote}`);
  await signOut();

  section('Visitors and disabled accounts');
  const anonRead = await page.evaluate(async ([sb, key]) => (await (await fetch(`${sb}/rest/v1/app_data?select=*`, { headers: { apikey: key, authorization: `Bearer ${key}` } })).json()).length, [SB, ANON_KEY]);
  check('F1', 'A signed-out visitor cannot read any data', anonRead === 0);
  await page.goto(`${APP}/enquiry`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="Acme Corporation"]', 'Orbit Pharma');
  await page.fill('input[placeholder="Jane Doe"]', 'Meena Rao');
  await page.fill('input[placeholder="jane@acme.example"]', 'meena@orbit.test');
  await page.getByRole('button', { name: /Submit/ }).last().click(); await wait(1500);
  const enq = (await rowsOf('cms_client_enquiries_v1')).filter((r) => r.data.company === 'Orbit Pharma');
  check('F2', 'A visitor\'s website enquiry reaches the server (and only that record)', enq.length === 1 && (await rowsOf('cms_client_enquiries_v1')).length === 1);

  await signIn('cora@qmics.test', pwCoord);
  await open('Application');
  await page.locator('button').filter({ hasText: /^\s*Client Enquiry/ }).first().click(); await page.waitForTimeout(800);
  const enqRow = page.locator('tr').filter({ hasText: 'Orbit Pharma' }).first();
  check('F3', 'Coordinator sees the visitor\'s enquiry', await enqRow.isVisible());
  await enqRow.locator('button[title="Convert to client registration"]').click(); await wait(2000);
  const conv = (await dump()).profiles.find((p) => p.email === 'meena@orbit.test');
  check('F4', 'Converting it creates the client\'s real Auditee login', conv?.role === 'Auditee' && dialogs.some((d) => /Password: \S{12}/.test(d)));
  await signOut();

  await signIn('admin@qmics.test', 'Admin@12345');
  await page.goto(`${APP}/management/users`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  await page.locator('tr').filter({ hasText: 'aaron@qmics.test' }).getByRole('button', { name: /Disable/ }).click(); await wait(800);
  await signOut();
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.fill('#live-email', 'aaron@qmics.test'); await page.fill('#live-password', pwAud);
  await page.getByRole('button', { name: /^Sign in$/ }).click(); await page.waitForTimeout(1500);
  check('F5', 'A disabled account cannot sign in', /disabled/i.test(await page.locator('[role=alert]').innerText().catch(() => '')) && page.url().includes('/login'));

  check('Z1', 'No JavaScript errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  await browser.close();
};

run()
  .catch((e) => check('X', 'Test stopped', false, (e?.message || String(e)).split('\n')[0]))
  .finally(() => {
    app?.kill(); fake.close();
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${'═'.repeat(60)}\n${results.length - failed}/${results.length} live-mode checks passed${failed ? ` · ${failed} FAILED` : ' ✔'}`);
    process.exit(failed ? 1 : 0);
  });

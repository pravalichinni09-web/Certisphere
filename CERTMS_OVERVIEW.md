# CertMS — Application Analysis

## What it is

**CertMS** (Certification Management System) is a single-page web application
from **Qmics** that manages the full ISO certification lifecycle for a
certification body — from a prospective client first enquiring through the
website, through audit planning and execution, all the way to issued
certificates and ongoing surveillance audits. It is role-aware: the same code
base shows different surfaces to a Coordinator, a Lead Auditor, a Field
Auditor, the Auditee (the client), and Management.

The application is entirely client-side — there is no backend service. All
data lives in the browser's localStorage, with custom events used to
synchronise updates across pages. This makes it ideal as a **demo / preview /
training instance** but not yet a production certification system.

---

## At a glance

| Stat | Value |
|---|---|
| Total source files | 84 `.tsx` files |
| Total lines of code | ~31,600 lines (TS + TSX) |
| Pages (route surfaces) | 47 |
| Reusable components | 24 |
| Utilities | 11 |
| AI modules | 4 (engine, Claude client, auditor matcher, corrective actions) |
| Active roles | 5 (Audit Coordinator, Lead Auditor, Auditor, Auditee, Management) |
| Persistent data layer | `localStorage` keyed under `cms_*` |
| Build target | Node 18, modern browsers |

---

## Technology stack

- **React 18** + **TypeScript 5.2** (strict mode)
- **Vite 5** (build & dev server)
- **React Router 7** (role-scoped routing under `/<role>/<page>`)
- **lucide-react 0.263** (icon set)
- **chart.js 4 + react-chartjs-2 5** (KPI donuts, bar charts)
- **jsPDF 4 + jspdf-autotable 5** (Audit Report and Certificate PDF export)
- **xlsx 0.18** (template upload / export)
- **axios** (Claude API client)
- **@supabase/supabase-js** (declared dependency, not yet wired — see "Future")
- **ESLint 8 + GitHub Actions CI** for type-check + lint on push

The app is fully client-rendered; there is no server, no SSR, no API server.
A small wrapper around `fetch`/`axios` calls the Anthropic Claude API
**directly from the browser** when the user supplies a key — see "AI Assistant"
below.

---

## Roles & their dashboards

CertMS has **five roles**, each with its own dashboard, navigation, and
permissions. The login form lists test credentials for every role; users
can also self-register as an Auditee from the login page.

### 1. Audit Coordinator
The plan-and-orchestrate role. Owns the full lead-to-certificate pipeline.
Sidebar groups:
- **Audit System Data** — Dashboard, Audit Scope, Auditor Profiles, Audit
  Checklists.
- **Client Registration** — Application (with nested Client Enquiry,
  Sent Application, Receive Application, Review Application tabs) and
  Client Registration.
- **Audit Execution** — Audit Workflow, Audit Schedules, Audit Types,
  Audit Certifications, Audit Report, Certificate Delivery, Surveillance
  Audit.

### 2. Lead Auditor
The team lead. Sidebar:
Dashboard, **Auditor Approvals** (validates Coordinator-created auditor
profiles), Audit Schedules, Conduct Audit, Audit Report, Action Review,
Action Approval.

### 3. Auditor
The field executor. Sidebar:
Dashboard, Schedule Confirmations, Conduct Audit, Audit Report, Action Review.

### 4. Auditee (the client being audited)
Sidebar: Dashboard, Audit Actions (corrective actions to close), Submit
Report, Schedule Approvals.

### 5. Management
Read-only oversight. Sidebar: Dashboard, Client Credentials, Audit
Assignments.

---

## End-to-end workflow

1. **Client Enquiry** — A prospective client submits the website contact
   form (or the Coordinator captures the lead manually). The enquiry is
   stored with company details, contact, standards of interest, message,
   and source. Status tracked: New → Contacted → Qualified → Converted /
   Rejected.

2. **Application** — Once an enquiry is qualified, a formal application is
   sent. The Coordinator can attach the **Application document** and the
   **Agreement** (file uploads stored as base64 dataUrls in localStorage,
   with Replace / Clear / Download actions). Application Status flips
   between Submitted ↔ Pending.

3. **Receive Application** — When the client returns the signed
   application, the Coordinator marks it Received. The Receive tab reuses
   the Submitted / Pending pill toggle, but with the first label
   contextualised to "Received".

4. **Review Application** — A separate review surface with a 3-state
   status (Approve / Hold / Rejected) and columns for Contact Name,
   Email, Application Review Date.

5. **Client Registration** — Approved applications are registered as
   formal clients with auto-generated client codes (`CMS-YYYY-NNNN`),
   logo upload, GSTIN / CIN / PAN validation, duplicate detection,
   Audit Type, Standard, and the Annexure-13 Certification Contract +
   Agreement. The Coordinator then **Submit-to-Email** the registration
   (opens a prefilled mailto), and once the client confirms, marks the
   row as **Approved by Client**.

6. **Audit Scope, Types, Checklists** — Coordinator defines what will be
   audited:
   - Audit Scope with **versioning + redline diff** between revisions.
   - Audit Types (initial / surveillance / re-certification etc.).
   - Audit Checklists with **drag-to-reorder**, conditional follow-up
     questions ("if Yes / No / N/A → ask follow-up"), and clone-from-
     template.

7. **Auditor Profiles + Lead Auditor Approval** — Coordinator creates an
   auditor profile (name, email, role, certifications, 0-5 skill matrix
   across 8 ISO families, availability calendar, rating history). Every
   create / edit drops the profile to **Pending Approval**; the **Lead
   Auditor** approves / rejects via a dedicated page with Approve All,
   Re-approve, decision log, and 25-entry audit trail.

8. **Schedule Request → Audit Schedule** — Coordinator builds a
   schedule with a **calendar heatmap**, conflict detection against the
   auditor's existing assignments, and an Auditee approval step (Auditee
   confirms or proposes alternative dates).

9. **Audit Confirmation** — 48-hour auto-reminder daemon scans pending
   schedules and surfaces "Send reminder" prompts. Bulk Approve All bulk-
   creates Confirmation records.

10. **Conduct Audit** (Lead Auditor / Auditor) — Walks the auditor through
    the checklist on-site, captures evidence and findings.

11. **Audit Report** — Auditor drafts; Lead Auditor reviews; Coordinator
    sees the consolidated report. Export to PDF via jsPDF.

12. **Action Review → Action Approval → Auditee submits closure** — The
    corrective-action loop: Auditee uploads closure evidence; Auditor
    reviews; Lead Auditor approves.

13. **Certificate Delivery** — Generate certificate as PDF with an
    embedded **QR code** linking to a verification URL
    (`https://verify.qmics.com/cert/<num>?c=<clientId>`). Dispatch via
    Email or WhatsApp (`wa.me/<phone>`).

14. **Surveillance / Renewal** — 60-day recertification reminders fire
    weekly via setInterval scanning of `cms_certificates`, with bulk and
    per-certificate reminder buttons.

---

## Notable features

### Qmics Certification AI (chat assistant)
A floating chat bot mounted globally — visible on the Login page **and**
inside every authenticated role. It works in two layers:
- **Rule engine**: in-browser intent recognizer with normalised input
  (so "what is CertMS" maps to the canonical CMS topic), a knowledge
  base covering CertMS, ISO standards, audit lifecycle, roles, and a
  smart fallback that always returns something useful.
- **Claude API**: when the user supplies an Anthropic API key in
  Settings, free-form questions that the rule engine can't confidently
  answer route to Claude with a general-purpose system prompt — making
  the bot a general AI agent. Slash commands `/draft-ncr`,
  `/summarize`, `/explain` use Claude with role-specific system prompts.
The same engine can navigate the user, look up live KPI data, draft
NCRs, summarise reports, and explain checklist questions.

### Smart auditor matcher
`src/ai/auditorMatcher.ts` scores auditor candidates for an audit based
on standard match, skill matrix match, current load, and rating average.
Used by the Schedule page when filling out the lead auditor field.

### Theme system
CSS-variable-based dark / light mode toggleable from any sidebar.
Tokens defined once in `styles/theme.css`; every page consumes via
`var(--bg-card)`, `var(--text-primary)`, etc.

### Universal Back button
A single `BackButton.tsx` mounted at every role's layout level. Smart
fallback to detected role dashboard when there's no history.

### Scheduling polish
Calendar heatmap, conflict detection, 48-hour reminder daemon,
Approve-All bulk action, auto-link to Confirmation page.

### File handling
- Certificate PDFs generated client-side with embedded QR codes.
- File uploads (Application Attachment, Agreement) stored as base64
  dataUrls in localStorage with a 3 MB cap and Replace / Clear /
  Download actions.
- Word document export for the Annexure-13 Certification Contract.
- xlsx template download for checklists.

### Versioning
Audit Scope keeps a redline diff between any two revisions, with
optional revision notes.

### Audit trail
The Lead Auditor's Auditor Approvals page persists a 25-entry decision
log to `cms_auditor_approval_log_v1`. Application Dispatch carries a
`deliveryHistory` array on every record.

---

## Storage map

All data lives in `localStorage` under `cms_*` keys. The most important:

| Key | Owner | Purpose |
|---|---|---|
| `cms_auditors_data` | Coordinator + Lead Auditor | Auditor records + approval state |
| `cms_client_registrations` | Coordinator | Registered clients |
| `cms_client_enquiries_v1` | Coordinator | Website / email / phone leads |
| `cms_application_dispatch_v7` | Coordinator | Sent / Received / Reviewed applications |
| `cms_audit_schedules` / `cms_audit_schedules_v3` | Coordinator | Audit schedule rows |
| `cms_schedule_requests_v1` | Coordinator | Pending Auditee approvals |
| `cms_audit_scopes` | Coordinator | Scope definitions |
| `cms_audit_checklists` | Coordinator | Checklists *(see gaps — not currently persisted)* |
| `cms_audit_types`, `cms_audit_certifications` | Coordinator | Static-ish reference data |
| `cms_audit_reports` | Lead Auditor + Auditor | Drafted reports |
| `cms_certificates` | Coordinator | Issued certificates |
| `cms_workflows` | Workflow engine | State machine for cross-role tasks |
| `cms_audit_reminder_log_v1` | Coordinator | 48-hour confirmation reminders |
| `cms_dispatch_log`, `cms_renewal_log` | Coordinator | Email / WhatsApp dispatch records |
| `cms_auditor_approval_log_v1` | Lead Auditor | Approval decision audit trail |
| `auditCoordinatorProfile` | Coordinator | Editable profile (name, photo) |
| `cms_ai_chat_history` *(sessionStorage)* | All roles | AI chat per-session memory |
| `cms_anthropic_key` | All roles | Claude API key (BYO) |

---

## Strengths

- **Tightly coupled vertical**: every role's view is derived from the same
  underlying data (auditors, schedules, applications) so there's a single
  source of truth.
- **Lots of polish**: drag-and-drop reorder, calendar heatmaps, redline
  diffs, QR codes, dark mode, file uploads, conditional checklist follow-
  ups, auto-reminders.
- **Type-safe**: zero TypeScript errors across 31k lines, strict mode,
  CI runs `tsc --noEmit` on every push.
- **AI baked in**: the chat assistant is genuinely useful — knows the
  app, knows ISO, can navigate, can call Claude for free-form Q&A.
- **Role isolation**: every role has its own Layout, sidebar, theme, and
  routes; cross-contamination is impossible at the routing layer.

## Limitations & risks

- **No backend**: localStorage only. Data is per-browser, per-machine —
  not shared across users, not backed up, no cross-device login. Two
  Coordinators on different laptops see different worlds.
- **localStorage quota**: base64 logos, application attachments,
  agreements, and certificate PDFs all live in a 5-10 MB browser quota.
  Heavy demo use will eventually fill it. No global guard.
- **Status enum fragmentation**: pages use overlapping but inconsistent
  status vocabularies (`Pending` / `Approved` / `Client Approved` /
  `Submitted` / `Sent` / `Received` / `Hold` / `Rejected`); see the gap
  review for the bugs this causes.
- **Audit Checklists not persisted**: every reload loses changes.
- **Audit Scope versions not persisted**: same problem.
- **Submit-to-Email is fire-and-forget**: opens mailto, stamps
  `submittedAt`, but if the user closes the email client without
  sending, the record looks submitted regardless.
- **Email / WhatsApp dispatch is simulated**: `sentAt` /`deliveredAt` /
  `readAt` is set client-side via `setTimeout`, not via real receipts.
- **Supabase is a declared dependency but not wired** — code is ready
  for a backend swap but the integration hasn't been built.
- **No automated tests**: only `tsc --noEmit` and ESLint run in CI; no
  unit / integration tests.

---

## Where the code lives

```
src/
├── App.tsx                       # router + global AI assistant mount
├── pages/
│   ├── LoginPage.tsx             # role login + self-registration + AI
│   ├── AuditorCoordinator/       # 18 pages
│   ├── LeadAuditor/              # 8 pages (incl. Auditor Approvals)
│   ├── Auditor/                  # 6 pages
│   ├── AuditClient/              # 5 pages (the Auditee surface)
│   └── Management/               # 4 pages
├── components/                   # 24 shared widgets
│   ├── BackButton.tsx            # universal back button (every role)
│   ├── AIAssistant.tsx           # the chat panel
│   ├── AISettings.tsx            # BYO API key
│   ├── QmicsLogo.tsx
│   ├── Sidebar.tsx               # role-aware nav with dark-mode toggle
│   ├── CoordinatorGreeting.tsx
│   ├── StandardPicker.tsx
│   ├── CertificationsPicker.tsx
│   ├── EmailTemplateEditor.tsx
│   ├── AvailabilityCalendar.tsx
│   ├── RatingStars.tsx
│   ├── EmptyState.tsx + Skeleton.tsx
│   └── ...                       # 11 more
├── ai/
│   ├── aiAssistantEngine.ts      # rule-based intent engine + KB
│   ├── claudeClient.ts           # BYO-key Anthropic wrapper
│   ├── auditorMatcher.ts         # smart auditor scoring
│   └── correctiveActions.ts      # rule-based + AI suggester
├── utils/                        # 11 helpers
│   ├── clientCode.ts             # auto-allocates CMS-YYYY-NNNN codes
│   ├── duplicateDetect.ts        # email / phone duplicate finder
│   ├── validators.ts             # GSTIN / CIN / PAN / email / phone
│   ├── qrcode.ts                 # Reed-Solomon QR generator
│   ├── emailTemplates.ts         # template store + var renderer
│   ├── workflow.ts               # cross-role state machine
│   └── ...
└── styles/                       # CSS modules per role
    ├── theme.css                 # CSS variable tokens (light + dark)
    ├── AuditorCoordinator/       # ...
    └── ...
```

---

## Where it shines vs. where it should grow

**Shines today** — for a demo / proof-of-concept / sales tool, CertMS is
genuinely impressive: end-to-end pipeline with role-based access,
realistic certification workflow including version control of audit
scope, conditional checklists, calendar conflict detection, certificate
PDFs with QR codes, and a real AI assistant. A new salesperson could
walk a prospect through the whole certification lifecycle without
touching anything else.

**Needs work for production**:

1. **Backend.** Either wire the existing Supabase dependency to a real
   project (clients, auditors, schedules, certificates as tables with
   RLS policies per role), or build a thin API. Without this, multi-user
   collaboration is impossible.
2. **Authentication.** Login is hard-coded credentials. A real deployment
   needs SSO / Supabase Auth / Clerk / Auth0.
3. **File storage.** Move blobs out of localStorage to S3 / Supabase
   Storage; keep just the URL on each record.
4. **Email / WhatsApp.** Replace the mailto / wa.me hand-offs with a
   real notification service (Postmark, SendGrid, Twilio).
5. **Audit logs.** Persist a global event stream (who did what, when,
   why) so the certification body can demonstrate process compliance.
6. **Tests.** Even a minimal Vitest suite covering the workflow engine,
   validators, and the AI engine's intent matching would prevent
   regressions during ongoing feature work.
7. **Status enum unification.** A single `src/types/statuses.ts` file
   that every page imports — eliminates the whole class of
   "Approved" vs "Client Approved" miscount bugs.

---

## TL;DR

CertMS is a 31k-line, type-safe, role-aware React SPA that already
covers the certification body's full operational lifecycle — enquiry,
registration, scheduling, audit, report, certificate, surveillance —
with built-in AI assistance and a polished UI. It's currently a
client-only application keyed entirely off `localStorage`; bolting on a
backend, real auth, and real notifications is the obvious next chapter.

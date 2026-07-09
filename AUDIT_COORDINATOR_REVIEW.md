# Audit Coordinator — Workflow & Gap Review

Scope: six pages reachable from the Audit Coordinator role's two top-level sidebar groups
**Audit System Data** (Dashboard, Audit Scope, Auditor Profiles, Audit Checklists) and
**Client Registration** (Application, Client Registration). For each page: the user-visible
workflow, the data it touches, and concrete recommended changes. A final cross-cutting
section flags issues that span more than one page.

---

## 1. Dashboard
**Path:** `/auditor-coordinator/dashboard` · `src/pages/AuditorCoordinator/Dashboard/index.tsx`

### Workflow
1. On load, the Coordinator sees a hero greeting (with avatar, time, today's date), four
   KPI cards (Auditors, Clients, Schedules, Certifications), a status donut, a Quick
   Actions grid, a Recent Audits table, a Recent Clients panel, and an Audit (Standards)
   Coverage bar chart.
2. KPI cards are clickable and navigate into the relevant page.
3. Stats refresh every 60 seconds from localStorage.
4. The Recent Clients panel rows are clickable and route to Client Registration.

### Data
Reads `cms_auditors`, `cms_client_registrations`, `cms_audit_schedules`,
`cms_audit_certifications`, `cms_audit_scopes`, `cms_audit_checklists`. Pulls profile via
the `coordinator-profile-updated` event.

### Gaps & recommended updates
- **P1 — "approved clients" KPI undercounts.** Line 111 filters
  `clients.filter(c => c.status === 'Client Approved')`. Client Registration was just
  changed to write `'Approved'` (not `'Client Approved'`). Newly-approved clients are
  no longer counted. Fix: filter on `c.status === 'Approved' || c.status === 'Client Approved'`
  (back-compat) until legacy seed rows are migrated.
- **P1 — date field fan-out.** Lines 92-94 and 128-129 try `s.date || s.scheduledDate
  || s.startDate`. Standardise schedule rows on `scheduledDate`.
- **P2 — no "stale data" indicator.** Dashboard refreshes every 60s but doesn't show
  the last-refresh timestamp; users can't tell if it's stuck.
- **P2 — KPI tile click areas are inconsistent.** The four KPI cards navigate, but
  the donut and coverage chart don't. Make all KPI surfaces clickable for consistency.

---

## 2. Audit Scope
**Path:** `/auditor-coordinator/audit-scope` · `src/pages/AuditorCoordinator/AuditScope.tsx`

### Workflow
1. List of scopes (name, description, standard, current version, actions) loaded from
   localStorage.
2. Add Scope opens a form with name, description, and a `StandardPicker`.
3. Edit shows the current values plus an optional Revision Note. If any field changed,
   a new version is appended to the in-memory version history.
4. History icon opens a side modal: list of revisions on the left, redline diff between
   any two revisions on the right.

### Data
Stores scopes under `cms_audit_scopes`. Each scope has an `id`, `scopeName`,
`description`, `standard`, and `currentVersion`. Version history is held in a separate
in-process store keyed by `audit_scope:${id}`.

### Gaps & recommended updates
- **P1 — version history is not persisted.** Reload the page and every previous
  revision is gone. Wrap the version-history utility in `localStorage.setItem` /
  `getItem` keyed under `cms_audit_scope_versions`.
- **P2 — no author attribution.** A revision note exists but there's no `editedBy`
  field. Persist the coordinator's name (already available from `loadProfile`) on
  every version.
- **P2 — long descriptions truncate.** Add a "View" button or popover to inspect
  the full description without entering edit mode.

---

## 3. Auditor Profiles
**Path:** `/auditor-coordinator/auditor-profiles` ·
`src/pages/AuditorCoordinator/AuditorProfiles.tsx`

### Workflow
1. Coordinator searches and lists all auditors. A blue info banner explains: every
   create/edit produces a Pending Approval profile until the Lead Auditor validates.
2. Add Auditor opens a form with name, email, role, specialization, department,
   certifications, and a 0-5 skill matrix across eight ISO families.
3. Submit sets `status: 'Inactive'` and `approvalStatus: 'Pending Approval'`.
4. Edit re-opens the same form. On save, `approvalStatus` resets to Pending and
   `approvedBy/At/Notes` are cleared, so any change re-triggers Lead Auditor review.
5. Calendar icon opens a 21-day availability modal. History icon opens a rating
   modal where ratings can be added/removed.
6. Approval column is informational here; Lead Auditor approval happens in the new
   `Auditor Approvals` page in the Lead Auditor role.

### Data
Stores in `cms_auditors_data`. Auditor record includes `approvalStatus`,
`approvedBy`, `approvedAt`, `approvalNotes` (added recently for the Lead Auditor
flow).

### Gaps & recommended updates
- **P1 — silent reset on edit.** Every edit (even a typo fix in email) resets
  approval state to Pending. Add a confirmation dialog: "Editing will require
  Lead Auditor re-approval — continue?" Or scope-detect: if only `email` /
  `phone` changed, keep approval status.
- **P2 — no event broadcast on approval state change.** Lead Auditor's approval
  page dispatches `cms-auditors-updated`, but Coordinator's profiles page doesn't
  listen for it. Add a `window.addEventListener('cms-auditors-updated', refresh)`.
- **P2 — Skill family vs Certification name mismatch.** Skills use `'ISO 9001'`
  but Certifications use `'ISO 9001:2015'` (with year). They should normalise so
  the smart auditor matcher can correlate them.
- **P2 — Ratings modal accepts any score.** The score input is a range with
  step 0.5 but no manual clamp; a stale `state` value of `'abc'` produces NaN.
  Coerce on save.

---

## 4. Audit Checklists
**Path:** `/auditor-coordinator/audit-checklists` ·
`src/pages/AuditorCoordinator/AuditChecklists.tsx`

### Workflow
1. Table of checklists with name, type, standard, items count, status, created date.
2. Search + status filter. Add Checklist opens a fullscreen editor.
3. Editor lets the user add questions one-by-one, drag to reorder, attach optional
   follow-up logic ("If answer = Yes/No/N/A → ask follow-up"), and clone items
   from any existing template via a header dropdown.
4. Bulk multi-select + Delete Selected works on items inside the editor.
5. Bulk-Add (paste many questions at once) was removed at user request — clean.

### Data
**No localStorage persistence.** All state is in-memory. Reloading loses changes.

### Gaps & recommended updates
- **P1 — persist checklists.** Add `STORAGE_KEY = 'cms_audit_checklists'`,
  hydrate on mount, save on every state mutation. The Dashboard already reads
  this key but it stays empty since the page never writes.
- **P1 — Template upload is a stub.** The Upload Template button exists but no
  file is parsed. Either implement xlsx parsing via SheetJS (already used in
  the certificate page) or hide the button until done.
- **P2 — `classification` and `evidence` fields exist on `ChecklistItem`** but
  are never displayed or edited. Either add UI or remove from the type.
- **P2 — Drag handle uses `GripVertical`** (good). Keyboard reorder for
  accessibility (alt+up/down) is missing.

---

## 5. Application
**Path:** `/auditor-coordinator/application-dispatch` ·
`src/pages/AuditorCoordinator/ApplicationDispatch.tsx`

### Workflow
1. Three top-level tabs: **Client Enquiry**, **Receive Application**,
   **Review Application**.
2. **Client Enquiry** has nested sub-tabs **Enquiries** and **Sent Application**.
   - Enquiries renders the standalone `ClientEnquiry` surface (stat cards,
     status filter, table, "+ New Enquiry", details modal, Convert-to-client).
   - Sent Application shows: Client Name, Organization, Email, Application Date,
     Application Status (Submitted/Pending pills), Application Attachment,
     Agreement, Actions. File cells use the `FileCell` sub-component
     (upload/replace/clear, max 3 MB, base64 dataUrl).
3. **Receive Application** shows: Client Name, Organization, Email, Application
   Date, Application Status (Received/Pending pills), Actions.
4. **Review Application** shows: Client Name, Organization, Contact Name, Email,
   Application Review Date, Application Status (3-state Approve/Hold/Rejected
   pills), Actions.

### Data
Stores in `cms_application_dispatch_v7`. Status union now includes
`'Submitted' | 'Pending' | 'Sent' | 'Received' | 'Approved' | 'Rejected' | 'Hold'`.
Each row also carries `contactName`, `reviewDate`, `attachment`, `agreement`,
plus delivery telemetry (`sentAt`, `deliveredAt`, `readAt`).

### Gaps & recommended updates
- **P1 — Bulk Dispatch modal is dead UI.** The trigger button was removed but
  the entire bulk-dispatch state, modal, and selectedIds checkbox machinery still
  ship in the bundle (~150 lines). Either fully delete or restore with a
  re-entry path.
- **P1 — Storage quota risk.** A row can carry two ~3 MB base64 blobs (attachment
  + agreement). Twenty rows could exceed the localStorage quota. Add an aggregate
  size guard or migrate large blobs to IndexedDB.
- **P2 — Review filter is broad.** It now lists everything except `'Pending'`
  on the Review tab. Add a status filter row similar to Client Enquiry so
  reviewers can isolate Hold or Rejected.
- **P2 — Sent Application search hides on the Enquiries sub-tab** — correct —
  but the search **does not search file names** of the attachment/agreement;
  consider including `attachment.name` and `agreement.name` in the haystack.
- **P2 — Telemetry is purely simulated.** `sentAt`/`deliveredAt`/`readAt` is
  set by `setTimeout` in client-side code, not real receipts. Either wire to a
  real backend or label clearly as "demo telemetry".

---

## 6. Client Registration
**Path:** `/auditor-coordinator/client-registration` ·
`src/pages/AuditorCoordinator/ClientRegistration.tsx`

### Workflow
1. Table of clients (logo, code, organization, contact name, registration number,
   audit type, standard, audit status, actions).
2. Add opens a form with auto-allocated Client Code, Logo upload (≤250 KB),
   Organization Name, Contact Person, **Email** + **Phone / Mobile** (now
   side-by-side, immediately after Contact Person), Registration Number,
   GSTIN/CIN/PAN with live validation, Audit Type, Standard, **Audit Status
   (Pending / Approved only)**, Certification Contract attachment, **Attach
   Agreement** attachment.
3. Submit creates / updates and stores in `cms_client_registrations`.
4. Submit-to-Email row action opens a `mailto:` to the client with a prefilled
   body and stamps `submittedAt`.
5. Mark-as-Approved row action (only visible after submit) prompts for a
   client-reply note and sets `status: 'Approved'`, `clientRespondedAt`,
   `clientResponseNote`.
6. View / Download generate the Annexure-13 contract HTML / Word file.
7. Duplicate detection chip appears if the email or phone already exists.

### Data
Stores in `cms_client_registrations`. Sync also pulls received applications
from `cms_application_dispatch_v4` (legacy key — see below).

### Gaps & recommended updates
- **P1 — Two dispatch storage keys.** ClientRegistration syncs from
  `cms_application_dispatch_v4`, but ApplicationDispatch writes to
  `cms_application_dispatch_v7`. Newly-received applications never appear in
  ClientRegistration's auto-sync. Fix: change line 30 of ClientRegistration
  to read `cms_application_dispatch_v7`.
- **P1 — Stale seed status values.** The hard-coded fallback clients use
  `'Client Approved'` and `'Registered'`. The form now only writes
  `'Pending'` / `'Approved'`. Migrate the seeds to the new vocabulary
  (or run a one-time normaliser at load time).
- **P1 — Submit-to-Email stamps `submittedAt` even if the user closes the
  mailto window without sending.** Move the stamp into a confirmation step
  ("I sent the email"), or treat `submittedAt` as "queued, not confirmed".
- **P2 — Agreement attachment stores filename only**, not the file content
  (consistent with the existing Certification Contract field). Both should be
  upgraded to base64 dataUrl storage like the Sent Application table does, so
  the file is downloadable later.
- **P2 — Inline field errors are partially wired.** Validators run for
  GSTIN/CIN/PAN/email/phone but the message rendering helper is only used
  near the IDs row. Wire `fieldError(...)` next to email & phone too.
- **P2 — Logo base64 in localStorage.** With many clients this can blow the
  storage quota. Migrate to IndexedDB or a remote URL.

---

## Cross-page issues

### Status enum fragmentation
Three pages use overlapping but inconsistent status vocabularies:

| Page | Status values |
|---|---|
| Dashboard (read-only) | `Client Approved` (filter only) |
| ClientRegistration | `Pending`, `Approved` (legacy: `Client Approved`, `Registered`, `Active`) |
| ApplicationDispatch | `Submitted`, `Pending`, `Sent`, `Received`, `Approved`, `Rejected`, `Hold` |
| AuditorProfiles | `Active` / `Inactive` + `Pending Approval` / `Approved` / `Rejected` |

**Recommendation:** create `src/types/statuses.ts` with three explicit enums
(`ApplicationStatus`, `ClientStatus`, `AuditorApprovalStatus`) and migrate every
page to import them. Update the Dashboard's "Approved" KPI to count `Approved`
and the legacy `Client Approved` for back-compat.

### Field naming drift
- `clientType`, `auditType`, `applicationType`, `specialization` are used for
  similar-but-different concepts. Standardise on `auditType`.
- `clientName`, `contactPerson`, `contactName` overlap. `contactPerson` (in
  Registration) and `contactName` (in Dispatch Review) refer to the same human.
  Standardise on `contactName`.
- `dispatchedDate`, `applicationDate`, `reviewDate`, `submittedAt`,
  `clientRespondedAt`, `registrationDate`, `joinDate`, `createdAt` — there's no
  shared timestamp convention. Settle on `<verb>At` (camelCase ISO).

### Cross-page data flow
- **Enquiry → Registration**: Client Enquiry's "Convert" writes a new client to
  `cms_client_registrations`. There's no back-link from the registration to the
  original enquiry, and editing the enquiry afterwards doesn't update the synced
  client. Add a `sourceEnquiryId` field on the client record (the enquiry already
  stores `convertedClientId` in the other direction) and optionally re-sync on
  edit.
- **Application Dispatch → Client Registration**: see the v4/v7 storage-key
  mismatch flagged above.
- **Auditor Profile (pending) → Lead Auditor approval**: changes from the Lead
  Auditor side broadcast `cms-auditors-updated`, but neither the Coordinator's
  profiles page nor the Dashboard listens. Add listeners.

### Audit trails
- Audit Scope has versioning (in-memory only — fix per page #2).
- Auditor Approvals has a 25-entry decision log (good).
- Client Registration has `submittedAt` + `clientRespondedAt` but no full history
  (e.g. resends, status flip-flops).
- Application Dispatch has a `deliveryHistory` array (good).
- Checklists have no audit trail at all.

**Recommendation:** adopt a uniform `events: Array<{at, by, action, note?}>` field
on every entity that benefits from history.

### Storage quota
Logo base64 + Application Attachment + Agreement + Certificate PDF (Certificate
Delivery page) all live in the 5-10 MB localStorage budget. A single noisy demo
session could fill it. Add a global quota check helper and consider IndexedDB
migration for binary blobs.

---

## Priority shortlist

1. **Fix Dashboard's "Approved" KPI undercount** (one-line change).
2. **Fix ClientRegistration's stale `cms_application_dispatch_v4` lookup** to use
   the current `_v7` key (one-line change).
3. **Persist Audit Checklists to localStorage** (small refactor, ~15 lines).
4. **Persist Audit Scope version history** (small refactor, ~10 lines).
5. **Unify status enums via `src/types/statuses.ts`** (small file + sweeping
   imports).
6. **Confirmation step before stamping `submittedAt` in Client Registration's
   Submit-to-Email flow** (~10 lines).
7. **Aggregate-size guard before saving file blobs to localStorage**.

The first two are one-liners that cause real visible miscounts today and should
be done immediately.

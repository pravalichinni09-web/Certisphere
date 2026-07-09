import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  Save,
  Send,
  Building2,
  FileText,
  Users as UsersIcon,
  ShieldCheck,
  Globe,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Printer,
} from 'lucide-react';

/* =================================================================
   QCS Application Form — Form Q1 digital edition
   Used by both the Audit Coordinator (preview / view submission)
   and the Auditee (fill & submit).
   ================================================================= */

export type QCSFormMode = 'fill' | 'view' | 'preview';

export interface QCSDepartmentRow {
  name: string;
  permanent: string;
  nonPermanent: string;
  total: string;
}

export interface QCSBranchOffice {
  address: string;
  activities: string;
}

export interface QCSApplication {
  certificationType: string;          // Initial / Re-certification / Transfer
  organizationName: string;
  organizationType: string;            // Company / Partnership / Proprietorship / Other
  organizationTypeOther: string;
  headOffice: string;
  mainOperativeSite: string;
  topManagementName: string;
  topManagementMobile: string;
  contactPersonName: string;
  contactMobile: string;
  contactEmail: string;
  contactWebsite: string;
  activityDetails: string;
  desiredScope: string;
  exclusions: string;
  schemes: string[];                    // ['ISO 9001', ...]
  accredited: string;
  unaccredited: string;
  otherCertified: string;               // 'No' | 'Yes'
  otherCertifiedDetails: string;
  imsDetails: string;
  legalRequirements: string;
  safetyConditions: string;
  language: string;
  outsourcedProcesses: string;
  technicalResources: string;
  consultantName: string;
  consultantMobile: string;
  consultantAddress: string;
  consultantEmail: string;
  departments: QCSDepartmentRow[];
  shifts: { one: string; two: string; three: string; total: string };
  branchOffices: QCSBranchOffice[];
  transferCB: string;
  transferLastAudit: string;
  transferReason: string;
  transferSuspension: string;           // 'Yes' | 'No'
  transferSuspensionReason: string;
  fsmsProcessLines: string;
  fsmsHaccpStudies: string;
  envStatutory: string;
  envLicenses: string;
  envEmissionTypes: string;
  envMeasures: string;
  envIncidents: string;
  envOther: string;
  ohsRisks: string;
  isoSoA: string;
  isoRiskLevel: string;
  authorizedRepresentative: string;
  signatureName: string;
  date: string;
  acknowledged: boolean;
  attachmentsChecked: string[];         // which attachment items the user has prepared
}

const SCHEMES = ['ISO 9001', 'ISO 14001', 'ISO 22000', 'ISO 27001', 'OHSMS 45001', 'HACCP'];

const DEFAULT_DEPARTMENTS: QCSDepartmentRow[] = [
  { name: 'Design / Research Development', permanent: '', nonPermanent: '', total: '' },
  { name: 'Production & service provision', permanent: '', nonPermanent: '', total: '' },
  { name: 'Quality Control / Assurance', permanent: '', nonPermanent: '', total: '' },
  { name: 'Stores / Warehouse', permanent: '', nonPermanent: '', total: '' },
  { name: 'Purchase', permanent: '', nonPermanent: '', total: '' },
  { name: 'Marketing', permanent: '', nonPermanent: '', total: '' },
  { name: 'Office & Administrative staff', permanent: '', nonPermanent: '', total: '' },
  { name: 'Unskilled personnel', permanent: '', nonPermanent: '', total: '' },
  { name: 'Personnel doing repetitive process (cleaners, security, transport, sales, call centers)', permanent: '', nonPermanent: '', total: '' },
  { name: 'Others (Please specify)', permanent: '', nonPermanent: '', total: '' },
];

const ATTACHMENT_ITEMS = [
  'Organization Chart',
  'Previous Certificate (for transfer only)',
  'Previous Audit report (for transfer only)',
  'Other Useful information, if any',
];

export const QCS_STORAGE_KEY = 'cms_qcs_applications_v1';

export const blankQCSApplication = (seed?: Partial<QCSApplication>): QCSApplication => ({
  certificationType: '',
  organizationName: '',
  organizationType: '',
  organizationTypeOther: '',
  headOffice: '',
  mainOperativeSite: '',
  topManagementName: '',
  topManagementMobile: '',
  contactPersonName: '',
  contactMobile: '',
  contactEmail: '',
  contactWebsite: '',
  activityDetails: '',
  desiredScope: '',
  exclusions: '',
  schemes: [],
  accredited: '',
  unaccredited: '',
  otherCertified: 'No',
  otherCertifiedDetails: '',
  imsDetails: '',
  legalRequirements: '',
  safetyConditions: '',
  language: '',
  outsourcedProcesses: '',
  technicalResources: '',
  consultantName: '',
  consultantMobile: '',
  consultantAddress: '',
  consultantEmail: '',
  departments: DEFAULT_DEPARTMENTS.map((d) => ({ ...d })),
  shifts: { one: '', two: '', three: '', total: '' },
  branchOffices: [{ address: '', activities: '' }, { address: '', activities: '' }],
  transferCB: '',
  transferLastAudit: '',
  transferReason: '',
  transferSuspension: 'No',
  transferSuspensionReason: '',
  fsmsProcessLines: '',
  fsmsHaccpStudies: '',
  envStatutory: '',
  envLicenses: '',
  envEmissionTypes: '',
  envMeasures: '',
  envIncidents: '',
  envOther: '',
  ohsRisks: '',
  isoSoA: '',
  isoRiskLevel: '',
  authorizedRepresentative: '',
  signatureName: '',
  date: new Date().toISOString().split('T')[0],
  acknowledged: false,
  attachmentsChecked: [],
  ...seed,
});

interface StoredQCSRecord {
  dispatchId: number | string;
  application: QCSApplication;
  submittedAt?: string;
  updatedAt: string;
}

export const loadQCSRecord = (dispatchId: number | string): StoredQCSRecord | null => {
  try {
    const raw = localStorage.getItem(QCS_STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as StoredQCSRecord[];
    if (!Array.isArray(arr)) return null;
    return arr.find((r) => String(r.dispatchId) === String(dispatchId)) || null;
  } catch {
    return null;
  }
};

export const saveQCSRecord = (
  dispatchId: number | string,
  application: QCSApplication,
  submitted = false
): void => {
  try {
    const raw = localStorage.getItem(QCS_STORAGE_KEY);
    const arr: StoredQCSRecord[] = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    const now = new Date().toISOString();
    const existingIdx = list.findIndex((r) => String(r.dispatchId) === String(dispatchId));
    const record: StoredQCSRecord = {
      dispatchId,
      application,
      submittedAt: submitted ? now : list[existingIdx]?.submittedAt,
      updatedAt: now,
    };
    if (existingIdx >= 0) list[existingIdx] = record;
    else list.unshift(record);
    localStorage.setItem(QCS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
};

/* =================================================================
   The form modal
   ================================================================= */

interface QCSApplicationFormProps {
  dispatchId: number | string;
  mode: QCSFormMode;
  prefill?: Partial<QCSApplication>;
  onClose: () => void;
  onSubmitted?: () => void;
}

const QCSApplicationForm: React.FC<QCSApplicationFormProps> = ({
  dispatchId,
  mode,
  prefill,
  onClose,
  onSubmitted,
}) => {
  const stored = useMemo(() => loadQCSRecord(dispatchId), [dispatchId]);

  const [form, setForm] = useState<QCSApplication>(
    () => stored?.application ?? blankQCSApplication(prefill)
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    type: true,
    org: true,
    cert: true,
    legal: false,
    consultant: false,
    employees: false,
    branches: false,
    transfer: false,
    fsms: false,
    iso14001: false,
    ohs: false,
    iso27001: false,
    ack: true,
    attach: false,
  });
  const [savedAt, setSavedAt] = useState<string | null>(stored?.updatedAt || null);

  const readOnly = mode === 'view' || mode === 'preview';

  /* ---------- Field updaters ---------- */
  const setF = <K extends keyof QCSApplication>(key: K, value: QCSApplication[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const toggleScheme = (s: string) =>
    setForm((p) => ({
      ...p,
      schemes: p.schemes.includes(s) ? p.schemes.filter((x) => x !== s) : [...p.schemes, s],
    }));

  const updateDept = (i: number, k: keyof QCSDepartmentRow, v: string) =>
    setForm((p) => ({
      ...p,
      departments: p.departments.map((d, idx) => (idx === i ? { ...d, [k]: v } : d)),
    }));

  const addBranch = () =>
    setForm((p) => ({
      ...p,
      branchOffices: [...p.branchOffices, { address: '', activities: '' }],
    }));

  const removeBranch = (idx: number) =>
    setForm((p) => ({
      ...p,
      branchOffices: p.branchOffices.filter((_, i) => i !== idx),
    }));

  const updateBranch = (idx: number, k: keyof QCSBranchOffice, v: string) =>
    setForm((p) => ({
      ...p,
      branchOffices: p.branchOffices.map((b, i) => (i === idx ? { ...b, [k]: v } : b)),
    }));

  const toggleAttachment = (item: string) =>
    setForm((p) => ({
      ...p,
      attachmentsChecked: p.attachmentsChecked.includes(item)
        ? p.attachmentsChecked.filter((x) => x !== item)
        : [...p.attachmentsChecked, item],
    }));

  /* ---------- Department totals auto-calc ---------- */
  const totalEmployees = useMemo(() => {
    let perm = 0;
    let nonPerm = 0;
    form.departments.forEach((d) => {
      perm += Number(d.permanent) || 0;
      nonPerm += Number(d.nonPermanent) || 0;
    });
    return { perm, nonPerm, total: perm + nonPerm };
  }, [form.departments]);

  /* ---------- Save & submit ---------- */
  const handleSaveDraft = () => {
    saveQCSRecord(dispatchId, form, false);
    setSavedAt(new Date().toISOString());
  };

  const handleSubmit = () => {
    if (!form.acknowledged) {
      alert('Please tick the acknowledgement box at the bottom before submitting.');
      return;
    }
    if (!form.organizationName.trim()) {
      alert('Please enter the Organization Name.');
      return;
    }
    if (!form.certificationType) {
      alert('Please select a Certification Type (Initial / Re-certification / Transfer).');
      return;
    }
    saveQCSRecord(dispatchId, form, true);
    setSavedAt(new Date().toISOString());
    if (onSubmitted) onSubmitted();
    alert('QCS application form submitted to the Audit Coordinator. Thank you!');
    onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  /* ---------- Auto-save every 30s in fill mode ---------- */
  useEffect(() => {
    if (mode !== 'fill') return;
    const t = window.setInterval(() => {
      saveQCSRecord(dispatchId, form, false);
      setSavedAt(new Date().toISOString());
    }, 30_000);
    return () => window.clearInterval(t);
  }, [mode, dispatchId, form]);

  const toggle = (key: string) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  /* ---------- Render ---------- */
  return (
    <div style={overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        {/* Header */}
        <div style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} color="#2563eb" />
              QCS Application Form — Form Q1
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              {mode === 'fill'
                ? 'Please fill correctly to enable us understand your requirements and issue a formal offer.'
                : mode === 'preview'
                ? 'Template preview — this is the digital form clients receive.'
                : 'Submission from client — read-only view.'}
              {savedAt && (
                <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>
                  · Saved {new Date(savedAt).toLocaleTimeString()}
                </span>
              )}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
              No information shall be disclosed to any third party without the written consent of
              the customer in conformity with QCS Policy & Procedures.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handlePrint} title="Print this form" style={iconBtn}>
              <Printer size={15} />
            </button>
            <button onClick={onClose} title="Close" style={iconBtn}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={body}>
          {/* Certification type */}
          <Section
            id="type"
            title="Certification Type *"
            icon={<ShieldCheck size={14} />}
            open={openSections.type}
            onToggle={() => toggle('type')}
          >
            <RadioRow
              value={form.certificationType}
              onChange={(v) => setF('certificationType', v)}
              options={['Initial Certification', 'Re-certification', 'Transfer']}
              disabled={readOnly}
            />
          </Section>

          {/* Organization */}
          <Section
            id="org"
            title="Organization Information"
            icon={<Building2 size={14} />}
            open={openSections.org}
            onToggle={() => toggle('org')}
          >
            <Grid>
              <Field label="Organization Name *" full>
                <input value={form.organizationName} onChange={(e) => setF('organizationName', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Organization Type" full>
                <RadioRow
                  value={form.organizationType}
                  onChange={(v) => setF('organizationType', v)}
                  options={['Company', 'Partnership', 'Proprietorship', 'Other']}
                  disabled={readOnly}
                />
                {form.organizationType === 'Other' && (
                  <input
                    value={form.organizationTypeOther}
                    onChange={(e) => setF('organizationTypeOther', e.target.value)}
                    placeholder="Specify other type"
                    style={{ ...inp, marginTop: 6 }}
                    disabled={readOnly}
                  />
                )}
              </Field>
              <Field label="Head Office / Registered Office" full>
                <textarea value={form.headOffice} onChange={(e) => setF('headOffice', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Main Operative Site (including temporary site if any)" full>
                <textarea value={form.mainOperativeSite} onChange={(e) => setF('mainOperativeSite', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Top Management Name">
                <input value={form.topManagementName} onChange={(e) => setF('topManagementName', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Mobile">
                <input value={form.topManagementMobile} onChange={(e) => setF('topManagementMobile', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Contact Person Name">
                <input value={form.contactPersonName} onChange={(e) => setF('contactPersonName', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Mobile / Tel" icon={<Phone size={12} />}>
                <input value={form.contactMobile} onChange={(e) => setF('contactMobile', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Email" icon={<Mail size={12} />}>
                <input type="email" value={form.contactEmail} onChange={(e) => setF('contactEmail', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Website" icon={<Globe size={12} />}>
                <input value={form.contactWebsite} onChange={(e) => setF('contactWebsite', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Details of activity / Products / Process / Services" full>
                <textarea value={form.activityDetails} onChange={(e) => setF('activityDetails', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Desired Scope of Certification" full>
                <textarea value={form.desiredScope} onChange={(e) => setF('desiredScope', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Exclusion if any and justification" full>
                <textarea value={form.exclusions} onChange={(e) => setF('exclusions', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
            </Grid>
          </Section>

          {/* Certification scheme */}
          <Section
            id="cert"
            title="Certification Scheme & Accreditation"
            icon={<ShieldCheck size={14} />}
            open={openSections.cert}
            onToggle={() => toggle('cert')}
          >
            <Grid>
              <Field label="Certification Scheme Applied (tick all that apply)" full>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SCHEMES.map((s) => {
                    const on = form.schemes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => !readOnly && toggleScheme(s)}
                        disabled={readOnly}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 14,
                          border: '1px solid ' + (on ? '#4338ca' : '#cbd5e1'),
                          background: on ? '#eef2ff' : '#fff',
                          color: on ? '#4338ca' : '#475569',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: readOnly ? 'default' : 'pointer',
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Accreditation — Accredited body">
                <input value={form.accredited} onChange={(e) => setF('accredited', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Un-accredited body">
                <input value={form.unaccredited} onChange={(e) => setF('unaccredited', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Certified in any other management systems?" full>
                <RadioRow
                  value={form.otherCertified}
                  onChange={(v) => setF('otherCertified', v)}
                  options={['No', 'Yes']}
                  disabled={readOnly}
                />
                {form.otherCertified === 'Yes' && (
                  <input
                    value={form.otherCertifiedDetails}
                    onChange={(e) => setF('otherCertifiedDetails', e.target.value)}
                    placeholder="Specify"
                    style={{ ...inp, marginTop: 6 }}
                    disabled={readOnly}
                  />
                )}
              </Field>
              <Field label="For IMS certification — details of integrated systems (internal audit, MRM, other core processes)" full>
                <textarea value={form.imsDetails} onChange={(e) => setF('imsDetails', e.target.value)} rows={3} style={textarea} disabled={readOnly} />
              </Field>
            </Grid>
          </Section>

          {/* Legal, safety, technical */}
          <Section
            id="legal"
            title="Legal, Safety & Technical"
            icon={<AlertTriangle size={14} />}
            open={openSections.legal}
            onToggle={() => toggle('legal')}
          >
            <Grid>
              <Field label="Legal and statutory requirements related to product" full>
                <textarea value={form.legalRequirements} onChange={(e) => setF('legalRequirements', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Safety conditions for auditors">
                <input value={form.safetyConditions} onChange={(e) => setF('safetyConditions', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Language">
                <input value={form.language} onChange={(e) => setF('language', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Outsourced processes (if any)" full>
                <textarea value={form.outsourcedProcesses} onChange={(e) => setF('outsourcedProcesses', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Description of Technical Resources (e.g. machinery)" full>
                <textarea value={form.technicalResources} onChange={(e) => setF('technicalResources', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
            </Grid>
          </Section>

          {/* Consultant */}
          <Section
            id="consultant"
            title="Consultant / Organisation"
            icon={<UsersIcon size={14} />}
            open={openSections.consultant}
            onToggle={() => toggle('consultant')}
          >
            <Grid>
              <Field label="Name">
                <input value={form.consultantName} onChange={(e) => setF('consultantName', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Mobile No.">
                <input value={form.consultantMobile} onChange={(e) => setF('consultantMobile', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Address" full>
                <textarea value={form.consultantAddress} onChange={(e) => setF('consultantAddress', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Email" full>
                <input type="email" value={form.consultantEmail} onChange={(e) => setF('consultantEmail', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
            </Grid>
          </Section>

          {/* Employees */}
          <Section
            id="employees"
            title="Employees by Department"
            icon={<UsersIcon size={14} />}
            open={openSections.employees}
            onToggle={() => toggle('employees')}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Department</th>
                    <th style={{ ...th, textAlign: 'right' }}>Permanent</th>
                    <th style={{ ...th, textAlign: 'right' }}>Non-Permanent</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {form.departments.map((d, i) => {
                    const rowTotal = (Number(d.permanent) || 0) + (Number(d.nonPermanent) || 0);
                    return (
                      <tr key={i}>
                        <td style={td}>{d.name}</td>
                        <td style={td}><input type="number" min="0" value={d.permanent} onChange={(e) => updateDept(i, 'permanent', e.target.value)} style={numInp} disabled={readOnly} /></td>
                        <td style={td}><input type="number" min="0" value={d.nonPermanent} onChange={(e) => updateDept(i, 'nonPermanent', e.target.value)} style={numInp} disabled={readOnly} /></td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#475569' }}>{rowTotal || ''}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                    <td style={{ ...td, fontWeight: 700 }}>TOTAL Staff Strength</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{totalEmployees.perm || ''}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{totalEmployees.nonPerm || ''}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{totalEmployees.total || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>No. of Shifts and Staff Strength</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ShiftInput label="One" value={form.shifts.one} onChange={(v) => setF('shifts', { ...form.shifts, one: v })} disabled={readOnly} />
                <ShiftInput label="Two" value={form.shifts.two} onChange={(v) => setF('shifts', { ...form.shifts, two: v })} disabled={readOnly} />
                <ShiftInput label="Three" value={form.shifts.three} onChange={(v) => setF('shifts', { ...form.shifts, three: v })} disabled={readOnly} />
                <ShiftInput label="Total" value={form.shifts.total} onChange={(v) => setF('shifts', { ...form.shifts, total: v })} disabled={readOnly} />
              </div>
            </div>
          </Section>

          {/* Branches */}
          <Section
            id="branches"
            title="Branch Offices / Other Sites to be Certified"
            icon={<Building2 size={14} />}
            open={openSections.branches}
            onToggle={() => toggle('branches')}
          >
            {form.branchOffices.map((b, i) => (
              <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 12 }}>Site {i + 1}</strong>
                  {!readOnly && form.branchOffices.length > 1 && (
                    <button onClick={() => removeBranch(i)} style={trashBtn} title="Remove site">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <Grid>
                  <Field label="Site address" full>
                    <textarea value={b.address} onChange={(e) => updateBranch(i, 'address', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
                  </Field>
                  <Field label="Activity(ies)" full>
                    <input value={b.activities} onChange={(e) => updateBranch(i, 'activities', e.target.value)} style={inp} disabled={readOnly} />
                  </Field>
                </Grid>
              </div>
            ))}
            {!readOnly && (
              <button onClick={addBranch} style={addRowBtn}>
                <Plus size={12} /> Add another site
              </button>
            )}
          </Section>

          {/* Transfer */}
          <Section
            id="transfer"
            title="Transfer Certification (only if applicable)"
            icon={<FileText size={14} />}
            open={openSections.transfer}
            onToggle={() => toggle('transfer')}
          >
            <Grid>
              <Field label="Name of CB (attach certificate)">
                <input value={form.transferCB} onChange={(e) => setF('transferCB', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Latest Audit (attach report)">
                <input value={form.transferLastAudit} onChange={(e) => setF('transferLastAudit', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Reason for Transfer" full>
                <textarea value={form.transferReason} onChange={(e) => setF('transferReason', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Certificate under suspension or threat of suspension?" full>
                <RadioRow
                  value={form.transferSuspension}
                  onChange={(v) => setF('transferSuspension', v)}
                  options={['No', 'Yes']}
                  disabled={readOnly}
                />
                {form.transferSuspension === 'Yes' && (
                  <textarea
                    value={form.transferSuspensionReason}
                    onChange={(e) => setF('transferSuspensionReason', e.target.value)}
                    placeholder="State reason for suspension"
                    rows={2}
                    style={{ ...textarea, marginTop: 6 }}
                    disabled={readOnly}
                  />
                )}
              </Field>
              <Field full>
                <div style={{ fontSize: 11, background: '#fef9c3', border: '1px solid #fde047', color: '#854d0e', padding: 10, borderRadius: 6 }}>
                  <strong>Management of transfers from suspended CAB:</strong> If the former CAB is
                  under suspension or withdrawn status, business registration number, registration
                  number of last certificate, copy of the last certificate with status (active /
                  suspended), management structure, and physical location (to be verified by QCS)
                  must be provided. Copy of manual, procedures, and reason for transfer must be
                  provided to QCS prior to initiation & confirmation of audit. If any of the above
                  conditions are not met or affirmative, transfers will be declined. There can be
                  no change in scope and the previous scope will only prevail as per the last
                  certificate. Declaration form Q1 needs to be additionally filled along with the
                  application.
                </div>
              </Field>
            </Grid>
          </Section>

          {/* FSMS */}
          <Section
            id="fsms"
            title="For FSMS (Food Safety)"
            icon={<ShieldCheck size={14} />}
            open={openSections.fsms}
            onToggle={() => toggle('fsms')}
          >
            <Grid>
              <Field label="Number of process lines">
                <input value={form.fsmsProcessLines} onChange={(e) => setF('fsmsProcessLines', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Number of HACCP Studies">
                <input value={form.fsmsHaccpStudies} onChange={(e) => setF('fsmsHaccpStudies', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
            </Grid>
          </Section>

          {/* ISO 14001 */}
          <Section
            id="iso14001"
            title="ISO 14001 Specific (Environmental)"
            icon={<ShieldCheck size={14} />}
            open={openSections.iso14001}
            onToggle={() => toggle('iso14001')}
          >
            <Grid>
              <Field label="Any statutory / regulatory requirements related to operations" full>
                <textarea value={form.envStatutory} onChange={(e) => setF('envStatutory', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Any licenses / approvals received related to environmental issues" full>
                <textarea value={form.envLicenses} onChange={(e) => setF('envLicenses', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Types of emissions your organisation produces" full>
                <textarea value={form.envEmissionTypes} onChange={(e) => setF('envEmissionTypes', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Do you measure any emissions? If yes, define" full>
                <textarea value={form.envMeasures} onChange={(e) => setF('envMeasures', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Any past environmental incidents? If yes, detail" full>
                <textarea value={form.envIncidents} onChange={(e) => setF('envIncidents', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Other information" full>
                <textarea value={form.envOther} onChange={(e) => setF('envOther', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
            </Grid>
          </Section>

          {/* OHSAS / 45001 */}
          <Section
            id="ohs"
            title="OHSAS 18001 / 45001 Specific (Occupational Health & Safety)"
            icon={<AlertTriangle size={14} />}
            open={openSections.ohs}
            onToggle={() => toggle('ohs')}
          >
            <Grid>
              <Field label="Detail any critical occupational health & safety risks identified" full>
                <textarea value={form.ohsRisks} onChange={(e) => setF('ohsRisks', e.target.value)} rows={3} style={textarea} disabled={readOnly} />
              </Field>
              <Field full>
                <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                  Additional information may be required (form QCS/OHSC/01/F) for OHSAS 18001 / 45001
                  criticality of scope as per OHS scheme.
                </div>
              </Field>
            </Grid>
          </Section>

          {/* ISO 27001 */}
          <Section
            id="iso27001"
            title="ISO 27001 Specific (Information Security)"
            icon={<ShieldCheck size={14} />}
            open={openSections.iso27001}
            onToggle={() => toggle('iso27001')}
          >
            <Grid>
              <Field label="Have you prepared your Statement of Applicability?" full>
                <textarea value={form.isoSoA} onChange={(e) => setF('isoSoA', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
              <Field label="Identify the level and type of risk associated with your information systems" full>
                <textarea value={form.isoRiskLevel} onChange={(e) => setF('isoRiskLevel', e.target.value)} rows={2} style={textarea} disabled={readOnly} />
              </Field>
            </Grid>
          </Section>

          {/* Attachments */}
          <Section
            id="attach"
            title="Attachments Checklist"
            icon={<FileText size={14} />}
            open={openSections.attach}
            onToggle={() => toggle('attach')}
          >
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
              Tick the items you have ready to attach with this application.
            </div>
            {ATTACHMENT_ITEMS.map((a) => (
              <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, cursor: readOnly ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.attachmentsChecked.includes(a)}
                  onChange={() => toggleAttachment(a)}
                  disabled={readOnly}
                />
                {a}
              </label>
            ))}
          </Section>

          {/* Acknowledgement & Sign */}
          <Section
            id="ack"
            title="Acknowledgement & Signature"
            icon={<CheckCircle2 size={14} />}
            open={openSections.ack}
            onToggle={() => toggle('ack')}
          >
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#854d0e',
              padding: 10,
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 12,
              lineHeight: 1.5,
            }}>
              <strong>I acknowledge that:</strong>
              <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                <li>The information provided is correct as per my best knowledge and the QCS offer is based on the above information. If during assessments any variation is found, QCS may revise its arrangements and offer.</li>
                <li>Application fee once paid is non-refundable.</li>
                <li>All fees need to be paid in advance before Stage 1 audit as per Proforma invoice & quotation to be given after receipt of application form by QCS H.O.</li>
              </ul>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12, cursor: readOnly ? 'default' : 'pointer' }}>
              <input
                type="checkbox"
                checked={form.acknowledged}
                onChange={(e) => setF('acknowledged', e.target.checked)}
                disabled={readOnly}
                style={{ marginTop: 3 }}
              />
              I have read and agree to the above acknowledgement.
            </label>
            <Grid>
              <Field label="Name of Authorised Representative">
                <input value={form.authorizedRepresentative} onChange={(e) => setF('authorizedRepresentative', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
              <Field label="Signature (type full name)">
                <input value={form.signatureName} onChange={(e) => setF('signatureName', e.target.value)} placeholder="Type your full name as signature" style={{ ...inp, fontFamily: 'Brush Script MT, cursive', fontSize: 18 }} disabled={readOnly} />
              </Field>
              <Field label="Date">
                <input type="date" value={form.date} onChange={(e) => setF('date', e.target.value)} style={inp} disabled={readOnly} />
              </Field>
            </Grid>
          </Section>
        </div>

        {/* Footer */}
        <div style={footer}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {stored?.submittedAt
              ? <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Submitted on {new Date(stored.submittedAt).toLocaleString()}</span>
              : mode === 'fill' ? 'Your progress is auto-saved every 30 seconds.' : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={cancelBtn}>Close</button>
            {mode === 'fill' && (
              <>
                <button onClick={handleSaveDraft} style={draftBtn}>
                  <Save size={13} /> Save Draft
                </button>
                <button onClick={handleSubmit} style={submitBtn}>
                  <Send size={13} /> Submit to Coordinator
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Sub-components ---------- */

const Section: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon, open, onToggle, children }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 10 }}>
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '10px 14px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontWeight: 700,
        fontSize: 13,
        color: '#0f172a',
      }}
    >
      {open ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
      {icon}
      <span style={{ flex: 1 }}>{title}</span>
    </button>
    {open && (
      <div style={{ padding: '0 14px 14px', borderTop: '1px solid #f1f5f9' }}>
        {children}
      </div>
    )}
  </div>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
    {children}
  </div>
);

const Field: React.FC<{ label?: string; full?: boolean; icon?: React.ReactNode; children: React.ReactNode }> = ({ label, full, icon, children }) => (
  <label style={{ gridColumn: full ? '1 / -1' : 'auto', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 600, color: '#334155' }}>
    {label && (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {icon}{label}
      </span>
    )}
    {children}
  </label>
);

const RadioRow: React.FC<{ value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean }> = ({ value, onChange, options, disabled }) => (
  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
    {options.map((o) => (
      <label key={o} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: disabled ? 'default' : 'pointer', color: '#0f172a' }}>
        <input
          type="radio"
          checked={value === o}
          onChange={() => onChange(o)}
          disabled={disabled}
        />
        {o}
      </label>
    ))}
  </div>
);

const ShiftInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
    <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', minWidth: 40 }}>{label}:</span>
    <input
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: 60, padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12, outline: 'none' }}
      disabled={disabled}
    />
  </div>
);

/* ---------- Styles ---------- */

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1100, padding: 16,
};

const panel: React.CSSProperties = {
  background: '#f8fafc',
  borderRadius: 12,
  width: 'min(880px, 100%)',
  maxHeight: '94vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 25px 60px rgba(15,23,42,0.30)',
};

const header: React.CSSProperties = {
  background: '#fff',
  padding: '14px 18px',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
};

const body: React.CSSProperties = {
  padding: 14,
  overflowY: 'auto',
  flex: 1,
};

const footer: React.CSSProperties = {
  background: '#fff',
  padding: '12px 18px',
  borderTop: '1px solid #e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const inp: React.CSSProperties = {
  width: '100%',
  padding: 7,
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const textarea: React.CSSProperties = {
  ...inp,
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: 50,
};

const numInp: React.CSSProperties = {
  width: '100%',
  padding: 5,
  borderRadius: 4,
  border: '1px solid #cbd5e1',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
  textAlign: 'right',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const th: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  background: '#f8fafc',
  textAlign: 'left',
  borderBottom: '1px solid #e2e8f0',
};

const td: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #f1f5f9',
  color: '#334155',
};

const iconBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  cursor: 'pointer',
  color: '#475569',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cancelBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#475569',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

const draftBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: '#f1f5f9',
  color: '#334155',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const submitBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const trashBtn: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #fecaca',
  borderRadius: 4,
  padding: 4,
  cursor: 'pointer',
  color: '#b91c1c',
};

const addRowBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px dashed #cbd5e1',
  background: '#fff',
  color: '#475569',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

export default QCSApplicationForm;

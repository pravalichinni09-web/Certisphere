import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Mail, ShieldCheck, Eye, EyeOff, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PermissionsToggle from '../../components/PermissionsToggle';
import { defaultPermissionsForRole, setUserPermissions, PermissionKey } from '../../utils/permissions';
import { listEmailTemplates, renderTemplate, EmailTemplate } from '../../utils/emailTemplates';
import { getAuditors, saveAuditorsData, getNextAuditorId } from './utils/dataStorage';
import { sendWelcomeEmail } from '../../services/emailService';
import { Auditor } from './mockData';
import '../../styles/AuditorCoordinator.css';
import '../../styles/PermissionsToggle.css';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  certifications: string[];
  department: string;
  startDate: string;
}

const certificationOptions = ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 45001:2018', 'ISO 27001:2013', 'ISO 50001:2018'];
const roles = ['Auditor', 'Lead Auditor', 'Internal Auditor'];
const departmentOptions = ['Quality Assurance', 'Compliance', 'Operations', 'Internal Audit', 'Risk Management', 'Environmental Health & Safety', 'Human Resources', 'Finance'];

const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
};

const CreateAuditor: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '',
    role: 'Auditor', certifications: [], department: '', startDate: '',
  });
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [perms, setPerms] = useState<PermissionKey[]>(defaultPermissionsForRole('Auditor'));
  const [tempPassword, setTempPassword] = useState<string>(generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [welcomeTemplate, setWelcomeTemplate] = useState<EmailTemplate | null>(null);
  const [welcomeSubject, setWelcomeSubject] = useState('');
  const [welcomeBody, setWelcomeBody] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Load welcome template on mount
  useEffect(() => {
    const tpls = listEmailTemplates('welcome');
    const tpl = tpls[0];
    if (tpl) {
      setWelcomeTemplate(tpl);
      setWelcomeSubject(tpl.subject);
      setWelcomeBody(tpl.body);
    }
  }, []);

  // When the role changes — reset perms to that role's defaults (so the toggles always start sensible)
  useEffect(() => {
    setPerms(defaultPermissionsForRole(formData.role));
  }, [formData.role]);

  const previewVars = useMemo(() => ({
    auditorName: `${formData.firstName} ${formData.lastName}`.trim() || 'New Auditor',
    auditorEmail: formData.email || '(no email)',
    tempPassword,
    role: formData.role,
  }), [formData.firstName, formData.lastName, formData.email, formData.role, tempPassword]);

  const renderedPreview = useMemo(() => {
    if (!welcomeTemplate) return { subject: welcomeSubject, body: welcomeBody };
    return renderTemplate({ ...welcomeTemplate, subject: welcomeSubject, body: welcomeBody }, previewVars);
  }, [welcomeTemplate, welcomeSubject, welcomeBody, previewVars]);

  const showToastMsg = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleCertification = (cert: string) =>
    setSelectedCerts(prev => prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email) {
        showToastMsg('Please complete all required fields'); return;
      }
    }
    if (step === 2) {
      if (!formData.role || !formData.department || !formData.startDate) {
        showToastMsg('Please complete all required fields'); return;
      }
    }
    if (step < 4) setStep(step + 1);
  };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleRegeneratePassword = () => setTempPassword(generatePassword());
  const handleCopyPassword = () => {
    navigator.clipboard?.writeText(tempPassword).then(() => showToastMsg('Password copied'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.role || !formData.department || !formData.startDate) {
      showToastMsg('Please complete all required fields before creating the auditor.');
      return;
    }

    // Persist auditor
    const id = getNextAuditorId();
    const newAuditor: Auditor = {
      id,
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email,
      role: formData.role,
      department: formData.department,
      certifications: selectedCerts,
      auditValidator: 'Pending',
      status: 'Active',
      joinDate: formData.startDate || new Date().toISOString().split('T')[0],
      skills: {},
      ratings: [],
    };
    const next = [...getAuditors(), newAuditor];
    saveAuditorsData(next);

    // Persist permissions
    setUserPermissions(id, perms);

    // Send welcome email via EmailJS (falls back to queue if not configured)
    sendWelcomeEmail({
      userName:     `${formData.firstName} ${formData.lastName}`.trim(),
      toEmail:      formData.email,
      tempPassword: tempPassword,
      role:         formData.role,
    }).catch(() => {/* non-blocking */});

    setEmailSent(true);
    showToastMsg(`Auditor created · welcome email queued to ${formData.email}`);
    setStep(1);
    setFormData({ firstName: '', lastName: '', email: '', phone: '', role: 'Auditor', certifications: [], department: '', startDate: '' });
    setSelectedCerts([]);
    setTempPassword(generatePassword());
    setEmailSent(false);

    setTimeout(() => navigate('/auditor-coordinator/auditor-profiles'), 1200);
  };

  return (
    <div className="create-auditor-container">
      <button className="back-btn" onClick={() => navigate('/auditor-coordinator/auditor-profiles')}>
        <ArrowLeft size={20} /> Back to Profiles
      </button>
      <div className="form-card">
        <div className="form-header">
          <h1>Create New Auditor</h1>
          <p>4-step wizard with permissions and welcome email</p>
        </div>
        <div className="progress-bar">
          <div className="progress" style={{ width: `${(step / 4) * 100}%` }}></div>
          <div className="steps">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={`step ${step >= n ? 'active' : ''}`}>{n}</div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="multi-step-form">
          {step === 1 && (
            <div className="form-step active">
              <h2>Personal Information</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input type="text" name="firstName" placeholder="Enter first name" value={formData.firstName} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input type="text" name="lastName" placeholder="Enter last name" value={formData.lastName} onChange={handleInputChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email Address *</label>
                  <input type="email" name="email" placeholder="example@cms.com" value={formData.email} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="tel" name="phone" placeholder="+1 (555) 123-4567" value={formData.phone} onChange={handleInputChange} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-step active">
              <h2>Professional Information</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Role *</label>
                  <select name="role" value={formData.role} onChange={handleInputChange} required>
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <select name="department" value={formData.department} onChange={handleInputChange} required>
                    <option value="">Select a department</option>
                    {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Start Date *</label>
                <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Certifications</label>
                <div className="certifications-grid">
                  {certificationOptions.map(cert => (
                    <div key={cert} className={`cert-option ${selectedCerts.includes(cert) ? 'selected' : ''}`} onClick={() => toggleCertification(cert)}>
                      <div className="cert-checkbox">{selectedCerts.includes(cert) && <Check size={18} />}</div>
                      <span>{cert}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-step active">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} color="#0ea5e9" /> Permissions
              </h2>
              <p style={{ color: '#64748b', marginBottom: 14 }}>
                Defaults are set from the {formData.role} role. Toggle individual capabilities below.
              </p>
              <PermissionsToggle value={perms} onChange={setPerms} />
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn-secondary" onClick={() => setPerms(defaultPermissionsForRole(formData.role))}>
                  Reset to {formData.role} defaults
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="form-step active">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={20} color="#0ea5e9" /> Welcome Email &amp; Credentials
              </h2>

              <div className="form-group" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: 14, borderRadius: 8 }}>
                <label style={{ color: '#0369a1', fontWeight: 600 }}>Temporary Password</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={tempPassword}
                    readOnly
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <button type="button" className="btn-secondary" onClick={() => setShowPassword(s => !s)}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleCopyPassword}><Copy size={14} /></button>
                  <button type="button" className="btn-secondary" onClick={handleRegeneratePassword}>Regenerate</button>
                </div>
                <small style={{ color: '#64748b', fontSize: 11 }}>
                  Auto-generated, 12 characters. The auditor will be asked to change this on first sign-in.
                </small>
              </div>

              <div className="form-group">
                <label>Email Subject</label>
                <input value={welcomeSubject} onChange={(e) => setWelcomeSubject(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Email Body</label>
                <textarea rows={8} value={welcomeBody} onChange={(e) => setWelcomeBody(e.target.value)} />
                <small style={{ color: '#64748b', fontSize: 11 }}>
                  Tokens like {'{{auditorName}}'}, {'{{auditorEmail}}'}, {'{{tempPassword}}'}, {'{{role}}'} expand on send.
                </small>
              </div>

              <div className="form-group" style={{ background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px dashed #e2e8f0' }}>
                <label style={{ color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Preview</label>
                <div style={{ fontWeight: 600, marginTop: 6, marginBottom: 6 }}>{renderedPreview.subject}</div>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, color: '#334155', margin: 0 }}>
                  {renderedPreview.body}
                </pre>
              </div>

              {emailSent && (
                <div style={{ background: '#dcfce7', color: '#166534', padding: 10, borderRadius: 8 }}>
                  Welcome email queued · {formData.email}
                </div>
              )}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={handleBack} disabled={step === 1}>Previous</button>
            {step < 4 ? (
              <button type="button" className="btn-primary" onClick={handleNext}>Next</button>
            ) : (
              <button type="submit" className="btn-primary">
                <Mail size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Create &amp; Send Welcome Email
              </button>
            )}
          </div>
        </form>
      </div>
      {showToast && <div className="toast-notification">{toastMessage}</div>}
    </div>
  );
};

export default CreateAuditor;

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search } from 'lucide-react';
import StandardPicker from '../../components/StandardPicker';
import '../../styles/AuditorCoordinator.css';

interface CertificationItem {
  id: number;
  name: string;
  certificateId: string;     // certificate id (e.g. CERT-2026-0001)
  certificateDate: string;   // ISO date the certificate was issued
  client: string;
  clientId: string;
  description: string;
  standard: string;
  validity: number;          // certification validity in months (was "duration")
  renewalPeriod: string;
}

const STORAGE_KEY = 'cms_audit_certifications';

const today = (): string => new Date().toISOString().split('T')[0];

const defaultCertifications: CertificationItem[] = [
  {
    id: 1,
    name: 'ISO 9001:2015 Certification',
    certificateId: 'CERT-2026-0001',
    certificateDate: '2026-01-12',
    client: 'Acme Corporation',
    clientId: 'CLI-001',
    description: 'Quality Management System Certification',
    standard: 'ISO 9001:2015',
    validity: 36,
    renewalPeriod: '12 Months',
  },
  {
    id: 2,
    name: 'ISO 14001:2015 Certification',
    certificateId: 'CERT-2026-0002',
    certificateDate: '2026-02-04',
    client: 'TechGlobal Inc',
    clientId: 'CLI-002',
    description: 'Environmental Management System Certification',
    standard: 'ISO 14001:2015',
    validity: 36,
    renewalPeriod: '12 Months',
  },
];

const blankForm = () => ({
  name: '',
  certificateId: '',
  certificateDate: today(),
  client: '',
  clientId: '',
  description: '',
  standard: '',
  validity: 36,
  renewalPeriod: '',
});

const AuditCertifications: React.FC = () => {
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(blankForm());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as any[];
        // Migrate legacy records: `duration` -> `validity`, fill missing certificateId / certificateDate
        const migrated: CertificationItem[] = parsed.map((c, idx) => ({
          id: c.id ?? idx + 1,
          name: c.name ?? '',
          certificateId: c.certificateId ?? `CERT-LEGACY-${String(c.id ?? idx + 1).padStart(4, '0')}`,
          certificateDate: c.certificateDate ?? c.issuedDate ?? today(),
          client: c.client ?? c.organizationName ?? '',
          clientId: c.clientId ?? '',
          description: c.description ?? '',
          standard: c.standard ?? '',
          validity: typeof c.validity === 'number' ? c.validity : (typeof c.duration === 'number' ? c.duration : 36),
          renewalPeriod: c.renewalPeriod ?? '12 Months',
        }));
        setCertifications(migrated);
        // Persist migrated shape so future loads don't need to migrate again
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } else {
        setCertifications(defaultCertifications);
        saveCertifications(defaultCertifications);
      }
    } catch (e) {
      console.error('Failed to load certifications', e);
      setCertifications(defaultCertifications);
    }
  }, []);

  const saveCertifications = (data: CertificationItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // Notify listeners (e.g. Client Coordinator live scope) that certifications changed.
      window.dispatchEvent(new CustomEvent('cms-audit-certifications-updated'));
    } catch (e) {
      console.error('Failed to save certifications', e);
    }
  };

  const allocateCertificateId = (existing: CertificationItem[]): string => {
    const year = new Date().getFullYear();
    const yearMatches = existing
      .map((c) => c.certificateId)
      .filter((cid) => cid && cid.startsWith(`CERT-${year}-`));
    const nextNum = yearMatches.length + 1;
    return `CERT-${year}-${String(nextNum).padStart(4, '0')}`;
  };

  const handleEdit = (certification: CertificationItem) => {
    setEditingId(certification.id);
    setFormData({
      name: certification.name,
      certificateId: certification.certificateId,
      certificateDate: certification.certificateDate,
      client: certification.client || '',
      clientId: certification.clientId || '',
      description: certification.description,
      standard: certification.standard,
      validity: certification.validity,
      renewalPeriod: certification.renewalPeriod,
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Are you sure you want to delete this certification?')) return;
    const updated = certifications.filter((c) => c.id !== id);
    setCertifications(updated);
    saveCertifications(updated);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'validity' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated: CertificationItem[];

    if (editingId) {
      updated = certifications.map((c) => (c.id === editingId ? { ...c, ...formData } : c));
      setEditingId(null);
    } else {
      const certificateId = formData.certificateId || allocateCertificateId(certifications);
      const newCertification: CertificationItem = {
        id: Math.max(...certifications.map((c) => c.id), 0) + 1,
        ...formData,
        certificateId,
      };
      updated = [...certifications, newCertification];
    }

    setCertifications(updated);
    saveCertifications(updated);
    setFormData(blankForm());
    setShowForm(false);
  };

  const handleCancel = () => {
    setFormData(blankForm());
    setEditingId(null);
    setShowForm(false);
  };

  const handleAutoAllocateCertId = () => {
    setFormData((prev) => ({
      ...prev,
      certificateId: allocateCertificateId(certifications),
    }));
  };

  const filteredCertifications = certifications.filter((cert) => {
    const q = searchQuery.toLowerCase();
    return (
      cert.name.toLowerCase().includes(q) ||
      cert.certificateId.toLowerCase().includes(q) ||
      cert.standard.toLowerCase().includes(q) ||
      (cert.client && cert.client.toLowerCase().includes(q)) ||
      (cert.clientId && cert.clientId.toLowerCase().includes(q))
    );
  });

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="audit-scope-container">
      {/* Lead-auditor approval gate notice */}
      <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '1px solid #f5c130', borderLeft: '4px solid #f59e0b', padding: '10px 14px', borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#7c2d12', fontWeight: 600 }} title="Certificates require Lead Auditor sign-off before issuance">
        <span aria-hidden="true">⚠️</span>
        <span>Every certificate issuance requires <strong>Lead Auditor approval</strong> before being delivered to the auditee.</span>
      </div>
      <div className="scope-header">
        <div>
          <h1>Audit Certifications</h1>
          <p>Manage and track audit certifications and their durations</p>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div className="search-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', color: '#6b7280' }} />
            <input
              type="text"
              placeholder="Search certifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px 8px 36px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                width: '250px',
                outline: 'none',
              }}
            />
          </div>
          <button
            className="add-btn"
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              if (!showForm) {
                setFormData({ ...blankForm(), certificateId: allocateCertificateId(certifications) });
              }
            }}
          >
            <Plus size={20} /> {editingId ? 'Edit Certification' : 'Add Certification'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="scope-form">
          <h3>{editingId ? 'Edit Certification' : 'Create New Certification'}</h3>
          <form onSubmit={handleSubmit}>
            {/* ROW: Certification Name */}
            <div className="form-group">
              <label>Certification Name</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                type="text"
                placeholder="e.g. ISO 9001:2015 Certification"
                required
              />
            </div>

            {/* ROW: Certificate ID + Certificate Date */}
            <div className="form-row">
              <div className="form-group">
                <label>Certificate ID</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    name="certificateId"
                    value={formData.certificateId}
                    onChange={handleFormChange}
                    type="text"
                    placeholder="CERT-YYYY-NNNN"
                    required
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleAutoAllocateCertId}
                    title="Auto-allocate next ID"
                    style={{
                      padding: '0 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#f1f5f9',
                      color: '#475569',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Auto
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Leave blank or click <strong>Auto</strong> to allocate the next ID.
                </div>
              </div>
              <div className="form-group">
                <label>Certificate Date</label>
                <input
                  name="certificateDate"
                  value={formData.certificateDate}
                  onChange={handleFormChange}
                  type="date"
                  required
                />
              </div>
            </div>

            {/* ROW: Client + Client ID */}
            <div className="form-row">
              <div className="form-group">
                <label>Client</label>
                <input
                  name="client"
                  value={formData.client}
                  onChange={handleFormChange}
                  type="text"
                  placeholder="Enter client name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Client ID</label>
                <input
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleFormChange}
                  type="text"
                  placeholder="e.g. CMS-2026-0001"
                  required
                />
              </div>
            </div>

            {/* ROW: Description */}
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="Enter certification description"
                required
              />
            </div>

            {/* ROW: Standard + Certification Validity */}
            <div className="form-row">
              <div className="form-group">
                <label>Standard</label>
                <StandardPicker
                  value={formData.standard}
                  onChange={(v) => setFormData((prev) => ({ ...prev, standard: v }))}
                  required
                  placeholder="Select a standard"
                />
              </div>
              <div className="form-group">
                <label>Certification Validity (months)</label>
                <input
                  name="validity"
                  value={formData.validity}
                  onChange={handleFormChange}
                  type="number"
                  min="1"
                  required
                />
              </div>
            </div>

            {/* ROW: Renewal Period */}
            <div className="form-row">
              <div className="form-group">
                <label>Renewal Period</label>
                <input
                  name="renewalPeriod"
                  value={formData.renewalPeriod}
                  onChange={handleFormChange}
                  type="text"
                  placeholder="e.g. Every 12 Months"
                  required
                />
              </div>
              <div className="form-group" />
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                {editingId ? 'Submit' : 'Add'}
              </button>
              <button type="button" className="cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="scopes-table">
        <table>
          <thead>
            <tr>
              <th>Certification Name</th>
              <th>Certificate ID</th>
              <th>Certificate Date</th>
              <th>Client</th>
              <th>Client ID</th>
              <th>Standard</th>
              <th>Validity (Months)</th>
              <th>Renewal Period</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCertifications.length > 0 ? (
              filteredCertifications.map((cert) => (
                <tr key={cert.id}>
                  <td>{cert.name}</td>
                  <td>
                    <code style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                      {cert.certificateId}
                    </code>
                  </td>
                  <td>{formatDate(cert.certificateDate)}</td>
                  <td>{cert.client}</td>
                  <td>{cert.clientId}</td>
                  <td>{cert.standard}</td>
                  <td>{cert.validity}</td>
                  <td>{cert.renewalPeriod}</td>
                  <td className="actions">
                    <button className="action-btn edit" onClick={() => handleEdit(cert)} title="Edit">
                      <Edit2 size={18} />
                    </button>
                    <button className="action-btn delete" onClick={() => handleDelete(cert.id)} title="Delete">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>
                  No certifications found{searchQuery ? ` matching "${searchQuery}"` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditCertifications;

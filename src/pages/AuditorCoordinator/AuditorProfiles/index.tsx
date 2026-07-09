import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Plus } from 'lucide-react';
import '../../../styles/AuditorCoordinator.css';
import { getAuditors, saveAuditorsData, getNextAuditorId } from '../utils/dataStorage';

interface Auditor {
  id: number;
  name: string;
  email: string;
  role: string;
  certifications: string[];
  status: 'Active' | 'Inactive';
  joinDate?: string;
  department?: string;
}

const AuditorProfiles: React.FC = () => {
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Lead Auditor',
    department: '',
    certifications: '',
  });

  // Load auditors from localStorage on mount
  useEffect(() => {
    const loadedAuditors = getAuditors();
    setAuditors(loadedAuditors);
  }, []);

  const departmentOptions = [
    'Quality Assurance',
    'Compliance',
    'Operations',
    'Internal Audit',
    'Risk Management',
    'Environmental Health & Safety',
    'Human Resources',
    'Finance'
  ];

  const handleEdit = (auditor: Auditor) => {
    setEditingId(auditor.id);
    setFormData({
      name: auditor.name,
      email: auditor.email,
      role: auditor.role,
      department: auditor.department || '',
      certifications: auditor.certifications.join(', '),
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this auditor?')) {
      setAuditors(auditors.filter(auditor => auditor.id !== id));
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId !== null) {
      const updated = auditors.map(auditor =>
        auditor.id === editingId
          ? {
              ...auditor,
              name: formData.name,
              email: formData.email,
              role: formData.role,
              department: formData.department || '',
              certifications: formData.certifications.split(',').map(c => c.trim()).filter(c => c),
            }
          : auditor
      );
      setAuditors(updated);
      saveAuditorsData(updated as any);
      setEditingId(null);
    } else {
      const newId = getNextAuditorId();
      const newAuditor: Auditor = {
        id: newId,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department: formData.department || '',
        certifications: formData.certifications.split(',').map(c => c.trim()).filter(c => c),
        status: 'Active',
        joinDate: new Date().toISOString().split('T')[0],
      };
      const updated = [...auditors, newAuditor];
      setAuditors(updated);
      saveAuditorsData(updated as any);
    }

    // Reset form
    setFormData({
      name: '',
      email: '',
      role: 'Lead Auditor',
      department: '',
      certifications: '',
    });
    setShowForm(false);
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      email: '',
      role: 'Lead Auditor',
      department: '',
      certifications: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="auditor-profiles-container">
      <div className="profiles-header">
        <div>
          <h1>Auditor Profiles</h1>
          <p>Manage and view all auditors in the system</p>
        </div>
        <button className="add-btn" onClick={() => setShowForm(!showForm)}>
          <Plus size={20} /> Add Auditor
        </button>
      </div>

      {showForm && (
        <div className="profile-form">
          <h3>{editingId ? 'Edit Auditor Profile' : 'Create New Auditor Profile'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                name="name"
                placeholder="Enter auditor name" 
                value={formData.name}
                onChange={handleFormChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  name="email"
                  placeholder="Enter email address" 
                  value={formData.email}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select name="role" value={formData.role} onChange={handleFormChange}>
                  <option>Lead Auditor</option>
                  <option>Auditor</option>
                  <option>Junior Auditor</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Department</label>
                <select name="department" value={formData.department} onChange={handleFormChange} required>
                  <option value="">Select a department</option>
                  {departmentOptions.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Certifications</label>
                <input 
                  type="text" 
                  name="certifications"
                  placeholder="Enter certifications (comma-separated)" 
                  value={formData.certifications}
                  onChange={handleFormChange}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="submit-btn">{editingId ? 'Update Profile' : 'Create Profile'}</button>
              <button type="button" className="cancel-btn" onClick={handleCancel}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="profiles-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Certifications</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {auditors.map((auditor) => (
              <tr key={auditor.id}>
                <td className="auditor-name">{auditor.name}</td>
                <td>{auditor.email}</td>
                <td>
                  <span className={`role-badge role-${auditor.role.toLowerCase().replace(' ', '-')}`}>
                    {auditor.role}
                  </span>
                </td>
                <td>
                  <div className="certifications">
                    {auditor.certifications.map((cert, idx) => (
                      <span key={idx} className="cert-badge">{cert}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`status-badge status-${auditor.status.toLowerCase()}`}>
                    {auditor.status}
                  </span>
                </td>
                <td className="join-date">{auditor.joinDate}</td>
                <td className="actions">
                  <button 
                    className="action-btn edit" 
                    onClick={() => handleEdit(auditor)}
                    title="Edit auditor"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    className="action-btn delete" 
                    onClick={() => handleDelete(auditor.id)}
                    title="Delete auditor"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditorProfiles;

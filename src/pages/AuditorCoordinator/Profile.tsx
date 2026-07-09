import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Briefcase, Calendar, MapPin, Edit3, Save, X, Camera, Award } from 'lucide-react';
import '../../styles/AuditorCoordinator/Profile.css';

export interface CoordinatorProfile {
  name: string;
  photo: string; // data URL or empty
  email: string;
  phone: string;
  role: string;
  department: string;
  employeeId: string;
  joinedDate: string;
  location: string;
  bio: string;
}

export const DEFAULT_PROFILE: CoordinatorProfile = {
  name: 'Praveen Gangarapu',
  photo: '',
  email: 'praveen.gangarapu@qmicssolutions.com',
  phone: '+91 98765 43210',
  role: 'Audit Coordinator',
  department: 'Certification & Compliance',
  employeeId: 'AC-00421',
  joinedDate: '2023-06-15',
  location: 'Hyderabad, India',
  bio: 'Coordinating audits, managing auditor assignments, and ensuring the certification lifecycle runs smoothly end-to-end.',
};

const STORAGE_KEY = 'auditCoordinatorProfile';

export const loadProfile = (): CoordinatorProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
};

export const saveProfile = (p: CoordinatorProfile) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  // Notify other components (sidebar, greeting) in the same tab
  window.dispatchEvent(new CustomEvent('coordinator-profile-updated', { detail: p }));
};

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<CoordinatorProfile>(loadProfile());
  const [draft, setDraft] = useState<CoordinatorProfile>(profile);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const handleChange = (field: keyof CoordinatorProfile, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraft((prev) => ({ ...prev, photo: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setDraft((prev) => ({ ...prev, photo: '' }));
  };

  const handleSave = () => {
    saveProfile(draft);
    setProfile(draft);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCancel = () => {
    setDraft(profile);
    setEditing(false);
  };

  const initials = (profile.name || 'A C')
    .split(' ')
    .map((s) => s.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const source = editing ? draft : profile;

  return (
    <div className="profile-page">
      <div className="profile-header-row">
        <div>
          <h2 className="profile-page-title">My Profile</h2>
          <p className="profile-page-sub">Manage your personal information and account details</p>
        </div>
        {!editing ? (
          <button className="profile-btn profile-btn-primary" onClick={() => setEditing(true)}>
            <Edit3 size={16} /> Edit Profile
          </button>
        ) : (
          <div className="profile-action-group">
            <button className="profile-btn profile-btn-ghost" onClick={handleCancel}>
              <X size={16} /> Cancel
            </button>
            <button className="profile-btn profile-btn-primary" onClick={handleSave}>
              <Save size={16} /> Submit
            </button>
          </div>
        )}
      </div>

      {saved && (
        <div className="profile-toast">
          <Award size={16} /> Profile updated successfully.
        </div>
      )}

      <div className="profile-card">
        <div className="profile-cover" />
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            {source.photo ? (
              <img src={source.photo} alt={source.name} />
            ) : (
              <span className="profile-avatar-initials">{initials}</span>
            )}
            {editing && (
              <button
                type="button"
                className="profile-avatar-edit"
                onClick={() => fileInputRef.current?.click()}
                title="Change photo"
              >
                <Camera size={16} />
              </button>
            )}
          </div>
          {editing && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
              {source.photo && (
                <button className="profile-remove-photo" type="button" onClick={handleRemovePhoto}>
                  Remove photo
                </button>
              )}
            </>
          )}
        </div>

        <div className="profile-identity">
          {editing ? (
            <input
              className="profile-name-input"
              value={draft.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Full name"
            />
          ) : (
            <h3 className="profile-name">{profile.name || 'Unnamed Coordinator'}</h3>
          )}
          <span className="profile-role-chip">{source.role || 'Audit Coordinator'}</span>
        </div>

        <div className="profile-grid">
          <Field
            label="Email"
            icon={<Mail size={16} />}
            editing={editing}
            value={source.email}
            onChange={(v) => handleChange('email', v)}
            type="email"
          />
          <Field
            label="Phone"
            icon={<Phone size={16} />}
            editing={editing}
            value={source.phone}
            onChange={(v) => handleChange('phone', v)}
          />
          <Field
            label="Employee ID"
            icon={<User size={16} />}
            editing={editing}
            value={source.employeeId}
            onChange={(v) => handleChange('employeeId', v)}
          />
          <Field
            label="Department"
            icon={<Briefcase size={16} />}
            editing={editing}
            value={source.department}
            onChange={(v) => handleChange('department', v)}
          />
          <Field
            label="Joined"
            icon={<Calendar size={16} />}
            editing={editing}
            value={source.joinedDate}
            onChange={(v) => handleChange('joinedDate', v)}
            type="date"
          />
          <Field
            label="Location"
            icon={<MapPin size={16} />}
            editing={editing}
            value={source.location}
            onChange={(v) => handleChange('location', v)}
          />
        </div>

        <div className="profile-bio-block">
          <label className="profile-field-label">About</label>
          {editing ? (
            <textarea
              className="profile-textarea"
              value={draft.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              rows={4}
              placeholder="Write a short bio"
            />
          ) : (
            <p className="profile-bio-text">{profile.bio || 'No bio added yet.'}</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  icon: React.ReactNode;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}

const Field: React.FC<FieldProps> = ({ label, icon, editing, value, onChange, type = 'text' }) => (
  <div className="profile-field">
    <label className="profile-field-label">
      <span className="profile-field-icon">{icon}</span> {label}
    </label>
    {editing ? (
      <input
        className="profile-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <div className="profile-value">{value || '—'}</div>
    )}
  </div>
);

export default Profile;

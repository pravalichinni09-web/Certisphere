import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../../styles/AuditorCoordinator.css';

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

const CreateAuditor: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'Auditor',
    certifications: [],
    department: '',
    startDate: ''
  });
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);

  const certificationOptions = [
    'ISO 9001:2015',
    'ISO 14001:2015',
    'ISO 45001:2018',
    'ISO 27001:2013',
    'ISO 50001:2018'
  ];

  const roles = ['Auditor', 'Lead Auditor', 'Internal Auditor'];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleCertification = (cert: string) => {
    setSelectedCerts(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    );
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('New Auditor:', { ...formData, certifications: selectedCerts });
    alert('Auditor created successfully!');
    setStep(1);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'Auditor',
      certifications: [],
      department: '',
      startDate: ''
    });
    setSelectedCerts([]);
  };

  return (
    <div className="create-auditor-container">
      <button className="back-btn" onClick={() => navigate('/auditor-coordinator/auditor-profiles')}>
        <ArrowLeft size={20} /> Back to Profiles
      </button>

      <div className="form-card">
        <div className="form-header">
          <h1>Create New Auditor</h1>
          <p>Add a new auditor to the system</p>
        </div>

        <div className="progress-bar">
          <div className="progress" style={{ width: `${(step / 3) * 100}%` }}></div>
          <div className="steps">
            <div className={`step ${step >= 1 ? 'active' : ''}`}>1</div>
            <div className={`step ${step >= 2 ? 'active' : ''}`}>2</div>
            <div className={`step ${step >= 3 ? 'active' : ''}`}>3</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="multi-step-form">
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="form-step active">
              <h2>Personal Information</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Enter last name"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="example@cms.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Professional Information */}
          {step === 2 && (
            <div className="form-step active">
              <h2>Professional Information</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Role *</label>
                  <select name="role" value={formData.role} onChange={handleInputChange} required>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <input
                    type="text"
                    name="department"
                    placeholder="e.g., Quality Assurance"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          )}

          {/* Step 3: Certifications */}
          {step === 3 && (
            <div className="form-step active">
              <h2>Certifications</h2>
              <p className="cert-instruction">Select all applicable certifications:</p>
              <div className="certifications-grid">
                {certificationOptions.map(cert => (
                  <div
                    key={cert}
                    className={`cert-option ${selectedCerts.includes(cert) ? 'selected' : ''}`}
                    onClick={() => toggleCertification(cert)}
                  >
                    <div className="cert-checkbox">
                      {selectedCerts.includes(cert) && <Check size={18} />}
                    </div>
                    <span>{cert}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={handleBack} disabled={step === 1}>
              Previous
            </button>
            {step < 3 ? (
              <button type="button" className="btn-primary" onClick={handleNext}>
                Next
              </button>
            ) : (
              <button type="submit" className="btn-primary">
                Create Auditor
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAuditor;

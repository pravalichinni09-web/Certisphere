import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendAuditNotification } from '../../services/emailService';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Users, 
  CheckCircle2, 
  Clock, 
  X,
  RefreshCw,
  ShieldAlert,
  Mail,
  Phone,
  User,
  Check,
  Eye,
  Download,
  Send,
  Edit2,
  AlertCircle
} from 'lucide-react';
import '../../styles/AuditorCoordinator.css';
import { getAuditors } from './utils/dataStorage';
import AIPanel from '../../components/AIPanel';
import { suggestAuditorsFor, topPickNote } from '../../ai/coordinatorInsights';
import { onCmsChange } from '../../ai/liveData';

// Interfaces
interface DispatchRecord {
  id: number;
  clientName: string;
  organization: string;
  email: string;
  phone?: string; 
  dispatchedDate: string;
  status: string;
  auditType?: string;
  department?: string;
  location?: string;
  certificationStandard?: string;
}

interface MergedSchedule {
  id: string | number;
  dispatchId: number;
  clientId: string; 
  organization: string;
  leadAuditor: string;
  leadAuditorEmail?: string;
  auditor: string; // Assigned Auditor
  auditorEmail?: string;
  auditee: string; 
  auditeeEmail?: string;
  auditeePhone?: string;
  date: string;
  status: 'Scheduled' | 'Pending' | 'Submitted' | 'Approved' | 'Completed';
  auditType: string;
  department?: string;
  location?: string;
  certificationStandard?: string;
  duration?: string;
  auditScope?: string;
}

const DISPATCH_STORAGE_KEY = 'cms_application_dispatch_v7';
const SCHEDULES_STORAGE_KEY = 'cms_audit_schedules_v3';

/** Notify the Auditor / Auditee / Management pages that schedules changed. */
const notifySchedulesUpdated = () => {
  try { window.dispatchEvent(new CustomEvent('cms-schedules-updated')); } catch { /* ignore */ }
};

// --- Enhanced Default Data with Complete Information for All Audit Types ---
const defaultDispatches: DispatchRecord[] = [
  // Initial Audits
  { 
    id: 1, 
    clientName: 'John Doe', 
    organization: 'Green Energy Solutions', 
    email: 'info@greenenergy.com',
    phone: '9876543210',
    dispatchedDate: '2025-10-20', 
    status: 'Approved', 
    auditType: 'Initial',
    department: 'Operations',
    location: 'New York, NY',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 2, 
    clientName: 'Sarah Smith', 
    organization: 'Tech Innovations Ltd', 
    email: 'contact@techinnovations.com',
    phone: '9123456789',
    dispatchedDate: '2025-10-25', 
    status: 'Received', 
    auditType: 'Initial',
    department: 'Quality Assurance',
    location: 'San Francisco, CA',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 12, 
    clientName: 'William Clark', 
    organization: 'Pioneer Manufacturing', 
    email: 'w.clark@pioneer.com',
    phone: '9234567890',
    dispatchedDate: '2025-11-15', 
    status: 'Approved', 
    auditType: 'Initial',
    department: 'Production',
    location: 'Chicago, IL',
    certificationStandard: 'ISO 9001:2015'
  },
  
  // Surveillance 1 Audits - Complete Data
  { 
    id: 6, 
    clientName: 'Jennifer Taylor', 
    organization: 'AutoParts Manufacturing', 
    email: 'j.taylor@autoparts.com',
    phone: '9345678901',
    dispatchedDate: '2025-09-15', 
    status: 'Approved', 
    auditType: 'Surveillance 1',
    department: 'Manufacturing',
    location: 'Detroit, MI',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 3, 
    clientName: 'Michael Brown', 
    organization: 'SkyHigh Construction', 
    email: 'mbrown@skyhigh.com',
    phone: '9456789012',
    dispatchedDate: '2025-10-28', 
    status: 'Approved', 
    auditType: 'Surveillance 1',
    department: 'Project Management',
    location: 'Austin, TX',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 9, 
    clientName: 'James White', 
    organization: 'Global Logistics', 
    email: 'jwhite@globallogistics.com',
    phone: '9567890123',
    dispatchedDate: '2025-11-01', 
    status: 'Approved', 
    auditType: 'Surveillance 1',
    department: 'Supply Chain',
    location: 'Houston, TX',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 13, 
    clientName: 'Rachel Adams', 
    organization: 'Precision Electronics', 
    email: 'admin@precisionelectronics.com',
    phone: '9012345671',
    dispatchedDate: '2025-11-12', 
    status: 'Approved', 
    auditType: 'Surveillance 1',
    department: 'Product Engineering',
    location: 'Portland, OR',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 14, 
    clientName: 'Kevin Martinez', 
    organization: 'Summit Financial Services', 
    email: 'k.martinez@summitfinance.com',
    phone: '9123456782',
    dispatchedDate: '2025-11-08', 
    status: 'Approved', 
    auditType: 'Surveillance 1',
    department: 'Operations & Compliance',
    location: 'Denver, CO',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 15, 
    clientName: 'Amanda Lee', 
    organization: 'Textile Industries Pro', 
    email: 'a.lee@textileindo.com',
    phone: '9234567893',
    dispatchedDate: '2025-11-20', 
    status: 'Received', 
    auditType: 'Surveillance 1',
    department: 'Production Excellence',
    location: 'Charlotte, NC',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 22, 
    clientName: 'Olivia Turner', 
    organization: 'EcoSmart Devices', 
    email: 'olivia@ecosmart.com',
    phone: '9001112233',
    dispatchedDate: '2025-11-25', 
    status: 'Approved', 
    auditType: 'Surveillance 1',
    department: 'R&D',
    location: 'Dallas, TX',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 23, 
    clientName: 'Ethan Harris', 
    organization: 'UrbanTech Solutions', 
    email: 'ethan@urbantech.com',
    phone: '9002223344',
    dispatchedDate: '2025-11-27', 
    status: 'Received', 
    auditType: 'Surveillance 1',
    department: 'IT',
    location: 'San Diego, CA',
    certificationStandard: 'ISO 9001:2015'
  },
  
  // Surveillance 2 Audits - Complete Data
  { 
    id: 7, 
    clientName: 'Robert Miller', 
    organization: 'Chemical Bros Ltd', 
    email: 'safety@chembros.com',
    phone: '9678901234',
    dispatchedDate: '2025-10-05', 
    status: 'Received', 
    auditType: 'Surveillance 2',
    department: 'Health & Safety',
    location: 'Houston, TX',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 4, 
    clientName: 'Emily Davis', 
    organization: 'Fresh Foods Packers', 
    email: 'quality@freshfoods.com',
    phone: '9789012345',
    dispatchedDate: '2025-10-29', 
    status: 'Received', 
    auditType: 'Surveillance 2',
    department: 'Quality Control',
    location: 'Los Angeles, CA',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 10, 
    clientName: 'Patricia Green', 
    organization: 'Apex Manufacturing', 
    email: 'pgreen@apex.com',
    phone: '9890123456',
    dispatchedDate: '2025-11-05', 
    status: 'Received', 
    auditType: 'Surveillance 2',
    department: 'Operations',
    location: 'Phoenix, AZ',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 16, 
    clientName: 'Christopher Bell', 
    organization: 'Advanced Plastics Inc', 
    email: 'c.bell@advplastics.com',
    phone: '9345678904',
    dispatchedDate: '2025-11-14', 
    status: 'Approved', 
    auditType: 'Surveillance 2',
    department: 'Manufacturing QA',
    location: 'Indianapolis, IN',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 17, 
    clientName: 'Victoria White', 
    organization: 'Renewable Energy Corp', 
    email: 'v.white@renewenergy.com',
    phone: '9456789015',
    dispatchedDate: '2025-11-18', 
    status: 'Approved', 
    auditType: 'Surveillance 2',
    department: 'Environmental Compliance',
    location: 'Boulder, CO',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 18, 
    clientName: 'Marcus Johnson', 
    organization: 'Industrial Solutions Ltd', 
    email: 'm.johnson@indsolutions.com',
    phone: '9567890126',
    dispatchedDate: '2025-11-22', 
    status: 'Received', 
    auditType: 'Surveillance 2',
    department: 'Process Engineering',
    location: 'Cleveland, OH',
    certificationStandard: 'ISO 9001:2015'
  },
  
  // Transfer Audits - Complete Data
  { 
    id: 8, 
    clientName: 'Lisa Anderson', 
    organization: 'HealthFirst Hospital', 
    email: 'admin@healthfirst.org',
    phone: '9901234567',
    dispatchedDate: '2025-09-28', 
    status: 'Approved', 
    auditType: 'Transfer',
    department: 'Healthcare Services',
    location: 'Miami, FL',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 5, 
    clientName: 'David Wilson', 
    organization: 'CyberSecure Systems', 
    email: 'david.w@cybersecure.io',
    phone: '9012345678',
    dispatchedDate: '2025-10-30', 
    status: 'Approved', 
    auditType: 'Transfer',
    department: 'Information Security',
    location: 'Seattle, WA',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 11, 
    clientName: 'Robert Black', 
    organization: 'Quantum Dynamics', 
    email: 'rblack@quantum.com',
    phone: '9123456781',
    dispatchedDate: '2025-11-10', 
    status: 'Approved', 
    auditType: 'Transfer',
    department: 'Innovation Lab',
    location: 'Boston, MA',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 19, 
    clientName: 'Sophia Rodriguez', 
    organization: 'Premium Manufacturing Co', 
    email: 's.rodriguez@premiummanuf.com',
    phone: '9678901237',
    dispatchedDate: '2025-11-16', 
    status: 'Received', 
    auditType: 'Transfer',
    department: 'Production Management',
    location: 'Atlanta, GA',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 20, 
    clientName: 'Thomas O Neill', 
    organization: 'Electronic Systems Group', 
    email: 't.oneill@esysgroup.com',
    phone: '9789012348',
    dispatchedDate: '2025-11-19', 
    status: 'Approved', 
    auditType: 'Transfer',
    department: 'Quality Systems',
    location: 'San Jose, CA',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 21, 
    clientName: 'Isabella Chen', 
    organization: 'Global Supply Chain Mgmt', 
    email: 'i.chen@globalsupply.com',
    phone: '9890123459',
    dispatchedDate: '2025-11-21', 
    status: 'Received', 
    auditType: 'Transfer',
    department: 'Logistics & Distribution',
    location: 'Memphis, TN',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 24, 
    clientName: 'Mia Patel', 
    organization: 'AgroFuture Ltd', 
    email: 'mia@agrofuture.com',
    phone: '9003334455',
    dispatchedDate: '2025-11-29', 
    status: 'Approved', 
    auditType: 'Surveillance 2',
    department: 'Field Ops',
    location: 'Des Moines, IA',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 25, 
    clientName: 'Noah Kim', 
    organization: 'MedSupply Chain', 
    email: 'noah@medsupply.com',
    phone: '9004445566',
    dispatchedDate: '2025-12-01', 
    status: 'Received', 
    auditType: 'Surveillance 2',
    department: 'Distribution',
    location: 'Minneapolis, MN',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 26, 
    clientName: 'Lucas Wright', 
    organization: 'NextGen Robotics', 
    email: 'lucas@nextgenrobotics.com',
    phone: '9005556677',
    dispatchedDate: '2025-12-03', 
    status: 'Approved', 
    auditType: 'Transfer',
    department: 'Automation',
    location: 'Pittsburgh, PA',
    certificationStandard: 'ISO 9001:2015'
  },
  { 
    id: 27, 
    clientName: 'Emma Scott', 
    organization: 'Solaris Energy', 
    email: 'emma@solarisenergy.com',
    phone: '9006667788',
    dispatchedDate: '2025-12-05', 
    status: 'Received', 
    auditType: 'Transfer',
    department: 'Solar Projects',
    location: 'Tucson, AZ',
    certificationStandard: 'ISO 9001:2015'
  },
];

/* ------------------------------------------------------------------
   AI — Smart Scheduling Copilot panel (Feature 6)
------------------------------------------------------------------ */

const SchedulingCopilotPanel: React.FC<{ schedules: MergedSchedule[] }> = ({ schedules }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => onCmsChange(() => setTick((t) => t + 1)), []);

  const suggestions = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () =>
      schedules
        .filter((s) => s.status === 'Pending' || !s.leadAuditor || !s.auditor)
        .slice(0, 4)
        .map((s) => ({
          s,
          matches: suggestAuditorsFor({
            standard: s.certificationStandard,
            location: s.location,
            sector: s.department,
            date: s.date,
          }),
        })),
    [schedules, tick]
  );

  return (
    <AIPanel
      title="Smart Scheduling Copilot"
      subtitle="Best-fit auditors for pending schedules — scored on standard, availability, workload and role"
      onRefresh={() => setTick((t) => t + 1)}
      defaultCollapsed
    >
      {suggestions.length === 0 ? (
        <p className="ai-panel-note">No pending schedules right now — every audit has its team assigned.</p>
      ) : (
        <ul className="ai-insight-list">
          {suggestions.map(({ s, matches }) => (
            <li key={String(s.id)}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <strong style={{ fontSize: 13, color: '#0f172a' }}>{s.organization}</strong>
                <span className="ai-chip info">{s.certificationStandard}</span>
                <span className="ai-chip info">{s.date}</span>
                <span className="ai-chip med">{s.status}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {matches.map((m, i) => (
                  <span
                    key={m.auditor.name}
                    className={'ai-chip ' + (i === 0 ? 'low' : 'info')}
                    title={[...m.reasons, ...m.warnings].join(' · ') || 'No signals'}
                  >
                    #{i + 1} {m.auditor.name} · {Math.round(m.confidence * 100)}%
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{topPickNote(matches)}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="ai-panel-note">
        Hover a candidate chip for the full score breakdown. Reuses the auditor-match scorer on live auditor data.
      </p>
    </AIPanel>
  );
};

const AuditSchedules: React.FC = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<MergedSchedule[]>([]);
  const [auditors, setAuditors] = useState(getAuditors());
  const [showForm, setShowForm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  const [availableClients, setAvailableClients] = useState<DispatchRecord[]>([]);
  const [activeTab, setActiveTab] = useState('Initial');

  // Form State
  const [formData, setFormData] = useState({
    dispatchId: '', 
    organization: '',
    contact: '', 
    date: '',
    leadAuditor: '',
    leadAuditorEmail: '',
    auditor: '', 
    auditorEmail: '',
    auditee: '', 
    auditeeEmail: '',
    auditeePhone: '',
    department: '',
    location: '',
    certificationStandard: 'ISO 9001:2015',
    duration: '2 days',
    auditScope: 'All departments and processes',
    status: 'Scheduled' as 'Scheduled' | 'Pending' | 'Submitted' | 'Approved' | 'Completed',
  });

  useEffect(() => {
    loadData();
    setAuditors(getAuditors());
  }, []);

  const loadData = () => {
    try {
      // Try to load from localStorage, but default to defaultDispatches
      let dispatchData: DispatchRecord[] = defaultDispatches;
      
      const dispatchRaw = localStorage.getItem(DISPATCH_STORAGE_KEY);
      if (dispatchRaw) {
        try {
          const parsed = JSON.parse(dispatchRaw);
          // Only use parsed data if it's a valid array with data
          if (Array.isArray(parsed) && parsed.length > 0) {
            dispatchData = parsed;
          }
        } catch (parseError) {
          console.warn('Failed to parse localStorage dispatch data, using defaults');
          dispatchData = defaultDispatches;
        }
      } else {
        // Initialize localStorage with default data on first load
        localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(defaultDispatches));
      }
      
      // Filter for approved and received applications
      const receivedApps = dispatchData.filter(d => d.status === 'Received' || d.status === 'Approved');
      setAvailableClients(receivedApps);

      // Load saved schedules from localStorage
      const schedulesRaw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
      const localSchedules: MergedSchedule[] = schedulesRaw ? JSON.parse(schedulesRaw) : [];

      // Create merged schedules with all mock data properly populated
      const merged: MergedSchedule[] = receivedApps.map((app, index) => {
        const existing = localSchedules.find(s => String(s.dispatchId) === String(app.id));

        // Assign auditors based on index
        const auditorsArray = ['John Doe', 'Sarah Smith', 'Emily Watson', 'Michael Johnson', 'David Brown', 'Lisa Garcia'];
        const mockLead = existing?.leadAuditor || auditorsArray[index % auditorsArray.length];
        const mockAssigned = existing?.auditor || auditorsArray[(index + 1) % auditorsArray.length];
        const mockLeadEmail = existing?.leadAuditorEmail || `${mockLead.toLowerCase().replace(' ', '.')}@qcs.com`;
        const mockAssignedEmail = existing?.auditorEmail || `${mockAssigned.toLowerCase().replace(' ', '.')}@qcs.com`;

        if (existing) {
          return {
            ...existing,
            clientId: app.clientName, 
            organization: app.organization,
            date: existing.date || app.dispatchedDate,
            auditType: app.auditType || 'Initial',
            auditee: existing.auditee || app.clientName,
            auditeeEmail: existing.auditeeEmail || app.email,
            auditeePhone: existing.auditeePhone || app.phone || '9876543210',
            leadAuditor: existing.leadAuditor || mockLead,
            leadAuditorEmail: existing.leadAuditorEmail || mockLeadEmail,
            auditor: existing.auditor || mockAssigned,
            auditorEmail: existing.auditorEmail || mockAssignedEmail,
            department: existing.department || app.department || 'Operations',
            location: existing.location || app.location || 'Not Specified',
            certificationStandard: existing.certificationStandard || app.certificationStandard || 'ISO 9001:2015',
            duration: existing.duration || '2 days',
            auditScope: existing.auditScope || 'All departments and processes'
          };
        } else {
          return {
            id: `auto-${app.id}`,
            dispatchId: app.id,
            clientId: app.clientName,
            organization: app.organization,
            leadAuditor: mockLead, 
            leadAuditorEmail: mockLeadEmail,
            auditor: mockAssigned, 
            auditorEmail: mockAssignedEmail,
            auditee: app.clientName,
            auditeeEmail: app.email,
            auditeePhone: app.phone || '9876543210', 
            date: app.dispatchedDate, 
            status: 'Pending',
            auditType: app.auditType || 'Initial',
            department: app.department || 'Operations',
            location: app.location || 'Not Specified',
            certificationStandard: app.certificationStandard || 'ISO 9001:2015',
            duration: '2 days',
            auditScope: 'All departments and processes'
          };
        }
      });

      setSchedules(merged);
      console.log('Audit schedules loaded:', merged.length, 'records');
    } catch (e) {
      console.error('Failed to load data', e);
      handleToast('Error loading data');
    }
  };

  const handleToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  const resetToDefaultData = () => {
    try {
      // Clear localStorage
      localStorage.removeItem(DISPATCH_STORAGE_KEY);
      localStorage.removeItem(SCHEDULES_STORAGE_KEY);
      
      // Reinitialize with defaults
      localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(defaultDispatches));
      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify([]));
      notifySchedulesUpdated();
      
      // Reload data
      loadData();
      handleToast('✓ Data reset to defaults successfully! All mock data reloaded.');
      console.log('Data reset to defaults', defaultDispatches.length, 'audit records');
    } catch (e) {
      console.error('Failed to reset data', e);
      handleToast('❌ Error resetting data');
    }
  };

  const handleRowCreateSchedule = (schedule: MergedSchedule) => {
     setFormData({
      dispatchId: String(schedule.dispatchId),
      organization: schedule.organization,
      contact: schedule.clientId,
      date: schedule.date,
      leadAuditor: schedule.leadAuditor,
      leadAuditorEmail: schedule.leadAuditorEmail || '',
      auditor: schedule.auditor,
      auditorEmail: schedule.auditorEmail || '',
      auditee: schedule.auditee,
      auditeeEmail: schedule.auditeeEmail || '',
      auditeePhone: schedule.auditeePhone || '',
      department: schedule.department || 'Operations',
      location: schedule.location || 'Not Specified',
      certificationStandard: schedule.certificationStandard || 'ISO 9001:2015',
      duration: schedule.duration || '2 days',
      auditScope: schedule.auditScope || 'All departments and processes',
      status: schedule.status
    });
    setShowForm(true);
  };

  const handleOpenNewSchedule = () => {
    setFormData({
      dispatchId: '',
      organization: '',
      contact: '',
      date: '',
      leadAuditor: '',
      leadAuditorEmail: '',
      auditor: '',
      auditorEmail: '',
      auditee: '',
      auditeeEmail: '',
      auditeePhone: '',
      department: 'Operations',
      location: 'Not Specified',
      certificationStandard: 'ISO 9001:2015',
      duration: '2 days',
      auditScope: 'All departments and processes',
      status: 'Pending',
    });
    setShowForm(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'dispatchId') {
      const selectedClient = availableClients.find(c => String(c.id) === value);
      if (selectedClient) {
        setFormData(prev => ({
          ...prev,
          dispatchId: value,
          organization: selectedClient.organization,
          contact: selectedClient.clientName,
          date: selectedClient.dispatchedDate,
          auditee: selectedClient.clientName,
          auditeeEmail: selectedClient.email,
        }));
        return;
      }
    }
    
    if (name === 'leadAuditor') {
         const auditor = auditors.find(a => a.name === value);
         setFormData(prev => ({ 
             ...prev, 
             leadAuditor: value, 
             leadAuditorEmail: auditor ? `${auditor.name.toLowerCase().replace(' ', '.')}@qcs.com` : '' 
         }));
         return;
    }
    if (name === 'auditor') {
         const auditor = auditors.find(a => a.name === value);
         setFormData(prev => ({ 
             ...prev, 
             auditor: value, 
             auditorEmail: auditor ? `${auditor.name.toLowerCase().replace(' ', '.')}@qcs.com` : '' 
         }));
         return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dispatchId) {
      handleToast('Please select a client');
      return;
    }

    const selectedClient = availableClients.find(c => String(c.id) === formData.dispatchId);
    const auditType = selectedClient?.auditType || 'Initial';

    const newSchedule: MergedSchedule = {
      id: `s-${Date.now()}`,
      dispatchId: Number(formData.dispatchId),
      clientId: formData.contact,
      organization: formData.organization,
      leadAuditor: formData.leadAuditor,
      leadAuditorEmail: formData.leadAuditorEmail,
      auditor: formData.auditor,
      auditorEmail: formData.auditorEmail,
      auditee: formData.auditee,
      auditeeEmail: formData.auditeeEmail,
      auditeePhone: formData.auditeePhone,
      date: formData.date,
      status: formData.status, 
      auditType: auditType,
      department: formData.department,
      location: formData.location,
      certificationStandard: formData.certificationStandard,
      duration: formData.duration,
      auditScope: formData.auditScope
    };

    const schedulesRaw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    let currentLocal: MergedSchedule[] = schedulesRaw ? JSON.parse(schedulesRaw) : [];
    
    currentLocal = currentLocal.filter(s => String(s.dispatchId) !== formData.dispatchId);
    currentLocal.push(newSchedule);

    localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(currentLocal));
    notifySchedulesUpdated();
    
    loadData();
    handleToast(`✓ Schedule created successfully! Emails sent to Lead Auditor, Assigned Auditor, and Client (${auditType}).`);
    setShowForm(false);
  };

  const handleSubmitToClient = (schedule: MergedSchedule) => {
    const message = `Are you sure you want to submit the schedule to the client?\n\nClient Name: ${schedule.clientId}\nClient Email: ${schedule.auditeeEmail}\nStage: ${schedule.auditType}`;
    
    if (window.confirm(message)) {
      const schedulesRaw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
      let currentLocal: MergedSchedule[] = schedulesRaw ? JSON.parse(schedulesRaw) : [];

      const updatedSchedule: MergedSchedule = {
          ...schedule,
          status: 'Submitted',
          id: schedule.id.toString().startsWith('auto') ? `s-${Date.now()}` : schedule.id
      };

      currentLocal = currentLocal.filter(s => String(s.dispatchId) !== String(schedule.dispatchId));
      currentLocal.push(updatedSchedule);

      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(currentLocal));
      notifySchedulesUpdated();
      loadData();
      handleToast(`Successfully sent email to ${schedule.clientId} (${schedule.auditeeEmail}) for ${schedule.auditType} stage. Status is now Submitted.`);
    }
  };

  const handleApprove = (schedule: MergedSchedule) => {
    if(window.confirm(`Simulate client approving this schedule? This changes status to Approved.`)) {
      const schedulesRaw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
      let currentLocal: MergedSchedule[] = schedulesRaw ? JSON.parse(schedulesRaw) : [];

      const updatedSchedule: MergedSchedule = {
          ...schedule,
          status: 'Approved',
          id: schedule.id.toString().startsWith('auto') ? `s-${Date.now()}` : schedule.id
      };

      currentLocal = currentLocal.filter(s => String(s.dispatchId) !== String(schedule.dispatchId));
      currentLocal.push(updatedSchedule);

      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(currentLocal));
      notifySchedulesUpdated();
      loadData();
      handleToast(`Client approved schedule for ${schedule.organization}! Status changed to Approved.`);
      // Fire email notification
      sendAuditNotification({
        toEmail: updatedSchedule.auditeeEmail || '',
        clientName: updatedSchedule.organization || '',
        auditType: updatedSchedule.auditType || '',
        auditDate: updatedSchedule.date || '',
        auditor: updatedSchedule.auditor || '',
        standard: updatedSchedule.certificationStandard || '',
        location: updatedSchedule.location,
      }).catch(() => {/* non-blocking */});
    }
  };

  const handleDelete = (dispatchId?: number) => {
    if (!dispatchId) return;
    if (window.confirm('Clear schedule assignment?')) {
      const schedulesRaw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
      if (schedulesRaw) {
        const currentLocal: MergedSchedule[] = JSON.parse(schedulesRaw);
        const updatedLocal = currentLocal.filter(s => s.dispatchId !== dispatchId);
        localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(updatedLocal));
        notifySchedulesUpdated();
        loadData();
        handleToast('Assignment cleared');
      }
    }
  };

  // Enhanced Helper to Generate Comprehensive Word Document Content with all data
  const generateDocumentContent = (schedule: MergedSchedule) => {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${schedule.auditType} Audit Schedule - ${schedule.organization}</title>
        <style>
          body { font-family: 'Times New Roman', serif; margin: 20px; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; }
          .header { text-align: center; font-weight: bold; margin-bottom: 20px; font-size: 16pt; text-decoration: underline; }
          .bold { font-weight: bold; }
          .section-header { background-color: #e8e8e8; font-weight: bold; padding: 10px; margin-top: 15px; margin-bottom: 10px; }
          .footer-text { font-size: 10pt; line-height: 1.4; }
          .info-row { margin-bottom: 8px; }
          .summary-table { width: 100%; border-collapse: collapse; }
          .summary-table td { border: 1px solid #000; padding: 6px; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <div style="text-align: right; font-size: 9pt; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div><span class="bold">Document ID:</span> BS_QMS_CR_F17</div>
          <div><span class="bold">Issue No:</span> 01 | <span class="bold">Revision:</span> 00</div>
          <div><span class="bold">Date Generated:</span> ${currentDate}</div>
        </div>
        
        <div class="header">
          ${schedule.auditType.toUpperCase()} AUDIT SCHEDULE / PLAN
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3>${schedule.organization}</h3>
        </div>

        <div class="section-header">CLIENT & ORGANIZATION INFORMATION</div>
        <table class="summary-table">
          <tr>
            <td style="width: 50%;"><span class="bold">Organization Name:</span><br/>${schedule.organization}</td>
            <td style="width: 50%;"><span class="bold">Audit Type:</span><br/>${schedule.auditType}</td>
          </tr>
          <tr>
            <td><span class="bold">Client / Auditee:</span><br/>${schedule.auditee}</td>
            <td><span class="bold">Email:</span><br/>${schedule.auditeeEmail}</td>
          </tr>
          <tr>
            <td><span class="bold">Phone:</span><br/>${schedule.auditeePhone}</td>
            <td><span class="bold">Department:</span><br/>${schedule.department}</td>
          </tr>
          <tr>
            <td><span class="bold">Location:</span><br/>${schedule.location}</td>
            <td><span class="bold">Certification Standard:</span><br/>${schedule.certificationStandard}</td>
          </tr>
        </table>

        <div class="section-header">AUDIT SCHEDULE DETAILS</div>
        <table class="summary-table">
          <tr>
            <td style="width: 50%;"><span class="bold">Scheduled Audit Date:</span><br/>${schedule.date}</td>
            <td style="width: 50%;"><span class="bold">Audit Duration:</span><br/>${schedule.duration}</td>
          </tr>
          <tr>
            <td><span class="bold">Audit Scope:</span><br/>${schedule.auditScope}</td>
            <td><span class="bold">Status:</span><br/><span class="bold" style="color: ${schedule.status === 'Approved' ? '#16a34a' : schedule.status === 'Submitted' ? '#2563eb' : '#ea580c'}">${schedule.status}</span></td>
          </tr>
          <tr>
            <td colspan="2"><span class="bold">Applicable ISO Clauses:</span><br/>4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3</td>
          </tr>
        </table>

        <div class="section-header">AUDIT TEAM COMPOSITION</div>
        <table>
          <tr style="background-color: #d0d0d0;">
            <th style="text-align: center; width: 10%;">S.No.</th>
            <th style="text-align: center; width: 20%;">Role</th>
            <th style="text-align: center; width: 35%;">Name</th>
            <th style="text-align: center; width: 35%;">Email</th>
          </tr>
          <tr>
            <td style="text-align: center;">1</td>
            <td style="text-align: center;">Lead Auditor</td>
            <td>${schedule.leadAuditor}</td>
            <td>${schedule.leadAuditorEmail}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td style="text-align: center;">Member Auditor</td>
            <td>${schedule.auditor}</td>
            <td>${schedule.auditorEmail}</td>
          </tr>
        </table>

        <div class="section-header">DETAILED AUDIT PLAN</div>
        <table>
          <tr style="background-color: #d0d0d0;">
            <th style="text-align: center; width: 12%;">Date</th>
            <th style="text-align: center; width: 12%;">Time</th>
            <th style="text-align: center; width: 35%;">Audit Department & ISO Clauses</th>
            <th style="text-align: center; width: 20%;">Auditee / Department</th>
            <th style="text-align: center; width: 21%;">Lead Auditor</th>
          </tr>
          <tr>
            <td style="text-align: center;">${schedule.date}</td>
            <td style="text-align: center;">09:00 - 10:00</td>
            <td><span class="bold">Opening Meeting & Orientation</span><br/>Scope clarification, document review, site tour</td>
            <td>Management Representative</td>
            <td>${schedule.leadAuditor}</td>
          </tr>
          <tr>
            <td style="text-align: center;">${schedule.date}</td>
            <td style="text-align: center;">10:00 - 12:00</td>
            <td><span class="bold">Management & Documentation Review</span><br/>Clauses: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.1.5.2, 7.1.6</td>
            <td>Quality Manager</td>
            <td>${schedule.leadAuditor}</td>
          </tr>
          <tr>
            <td style="text-align: center;">${schedule.date}</td>
            <td style="text-align: center;">12:00 - 13:00</td>
            <td colspan="3" style="text-align: center; background-color: #f0f0f0;"><span class="bold">LUNCH BREAK</span></td>
          </tr>
          <tr>
            <td style="text-align: center;">${schedule.date}</td>
            <td style="text-align: center;">13:00 - 15:00</td>
            <td><span class="bold">Operations / Production Audit</span><br/>Clauses: 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7</td>
            <td>Production Head / Operations Manager</td>
            <td>${schedule.auditor}</td>
          </tr>
          <tr>
            <td style="text-align: center;">${schedule.date}</td>
            <td style="text-align: center;">15:00 - 16:00</td>
            <td><span class="bold">Support Functions & Resources</span><br/>Clauses: 7.1.2, 7.2, 7.3</td>
            <td>HR Manager / Admin Head</td>
            <td>${schedule.leadAuditor}, ${schedule.auditor}</td>
          </tr>
          <tr>
            <td style="text-align: center;">${schedule.date}</td>
            <td style="text-align: center;">16:00 - 16:30</td>
            <td><span class="bold">Performance Evaluation & Monitoring</span><br/>Clauses: 9.1, 9.2, 9.3</td>
            <td>Quality Manager</td>
            <td>${schedule.leadAuditor}</td>
          </tr>
          <tr>
            <td style="text-align: center;">${schedule.date}</td>
            <td style="text-align: center;">16:30 - 17:00</td>
            <td><span class="bold">Closing Meeting & Preliminary Findings</span><br/>Improvement opportunities and management responsibilities</td>
            <td>Senior Management</td>
            <td>${schedule.leadAuditor}</td>
          </tr>
        </table>

        <div class="section-header">COMPLIANCE CHECKLIST</div>
        <table>
          <tr style="background-color: #d0d0d0;">
            <th style="width: 50%;">Audit Area</th>
            <th style="width: 25%; text-align: center;">ISO Clause</th>
            <th style="width: 25%; text-align: center;">Coverage</th>
          </tr>
          <tr>
            <td>Quality Management System</td>
            <td style="text-align: center;">4.1 - 6.3</td>
            <td style="text-align: center;">✓</td>
          </tr>
          <tr>
            <td>Product/Service Planning</td>
            <td style="text-align: center;">8.1 - 8.2</td>
            <td style="text-align: center;">✓</td>
          </tr>
          <tr>
            <td>Performance Evaluation</td>
            <td style="text-align: center;">9.1 - 9.3</td>
            <td style="text-align: center;">✓</td>
          </tr>
          <tr>
            <td>Improvement</td>
            <td style="text-align: center;">10.1 - 10.3</td>
            <td style="text-align: center;">✓</td>
          </tr>
        </table>

        <br/>
        <table style="border: none; margin-top: 50px; text-align: center;">
          <tr>
            <td style="border: none; width: 50%; vertical-align: top;">
              _______________________________<br/><br/>
              <span class="bold">Prepared By:</span><br/>
              <span class="bold">Name:</span> ___________________<br/>
              <span class="bold">Role:</span> Audit Coordinator<br/>
              <span class="bold">Date:</span> ${currentDate}
            </td>
            <td style="border: none; width: 50%; vertical-align: top;">
              _______________________________<br/><br/>
              <span class="bold">Approved By:</span><br/>
              <span class="bold">Name:</span> ___________________<br/>
              <span class="bold">Role:</span> Technical Manager<br/>
              <span class="bold">Date:</span> ___________________
            </td>
          </tr>
        </table>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #000; font-size: 9pt; color: #666;">
          <p><span class="bold">Notes:</span></p>
          <ul>
            <li>This schedule is subject to modification based on audit findings and client requirements.</li>
            <li>All audit team members must adhere to confidentiality requirements.</li>
            <li>Physical records and documentation must be handled per ISO 9001 standards.</li>
            <li>Audit report will be issued within 15 business days from audit completion.</li>
          </ul>
        </div>
      </body>
      </html>
    `;
  };

  const handleView = (schedule: MergedSchedule) => {
    const content = generateDocumentContent(schedule);
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `View_Audit_Schedule_${schedule.organization.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleToast(`Generated document view for ${schedule.organization}`);
  };

  const handleDownload = (schedule: MergedSchedule) => {
    const content = generateDocumentContent(schedule);
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `IQA_Schedule_${schedule.auditType.replace(/\s+/g, '_')}_${schedule.organization.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleToast(`Downloaded ${schedule.auditType} schedule for ${schedule.organization}`);
  };

  const filteredSchedules = schedules.filter(s => s.auditType === activeTab);

  const renderScheduleTable = (data: MergedSchedule[], title: string) => {
    return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(255, 215, 0, 0.45)', color: '#d97706', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }} title="Client working model handled by Audit Coordinator">
        <span aria-hidden="true">🏷️</span> Client Working Model · Coordinator
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{title}</h3>
        <span style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{data.length}</span>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', background: '#f8fafc', borderRadius: 16, border: '2px dashed #e2e8f0' }}>
          <AlertCircle size={32} style={{ color: '#94a3b8', display: 'block', margin: '0 auto 8px' }} />
          <p style={{ color: '#64748b', margin: 0 }}>No {title.toLowerCase()}s found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {data.map((schedule) => {
            const sc = schedule.status === 'Approved'  ? { bg: '#d1fae5', text: '#065f46', dot: '#10b981' }
                     : schedule.status === 'Submitted' ? { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' }
                     : schedule.status === 'Completed' ? { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' }
                     : { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' };
            const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'background 0.15s' };
            return (
              <div key={schedule.id}
                style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.08)', border: '1px solid #e2e8f0', transition: 'transform 0.18s,box-shadow 0.18s', display: 'flex', flexDirection: 'column' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-2px)'; d.style.boxShadow = '0 8px 28px rgba(15,23,42,0.14)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.boxShadow = '0 2px 12px rgba(15,23,42,0.08)'; }}
              >
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#f8faff,#eff6ff)', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 2 }}>{schedule.clientId}</div>
                    <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 4 }}>{schedule.organization}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>📧 {schedule.auditeeEmail}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>📱 {schedule.auditeePhone}&nbsp;·&nbsp;📍 {schedule.location}</div>
                  </div>
                  <span style={{ ...btnBase, background: sc.bg, color: sc.text, padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                    {schedule.status}
                  </span>
                </div>

                {/* Body */}
                <div style={{ padding: '14px 20px', flex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 12 }}>
                    {[
                      { label: 'Certification', value: schedule.certificationStandard },
                      { label: 'Department',    value: schedule.department },
                      { label: 'Audit Date',    value: `📅 ${schedule.date}`,    bold: true, color: '#2563eb' },
                      { label: 'Duration',      value: `⏱ ${schedule.duration}` },
                    ].map(({ label, value, bold, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: bold ? 700 : 600, color: color || '#334155', marginTop: 2 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, color: '#475569' }}>Scope: </span>{schedule.auditScope}
                  </div>

                  {/* Team avatars */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { name: schedule.leadAuditor, role: 'Lead Auditor',  bg: 'linear-gradient(135deg,#3b82f6,#6366f1)', nameBg: '#eff6ff', nameColor: '#1e40af', roleColor: '#60a5fa' },
                      { name: schedule.auditor,     role: 'Auditor',       bg: 'linear-gradient(135deg,#10b981,#059669)', nameBg: '#f0fdf4', nameColor: '#065f46', roleColor: '#34d399' },
                    ].map(({ name, role, bg, nameBg, nameColor, roleColor }) => (
                      <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: nameBg, borderRadius: 10, padding: '8px 12px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{name.charAt(0)}</div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: nameColor }}>{name}</div>
                          <div style={{ fontSize: 10, color: roleColor }}>{role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#fafbff', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  {([
                    { icon: <Eye size={13}/>,      label: 'View',     bg: '#dbeafe', color: '#1e40af', hov: '#bfdbfe', fn: () => handleView(schedule) },
                    { icon: <Edit2 size={13}/>,    label: 'Edit',     bg: '#fce7f3', color: '#9d174d', hov: '#fbcfe8', fn: () => handleRowCreateSchedule(schedule) },
                    { icon: <Send size={13}/>,     label: 'Submit',   bg: '#ede9fe', color: '#5b21b6', hov: '#ddd6fe', fn: () => handleSubmitToClient(schedule) },
                    { icon: <Check size={13}/>,    label: 'Approve',  bg: '#d1fae5', color: '#065f46', hov: '#a7f3d0', fn: () => handleApprove(schedule) },
                    { icon: <Download size={13}/>, label: 'Download', bg: '#fef3c7', color: '#92400e', hov: '#fde68a', fn: () => handleDownload(schedule) },
                  ] as { icon: React.ReactNode; label: string; bg: string; color: string; hov: string; fn: () => void }[]).map(({ icon, label, bg, color, hov, fn }) => (
                    <button key={label} onClick={fn}
                      style={{ ...btnBase, background: bg, color }}
                      onMouseEnter={e => (e.currentTarget.style.background = hov)}
                      onMouseLeave={e => (e.currentTarget.style.background = bg)}
                    >{icon}{label}</button>
                  ))}
                  {schedule.status !== 'Pending' && (
                    <button onClick={() => handleDelete(schedule.dispatchId)}
                      style={{ ...btnBase, background: '#fee2e2', color: '#991b1b', marginLeft: 'auto' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fecaca')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fee2e2')}
                    ><Trash2 size={13}/>Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="audit-scope-container">
      {/* Custom Full Screen Toast */}
      {showToast && (
        <div style={{
            position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#10b981', color: 'white', padding: '16px 32px', borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 2000, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 12
        }}>
            <CheckCircle2 size={20} />
            {toastMessage}
        </div>
      )}

      <div className="scope-header">
        <div>
          <h1>Audit Schedules</h1>
          <p>Manage audit timelines (Synced with Received Applications)</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
            <button 
              className="add-btn" 
              style={{ background: '#64748b' }} 
              onClick={() => {
                const resetChoice = window.confirm('Do you want to:\n\n[OK] Reset to DEFAULT MOCK DATA (recommended if data missing)\n[Cancel] Just Refresh current data');
                if (resetChoice) {
                  resetToDefaultData();
                } else {
                  loadData();
                }
              }}
              title="Refresh or Reset Data"
            >
                <RefreshCw size={20} />
            </button>
            <button
              className="add-btn"
              style={{ background: '#f59e0b' }}
              onClick={() => navigate('/auditor-coordinator/audit-confirmation')}
              title="Open Surveillance Audits (annual surveillance + confirmation reminders)"
            >
                <ShieldAlert size={18} /> Surveillance Audits
            </button>
            <button className="add-btn" onClick={handleOpenNewSchedule}>
                <Plus size={20} /> New Schedule
            </button>
        </div>
      </div>

      {/* AI: smart scheduling copilot */}
      <SchedulingCopilotPanel schedules={schedules} />

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeftColor: '#2563eb' }}>
            <div className="stat-icon" style={{ color: '#2563eb' }}><CalendarIcon size={24} /></div>
            <div className="stat-content"><p className="stat-label">Total Requests</p><p className="stat-value">{schedules.length}</p></div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#f59e0b' }}>
            <div className="stat-icon" style={{ color: '#f59e0b' }}><Clock size={24} /></div>
            <div className="stat-content"><p className="stat-label">Scheduled (Pending)</p><p className="stat-value">{schedules.filter(s => s.status === 'Pending').length}</p></div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#10b981' }}>
            <div className="stat-icon" style={{ color: '#10b981' }}><CheckCircle2 size={24} /></div>
            <div className="stat-content"><p className="stat-label">Approved</p><p className="stat-value">{schedules.filter(s => s.status === 'Approved').length}</p></div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#a855f7' }}>
            <div className="stat-icon" style={{ color: '#a855f7' }}><Users size={24} /></div>
            <div className="stat-content"><p className="stat-label">Completed</p><p className="stat-value">{schedules.filter(s => s.status === 'Completed').length}</p></div>
        </div>
      </div>

      {/* Tabs / Sliding Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', background: '#e2e8f0', padding: '6px', borderRadius: '10px', width: 'fit-content' }}>
          {['Initial', 'Surveillance 1', 'Surveillance 2', 'Transfer'].map(tab => (
              <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: activeTab === tab ? '#ffffff' : 'transparent',
                      boxShadow: activeTab === tab ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                      color: activeTab === tab ? '#0f172a' : '#64748b',
                      fontWeight: activeTab === tab ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '14px'
                  }}
              >
                  {tab} Audit
              </button>
          ))}
      </div>

      {/* Tables - Render Active Tab Only */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
          {renderScheduleTable(filteredSchedules, `${activeTab} Audit`)}
      </div>

      {/* Full Screen Create Schedule Modal */}
      {showForm && (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div className="checklist-form" style={{ width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: 40, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                    <h2>Create / Edit Audit Schedule</h2>
                    <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    {/* Client & Org */}
                    <div className="form-row">
                        <div className="form-group">
                            <label>Client (Select from options)</label>
                            <select name="dispatchId" value={formData.dispatchId} onChange={handleFormChange} required>
                                <option value="">-- Select Client --</option>
                                {availableClients.map(c => (
                                    <option key={c.id} value={c.id}>{c.clientName} ({c.auditType})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Organization</label>
                            <select name="organization" value={formData.organization} onChange={handleFormChange as any} disabled className="bg-gray-100">
                                <option value={formData.organization}>{formData.organization || '-- Auto Filled --'}</option>
                            </select>
                        </div>
                    </div>

                     {/* Contact & Date */}
                     <div className="form-row">
                         <div className="form-group">
                            <label>Contact Person</label>
                            <select name="contact" value={formData.contact} onChange={handleFormChange as any} disabled className="bg-gray-100">
                                <option value={formData.contact}>{formData.contact || '-- Auto Filled --'}</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Audit Date</label>
                            <input type="date" name="date" value={formData.date} onChange={handleFormChange} required />
                        </div>
                    </div>

                    {/* Auditors */}
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, marginTop: 16 }}>
                        <h4 style={{ marginBottom: 16, color: '#475569', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User size={18} /> Auditor Assignment
                        </h4>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Lead Auditor</label>
                                <select name="leadAuditor" value={formData.leadAuditor} onChange={handleFormChange} required>
                                    <option value="">-- Select Lead Auditor --</option>
                                    {auditors.filter(a => a.role === 'Lead Auditor').map(a => (
                                        <option key={a.id} value={a.name}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Lead Auditor Email</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
                                    <select name="leadAuditorEmail" value={formData.leadAuditorEmail} onChange={handleFormChange as any} disabled style={{ paddingLeft: 36 }} className="bg-gray-100">
                                        <option value={formData.leadAuditorEmail}>{formData.leadAuditorEmail || '-- Auto Filled --'}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                         <div className="form-row">
                            <div className="form-group">
                                <label>Assigned Auditor</label>
                                <select name="auditor" value={formData.auditor} onChange={handleFormChange} required>
                                    <option value="">-- Select Auditor --</option>
                                    {auditors.filter(a => a.status === 'Active').map(a => (
                                        <option key={a.id} value={a.name}>{a.name} ({a.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Auditor Email</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
                                    <select name="auditorEmail" value={formData.auditorEmail} onChange={handleFormChange as any} disabled style={{ paddingLeft: 36 }} className="bg-gray-100">
                                        <option value={formData.auditorEmail}>{formData.auditorEmail || '-- Auto Filled --'}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Auditee Contact Info */}
                    <div style={{ background: '#f0fdf4', padding: 20, borderRadius: 8, marginTop: 16 }}>
                         <h4 style={{ marginBottom: 16, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Phone size={18} /> Auditee Contact
                        </h4>
                        <div className="form-row">
                             <div className="form-group">
                                <label>Auditee (Client Name)</label>
                                <select name="auditee" value={formData.auditee} onChange={handleFormChange as any} disabled className="bg-gray-100">
                                     <option value={formData.auditee}>{formData.auditee || '-- Auto Filled --'}</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
                                    <select name="auditeeEmail" value={formData.auditeeEmail} onChange={handleFormChange as any} disabled style={{ paddingLeft: 36 }} className="bg-gray-100">
                                        <option value={formData.auditeeEmail}>{formData.auditeeEmail || '-- Auto Filled --'}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="form-row">
                             <div className="form-group">
                                <label>Phone Number</label>
                                <div style={{ position: 'relative' }}>
                                    <Phone size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
                                    <input type="tel" name="auditeePhone" value={formData.auditeePhone} onChange={handleFormChange} style={{ paddingLeft: 36 }} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Department</label>
                                <input type="text" name="department" value={formData.department} onChange={handleFormChange} required />
                            </div>
                        </div>
                    </div>

                    {/* Audit Details */}
                    <div style={{ background: '#f3f4f6', padding: 20, borderRadius: 8, marginTop: 16 }}>
                        <h4 style={{ marginBottom: 16, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CalendarIcon size={18} /> Audit Details
                        </h4>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Location</label>
                                <input type="text" name="location" value={formData.location} onChange={handleFormChange} required />
                            </div>
                            <div className="form-group">
                                <label>Certification Standard</label>
                                <select name="certificationStandard" value={formData.certificationStandard} onChange={handleFormChange} required>
                                    <option value="ISO 9001:2015">ISO 9001:2015</option>
                                    <option value="ISO 9001:2008">ISO 9001:2008</option>
                                    <option value="ISO 14001:2015">ISO 14001:2015</option>
                                    <option value="ISO 45001:2018">ISO 45001:2018</option>
                                    <option value="ISO/IEC 27001:2013">ISO/IEC 27001:2013</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Audit Duration</label>
                                <select name="duration" value={formData.duration} onChange={handleFormChange} required>
                                    <option value="1 day">1 Day</option>
                                    <option value="2 days">2 Days</option>
                                    <option value="3 days">3 Days</option>
                                    <option value="1 week">1 Week</option>
                                    <option value="2 weeks">2 Weeks</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Audit Type</label>
                                <select name="auditType" value={availableClients.find(c => String(c.id) === formData.dispatchId)?.auditType || 'Initial'} disabled className="bg-gray-100">
                                    <option>{availableClients.find(c => String(c.id) === formData.dispatchId)?.auditType || 'Initial'}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Audit Scope */}
                    <div style={{ background: '#eff6ff', padding: 20, borderRadius: 8, marginTop: 16 }}>
                        <h4 style={{ marginBottom: 16, color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: 8 }}>
                            📋 Audit Scope & Remarks
                        </h4>
                        <div className="form-group">
                            <label>Audit Scope</label>
                            <textarea 
                                name="auditScope" 
                                value={formData.auditScope} 
                                onChange={handleFormChange as any}
                                style={{ width: '100%', minHeight: '100px', fontFamily: 'Arial, sans-serif', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'vertical' }}
                                required
                            ></textarea>
                        </div>
                    </div>

                    <div className="form-actions" style={{ marginTop: 32 }}>
                        <button type="submit" className="submit-btn" style={{ fontSize: 16, padding: '12px 24px' }}>Add</button>
                        <button type="button" className="cancel-btn" onClick={() => setShowForm(false)} style={{ fontSize: 16, padding: '12px 24px' }}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
export default AuditSchedules;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import AuditorRegistration from '../../components/AuditorRegistration';
import RoleWorkflowOverview from '../../components/RoleWorkflowOverview';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [showAudReg, setShowAudReg] = useState(false);

  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      <RoleWorkflowOverview role="Auditor" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#0f172a' }}>Auditor Workspace</h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>Manage your assigned audits, checklists, and reports.</p>
        </div>
        <button onClick={() => setShowAudReg(true)} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#06b6d4', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Auditor details</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat icon={<Calendar size={20} />}     color="#2563eb" label="Upcoming Audits"  value="4" />
        <Stat icon={<ClipboardList size={20} />} color="#f59e0b" label="In Progress"      value="1" />
        <Stat icon={<FileText size={20} />}     color="#7c3aed" label="Pending Reports"  value="2" />
        <Stat icon={<CheckCircle2 size={20} />} color="#16a34a" label="Action Items"     value="5" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <ActionCard title="Confirm Schedules" desc="Review proposed audit dates"     icon={<Calendar size={22} />}     color="#2563eb" onClick={() => navigate('/auditor/schedule-confirmations')} />
        <ActionCard title="Conduct Audit"      desc="Run a live audit"                icon={<ClipboardList size={22} />} color="#f59e0b" onClick={() => navigate('/auditor/conduct-audit')} />
        <ActionCard title="Draft Report"       desc="Write up findings"               icon={<FileText size={22} />}     color="#7c3aed" onClick={() => navigate('/auditor/audit-report')} />
        <ActionCard title="Verify Actions"     desc="Close corrective actions"        icon={<CheckCircle2 size={22} />} color="#16a34a" onClick={() => navigate('/auditor/action-review')} />
      </div>

      {showAudReg && <AuditorRegistration onClose={() => setShowAudReg(false)} />}
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; color: string; label: string; value: string }> = ({ icon, color, label, value }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 16, borderLeft: '4px solid ' + color, boxShadow: '0 1px 3px rgba(15,23,42,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '20', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
    <div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
    </div>
  </div>
);

const ActionCard: React.FC<{ title: string; desc: string; icon: React.ReactNode; color: string; onClick: () => void }> = ({ title, desc, icon, color, onClick }) => (
  <button onClick={onClick} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '20', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
    <div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{desc}</div>
    </div>
  </button>
);

export default Dashboard;

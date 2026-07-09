import React from 'react';
import { 
  LayoutDashboard, 
  CalendarClock, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/LeadAuditor/Dashboard.css';
import RoleWorkflowOverview from '../../components/RoleWorkflowOverview';

interface AuditSummary {
  id: string;
  client: string;
  type: string;
  date: string;
  status: 'Scheduled' | 'In Progress' | 'Pending Report';
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Mock Data for Dashboard
  const stats = [
    { label: 'Upcoming Audits', value: 3, icon: <CalendarClock size={24} />, color: 'blue' },
    { label: 'Audits In Progress', value: 1, icon: <Clock size={24} />, color: 'orange' },
    { label: 'Reports Pending', value: 2, icon: <FileText size={24} />, color: 'purple' },
    { label: 'Actions to Review', value: 5, icon: <CheckCircle2 size={24} />, color: 'green' },
  ];

  const upcomingAudits: AuditSummary[] = [
    { id: 'AUD-101', client: 'Acme Corp', type: 'ISO 9001:2015', date: '2025-10-25', status: 'Scheduled' },
    { id: 'AUD-102', client: 'Tech Solutions', type: 'ISO 27001', date: '2025-10-28', status: 'Scheduled' },
    { id: 'AUD-103', client: 'Global Logistics', type: 'ISO 14001', date: '2025-11-02', status: 'In Progress' },
    { id: 'AUD-104', client: 'MediCare Systems', type: 'ISO 13485', date: '2025-11-05', status: 'Pending Report' },
  ];

  const notifications = [
    { id: 1, text: 'Audit Report for "Green Energy" is due tomorrow.', type: 'urgent' },
    { id: 2, text: 'New Corrective Actions submitted by "Tech Solutions".', type: 'info' },
    { id: 3, text: 'Schedule confirmation pending for "Alpha Industries".', type: 'warning' },
  ];

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'status-scheduled';
      case 'In Progress': return 'status-progress';
      case 'Pending Report': return 'status-pending';
      default: return '';
    }
  };

  return (
    <div className="lead-dashboard">
      <RoleWorkflowOverview role="Lead Auditor" />
      {/* Header Section */}
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, Lead Auditor</h1>
          <p>Here's what's happening with your audits today.</p>
        </div>
        <div className="date-badge">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className={`stat-card border-${stat.color}`}>
            <div className={`icon-wrapper bg-${stat.color}`}>
              {stat.icon}
            </div>
            <div className="stat-content">
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-content-split">
        {/* Left Column: Upcoming Audits */}
        <div className="main-section">
          <div className="section-header">
            <h2><ClipboardList size={20} /> Audit Activity</h2>
            <button className="btn-link" onClick={() => navigate('/lead-auditor/audit-schedules')}>
              View Schedule <ArrowRight size={16} />
            </button>
          </div>
          
          <div className="card-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Audit Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {upcomingAudits.map((audit) => (
                  <tr key={audit.id}>
                    <td>
                      <div className="client-name">{audit.client}</div>
                      <span className="audit-id">{audit.id}</span>
                    </td>
                    <td>{audit.type}</td>
                    <td>{audit.date}</td>
                    <td><span className={`status-pill ${getStatusClass(audit.status)}`}>{audit.status}</span></td>
                    <td>
                      {audit.status === 'In Progress' ? (
                        <button className="btn-action" onClick={() => navigate('/lead-auditor/conduct-audit')}>Resume</button>
                      ) : audit.status === 'Pending Report' ? (
                        <button className="btn-action" onClick={() => navigate('/lead-auditor/audit-report')}>Report</button>
                      ) : (
                        <button className="btn-action-secondary" onClick={() => navigate('/lead-auditor/audit-schedules')}>View</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Quick Actions & Notifications */}
        <div className="side-section">
          {/* Quick Actions */}
          <div className="action-card">
            <h3>Quick Actions</h3>
            <div className="quick-actions-grid">
              <button onClick={() => navigate('/lead-auditor/conduct-audit')}>
                <div className="qa-icon blue"><ClipboardList size={20} /></div>
                <span>Conduct Audit</span>
              </button>
              <button onClick={() => navigate('/lead-auditor/audit-report')}>
                <div className="qa-icon purple"><FileText size={20} /></div>
                <span>Create Report</span>
              </button>
              <button onClick={() => navigate('/lead-auditor/action-review')}>
                <div className="qa-icon green"><CheckCircle2 size={20} /></div>
                <span>Review Actions</span>
              </button>
              <button onClick={() => navigate('/lead-auditor/submit-schedule')}>
                <div className="qa-icon orange"><CalendarClock size={20} /></div>
                <span>Plan Schedule</span>
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div className="notification-card">
            <h3>Notifications</h3>
            <div className="notification-list">
              {notifications.map((notif) => (
                <div key={notif.id} className={`notification-item ${notif.type}`}>
                  {notif.type === 'urgent' ? <AlertTriangle size={16} className="text-red" /> : 
                   notif.type === 'warning' ? <Clock size={16} className="text-orange" /> :
                   <LayoutDashboard size={16} className="text-blue" />}
                  <p>{notif.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import { useMemo, useState } from 'react';
import { 
  Activity, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  FileText, 
  ArrowRight
} from 'lucide-react';
import AIPanel from '../../components/AIPanel';
import {
  READINESS_STANDARDS,
  READINESS_QUESTIONS,
  assessReadiness,
} from '../../ai/auditeeInsights';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import RoleWorkflowOverview from '../../components/RoleWorkflowOverview';

// Mock data
const dashboardData = {
  user: {
    name: 'John Doe',
    company: 'Tech Solutions Inc.'
  },
  metrics: [
    { id: 'total', label: 'Total Audits', value: 12, icon: 'FileText', trend: '+15%', color: 'blue' },
    { id: 'completed', label: 'Completed', value: 8, icon: 'CheckCircle', trend: '+8%', color: 'green' },
    { id: 'inProgress', label: 'In Progress', value: 3, icon: 'Clock', trend: '+2%', color: 'yellow' },
    { id: 'pending', label: 'Pending', value: 1, icon: 'AlertTriangle', trend: '-5%', color: 'red' },
    { id: 'compliance', label: 'Compliance Score', value: 92, icon: 'Activity', trend: '+3%', color: 'green' }
  ],
  auditStatusDist: [
    { status: 'Completed', count: 8, color: 'bg-green', percentage: 67 },
    { status: 'In Progress', count: 3, color: 'bg-yellow', percentage: 25 },
    { status: 'Pending', count: 1, color: 'bg-red', percentage: 8 }
  ],
  recentActivities: [
    { id: 'a1', type: 'schedule', message: 'Quality Management Audit scheduled for Jan 15, 2025', date: '2 hours ago' },
    { id: 'a2', type: 'success', message: 'Environmental Compliance Audit completed successfully', date: '1 day ago' },
    { id: 'a3', type: 'alert', message: 'Action items pending for Health & Safety Audit', date: '3 days ago' }
  ],
  upcomingDeadlines: [
    { id: 'd1', title: 'Submit Corrective Actions', dueDate: '2025-01-10', priority: 'high' },
    { id: 'd2', title: 'ISO 27001 Compliance Review', dueDate: '2025-01-20', priority: 'medium' },
    { id: 'd3', title: 'Annual Audit Report', dueDate: '2025-02-15', priority: 'low' }
  ]
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, metrics, auditStatusDist, recentActivities, upcomingDeadlines } = dashboardData;

  // --- AI Readiness Self-Assessment (feature 16) ---
  const [readyStandard, setReadyStandard] = useState<string>(READINESS_STANDARDS[0]);
  const [readyAnswers, setReadyAnswers] = useState<Record<string, boolean | null>>({});
  const readiness = useMemo(
    () => assessReadiness(readyStandard, readyAnswers),
    [readyStandard, readyAnswers]
  );
  const setAnswer = (id: string, value: boolean) =>
    setReadyAnswers((prev) => ({ ...prev, [id]: prev[id] === value ? null : value }));

  // Helper to get icon based on activity type
  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'schedule': return <Calendar className="act-icon icon-blue" />;
      case 'success': return <CheckCircle className="act-icon icon-green" />;
      case 'alert': return <AlertTriangle className="act-icon icon-red" />;
      default: return <FileText className="act-icon icon-gray" />;
    }
  };

  return (
    <div className="dashboard-container">
      <RoleWorkflowOverview role="Auditee" />
      {/* Welcome Banner */}
      <div className="welcome-section">
        <div>
          <h1>Welcome back, {user.name}</h1>
          <p>Here's what's happening with your audits at <strong>{user.company}</strong> today.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/audit-client/pre-auditee')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#fef3c7', color: '#a16207',
              border: '1px solid #fcd34d', padding: '8px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
            title="All work that happens before becoming an Auditee"
          >
            <Inbox size={14} /> Pre-Auditee
          </button>
          <div className="date-badge">
            <Clock className="icon-xs" />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* AI Readiness Self-Assessment */}
      <AIPanel
        title="Readiness Self-Assessment"
        subtitle="Answer 8 quick questions to estimate certification readiness"
        defaultCollapsed
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <select
            value={readyStandard}
            onChange={(e) => setReadyStandard(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
          >
            {READINESS_STANDARDS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className={'ai-chip ' + (readiness.score >= 75 ? 'ok' : readiness.score >= 40 ? 'med' : 'high')}>
            Readiness {readiness.score}%
          </span>
          {readiness.unanswered.length > 0 && (
            <span className="ai-chip info">{readiness.unanswered.length} unanswered</span>
          )}
        </div>
        <ul className="ai-insight-list">
          {READINESS_QUESTIONS.map((q) => {
            const val = readyAnswers[q.id] ?? null;
            return (
              <li key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 12.5 }}>{q.label}</span>
                <button
                  onClick={() => setAnswer(q.id, true)}
                  style={{
                    padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid ' + (val === true ? '#059669' : '#cbd5e1'),
                    background: val === true ? '#d1fae5' : '#fff', color: val === true ? '#059669' : '#64748b',
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setAnswer(q.id, false)}
                  style={{
                    padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid ' + (val === false ? '#dc2626' : '#cbd5e1'),
                    background: val === false ? '#fee2e2' : '#fff', color: val === false ? '#dc2626' : '#64748b',
                  }}
                >
                  No
                </button>
              </li>
            );
          })}
        </ul>
        {readiness.gaps.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12.5 }}>
            <strong>Gaps to close:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              {readiness.gaps.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        )}
        <p className="ai-panel-note">Next step: {readiness.nextStep}</p>
      </AIPanel>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {metrics.map((m) => {
          const Icon = ({
            FileText,
            CheckCircle,
            Clock,
            AlertTriangle,
            Activity
          } as any)[m.icon] || FileText;

          return (
            <div className="kpi-card" key={m.id}>
              <div className="kpi-header">
                <span className="kpi-title">{m.label}</span>
                <div className={`kpi-icon-bg bg-${m.color}`}>
                  <Icon className="icon-sm" />
                </div>
              </div>
              <div className="kpi-value">{typeof m.value === 'number' ? m.value : m.value}</div>
              <div className="kpi-trend">
                <span>{m.trend}</span>
              </div>
              {m.id === 'compliance' && (
                <div className="progress-bar-mini">
                  <div className="progress-fill" style={{ width: `${m.value}%` }}></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Content Split */}
      <div className="dashboard-content-grid">
        
        {/* Left Column: Status & Deadlines */}
        <div className="content-col-left">
          
          {/* Audit Status Distribution */}
          <div className="dash-card mb-6">
            <div className="card-header">
              <h3>Audit Status Overview</h3>
            </div>
            <div className="status-list">
              {auditStatusDist.map((item) => (
                <div key={item.status} className="status-item">
                  <div className="status-info">
                    <span className="status-label">{item.status}</span>
                    <span className="status-count">{item.count}</span>
                  </div>
                  <div className="status-bar-bg">
                    <div 
                      className={`status-bar-fill ${item.color.replace('bg-', 'fill-')}`} 
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="dash-card">
            <div className="card-header">
              <h3>Upcoming Deadlines</h3>
              <button className="btn-link">View Calendar</button>
            </div>
            <div className="deadline-list">
              {upcomingDeadlines.map((item) => (
                <div key={item.id} className={`deadline-item ${item.priority === 'high' ? 'urgent' : ''}`}>
                  <div className="deadline-date">
                    <span className="day">{new Date(item.dueDate).getDate()}</span>
                    <span className="month">{new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short' })}</span>
                  </div>
                  <div className="deadline-details">
                    <span className="task-name">{item.title}</span>
                    {item.priority === 'high' && <span className="urgent-badge">Due Soon</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="content-col-right">
          <div className="dash-card h-full">
            <div className="card-header">
              <h3>Recent Activity</h3>
              <button className="btn-icon">
                <ArrowRight className="icon-sm" />
              </button>
            </div>
            <div className="activity-feed">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon-wrapper">
                    {getActivityIcon(activity.type)}
                    <div className="activity-line"></div>
                  </div>
                  <div className="activity-content">
                    <p className="act-title">{activity.message}</p>
                    <span className="act-time">{activity.date}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="card-footer">
              <button className="btn-full">View All Notifications</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
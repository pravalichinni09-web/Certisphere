import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationsBell from '../../components/NotificationsBell';
import BackButton from '../../components/BackButton';
import Dashboard from './Dashboard';
import PendingApplications from './PendingApplications';
import AuditActions from './AuditActions';
import SubmitReport from './SubmitReport';
import ScheduleApprovals from './ScheduleApprovals';
import PreAuditee from './PreAuditee';
import AuditWorkflow from './AuditWorkflow';
import '../../styles/AuditClient/Layout.css';

interface LayoutProps {
  onLogout: () => void;
}

const AuditClientLayout: React.FC<LayoutProps> = ({ onLogout }) => {
  return (
    <div className="client-layout">
      <Sidebar role="Auditee" onLogout={onLogout} />
      <NotificationsBell role="Auditee" />
      <div className="client-content">
        <BackButton />
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pending-applications" element={<PendingApplications />} />
          <Route path="/audit-actions" element={<AuditActions />} />
          <Route path="/submit-report" element={<SubmitReport />} />
          <Route path="/schedule-approvals" element={<ScheduleApprovals />} />
          <Route path="/pre-auditee" element={<PreAuditee />} />
          <Route path="/audit-workflow" element={<AuditWorkflow />} />
        </Routes>
      </div>
    </div>
  );
};

export default AuditClientLayout;

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationsBell from '../../components/NotificationsBell';
import BackButton from '../../components/BackButton';
import Dashboard from './Dashboard';
import AuditSchedules from './AuditSchedules';
import ConductAudit from './ConductAudit';
import AuditReport from './AuditReport';
import ActionReview from './ActionReview';
import ActionApproval from './ActionApproval';
import AuditorApprovals from './AuditorApprovals';
import AuditAnalysis from '../shared/AuditAnalysis';
import LeadAuditorWorkflow from './LeadAuditorWorkflow';
import '../../styles/LeadAuditor/Layout.css';

interface LayoutProps {
  onLogout: () => void;
}

const LeadAuditorLayout: React.FC<LayoutProps> = ({ onLogout }) => {
  return (
    <div className="lead-layout">
      <Sidebar role="Lead Auditor" onLogout={onLogout} />
      <NotificationsBell role="Lead Auditor" />
      <div className="lead-content">
        <BackButton />
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="audit-schedules" element={<AuditSchedules />} />
          <Route path="conduct-audit" element={<ConductAudit />} />
          <Route path="audit-report" element={<AuditReport />} />
          <Route path="action-review" element={<ActionReview />} />
          <Route path="action-approval" element={<ActionApproval />} />
          <Route path="auditor-approvals" element={<AuditorApprovals />} />
          <Route path="audit-analysis" element={<AuditAnalysis role="lead-auditor" />} />
          <Route path="workflow" element={<LeadAuditorWorkflow />} />
        </Routes>
      </div>
    </div>
  );
};

export default LeadAuditorLayout;

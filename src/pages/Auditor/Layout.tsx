import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationsBell from '../../components/NotificationsBell';
import BackButton from '../../components/BackButton';
import Dashboard from './Dashboard';
import ScheduleConfirmations from './ScheduleConfirmations';
import ConductAudit from './ConductAudit';
import AuditReport from './AuditReport';
import ActionReview from './ActionReview';
import '../../styles/Auditor/Layout.css';

interface LayoutProps {
  onLogout: () => void;
}

const AuditorLayout: React.FC<LayoutProps> = ({ onLogout }) => {
  return (
    <div className="auditor-layout">
      <Sidebar role="Auditor" onLogout={onLogout} />
      <NotificationsBell role="Auditor" />
      <div className="auditor-content">
        <BackButton />
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/schedule-confirmations" element={<ScheduleConfirmations />} />
          <Route path="/conduct-audit" element={<ConductAudit />} />
          <Route path="/audit-report" element={<AuditReport />} />
          <Route path="/action-review" element={<ActionReview />} />
        </Routes>
      </div>
    </div>
  );
};

export default AuditorLayout;

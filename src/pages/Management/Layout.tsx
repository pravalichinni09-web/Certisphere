import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationsBell from '../../components/NotificationsBell';
import BackButton from '../../components/BackButton';
import Dashboard from './Dashboard';
import ClientCredentials from './ClientCredentials';
import AuditAssignments from './AuditAssignments';
import AuditorApprovals from './AuditorApprovals';
import GlobalSettings from './GlobalSettings';
import ClientOnboarding from './ClientOnboarding';
import GrowthAnalytics from './GrowthAnalytics';
import '../../styles/Auditor/Layout.css';

interface LayoutProps {
  onLogout: () => void;
}

const ManagementLayout: React.FC<LayoutProps> = ({ onLogout }) => {
  return (
    <div className="auditor-layout">
      <Sidebar role="Management" onLogout={onLogout} />
      <NotificationsBell role="Management" />
      <div className="auditor-content">
        <BackButton />
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/client-credentials" element={<ClientCredentials />} />
          <Route path="/audit-assignments" element={<AuditAssignments />} />
          <Route path="/auditor-approvals" element={<AuditorApprovals />} />
          <Route path="/global-settings" element={<GlobalSettings />} />
          <Route path="/growth-analytics" element={<GrowthAnalytics />} />
          <Route path="/client-onboarding" element={<ClientOnboarding />} />
          <Route index element={<Navigate to="/management/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/management/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default ManagementLayout;

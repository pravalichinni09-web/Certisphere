import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import BackButton from '../../components/BackButton';
import NotificationsBell from '../../components/NotificationsBell';
import Dashboard from './Dashboard';
import Organization from './Organization';
import Certifications from './Certifications';
import DueDates from './DueDates';
import Schedules from './Schedules';
import Reports from './Reports';
import Notifications from './Notifications';
import { seedClientCoordinatorDemo } from './clientCoordinatorDemoSeeder';

interface LayoutProps { onLogout: () => void; }

const ClientCoordinatorLayout: React.FC<LayoutProps> = ({ onLogout }) => {
  // Seed realistic demo data once on first CC session load
  useEffect(() => {
    seedClientCoordinatorDemo();
  }, []);

  return (
    <div className="client-layout">
      <Sidebar role="Client Coordinator" onLogout={onLogout} />
      <NotificationsBell role="Client Coordinator" />
      <div className="client-content">
        <BackButton />
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/organization" element={<Organization />} />
          <Route path="/certifications" element={<Certifications />} />
          <Route path="/due-dates" element={<DueDates />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/audit-schedules" element={<Schedules />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit-reports" element={<Reports />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<Navigate to="/client-coordinator/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default ClientCoordinatorLayout;

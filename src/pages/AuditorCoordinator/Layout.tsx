import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import NotificationsBell from '../../components/NotificationsBell';
import BackButton from '../../components/BackButton';
import CoordinatorGreeting from '../../components/CoordinatorGreeting';
import Dashboard from './Dashboard';
import AuditorProfiles from './AuditorProfiles.tsx';
import AuditorRequests from './AuditorRequests';
import AuditScope from './AuditScope.tsx';
import AuditTypes from './AuditTypes';
import AuditCertifications from './AuditCertifications.tsx';
import AuditReport from './AuditReport.tsx';
import AuditChecklists from './AuditChecklists.tsx';
import CreateAuditor from './CreateAuditor.tsx';
import ApplicationDispatch from './ApplicationDispatch';
import ClientRegistration from './ClientRegistration';
import ClientEnquiry from './ClientEnquiry';
import AuditSchedules from './AuditSchedules';
import RequestSchedule from './RequestSchedule';
import CertificateDelivery from './CertificateDelivery';
import AuditConfirmation from './AuditConfirmation';
import AuditApplication from './AuditApplication';
import Profile from './Profile';
import AuditWorkflowPage from './AuditWorkflow';
import WorkflowMap from './WorkflowMap';
import AuditAnalysis from '../shared/AuditAnalysis';
import AuditIntelligence from './AuditIntelligence';
import EmailJSSettings from '../../components/EmailJSSettings';
import '../../styles/AuditorCoordinator.css';

interface LayoutProps {
  onLogout: () => void;
}

const AuditorCoordinatorLayout: React.FC<LayoutProps> = ({ onLogout }) => {
  return (
    <div className="coordinator-layout">
      <Sidebar role="Audit Coordinator" onLogout={onLogout} />
      <NotificationsBell role="Audit Coordinator" />
      <CoordinatorGreeting />
      <div className="coordinator-content">
        <BackButton />
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/audit-scope" element={<AuditScope />} />
          <Route path="/audit-types" element={<AuditTypes />} />
          <Route path="/auditor-profiles" element={<AuditorProfiles />} />
          <Route path="/auditor-requests" element={<AuditorRequests />} />
          <Route path="/audit-certifications" element={<AuditCertifications />} />
          <Route path="/audit-checklists" element={<AuditChecklists />} />
          <Route path="/audit-report" element={<AuditReport />} />
          <Route path="/create-auditor" element={<CreateAuditor />} />
          <Route path="/application-dispatch" element={<ApplicationDispatch />} />
          <Route path="/client-registration" element={<ClientRegistration />} />
          <Route path="/client-enquiry" element={<ClientEnquiry />} />
          <Route path="/audit-schedules" element={<AuditSchedules />} />
          <Route path="/request-schedule" element={<RequestSchedule />} />
          <Route path="/certificate-delivery" element={<CertificateDelivery />} />
          <Route path="/audit-confirmation" element={<AuditConfirmation />} />
          <Route path="/audit-application" element={<AuditApplication />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/audit-workflow" element={<AuditWorkflowPage />} />
          <Route path="/workflow-map" element={<WorkflowMap />} />
          <Route path="/audit-analysis" element={<AuditAnalysis role="coordinator" />} />
          <Route path="/audit-intelligence" element={<AuditIntelligence />} />
          <Route path="/email-config" element={<EmailJSSettings />} />
        </Routes>
      </div>
    </div>
  );
};

export default AuditorCoordinatorLayout;

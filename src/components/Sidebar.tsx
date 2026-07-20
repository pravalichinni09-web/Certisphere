import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Users,
  CheckSquare,
  ListChecks,
  LogOut,
  Menu,
  X,
  Award,
  FileText,
  Calendar,
  UserPlus,
  ShieldCheck,
  FileSpreadsheet, Mail,
  ClipboardCheck,
  Database,
  Activity,
  ClipboardList,
  UserCheck,
  User,
  KeyRound,
  Workflow,
  Globe,
  CalendarCheck,
  Search,
  Bell,
  Building2,
  Timer,
  BrainCircuit,
  FileSearch,
  MessageCircle,
  TrendingUp,
  ShieldAlert,
  FileCheck,
  MessageSquare,
  LayoutList,
  CalendarDays,
} from 'lucide-react';
import { loadProfile, CoordinatorProfile } from '../pages/AuditorCoordinator/Profile';
import { readGlobalConfig, flagOf, onGlobalConfigChange, GlobalConfig } from '../utils/globalConfig';
import '../styles/Sidebar.css';
import CertiSphereLogo from './CertiSphereLogo';

interface SidebarProps {
  role: string;
  onLogout: () => void;
}

interface MenuItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

interface MenuSection {
  title: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

// Client Coordinator sidebar with live notification badge
const ClientCoordinatorMenu: React.FC<{ items: MenuItem[]; onNavigate: () => void }> = ({ items, onNavigate }) => {
  const [badgeCount, setBadgeCount] = React.useState(0);
  React.useEffect(() => {
    try {
      const orgId = Number(localStorage.getItem('cms_active_org_id') || '0');
      // Read from real cms_certificates (seeded), fall back to synthetic key
      const allCerts: any[] = JSON.parse(localStorage.getItem('cms_certificates') || '[]');
      const orgCerts = allCerts.filter((c: any) => Number(c.clientId) === orgId);
      const synCerts: any[] = JSON.parse(localStorage.getItem(`cms_org_certs_v1_${orgId}`) || '[]');
      const certs = orgCerts.length > 0 ? orgCerts : synCerts;
      const now = Date.now();
      const count = certs.filter((c: any) => Math.ceil((new Date(c.expiryDate).getTime() - now) / 86400000) <= 30).length;
      setBadgeCount(count);
    } catch { /* ignore */ }
  }, []);
  return (
    <ul className="vertical-menu-list">
      {items.map(item => (
        <li key={item.path}>
          <NavLink to={item.path} className={({ isActive }) => `vertical-menu-item ${isActive ? 'active' : ''}`} onClick={onNavigate}>
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label" style={{ flex: 1 }}>{item.label}</span>
            {item.path.endsWith('/notifications') && badgeCount > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 800, padding: '1px 7px', marginLeft: 4 }}>
                {badgeCount}
              </span>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
};

const ROLE_RESPONSIBILITIES: Record<string, string> = {
  'Management': 'Oversees assignments, auditor approvals, client onboarding and global settings.',
  'Audit Coordinator': 'Coordinates enquiries, applications, scheduling, findings and certificate delivery.',
  'Lead Auditor': 'Approves schedules, leads audits, and reviews findings & corrective actions.',
  'Auditor': 'Confirms schedules, conducts audits and submits audit reports.',
  'Auditee': 'Reviews applications, approves schedules and responds to audit findings.',
  'Client Coordinator': "Tracks your organization's certifications, schedules and due dates.",
};

const Sidebar: React.FC<SidebarProps> = ({ role, onLogout }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(() => readGlobalConfig());
  useEffect(() => onGlobalConfigChange((cfg) => setGlobalConfig(cfg)), []);
  const sidebarRef = useRef<HTMLElement>(null);



  const isCoordinator = role === 'Audit Coordinator';
  const isLeadAuditor = role === 'Lead Auditor';
  const isAuditor = role === 'Auditor';
  const isAuditee = role === 'Auditee';
  const isClientCoordinator = role === 'Client Coordinator';
  const isManagement = role === 'Management';
  const useVerticalSidebar = isCoordinator || isLeadAuditor || isAuditor || isAuditee || isManagement || isClientCoordinator;

  // Coordinator profile (for avatar / name in sidebar header)
  const [coordProfile, setCoordProfile] = useState<CoordinatorProfile | null>(
    isCoordinator ? loadProfile() : null
  );

  useEffect(() => {
    if (!isCoordinator) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CoordinatorProfile>).detail;
      if (detail) setCoordProfile(detail);
    };
    window.addEventListener('coordinator-profile-updated', handler);
    return () => window.removeEventListener('coordinator-profile-updated', handler);
  }, [isCoordinator]);

  // Grouped sections for the Audit Coordinator role
  const coordinatorSections: MenuSection[] = [
    {
      title: 'Audit System Data',
      icon: <Database size={18} />,
      items: [
        { path: '/auditor-coordinator/dashboard', icon: <BarChart3 size={16} />, label: 'Dashboard' },
        { path: '/auditor-coordinator/audit-scope', icon: <CheckSquare size={16} />, label: 'Audit Scope' },
        { path: '/auditor-coordinator/auditor-profiles', icon: <Users size={16} />, label: 'Auditor Profiles' },
        { path: '/auditor-coordinator/auditor-requests', icon: <UserPlus size={16} />, label: 'Auditor Requests' },
        { path: '/auditor-coordinator/audit-types', icon: <ListChecks size={16} />, label: 'Audit Types' },
        { path: '/auditor-coordinator/workflow-map', icon: <Workflow size={16} />, label: 'Workflow Map' },
      ],
    },
    {
      title: 'Client Registration',
      icon: <FileText size={18} />,
      items: [
        { path: '/auditor-coordinator/client-enquiry', icon: <Users size={16} />, label: 'Client Enquiry' },
        { path: '/auditor-coordinator/application-dispatch', icon: <FileText size={16} />, label: 'Application' },
        { path: '/auditor-coordinator/client-registration', icon: <UserPlus size={16} />, label: 'Client Registration' },
      ],
    },
    {
      title: 'Audit Execution',
      icon: <Activity size={18} />,
      items: [
        { path: '/auditor-coordinator/audit-checklists', icon: <ClipboardCheck size={16} />, label: 'Audit Checklists' },
        { path: '/auditor-coordinator/request-schedule', icon: <CalendarCheck size={16} />, label: 'Schedule Requests' },
        { path: '/auditor-coordinator/audit-schedules', icon: <Calendar size={16} />, label: 'Audit Schedules' },
        { path: '/auditor-coordinator/audit-confirmation', icon: <ShieldCheck size={16} />, label: 'Audit Confirmations' },
        { path: '/auditor-coordinator/audit-workflow', icon: <Workflow size={16} />, label: 'Audit Workflow' },
        { path: '/auditor-coordinator/audit-certifications', icon: <Award size={16} />, label: 'Audit Certifications' },
        { path: '/auditor-coordinator/audit-report', icon: <FileSpreadsheet size={16} />, label: 'Audit Report' },
        { path: '/auditor-coordinator/certificate-delivery', icon: <Award size={16} />, label: 'Certificate Delivery' },
        { path: '/auditor-coordinator/audit-analysis', icon: <BarChart3 size={16} />, label: 'Audit Analysis' },
        { path: '/auditor-coordinator/audit-intelligence', icon: <BrainCircuit size={16} />, label: 'Audit Intelligence' },
        { path: '/auditor-coordinator/smart-scheduler', icon: <CalendarDays size={16} />, label: 'Smart Scheduler' },
        { path: '/auditor-coordinator/auditor-assignment', icon: <UserCheck size={16} />, label: 'Auditor Assignment' },
      ],
    },
    {
      title: 'Configuration',
      icon: <Mail size={18} />,
      items: [
        { path: '/auditor-coordinator/email-config', icon: <Mail size={16} />, label: 'Email Configuration' },
      ],
    },
  ];

  // Flat items for the Lead Auditor vertical sidebar (no sections)
  const leadAuditorItems: MenuItem[] = [
    { path: '/lead-auditor/dashboard', icon: <BarChart3 size={18} />, label: 'Dashboard' },
    { path: '/lead-auditor/workflow', icon: <Workflow size={18} />, label: 'Audit Workflow' },
    { path: '/lead-auditor/auditor-approvals', icon: <ShieldCheck size={18} />, label: 'Auditor Approvals' },
    { path: '/lead-auditor/audit-schedules', icon: <Calendar size={18} />, label: 'Audit Schedules' },
    { path: '/lead-auditor/conduct-audit', icon: <ClipboardCheck size={18} />, label: 'Conduct Audit' },
    { path: '/lead-auditor/audit-report', icon: <FileSpreadsheet size={18} />, label: 'Audit Report' },
    { path: '/lead-auditor/audit-analysis', icon: <BarChart3 size={18} />, label: 'Audit Analysis' },
    { path: '/lead-auditor/action-review', icon: <ClipboardList size={18} />, label: 'Action Review' },
    { path: '/lead-auditor/action-approval', icon: <UserCheck size={18} />, label: 'Action Approval' },
  ];

  // Flat items for the Auditor vertical sidebar (no sections)
  const auditorItems: MenuItem[] = [
    { path: '/auditor/dashboard', icon: <BarChart3 size={18} />, label: 'Dashboard' },
    { path: '/auditor/schedule-confirmations', icon: <Calendar size={18} />, label: 'Schedule Confirmations' },
    { path: '/auditor/conduct-audit', icon: <ClipboardCheck size={18} />, label: 'Conduct Audit' },
    { path: '/auditor/audit-report', icon: <FileSpreadsheet size={18} />, label: 'Audit Report' },
    { path: '/auditor/action-review', icon: <ClipboardList size={18} />, label: 'Action Review' },
    { path: '/auditor/smart-checklist', icon: <ClipboardCheck size={18} />, label: 'Smart Checklist' },
    { path: '/auditor/anomaly-detection', icon: <ShieldAlert size={18} />, label: 'Anomaly Detection' },
    { path: '/auditor/evidence-validation', icon: <FileCheck size={18} />, label: 'Evidence Validation' },
    { path: '/auditor/audit-assistant', icon: <MessageSquare size={18} />, label: 'Audit Assistant' },
    { path: '/auditor/findings-categorization', icon: <LayoutList size={18} />, label: 'Findings Categorization' },
  ];

  // Flat items for the Auditee (client) vertical sidebar
  const auditeeItems: MenuItem[] = [
    { path: '/audit-client/dashboard', icon: <BarChart3 size={18} />, label: 'Dashboard' },
    { path: '/audit-client/audit-workflow', icon: <Workflow size={18} />, label: 'Audit Workflow' },
    { path: '/audit-client/pending-applications', icon: <FileText size={18} />, label: 'Pending Applications' },
    { path: '/audit-client/schedule-approvals', icon: <CalendarCheck size={18} />, label: 'Schedule Approvals' },
    { path: '/audit-client/audit-actions', icon: <ClipboardList size={18} />, label: 'Audit Actions' },
    { path: '/audit-client/submit-report', icon: <FileSpreadsheet size={18} />, label: 'Submit Report' },
    { path: '/audit-client/document-analysis', icon: <FileSearch size={18} />, label: 'Document Analysis' },
    { path: '/audit-client/smart-compliance', icon: <BrainCircuit size={18} />, label: 'Smart Compliance' },
    { path: '/audit-client/ai-chat', icon: <MessageCircle size={18} />, label: 'AI Chat Support' },
    { path: '/audit-client/action-risk', icon: <TrendingUp size={18} />, label: 'Action Risk Predictor' },
    { path: '/audit-client/auto-report', icon: <FileText size={18} />, label: 'Auto Report' },
  ];

  const clientCoordinatorItems: MenuItem[] = [
    { path: '/client-coordinator/dashboard',      icon: <BarChart3 size={18} />,       label: 'Dashboard' },
    { path: '/client-coordinator/organization',   icon: <Building2 size={18} />,        label: 'Organization View' },
    { path: '/client-coordinator/certifications', icon: <Award size={18} />,            label: 'Certifications View' },
    { path: '/client-coordinator/due-dates',      icon: <Timer size={18} />,            label: 'Due Date Tracker' },
    { path: '/client-coordinator/audit-schedules',icon: <Calendar size={18} />,         label: 'Audit Schedules' },
    { path: '/client-coordinator/audit-reports',  icon: <FileSpreadsheet size={18} />,  label: 'Audit Reports' },
    { path: '/client-coordinator/notifications',  icon: <Bell size={18} />,             label: 'Notifications' },
  ];

  // Flat items for the Management vertical sidebar
  const managementItems: MenuItem[] = [
    { path: '/management/dashboard', icon: <BarChart3 size={18} />, label: 'Dashboard' },
    { path: '/management/audit-assignments', icon: <ClipboardList size={18} />, label: 'Audit Assignments' },
    { path: '/management/auditor-approvals', icon: <ShieldCheck size={18} />, label: 'Auditor Approvals' },
    { path: '/management/client-onboarding', icon: <Users size={18} />, label: 'Client Onboarding' },
        { path: '/management/client-credentials', icon: <KeyRound size={18} />, label: 'Client Credentials' },
    { path: '/management/growth-analytics', icon: <TrendingUp size={18} />, label: 'Growth Analytics' },
    { path: '/management/global-settings', icon: <Globe size={18} />, label: 'Global Settings' },
  ];

  // Fallback horizontal-navbar items (no roles currently use this — all roles are vertical)
  const flatMenuItems: MenuItem[] = [];

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const getSearchableItems = () => {
    const items: { label: string; path: string; icon: React.ReactNode; category?: string }[] = [];
    if (isCoordinator) {
      coordinatorSections.forEach(section => {
        section.items.forEach(item => {
          items.push({ ...item, category: section.title });
        });
      });
      items.push({ path: '/auditor-coordinator/profile', icon: <User size={16} />, label: 'My Profile', category: 'Account' });
    } else if (isLeadAuditor) {
      leadAuditorItems.forEach(item => items.push({ ...item, category: 'Navigation' }));
    } else if (isAuditor) {
      auditorItems.forEach(item => items.push({ ...item, category: 'Navigation' }));
    } else if (isAuditee) {
      auditeeItems.forEach(item => items.push({ ...item, category: 'Navigation' }));
    } else if (isClientCoordinator) {
      clientCoordinatorItems.forEach(item => items.push({ ...item, category: 'Navigation' }));
    } else if (isManagement) {
      managementItems.forEach(item => items.push({ ...item, category: 'Navigation' }));
    }
    return items;
  };

  const searchableItems = React.useMemo(() => {
    const rawItems = getSearchableItems();
    if (!searchQuery.trim()) return rawItems.slice(0, 5);
    return rawItems.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, role]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, searchableItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + searchableItems.length) % Math.max(1, searchableItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchableItems[selectedIndex]) {
        navigate(searchableItems[selectedIndex].path);
        setIsSearchOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchOpen]);

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  // Close the popup when clicking outside the sidebar
  useEffect(() => {
    if (!activePopup) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setActivePopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activePopup]);

  // Close popup on Escape key
  useEffect(() => {
    if (!activePopup) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopup(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activePopup]);


  const handleItemClick = () => {
    setActivePopup(null);
    setIsOpen(false);
  };

  const coordInitials = (coordProfile?.name || 'A C')
    .split(' ')
    .map((s) => s.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // ---------- Vertical sidebar (all roles) ----------
  if (useVerticalSidebar) {
    return (
      <>
        <button
          className="vertical-menu-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <aside ref={sidebarRef} className={`vertical-sidebar ${isOpen ? 'open' : ''}`}>
          <div className="vertical-sidebar-header cs-sidebar-header-stacked">
            <div className="cs-sidebar-brand">
              <a
                href="https://www.qcertisphere.com"
                target="_blank"
                rel="noopener noreferrer"
                title="Visit the CertiSphere website"
                style={{ display: 'inline-flex', textDecoration: 'none', cursor: 'pointer' }}
              >
                <CertiSphereLogo size={180} iconOnly={false} className="cs-sidebar-brand-img" />
              </a>
            </div>
            <div className="cs-sidebar-meta">
              <span className="cs-sidebar-role">{role}</span>
              <p className="cs-sidebar-resp">{ROLE_RESPONSIBILITIES[role] || globalConfig.accreditationBody}</p>
              <span className="cs-sidebar-accred">{globalConfig.accreditationBody}</span>
            </div>
          </div>

          {isCoordinator && coordProfile && (
            <NavLink
              to="/auditor-coordinator/profile"
              className="sidebar-profile-card"
              onClick={() => setIsOpen(false)}
              title="View profile"
            >
              <div className="sidebar-profile-avatar">
                {coordProfile.photo ? (
                  <img src={coordProfile.photo} alt={coordProfile.name} />
                ) : (
                  <span>{coordInitials}</span>
                )}
              </div>
              <div className="sidebar-profile-meta">
                <span className="sidebar-profile-name">{coordProfile.name || 'Audit Coordinator'}</span>
                <span className="sidebar-profile-role">View profile</span>
              </div>
            </NavLink>
          )}

          {/* Global Search Button */}
          <div className="sidebar-search-container" style={{ padding: '0 14px', margin: '8px 0 14px' }}>
            <button
              type="button"
              className="sidebar-search-btn"
              onClick={() => setIsSearchOpen(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              }}
            >
              <Search size={14} style={{ color: 'rgba(255, 255, 255, 0.6)' }} />
              <span>Search...</span>
              <kbd style={{
                marginLeft: 'auto',
                fontSize: '10px',
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '1px 5px',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontFamily: 'monospace'
              }}>Ctrl+K</kbd>
            </button>
          </div>

          <nav className="vertical-sidebar-nav">
            {isCoordinator &&
              coordinatorSections.map((section) => (
                <div className="sidebar-section-inline" key={section.title}>
                  <div className="sidebar-section-heading">
                    <span className="menu-icon">{section.icon}</span>
                    <span className="menu-label">{section.title}</span>
                  </div>
                  <ul className="sidebar-section-items">
                    {section.items.map((item) => (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          className={({ isActive }) =>
                            `vertical-menu-item sidebar-section-item ${isActive ? 'active' : ''}`
                          }
                          onClick={handleItemClick}
                        >
                          <span className="menu-icon">{item.icon}</span>
                          <span className="menu-label">{item.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

            {isCoordinator && (
              <ul className="vertical-menu-list" style={{ marginTop: 8 }}>
                <li>
                  <NavLink
                    to="/auditor-coordinator/profile"
                    className={({ isActive }) =>
                      `vertical-menu-item ${isActive ? 'active' : ''}`
                    }
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="menu-icon"><User size={18} /></span>
                    <span className="menu-label">My Profile</span>
                  </NavLink>
                </li>
              </ul>
            )}

            {isClientCoordinator && (
              <ClientCoordinatorMenu items={clientCoordinatorItems} onNavigate={() => setIsOpen(false)} />
            )}

            {isLeadAuditor && (
              <ul className="vertical-menu-list">
                {leadAuditorItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `vertical-menu-item ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      <span className="menu-label">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}

            {isAuditor && (
              <ul className="vertical-menu-list">
                {auditorItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `vertical-menu-item ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      <span className="menu-label">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}

            {isAuditee && (
              <ul className="vertical-menu-list">
                {auditeeItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `vertical-menu-item ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      <span className="menu-label">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}

            {isManagement && (
              <ul className="vertical-menu-list">
                {managementItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `vertical-menu-item ${isActive ? 'active' : ''}`
                      }
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      <span className="menu-label">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </nav>

          <div className="vertical-sidebar-footer">
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Backdrop for mobile drawer */}
        {isOpen && (
          <div className="vertical-sidebar-backdrop" onClick={() => setIsOpen(false)} />
        )}

        {/* Global Search Modal Overlay */}
        {isSearchOpen && (
          <div
            className="cs-search-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: '100px',
            }}
            onClick={() => setIsSearchOpen(false)}
          >
            <div
              className="cs-search-modal"
              style={{
                width: '100%',
                maxWidth: '560px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                animation: 'cs-modal-slide-down 0.2s ease-out',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)', display: 'flex' }}>
                  <Search size={20} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search pages and features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '16px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.6)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  ESC
                </button>
              </div>

              {/* Search results */}
              <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
                {searchableItems.length > 0 ? (
                  searchableItems.map((item, index) => (
                    <div
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setIsSearchOpen(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: index === selectedIndex ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        border: '1px solid',
                        borderColor: index === selectedIndex ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: index === selectedIndex ? '#ffd700' : 'rgba(255, 255, 255, 0.4)',
                        transition: 'color 0.1s ease',
                      }}>
                        {item.icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          color: '#ffffff',
                          fontSize: '14.5px',
                          fontWeight: index === selectedIndex ? '600' : '500'
                        }}>
                          {item.label}
                        </div>
                        {item.category && (
                          <div style={{
                            color: 'rgba(255, 255, 255, 0.35)',
                            fontSize: '11.5px',
                            marginTop: '2px'
                          }}>
                            {item.category}
                          </div>
                        )}
                      </div>
                      {index === selectedIndex && (
                        <span style={{
                          color: 'rgba(255, 255, 255, 0.3)',
                          fontSize: '12px'
                        }}>
                          ↵ Enter
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: '14.5px' }}>
                    No results found for "{searchQuery}"
                  </div>
                )}
              </div>

              {/* Footer / Shortcuts hint */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                background: 'rgba(0, 0, 0, 0.2)',
                display: 'flex',
                gap: '16px',
                fontSize: '11.5px',
                color: 'rgba(255, 255, 255, 0.4)',
              }}>
                <span>↑↓ to navigate</span>
                <span>↵ to select</span>
                <span>ESC to close</span>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ---------- Horizontal top navbar (fallback, unused) ----------
  return (
    <>
      <nav className="top-navbar">
        <div className="navbar-container">
          <div className="navbar-logo cs-navbar-brand">
            <CertiSphereLogo size={160} iconOnly={false} className="cs-navbar-brand-img" />
            <div className="logo-info">
              <span className="logo-text">{flagOf(globalConfig.defaultCountryCode)} {globalConfig.orgShortName}</span>
              <span className="logo-role">{role}</span>
            </div>
          </div>

          {/* Top Navbar Search Button */}
          <button 
            type="button" 
            onClick={() => setIsSearchOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              marginLeft: 'auto',
              marginRight: '12px'
            }}
            title="Search pages (Ctrl+K)"
          >
            <Search size={20} />
          </button>

          <button className="menu-toggle" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className={`navbar-menu ${isOpen ? 'open' : ''}`}>
            <ul className="menu-list">
              {flatMenuItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="menu-icon">{item.icon}</div>
                    <span className="menu-label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="navbar-footer">
              <button className="logout-btn" onClick={handleLogout}>
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Global Search Modal Overlay for Horizontal Navbar */}
      {isSearchOpen && (
        <div
          className="cs-search-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
          }}
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="cs-search-modal"
            style={{
              width: '100%',
              maxWidth: '560px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.4)', display: 'flex' }}>
                <Search size={20} />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search pages and features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '16px',
                }}
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                ESC
              </button>
            </div>

            {/* Search results */}
            <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
              {searchableItems.length > 0 ? (
                searchableItems.map((item, index) => (
                  <div
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setIsSearchOpen(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: index === selectedIndex ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      border: '1px solid',
                      borderColor: index === selectedIndex ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: index === selectedIndex ? '#ffd700' : 'rgba(255, 255, 255, 0.4)',
                      transition: 'color 0.1s ease',
                    }}>
                      {item.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        color: '#ffffff',
                        fontSize: '14.5px',
                        fontWeight: index === selectedIndex ? '600' : '500'
                      }}>
                        {item.label}
                      </div>
                      {item.category && (
                        <div style={{
                          color: 'rgba(255, 255, 255, 0.35)',
                          fontSize: '11.5px',
                          marginTop: '2px'
                        }}>
                          {item.category}
                        </div>
                      )}
                    </div>
                    {index === selectedIndex && (
                      <span style={{
                        color: 'rgba(255, 255, 255, 0.3)',
                        fontSize: '12px'
                      }}>
                        ↵ Enter
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: '14.5px' }}>
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>

            {/* Footer / Shortcuts hint */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              background: 'rgba(0, 0, 0, 0.2)',
              display: 'flex',
              gap: '16px',
              fontSize: '11.5px',
              color: 'rgba(255, 255, 255, 0.4)',
            }}>
              <span>↑↓ to navigate</span>
              <span>↵ to select</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;

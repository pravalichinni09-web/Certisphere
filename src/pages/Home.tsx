/**
 * CertiSphere — Public Home / landing page (BENTO redesign)
 *
 * Modern asymmetric Bento-grid layout (the design language used by Apple,
 * Linear, Vercel, Stripe in 2024-2025) — all original copy preserved.
 *
 * Key innovations layered into this page:
 *   • Asymmetric Bento grid for hero + modules
 *   • Mouse-follow gradient spotlight on the headline card
 *   • Animated counters for the stat tile
 *   • 3D-tilt-on-hover for module cards
 *   • Gradient-border "shine" loop on featured cards
 *   • Marquee country flag strip
 *   • Pulsing workflow ring with travelling dot
 *   • Same scroll-reveal animations as before
 *
 * IMPORTANT: No content (headlines, paragraphs, CTAs, benefits, modules,
 * pre-footer copy, footer copy) has been changed.
 */

import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, FileText, Send, Users, ClipboardCheck, Workflow, AlertOctagon, Award, RefreshCw, Check, Star, ClipboardList, FolderOpen, Smartphone, Command, Phone, Globe, MapPin, Medal, Leaf, HardHat, Lock, KeyRound, HeartPulse, TrendingUp, FlaskConical } from 'lucide-react';
import { readGlobalConfig } from '../utils/globalConfig';
import FlagImg from '../components/FlagImg';
import { useScrollReveal } from '../hooks/useScrollReveal';
import '../styles/Home.css';
import '../styles/HomePolish.css';
import '../styles/HomeColors.css';
import '../styles/HomeLight.css';
import '../styles/HomeHeroNoir.css';
import '../styles/HomeNeon.css';
import CertiSphereLogo from '../components/CertiSphereLogo';
import ContactForm from '../components/ContactForm';


/* ---------- Mouse-follow spotlight wrapper ---------- */
const SpotlightCard: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    ref.current.style.setProperty('--spot-x', `${x}%`);
    ref.current.style.setProperty('--spot-y', `${y}%`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={'bento-card bento-spotlight ' + (className || '')}>
      {children}
    </div>
  );
};

/* ---------- Animated count-up number (starts when scrolled into view) ---------- */
const CountUp: React.FC<{ end: number; suffix?: string; duration?: number }> = ({ end, suffix = '', duration = 1800 }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return;
      started = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const pr = Math.min(1, (t - t0) / duration);
        setVal(Math.round(end * (1 - Math.pow(1 - pr, 3))));
        if (pr < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io.disconnect();
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [end, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
};

/* ---------- Module + benefit data ---------- */
interface Mod { label: string; icon: React.ReactNode; desc: string; featured?: boolean; demoRole: 'Audit Coordinator' | 'Lead Auditor' | 'Management' | 'Auditor' | 'Auditee'; demoPath: string; }

const Home: React.FC = () => {
  const navigate = useNavigate();
  const cfg = readGlobalConfig();
  useScrollReveal([]);
  // Prefetch /login route on mount so clicking any CTA feels instant
  React.useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = '/login';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);
  /**
   * Founder photo — FIXED. Mr. Ramakrishna Chinmaya's official portrait ships with
   * the app at /public/images/founder-rk-chinmaya.png. It is intentionally not
   * user-editable: no upload control and no localStorage override, so every
   * visitor sees the same official photo.
   */
  const FOUNDER_PHOTO = '/images/founder-rk-chinmaya.png';
  const [founderPhotoErr, setFounderPhotoErr] = useState(false);
  // Clear any photo a previous build let the user store locally.
  React.useEffect(() => {
    try { localStorage.removeItem('cms_founder_photo'); } catch { /* ignore */ }
  }, []);
  const [showContact, setShowContact] = useState(false);
  // Rotating spotlight across the 8 orbit modules
  const [activeModule, setActiveModule] = useState(0);
  React.useEffect(() => {
    const t = window.setInterval(() => setActiveModule((n) => (n + 1) % 8), 1500);
    return () => window.clearInterval(t);
  }, []);


  const modules: Mod[] = [
    { label: 'Audit Workflow',       icon: <Workflow size={22} />,       desc: 'The single 14-stage tracker every certification flows through.', featured: true, demoRole: 'Audit Coordinator', demoPath: '/auditor-coordinator/audit-workflow' },
    { label: 'Client Enquiry',       icon: <FileText size={22} />,       desc: 'Capture leads from the public site and convert them into applications.', demoRole: 'Audit Coordinator', demoPath: '/auditor-coordinator/client-enquiry' },
    { label: 'Application Dispatch', icon: <Send size={22} />,           desc: 'Send application forms by email, WhatsApp or portal link with delivery tracking.', demoRole: 'Audit Coordinator', demoPath: '/auditor-coordinator/application-dispatch' },
    { label: 'Auditor Onboarding',   icon: <Users size={22} />,          desc: 'Validate auditor competence end-to-end: Coordinator → Lead Auditor → Management.', demoRole: 'Audit Coordinator', demoPath: '/auditor-coordinator/auditor-requests' },
    { label: 'Audit Scheduling',     icon: <ClipboardCheck size={22} />, desc: 'Propose dates, assign teams, route through auditee + auditor confirmations.', demoRole: 'Audit Coordinator', demoPath: '/auditor-coordinator/audit-schedules' },
    { label: 'Findings & Actions',   icon: <AlertOctagon size={22} />,   desc: 'Log non-conformities, release to auditee, accept corrective actions.', demoRole: 'Lead Auditor', demoPath: '/lead-auditor/action-review' },
    { label: 'Certification',        icon: <Award size={22} />,          desc: 'Issue, seal and deliver certificates with full audit trail.', featured: true, demoRole: 'Audit Coordinator', demoPath: '/auditor-coordinator/audit-certifications' },
    { label: 'Surveillance',         icon: <RefreshCw size={22} />,      desc: 'Schedule annual surveillance + 3-yearly recertification automatically.', demoRole: 'Audit Coordinator', demoPath: '/auditor-coordinator/audit-schedules' },
  ];

  const benefits = [
    { title: 'Standardised across countries', icon: <ShieldCheck size={20} />, desc: 'One process, every market. Country flags, currencies and timezones baked in.' },
    { title: 'Role-based workflows',          icon: <Users size={20} />,       desc: 'Management, Coordinator, Lead Auditor, Auditor, Auditee — each sees only what they own.' },
    { title: 'Real-time pending inbox',       icon: <Workflow size={20} />,    desc: 'Notifications bell on every screen — never miss a handoff.' },
    { title: 'Demo-ready in seconds',         icon: <Award size={20} />,       desc: 'Bundled seeders populate every screen with realistic data on first load.' },
    { title: 'AI-powered process',            icon: <Command size={20} />,     desc: 'AI-assisted workflows and the QCSAI assistant cut time-to-compliance by up to 60%.' },
    { title: 'Real-time monitoring',          icon: <ClipboardList size={20} />, desc: 'Continuous compliance dashboards maintain certification status and flag risks in real time.' },
  ];

  return (
    <div className="cs-home cs-home-bento">
      {/* ===== Header ===== */}
      <header className="cs-home-header">
        <div className="cs-home-header-inner">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div className="cs-home-brand-plate">
              <a href="https://qmicscertifications.com/" target="_blank" rel="noopener noreferrer" title="Visit the CertiSphere website" style={{ display: 'inline-flex', textDecoration: 'none', cursor: 'pointer' }}>
                <CertiSphereLogo size={56} iconOnly={false} />
              </a>
            </div>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(246,216,120,0.6)', letterSpacing: '0.05em', paddingLeft: 2 }}>
              A product by <strong style={{ color: '#f6d878', fontWeight: 800 }}>QMICS Solutions</strong>
            </span>
          </div>
          <nav className="cs-home-nav">
            <a href="#about">About {cfg.orgShortName}</a>
            <a href="#modules">Modules</a>
            <a href="#benefits">Benefits</a>
            <a href="#certification-bodies">Cert Bodies</a>
            <a href="#process">Process</a>
            <a href="#contact">Contact</a>
            <a href="#about-us">About Us</a>
          </nav>
          <button className="cs-home-signin" onClick={() => navigate('/login')}>
            Sign In <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* ===== HERO BENTO GRID ===== */}
      <main className="cs-bento-wrap">
        <section id="about" className="cs-bento-hero">
          {/* Big hero card with mouse-follow spotlight */}
          <SpotlightCard className="bento-hero-text cs-reveal cs-reveal-up">
            <p className="cs-hero-quote">&ldquo;Compliance builds trust &mdash; Certification proves it.&rdquo;</p>
            <span className="cs-home-tag">
              <span className="cs-home-tag-dot" />
              Global Certification Management Platform
            </span>
            <h1 className="cs-home-title">
              One Platform. Every Certification.<br />
              Fully <em>Assured</em>.
            </h1>
            <p className="cs-home-sub">
              CertiSphere shifts certification from
              <strong> fragmented spreadsheets</strong> to
              <strong> end-to-end audit workflows</strong> —
              bringing Enquiry, Application, Scheduling, Findings,
              Certification and Surveillance into one unified platform.
            </p>
            <div className="cs-home-cta-row">
              <button
                className="cs-home-cta cs-home-cta-primary"
                onClick={() => navigate('/login')}
                aria-label="Get Started — go to login"
              >
                Get Started
              </button>
              <button
                className="cs-home-cta cs-home-cta-secondary"
                onClick={() => {
                  const el = document.getElementById('modules');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                aria-label="Explore Modules — scroll to modules section"
              >
                Explore Modules
              </button>
            </div>
            <ul className="cs-home-trust">
              <li><Check size={14} /> ISO/IEC 17021-1 compliant</li>
              <li><Check size={14} /> {cfg.accreditationBody}</li>
              <li><Check size={14} /> Operating in {cfg.supportedCountries.length}+ countries <FlagImg code={cfg.defaultCountryCode} w={18} rounded /></li>
            </ul>
          </SpotlightCard>

          {/* Orbital triangle diagram — full-height right column */}
          <div className="bento-card bento-orbital cs-reveal cs-reveal-zoom" data-reveal-delay="100">
            <div className="bento-card-label"><Workflow size={12} /> Modules in Orbit</div>
            <div className="cs-orbital-diagram" aria-hidden="true">
              <div className="cs-orbital-outer" />

              {/* Rotating ring holding the connecting lines + 6 satellite circles */}
              <div className="cs-orbital-ring">
                {/* SVG connecting lines from center to each of 8 satellites */}
                <svg className="cs-orbital-lines" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
                  {[
                    { x: 200, y:  48 }, { x: 308, y:  92 },
                    { x: 352, y: 200 }, { x: 308, y: 308 },
                    { x: 200, y: 352 }, { x:  92, y: 308 },
                    { x:  48, y: 200 }, { x:  92, y:  92 },
                  ].map((pt, i) => (
                    <line key={i} x1="200" y1="200" x2={pt.x} y2={pt.y}
                      stroke="rgba(56,189,248,0.35)" strokeWidth="1.5" strokeDasharray="4 4" />
                  ))}
                  {/* Octagon figure connecting the 8 branch endpoints */}
                  <polygon
                    points="200,48 308,92 352,200 308,308 200,352 92,308 48,200 92,92"
                    fill="none"
                    stroke="rgba(34,211,238,0.7)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>

                {[
                  { label: 'Audit Workflow',       icon: <Workflow size={16} />,       angle: -90 },
                  { label: 'Client Enquiry',       icon: <FileText size={16} />,       angle: -45 },
                  { label: 'Application Dispatch', icon: <Send size={16} />,           angle:   0 },
                  { label: 'Auditor Onboarding',   icon: <Users size={16} />,          angle:  45 },
                  { label: 'Audit Scheduling',     icon: <ClipboardCheck size={16} />, angle:  90 },
                  { label: 'Findings & Actions',   icon: <AlertOctagon size={16} />,   angle: 135 },
                  { label: 'Certification',        icon: <Award size={16} />,          angle: 180 },
                  { label: 'Surveillance',         icon: <RefreshCw size={16} />,      angle: 225 },
                ].map((s, i) => {
                  const rad = (s.angle * Math.PI) / 180;
                  const x = 50 + Math.cos(rad) * 38;
                  const y = 50 + Math.sin(rad) * 38;
                  return (
                    <div key={i} className={'cs-orbital-node' + (activeModule === i ? ' is-active' : '')} style={{ left: x + '%', top: y + '%' }}>
                      <div className="cs-orbital-node-inner">
                        <div className="cs-orbital-circle">{s.icon}</div>
                        <span className="cs-orbital-label">{s.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Central triangle with the CertiSphere icon */}
              <div className="cs-orbital-center">
                <div className="cs-orbital-triangle">
                  <img
                    src="/images/certisphere-icon.png"
                    alt="CertiSphere"
                    className="cs-orbital-logo cs-orbital-icon-img"
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement;
                      // Fallback to CertiSphere logo if QMICS logo fails to load
                      el.style.display = 'none';
                      const fallback = el.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                  <CertiSphereLogo iconOnly={true} className="cs-orbital-logo" style={{ display: 'none' }} />
                </div>
              </div>
            </div>
          </div>
        </section>

{/* ===== Live stats band — animated counters (QMICS parity) ===== */}
        <section className="cs-stats-band cs-reveal cs-reveal-up" aria-label="CertiSphere in numbers">
          {[
            { end: 250, suffix: '+', label: 'Certifications Delivered' },
            { end: 200, suffix: '+', label: 'Happy Clients' },
            { end: 98,  suffix: '%', label: 'Success Rate' },
            { end: 20,  suffix: '+', label: 'Expert Auditors' },
          ].map((st, i) => (
            <div key={i} className="cs-stat-tile">
              <strong><CountUp end={st.end} suffix={st.suffix} /></strong>
              <span>{st.label}</span>
            </div>
          ))}
        </section>

        {/* ===== Country flag marquee strip (moved in-between sections) ===== */}
        <div className="bento-marquee" aria-hidden="true">
          <div className="bento-marquee-track">
            {(() => {
              const ISO: Record<string, string> = {
                India: 'IN', USA: 'US', UK: 'GB', Germany: 'DE',
                France: 'FR', UAE: 'AE', Singapore: 'SG', Australia: 'AU',
                Brazil: 'BR', Japan: 'JP', China: 'CN', Canada: 'CA',
                Mexico: 'MX', 'South Africa': 'ZA',
              };
              return [...cfg.supportedCountries, ...cfg.supportedCountries, ...cfg.supportedCountries].map((c, i) => (
                <span key={i} className="bento-marquee-item">
                  <FlagImg code={ISO[c] || cfg.defaultCountryCode} w={26} rounded title={c} />
                  <span className="bento-marquee-name">{c}</span>
                </span>
              ));
            })()}
          </div>
        </div>


        
                {/* ===== MODULES — Bento Grid ===== */}
        <section id="modules" className="cs-bento-section">
          <header className="cs-bento-section-head cs-reveal cs-reveal-up">
            <span className="cs-home-tag"><span className="cs-home-tag-dot" /> Modules</span>
            <h2 className="cs-home-section-title">Eight modules. One certification platform.</h2>
            <p className="cs-home-section-sub">
              Built for global certification bodies running multi-standard, multi-country
              audit programmes under ISO/IEC 17021-1.
            </p>
          </header>

          <div className="cs-bento-modules">
            {modules.map((m, i) => (
              <article
                key={i}
                className={'bento-card bento-mod' + (m.featured ? ' bento-mod-featured' : '') + ' cs-reveal cs-reveal-up'}
                data-reveal-delay={i * 70}
                onClick={() => navigate('/login?intent=' + encodeURIComponent(m.label + ' module'))}
                style={{ cursor: 'pointer' }}
                title="Sign in to access this module"
              >
                <div className="bento-mod-icon">{m.icon}</div>
                <h3>{m.label}</h3>
                <p>{m.desc}</p>
                <span className="bento-mod-demo">Open Demo →</span>
                <span className="bento-mod-arrow"><ArrowRight size={14} /></span>
              </article>
            ))}
          </div>
        </section>


        {/* ===== CERTIFICATION BODIES ===== */}
        <section id="certification-bodies" className="cs-bento-section">
          <header className="cs-bento-section-head cs-reveal cs-reveal-up">
            <span className="cs-home-tag"><span className="cs-home-tag-dot" /> Certification Bodies</span>
            <h2 className="cs-home-section-title">Supported Certification Standards</h2>
            <p className="cs-home-section-sub">
              CertiSphere supports all major ISO management systems plus global compliance frameworks — SOC 2, GDPR, HIPAA and CMMI.
              Sign in to access your certification body's dedicated portal.
            </p>
          </header>
          <div className="cs-cert-bodies-grid">
            {[
              { code: 'ISO 9001', name: 'Quality Management System', icon: <Medal size={30} />, desc: 'Internationally recognised quality management system for consistent product and service delivery.' },
              { code: 'ISO 14001', name: 'Environmental Management System', icon: <Leaf size={30} />, desc: 'Framework for organisations to improve environmental performance and manage regulatory compliance.' },
              { code: 'ISO 45001', name: 'Occupational Health & Safety', icon: <HardHat size={30} />, desc: 'Occupational health & safety management system to reduce workplace incidents and hazards.' },
              { code: 'ISO/IEC 27001', name: 'Information Security Management System', icon: <Lock size={30} />, desc: 'Systematic approach to managing sensitive company information and information security risks.' },
              { code: 'ISO 50001', name: 'Energy Management System', icon: <RefreshCw size={30} />, desc: 'Establish, implement and improve energy performance, efficiency and consumption.' },
              { code: 'ISO 37001', name: 'Anti-Bribery Management System', icon: <ShieldCheck size={30} />, desc: 'Prevent, detect and address bribery and corruption risks across the organisation.' },
              { code: 'ISO 22000', name: 'Food Safety Management System', icon: <FlaskConical size={30} />, desc: 'Food safety management across the supply chain, from farm to fork.' },
              { code: 'ISO 22301', name: 'Business Continuity Management Systems', icon: <Workflow size={30} />, desc: 'Prepare for, respond to and recover from disruptions to keep operations running.' },
              { code: 'ISO/IEC 20000-1', name: 'IT Service Management System', icon: <Smartphone size={30} />, desc: 'IT service management for reliable, high-quality delivery of IT services.' },
              { code: 'ISO 13485', name: 'Quality Management For Medical Devices', icon: <HeartPulse size={30} />, desc: 'Quality management for the design and manufacture of safe, compliant medical devices.' },
              { code: 'ISO 41001', name: 'Facility Management System', icon: <FolderOpen size={30} />, desc: 'Facility management for efficient, safe and cost-effective built environments.' },
              { code: 'ISO 42001', name: 'Artificial Intelligence Management System', icon: <Command size={30} />, desc: 'Governance framework for responsible development and use of artificial intelligence.' },
              { code: 'ISO 30000', name: 'Ship Recycling Management System', icon: <Globe size={30} />, desc: 'Safe and environmentally sound management systems for ship recycling facilities.' },
              { code: 'ISO 21001', name: 'Educational Organizations Management System', icon: <Users size={30} />, desc: 'Management system for educational organisations to enhance learner satisfaction.' },
              { code: 'ISO 55001', name: 'Asset Management System', icon: <ClipboardList size={30} />, desc: 'Asset management to maximise value and performance across the asset lifecycle.' },
              { code: 'ISO/IEC 17025', name: 'Testing and Calibration Laboratories', icon: <ClipboardCheck size={30} />, desc: 'Competence requirements for testing and calibration laboratories to ensure valid results.' },
              { code: 'SOC 2', name: 'Service Organization Control', icon: <Award size={30} />, desc: 'Trust-services audit for data security, availability, processing integrity and confidentiality.' },
              { code: 'GDPR', name: 'Data Protection', icon: <KeyRound size={30} />, desc: 'General Data Protection Regulation compliance for privacy and data protection rights.' },
              { code: 'HIPAA', name: 'Healthcare Compliance', icon: <FileText size={30} />, desc: 'Health Insurance Portability & Accountability Act for healthcare data protection.' },
              { code: 'CMMI', name: 'Process Maturity', icon: <TrendingUp size={30} />, desc: 'Capability Maturity Model Integration for process improvement and performance excellence.' },
            ].map((cb, i) => (
              <article
                key={i}
                className="cs-cert-body-card cs-reveal cs-reveal-up"
                data-reveal-delay={i * 80}
                onClick={() => navigate('/login?intent=' + encodeURIComponent(cb.code + ' — ' + cb.name))}
                style={{ cursor: 'pointer' }}
                title="Sign in to access this certification body"
              >
                <span className="cs-cert-body-icon">{cb.icon}</span>
                <div className="cs-cert-body-info">
                  <strong className="cs-cert-body-code">{cb.code}</strong>
                  <span className="cs-cert-body-name">{cb.name}</span>
                  <p className="cs-cert-body-desc">{cb.desc}</p>
                </div>
                <span className="cs-cert-body-cta">Explore <ArrowRight size={13} /></span>
              </article>
            ))}
          </div>
        </section>

        {/* ===== CERTIFICATION PROCESS — 5 steps (QMICS parity) ===== */}
        <section id="process" className="cs-bento-section">
          <header className="cs-bento-section-head cs-reveal cs-reveal-up">
            <span className="cs-home-tag"><span className="cs-home-tag-dot" /> Our Process</span>
            <h2 className="cs-home-section-title">The Certification <em>Process</em></h2>
            <p className="cs-home-section-sub">
              Simple, streamlined certification from assessment to achievement.
            </p>
          </header>
          <ol className="cs-process-track">
            {[
              { t: 'Application Submission', d: 'Submit your application with organisation details and the certification standard required.' },
              { t: 'Application Review',     d: 'Our team reviews your application, confirms scope, and schedules the audit process.' },
              { t: 'Audit Stage 1 & 2',      d: 'Stage 1 document review followed by Stage 2 on-site audit by certified lead auditors.' },
              { t: 'Finding Closure',        d: 'Non-conformities identified during the audit are reviewed and closed with corrective actions.' },
              { t: 'Certificate Issuance',   d: 'Final audit report prepared and the certificate issued upon successful completion.' },
            ].map((st, i) => (
              <li key={i} className="cs-process-step cs-reveal cs-reveal-up" data-reveal-delay={i * 120}>
                <span className="cs-process-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{st.t}</h3>
                <p>{st.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ===== BENEFITS ===== */}
        <section id="benefits" className="cs-bento-section">
          <header className="cs-bento-section-head cs-reveal cs-reveal-up">
            <span className="cs-home-tag"><span className="cs-home-tag-dot" /> Benefits</span>
            <h2 className="cs-home-section-title">Why certification bodies choose CertiSphere</h2>
          </header>
          <div className="cs-bento-benefits">
            {benefits.map((b, i) => (
              <article
                key={i}
                className="bento-card bento-benefit cs-reveal cs-reveal-scale"
                data-reveal-delay={i * 100}
              >
                <div className="bento-benefit-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* ===== Pre-footer CTA band ===== */}
      <section id="contact" className="cs-prefooter cs-reveal cs-reveal-zoom">
        <div className="cs-prefooter-inner">
          <h2 className="cs-prefooter-title">Contact Us</h2>
          <p className="cs-prefooter-sub">
            Ready to modernise your certification operations? Reach us directly or send a message —
            our team responds within 1 business day.
          </p>

          {/* Contact details — monochromatic navy + gold */}
          {(() => {
            const ink = '#f6d878', soft = 'rgba(247,242,226,0.78)';
            const chip = { background:'rgba(212,175,55,0.12)', border:'1px solid rgba(212,175,55,0.45)', color:'#d4af37', borderRadius:'50%', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 } as React.CSSProperties;
            const link = { display:'flex', alignItems:'center', gap:10, color:ink, textDecoration:'none', fontSize:15, fontWeight:600 } as React.CSSProperties;
            return (
              <>
                {/* Websites — top row */}
                <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'nowrap', margin:'26px 0 20px' }}>
                  <a className="cs-contact-pill" href="https://qmicscertifications.com/" target="_blank" rel="noopener noreferrer" style={link}>
                    <span style={chip}><Globe size={18} /></span> qmicscertifications.com
                  </a>
                  <a className="cs-contact-pill" href="https://www.qmicssolutions.com" target="_blank" rel="noopener noreferrer" style={link}>
                    <span style={chip}><Globe size={18} /></span> www.qmicssolutions.com
                  </a>
                  <a className="cs-contact-pill" href="https://qmicsgroup.com/" target="_blank" rel="noopener noreferrer" style={link}>
                    <span style={chip}><Globe size={18} /></span> qmicsgroup.com
                  </a>
                </div>

                {/* Address */}
                <div style={{ display:'flex', justifyContent:'center', margin:'0 0 18px' }}>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=V%20Starx%20IT%20Hub%2C%20Plot%20No%2055%2C%204th%20Floor%2C%2015th%20Phase%2C%20Green%20Hills%20Road%2C%20KPHB%20Colony%2C%20Kukatpally%2C%20Hyderabad%20500072"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in Google Maps"
                    className="cs-contact-address"
                    style={{ display:'flex', alignItems:'flex-start', gap:10, color:soft, fontSize:14, fontWeight:500, maxWidth:560, textAlign:'left', textDecoration:'none', cursor:'pointer' }}
                  >
                    <span style={chip}><MapPin size={18} /></span>
                    <span><strong style={{ color:ink }}>V Starx IT Hub</strong><br />Plot No: 55, 4th Floor, 15th Phase, Green Hills Road,<br />KPHB Colony, Kukatpally, Hyderabad &ndash; 500072</span>
                  </a>
                </div>

                {/* Phone */}
                <div style={{ display:'flex', justifyContent:'center', margin:'0 0 4px' }}>
                  <a className="cs-contact-pill" href="tel:9849499111" style={link}>
                    <span style={chip}><Phone size={18} /></span> +91 98494 99111
                  </a>
                </div>
              </>
            );
          })()}

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
            <button
              onClick={() => setShowContact(true)}
              style={{
                padding: '13px 32px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#f6d878 0%,#d4af37 45%,#96772a 100%)', color: '#0c0b09', fontWeight: 800,
                fontSize: 16, cursor: 'pointer', letterSpacing: '.01em', boxShadow:'0 12px 30px rgba(212,175,55,.3)',
              }}>
              ✉️ Send Us a Message
            </button>

          </div>
        </div>
      </section>

      {/* Contact form modal */}
      {showContact && <ContactForm onClose={() => setShowContact(false)} />}

      {/* ===== ABOUT US — Founder Profile ===== */}
      <section id="about-us" className="cs-aboutus cs-bento-section">
        <header className="cs-bento-section-head cs-reveal cs-reveal-up">
          <span className="cs-home-tag"><span className="cs-home-tag-dot" /> About Us</span>
          <h2 className="cs-home-section-title">The Organization Behind the Platform</h2>
          <p className="cs-home-section-sub">
            CertiSphere is built on over 35 years of expertise in certification, auditing, and compliance.
            Combining deep industry knowledge with cutting-edge digital technology, we help certification bodies
            and organizations streamline audit workflows, ensure regulatory compliance, and manage certification
            programs across global standards with confidence.
          </p>
          <a
            href="https://qmicscertifications.com"
            target="_blank"
            rel="noopener noreferrer"
            className="cs-link-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
              padding: '9px 20px', borderRadius: 999, textDecoration: 'none',
              border: '1px solid rgba(212,175,55,0.5)', color: '#f6d878',
              fontSize: 13, fontWeight: 600, letterSpacing: 0.6,
            }}
          >
            <FolderOpen size={14} /> View Company Profile →
          </a>
        </header>

        <div className="cs-aboutus-card cs-reveal cs-reveal-zoom">
          {/* Left — Founder identity panel */}
          <aside className="cs-founder-side">
            <div className="cs-founder-photo" style={{ position: 'relative' }}>
              {!founderPhotoErr ? (
                <img
                  src={FOUNDER_PHOTO}
                  alt="Mr. Ramakrishna Chinmaya — Founder & CEO"
                  className="cs-founder-img"
                  draggable={false}
                  loading="eager"
                  decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%', display: 'block', userSelect: 'none' }}
                  onError={() => setFounderPhotoErr(true)}
                />
              ) : (
                <div className="cs-founder-photo-fallback" style={{ display: 'grid' }}>RC</div>
              )}
              <span className="cs-founder-star"><Star size={14} /></span>
            </div>
            <h3 className="cs-founder-name">Mr. Ramakrishna Chinmaya</h3>
            <span className="cs-founder-role">Founder &amp; CEO</span>
            <p className="cs-founder-org">QMICS Group</p>
            <div className="cs-founder-exp">
              <strong>35+</strong>
              <span>Years of<br />Industry Experience</span>
            </div>
          </aside>

          {/* Right — Bio + expertise */}
          <div className="cs-founder-bio">
            <div className="cs-founder-bio-head">
              <span className="cs-bio-bar" />
              <div>
                <span className="cs-bio-label">FOUNDER PROFILE</span>
              </div>
            </div>

            <p>
              Mr. Ramakrishna Chinmaya is the Lead Auditor for CertiSphere and an expert in certification
              programme delivery. An Engineering Post Graduate with M.Tech in Industrial Engineering &amp;
              Management from Jawaharlal Nehru Technological University, he brings
              <strong> 35 years of experience</strong> across audit leadership, compliance systems and
              quality governance.
            </p>
            <p>
              His expertise spans Quality &amp; Process Compliances, Software &amp; Systems Compliances,
              and Digital Process Compliance Programs. He has served leading MNCs and corporate
              organizations including <strong>Kakati Industries, Avanti Kopp, Visualsoft, Intec Group,
              Symphony Softwares, Virtusa,</strong> and <strong>Cognizant Technologies</strong>.
            </p>
            <p>
              Mr. RK Chinmaya also co-founded and developed an independent Quality Control Laboratory,
              <strong> M/S Micro Testing Labs</strong>, in 1995, serving as CEO for 5 years. With his
              passion towards Industry Standards development and Compliance Excellence, he incorporated
              QMICS — now delivering Integrated Compliance Excellence Services &amp; Solutions for all
              IT &amp; Non-IT organizations.
            </p>

            <div className="cs-expertise-grid">
              <span className="cs-expertise-pill"><ClipboardCheck size={14} /> Audit Leadership</span>
              <span className="cs-expertise-pill"><ShieldCheck size={14} /> Compliance Systems</span>
              <span className="cs-expertise-pill"><FolderOpen size={14} /> Certification Workflows</span>
              <span className="cs-expertise-pill"><Smartphone size={14} /> Digital Assurance</span>
              <span className="cs-expertise-pill"><ClipboardList size={14} /> Standards Management</span>
              <span className="cs-expertise-pill"><Command size={14} /> Quality Governance</span>
            </div>
            <div className="cs-about-profile-links" style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a
                href="https://qmicscertifications.com"
                target="_blank"
                rel="noreferrer"
                className="cs-profile-link-btn"
                style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:8, background:'#1E3A8A', color:'#fff', fontWeight:600, fontSize:14, textDecoration:'none' }}
              >
                <FolderOpen size={15} /> Company Profile
              </a>
              <button
                type="button"
                onClick={() => setShowContact(true)}
                className="cs-profile-link-btn"
                style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:8, border:'none', cursor:'pointer', background:'#F5A623', color:'#1E3A8A', fontWeight:600, fontSize:14, textDecoration:'none' }}
              >
                <Send size={15} /> Get In Touch
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer (unchanged) ===== */}
      <footer className="cs-home-footer">
        <div className="cs-footer-grid">
          <div className="cs-footer-brand">
            <div className="cs-footer-logo-plate">
              <a href="https://qmicscertifications.com/" target="_blank" rel="noopener noreferrer" title="Visit the CertiSphere website" style={{ display: 'inline-flex', textDecoration: 'none', cursor: 'pointer' }}>
                <CertiSphereLogo size={52} iconOnly={false} />
              </a>
            </div>
            <p className="cs-footer-tagline">
              A unified platform for managing certification programmes end-to-end
              — enquiry to renewal, across countries and standards.
            </p>
          </div>
          <div className="cs-footer-col">
            <h4>Modules</h4>
            <button type="button" onClick={() => navigate('/login')}>Client Enquiry</button>
            <button type="button" onClick={() => navigate('/login')}>Application Dispatch</button>
            <button type="button" onClick={() => navigate('/login')}>Auditor Onboarding</button>
            <button type="button" onClick={() => navigate('/login')}>Audit Scheduling</button>
            <button type="button" onClick={() => navigate('/login')}>Audit Workflow</button>
            <button type="button" onClick={() => navigate('/login')}>Findings &amp; Actions</button>
            <button type="button" onClick={() => navigate('/login')}>Certification</button>
            <button type="button" onClick={() => navigate('/login')}>Surveillance</button>
          </div>
          <div className="cs-footer-col">
            <h4>Company</h4>
            <a href={cfg.website} target="_blank" rel="noreferrer">{cfg.orgShortName}</a>
            <button type="button" onClick={() => navigate('/login')}>About</button>
            <button type="button" onClick={() => navigate('/login')}>Benefits</button>
            <a href={`mailto:${cfg.contactEmail}`}>Support</a>
            <a href="/enquiry">Submit Enquiry</a>
            <a href="/login">Sign In</a>
          </div>
          <div className="cs-footer-col">
            <h4>Contact</h4>
            <a href={`mailto:${cfg.contactEmail}`}>{cfg.contactEmail}</a>
            <a href={`tel:${cfg.contactPhone.replace(/\s+/g, '')}`}>{cfg.contactPhone}</a>
            <a href={cfg.website} target="_blank" rel="noreferrer">{cfg.website.replace(/^https?:\/\//, '')}</a>
            <span className="cs-footer-static">
              <FlagImg code={cfg.defaultCountryCode} w={18} rounded /> {cfg.defaultCountry}
            </span>
            <span className="cs-footer-static">
{cfg.accreditationBody}</span>
          </div>
        </div>

        <div className="cs-footer-bottom">
          <span>© {new Date().getFullYear()} {cfg.orgName}. All rights reserved.</span>
          <span className="cs-footer-slogan">{cfg.legalFooter}</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;

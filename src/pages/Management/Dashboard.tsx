import React, { useEffect, useState } from 'react';
import { forecastFindings } from '../../ai/models';
import { TrendingUp } from 'lucide-react';
import RoleAIGuide from '../../components/RoleAIGuide';
import 'chart.js/auto';
import { Bar, Pie, Scatter } from 'react-chartjs-2';
import * as XLSX from 'xlsx'; // Requires: npm install xlsx
import '../../styles/Management/Dashboard.css';
import { ChartOptions, ChartData } from 'chart.js';
import RoleWorkflowOverview from '../../components/RoleWorkflowOverview';
import AIPanel from '../../components/AIPanel';
import { buildExecutiveBriefing, briefingClaudePrompt, ExecutiveBriefing } from '../../ai/managementInsights';
import { onCmsChange, claudeComplete, isClaudeConfigured } from '../../ai/liveData';

const ManagementDashboard: React.FC = () => {
  // --- 0. Executive AI Briefing (live, heuristic; optional Claude polish) ---
  const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);
  const [aiBriefText, setAiBriefText] = useState<string | null>(null);
  const [aiBriefBusy, setAiBriefBusy] = useState(false);
  const [aiBriefErr, setAiBriefErr] = useState<string | null>(null);

  const runBriefing = () => {
    setBriefing(buildExecutiveBriefing());
    setAiBriefText(null);
    setAiBriefErr(null);
  };

  useEffect(() => {
    runBriefing();
    const off = onCmsChange(runBriefing);
    return off;
  }, []);

  const enhanceBriefing = async () => {
    if (!briefing || aiBriefBusy) return;
    setAiBriefBusy(true);
    setAiBriefErr(null);
    const res = await claudeComplete(briefingClaudePrompt(briefing), { maxTokens: 400 });
    setAiBriefBusy(false);
    if (res.ok) setAiBriefText(res.text);
    else setAiBriefErr(res.error);
  };

  // --- 1. General Role Analysis Data ---
  const roles = ['Audit Coordinator', 'Lead Auditor', 'Auditor'];

  const roleProgressData = {
    labels: roles,
    datasets: [
      {
        label: 'Analysis Progress (%)',
        data: [85, 72, 64],
        backgroundColor: ['#0ea5e9', '#f59e0b', '#8b5cf6'],
        borderRadius: 4,
      },
    ],
  };

  const workloadPieData = {
    labels: roles,
    datasets: [
      {
        label: 'Workload Distribution',
        data: [20, 35, 45],
        backgroundColor: ['#0ea5e9', '#f59e0b', '#8b5cf6'],
        hoverOffset: 4,
      },
    ],
  };

  const performanceScatterData = {
    datasets: [
      {
        label: 'Audit Coordinator',
        data: [{ x: 2, y: 75 }, { x: 3, y: 80 }, { x: 4, y: 72 }],
        backgroundColor: '#0ea5e9',
      },
      {
        label: 'Lead Auditor',
        data: [{ x: 2.5, y: 85 }, { x: 3.5, y: 88 }, { x: 5, y: 82 }],
        backgroundColor: '#f59e0b',
      },
      {
        label: 'Auditor',
        data: [{ x: 1, y: 60 }, { x: 2, y: 65 }, { x: 3, y: 58 }],
        backgroundColor: '#8b5cf6',
      },
    ],
  };

  // --- 2. Monthly Analysis Data (12 Months) ---
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const vibrantMonthColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', 
    '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16', '#d946ef'
  ];
  const whiteBorder = '#ffffff';

  // Raw Data for Findings
  const rawAuditorFindings = [12, 19, 15, 17, 14, 20, 22, 18, 25, 20, 24, 28];
  const rawLeadFindings = [8, 12, 10, 11, 9, 14, 15, 12, 18, 14, 16, 20];

  const findingsAuditorData = {
    labels: months,
    datasets: [{
      label: 'Auditor Findings',
      data: rawAuditorFindings,
      backgroundColor: '#8b5cf6',
      borderRadius: 4,
    }],
  };

  const findingsLeadAuditorData = {
    labels: months,
    datasets: [{
      label: 'Lead Auditor Findings',
      data: rawLeadFindings,
      backgroundColor: '#f59e0b',
      borderRadius: 4,
    }],
  };

  // Raw Data for Checklists
  const rawAdminChecklists = [5, 5, 6, 5, 7, 6, 8, 7, 6, 8, 9, 10];
  const rawLeadChecklists = [10, 12, 15, 12, 14, 16, 18, 15, 20, 18, 22, 24];
  const rawAuditorChecklists = [20, 25, 22, 28, 30, 32, 35, 30, 38, 35, 40, 42];

  // Pie Chart Data Definitions
  const checklistAdminPieData: ChartData<'pie'> = {
    labels: months,
    datasets: [{
      label: 'Admin Checklists',
      data: rawAdminChecklists,
      backgroundColor: vibrantMonthColors,
      borderColor: whiteBorder,
      borderWidth: 2,
      hoverOffset: 15,
    }],
  };

  const checklistLeadPieData: ChartData<'pie'> = {
    labels: months,
    datasets: [{
      label: 'Lead Auditor Checklists',
      data: rawLeadChecklists,
      backgroundColor: vibrantMonthColors,
      borderColor: whiteBorder,
      borderWidth: 2,
      hoverOffset: 15,
    }],
  };

  const checklistAuditorPieData: ChartData<'pie'> = {
    labels: months,
    datasets: [{
      label: 'Auditor Checklists',
      data: rawAuditorChecklists,
      backgroundColor: vibrantMonthColors,
      borderColor: whiteBorder,
      borderWidth: 2,
      hoverOffset: 15,
    }],
  };

  const checklistPieOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      animateScale: true,
      animateRotate: true,
      duration: 2000,
      easing: 'easeOutQuart'
    },
    layout: { padding: 10 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        padding: 12,
        callbacks: {
          label: function(context) {
             const label = context.label || '';
             const value = context.raw as number;
             const dataset = context.dataset;
             const total = dataset.data.reduce((acc: number, val: number) => acc + val, 0);
             const percentage = ((value / total) * 100).toFixed(1);
             return ` ${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  // C. Certificate Issuance Data
  const certificatesData = {
    labels: months,
    datasets: [
      {
        label: 'Certificates Issued',
        data: [5, 8, 6, 12, 15, 18, 22, 20, 25, 28, 30, 35],
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
    ],
  };

  const totalCertificates = certificatesData.datasets[0].data.reduce((a, b) => a + b, 0);
  const lastMonthCerts = certificatesData.datasets[0].data[11];

  // --- EXPORT TO EXCEL FUNCTION ---
  const handleExport = () => {
    // 1. Prepare Findings Data
    const findingsSheetData = months.map((month, index) => ({
      Month: month,
      'Auditor Findings': rawAuditorFindings[index],
      'Lead Auditor Findings': rawLeadFindings[index],
      'Total Findings': rawAuditorFindings[index] + rawLeadFindings[index]
    }));

    // 2. Prepare Checklists Data
    const checklistsSheetData = months.map((month, index) => ({
      Month: month,
      'Admin Checklists': rawAdminChecklists[index],
      'Lead Auditor Checklists': rawLeadChecklists[index],
      'Auditor Checklists': rawAuditorChecklists[index],
      'Total Completed': rawAdminChecklists[index] + rawLeadChecklists[index] + rawAuditorChecklists[index]
    }));

    // 3. Create Workbook and Sheets
    const workbook = XLSX.utils.book_new();
    
    const findingsSheet = XLSX.utils.json_to_sheet(findingsSheetData);
    XLSX.utils.book_append_sheet(workbook, findingsSheet, 'Findings Analysis');

    const checklistsSheet = XLSX.utils.json_to_sheet(checklistsSheetData);
    XLSX.utils.book_append_sheet(workbook, checklistsSheet, 'Checklists Analysis');

    // 4. Trigger Download
    XLSX.writeFile(workbook, 'Management_Dashboard_Analysis.xlsx');
  };

  return (
    <div className="management-dashboard">
      <RoleAIGuide />
      <AIPanel title="Compliance Forecast" subtitle="Holt time-series model — findings volume projected 3 months ahead" icon={<TrendingUp size={15} />}>
        {(() => {
          const fc = forecastFindings(3);
          return (
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{fc.reading}</p>
              {fc.history.length > 0 && (
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  History: {fc.history.map((h) => `${h.month}: ${h.count}`).join(' · ')}
                </div>
              )}
              {fc.forecast.length > 0 && (
                <div style={{ fontSize: 12.5, marginTop: 6 }}>
                  <strong>Forecast:</strong> {fc.forecast.map((f) => `${f.month}: ~${f.predicted}`).join(' · ')}
                </div>
              )}
            </div>
          );
        })()}
      </AIPanel>
      <RoleWorkflowOverview role="Management" />

      {/* Executive AI Briefing — computed live from cms_* stores */}
      <AIPanel
        title="Executive AI Briefing"
        subtitle="Certificates, corrective actions, auditor utilisation and pipeline — generated from live data"
        onRefresh={runBriefing}
      >
        {briefing && (
          <>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: '#334155' }}>
              {aiBriefText || briefing.paragraph}
            </p>
            <ul className="ai-insight-list">
              {briefing.highlights.map((h) => (
                <li key={h.chip}>
                  <span className={`ai-chip ${h.level}`}>{h.chip}</span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
            {isClaudeConfigured() && !aiBriefText && (
              <button type="button" className="ai-action-btn" onClick={enhanceBriefing} disabled={aiBriefBusy} style={{ marginTop: 10 }}>
                {aiBriefBusy ? 'Enhancing…' : 'Enhance with Claude'}
              </button>
            )}
            {aiBriefErr && <p className="ai-panel-note">Claude enhancement failed: {aiBriefErr} — showing the local summary.</p>}
            {aiBriefText && <p className="ai-panel-note">Narrative polished by Claude · numbers computed locally from live data.</p>}
          </>
        )}
      </AIPanel>

      <header className="dashboard-header">
        <div>
          <h1>Management Analysis Dashboard</h1>
          <p>Comprehensive overview of Audit Roles, Progress, and Certification Status.</p>
        </div>
        
        {/* Header Actions (Stats + Export Button) */}
        <div className="header-actions">
          <button className="export-btn" onClick={handleExport}>
            <span className="icon">📊</span> Export Excel
          </button>
          
          <div className="stat-badge">
            <span className="label">Total Certs (YTD)</span>
            <span className="value">{totalCertificates}</span>
          </div>
        </div>
      </header>

      {/* --- Section 1: Role Visualization Models --- */}
      <section className="analysis-section">
        <h2 className="section-title">Role-Based Analysis</h2>
        <div className="charts-grid-3">
          <div className="chart-card">
            <h3>Analysis Progress (%)</h3>
            <div className="chart-wrapper">
              <Bar data={roleProgressData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          </div>
          <div className="chart-card">
            <h3>Workload Distribution</h3>
            <div className="chart-wrapper">
              <Pie data={workloadPieData} options={{ responsive: true, maintainAspectRatio: false, animation: { animateScale: true, duration: 1500 } }} />
            </div>
          </div>
          <div className="chart-card">
            <h3>Performance Matrix</h3>
            <div className="chart-wrapper">
              <Scatter 
                data={performanceScatterData} 
                options={{ responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'Duration' } } } }} 
              />
            </div>
          </div>
        </div>
      </section>

      {/* --- Section 2: Certificate Numbering --- */}
      <section className="analysis-section certificate-log-section">
        <h2 className="section-title">Certificate Issuance Numbering</h2>
        <div className="certificate-numbering-container">
          <div className="cert-number-card">
            <div className="cert-icon">📜</div>
            <div className="cert-details">
              <h4>Last Certificate Issued</h4>
              <span className="cert-code">CERT-2025-{(1000 + totalCertificates).toString()}</span>
              <span className="cert-date">Issued: Dec 31, 2025</span>
            </div>
          </div>
          <div className="cert-number-card next-issue">
            <div className="cert-icon">🆕</div>
            <div className="cert-details">
              <h4>Next Sequence Number</h4>
              <span className="cert-code highlight">CERT-2025-{(1001 + totalCertificates).toString()}</span>
              <span className="cert-status">Ready for Allocation</span>
            </div>
          </div>
          <div className="cert-number-card stat-only">
            <div className="cert-details">
              <h4>This Month</h4>
              <span className="cert-value">+{lastMonthCerts}</span>
              <span className="cert-sub">Issues in December</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- Section 3: Findings Analysis (Monthly Trend) --- */}
      <section className="analysis-section">
        <h2 className="section-title">Findings Analysis (Monthly Trend)</h2>
        <div className="charts-grid-2">
          <div className="chart-card">
            <div className="card-header">
              <h3>Auditor Findings</h3>
              <span className="badge badge-purple">Auditor Role</span>
            </div>
            <div className="chart-wrapper-medium">
              <Bar data={findingsAuditorData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }}} />
            </div>
          </div>
          <div className="chart-card">
            <div className="card-header">
              <h3>Lead Auditor Findings</h3>
              <span className="badge badge-orange">Lead Auditor Role</span>
            </div>
            <div className="chart-wrapper-medium">
              <Bar data={findingsLeadAuditorData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }}} />
            </div>
          </div>
        </div>
      </section>

      {/* --- Section 4: Checklists Analysis (Monthly Pie Charts) --- */}
      <section className="analysis-section">
        <h2 className="section-title">Checklists Analysis (Monthly Wise Distribution)</h2>
        <div className="charts-grid-3">
          <div className="chart-card pie-card-wrapper">
            <div className="card-header">
              <h3>Admin Checklists</h3>
            </div>
            <div className="chart-wrapper-pie">
              <Pie data={checklistAdminPieData} options={checklistPieOptions} />
            </div>
          </div>
          <div className="chart-card pie-card-wrapper">
            <div className="card-header">
              <h3>Lead Auditor Checklists</h3>
            </div>
            <div className="chart-wrapper-pie">
              <Pie data={checklistLeadPieData} options={checklistPieOptions} />
            </div>
          </div>
          <div className="chart-card pie-card-wrapper">
            <div className="card-header">
              <h3>Auditor Checklists</h3>
            </div>
            <div className="chart-wrapper-pie">
              <Pie data={checklistAuditorPieData} options={checklistPieOptions} />
            </div>
          </div>
        </div>
      </section>

      {/* --- Section 5: Certificate Issuance --- */}
      <section className="analysis-section">
        <h2 className="section-title">Certificate Issuance Progress</h2>
        <div className="chart-card full-width">
          <div className="card-header">
            <h3>Certificates Issued to Clients</h3>
            <span className="badge badge-green">Last 12 Months</span>
          </div>
          <div className="chart-wrapper-large">
            <Bar data={certificatesData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }}} />
          </div>
        </div>
      </section>

    </div>
  );
};

export default ManagementDashboard;
/**
 * AI Assistant Engine for the Certification Management System.
 *
 * A self-contained, frontend-only chatbot that uses an intent + knowledge
 * base approach to answer almost any question related to the CMS, ISO
 * standards, auditing concepts, and the live data stored in localStorage.
 */

export type AssistantBlockKind = 'text' | 'list' | 'cards' | 'navigate' | 'kpi';

export interface AssistantBlock {
  kind: AssistantBlockKind;
  text?: string;
  items?: string[];
  cards?: { title: string; subtitle?: string; meta?: string }[];
  nav?: { label: string; path: string }[];
  kpis?: { label: string; value: string | number }[];
}

export interface AssistantResponse {
  blocks: AssistantBlock[];
  suggestions?: string[];
}

export interface AssistantContext {
  role: string;
  navigate?: (path: string) => void;
}

/* --------------------------------------------------------------------- */
/*  Knowledge base                                                       */
/* --------------------------------------------------------------------- */

const STANDARDS = [
  { code: 'ISO 9001:2015', name: 'Quality Management System' },
  { code: 'ISO 14001:2015', name: 'Environmental Management System' },
  { code: 'ISO 45001:2018', name: 'Occupational Health & Safety' },
  { code: 'ISO 27001:2022', name: 'Information Security Management' },
  { code: 'ISO 42001:2023', name: 'AI Management System' },
];

const ROLE_PATHS: Record<string, Record<string, string>> = {
  'Audit Coordinator': {
    dashboard: '/auditor-coordinator/dashboard',
    'audit scope': '/auditor-coordinator/audit-scope',
    'auditor profiles': '/auditor-coordinator/auditor-profiles',
    'audit certifications': '/auditor-coordinator/audit-certifications',
    'audit checklists': '/auditor-coordinator/audit-checklists',
    'client registration': '/auditor-coordinator/client-registration',
    application: '/auditor-coordinator/application-dispatch',
    'audit schedules': '/auditor-coordinator/audit-schedules',
    'audit types': '/auditor-coordinator/audit-types',
    'audit report': '/auditor-coordinator/audit-report',
    'certificate delivery': '/auditor-coordinator/certificate-delivery',
    'surveillance audit': '/auditor-coordinator/audit-confirmation',
    profile: '/auditor-coordinator/profile',
  },
  'Lead Auditor': {
    dashboard: '/lead-auditor/dashboard',
    'audit schedules': '/lead-auditor/audit-schedules',
    'conduct audit': '/lead-auditor/conduct-audit',
    'audit report': '/lead-auditor/audit-report',
    'action review': '/lead-auditor/action-review',
    'action approval': '/lead-auditor/action-approval',
  },
  Auditor: {
    dashboard: '/auditor/dashboard',
    'schedule confirmations': '/auditor/schedule-confirmations',
    'conduct audit': '/auditor/conduct-audit',
    'audit report': '/auditor/audit-report',
    'action review': '/auditor/action-review',
  },
  Auditee: {
    dashboard: '/audit-client/dashboard',
    'audit actions': '/audit-client/audit-actions',
    'submit report': '/audit-client/submit-report',
  },
  Management: {
    dashboard: '/management/dashboard',
  },
};

/* --------------------------------------------------------------------- */
/*  Storage helpers                                                      */
/* --------------------------------------------------------------------- */

const safeJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const data = () => ({
  scopes: safeJSON<any[]>('cms_audit_scopes', []),
  types: safeJSON<any[]>('cms_audit_types', []),
  auditors: safeJSON<any[]>('cms_auditors', []),
  clients: safeJSON<any[]>('cms_client_registrations', []),
  dispatch: safeJSON<any[]>('cms_application_dispatch_v7', []),
  dispatchFallback: safeJSON<any[]>('cms_application_dispatch_v4', []),
  schedules: [...safeJSON<any[]>('cms_audit_schedules', []), ...safeJSON<any[]>('cms_audit_schedules_v3', [])],
  certifications: safeJSON<any[]>('cms_audit_certifications', []),
  checklists: safeJSON<any[]>('cms_audit_checklists', []),
  reports: safeJSON<any[]>('cms_audit_reports', []),
  certificates: safeJSON<any[]>('cms_certificates', []),
  profile: safeJSON<any>('auditCoordinatorProfile', null),
});

/* --------------------------------------------------------------------- */
/*  Intent helpers                                                       */
/* --------------------------------------------------------------------- */

const has = (text: string, ...needles: string[]) =>
  needles.every((n) => text.includes(n.toLowerCase()));

const hasAny = (text: string, ...needles: string[]) =>
  needles.some((n) => text.includes(n.toLowerCase()));

const lower = (s: string) => (s || '').trim().toLowerCase();

/**
 * Normalize the user's question so synonyms / brand names map to canonical tokens.
 * Keeps the original input for greeting regex; only used for intent matching.
 */
const normalize = (s: string): string => {
  let t = lower(s);
  // Brand / product names
  t = t.replace(/\bcertms\b/g, 'cms');
  t = t.replace(/\bcert\s*ms\b/g, 'cms');
  t = t.replace(/\bcertification\s+management\s+system\b/g, 'cms');
  t = t.replace(/\bqmics\b/g, 'cms');
  // Common abbreviations & synonyms
  t = t.replace(/\bncr\b/g, 'non-conformity');
  t = t.replace(/\bnc\b/g, 'non-conformity');
  t = t.replace(/\bca\b/g, 'corrective action');
  t = t.replace(/\bofi\b/g, 'opportunity for improvement');
  t = t.replace(/\bisms\b/g, 'information security management system');
  t = t.replace(/\bqms\b/g, 'quality management system');
  t = t.replace(/\bems\b/g, 'environmental management system');
  t = t.replace(/\bohs\b/g, 'occupational health and safety');
  t = t.replace(/\boh&s\b/g, 'occupational health and safety');
  // Punctuation collapse
  t = t.replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
};

/* --------------------------------------------------------------------- */
/*  Quick suggestions per role                                           */
/* --------------------------------------------------------------------- */

export const suggestionsForRole = (role: string): string[] => {
  switch (role) {
    case 'Audit Coordinator':
      return [
        'What is required to conduct an audit?',
        'How do I create an audit scope?',
        'Stages of a certification audit',
        'How many auditors do I have?',
        'What is ISO 27001?',
        'Open audit schedules',
      ];
    case 'Lead Auditor':
      return [
        'What is required to conduct an audit?',
        'Show my upcoming audits',
        'How do I submit an audit report?',
        'What is a non-conformity?',
        'Open conduct audit page',
      ];
    case 'Auditor':
      return [
        'How do I conduct an audit?',
        'What is audit evidence?',
        'Open my schedule confirmations',
        'What is a checklist?',
      ];
    case 'Auditee':
      return [
        'What is an audit?',
        'How do I submit a report?',
        'What is corrective action?',
        'Show my audit actions',
      ];
    case 'Management':
      return [
        'How does the certification flow work?',
        'List supported standards',
        'What is accreditation?',
        'Open dashboard',
      ];
    default:
      return [
        'What is an audit?',
        'List supported standards',
        'What can you do?',
      ];
  }
};

/* --------------------------------------------------------------------- */
/*  Public entry: ask                                                    */
/* --------------------------------------------------------------------- */

export const ask = (rawInput: string, ctx: AssistantContext): AssistantResponse => {
  const input = normalize(rawInput);
  if (!input) {
    return {
      blocks: [
        {
          kind: 'text',
          text: 'Tell me what you need help with — or try one of the suggestions below.',
        },
      ],
      suggestions: suggestionsForRole(ctx.role),
    };
  }

  /* ------------------------ Greetings & meta ------------------------- */
  if (
    /^(hi|hello|hey|hiya|yo|hola|hii+|good\s*(morning|afternoon|evening))[\s!.,?]*$/i.test(rawInput) ||
    hasAny(input, 'good morning', 'good afternoon', 'good evening')
  ) {
    const t = new Date().getHours();
    const greet =
      t < 12 ? 'Good morning' : t < 17 ? 'Good afternoon' : t < 21 ? 'Good evening' : 'Hello';
    return {
      blocks: [
        {
          kind: 'text',
          text: `${greet}! I'm your CMS assistant. Ask me anything about the Certification Management System — audits, standards, processes, or your live data.`,
        },
      ],
      suggestions: suggestionsForRole(ctx.role),
    };
  }

  if (hasAny(input, 'who are you', 'what are you', 'what can you do', 'help me', 'capabilities', 'features')) {
    return {
      blocks: [
        { kind: 'text', text: 'I am your **CMS Assistant**. I can help with:' },
        {
          kind: 'list',
          items: [
            '**Concepts** — "What is an audit?", "What is a non-conformity?", "What is corrective action?"',
            '**Standards** — "What is ISO 27001?", "List supported standards", "Difference between ISO 9001 and 14001"',
            '**Process** — "What is required to conduct an audit?", "Stages of a certification audit"',
            '**How-to** — "How do I create an audit scope?", "How do I submit a report?"',
            '**Navigation** — "Open audit schedules", "Take me to dashboard"',
            '**Live data** — "How many auditors?", "Show pending applications"',
          ],
        },
      ],
      suggestions: suggestionsForRole(ctx.role),
    };
  }

  if (hasAny(input, 'thank', 'thanks', 'thx', 'thank you')) {
    return { blocks: [{ kind: 'text', text: 'You are welcome — happy auditing!' }] };
  }

  if (/^(bye|goodbye|see you|see ya|cya|later)[\s!.,?]*$/i.test(rawInput)) {
    return { blocks: [{ kind: 'text', text: 'Goodbye! I will be here whenever you need me.' }] };
  }

  if (/^(ok|okay|alright|got it|sure|fine|cool|nice|great)[\s!.,?]*$/i.test(rawInput)) {
    return {
      blocks: [{ kind: 'text', text: 'Anything else I can help you with?' }],
      suggestions: suggestionsForRole(ctx.role),
    };
  }

  if (hasAny(input, 'your name', 'who made you', 'who built you')) {
    return {
      blocks: [
        {
          kind: 'text',
          text: 'I am the built-in **CMS Assistant** for the Certification Management System — a role-aware helper that knows the app, the ISO standards, and your live data.',
        },
      ],
    };
  }

  /* ------------------------ Navigation ------------------------------- */
  const navMatch = matchNavigation(input, ctx.role);
  if (navMatch) {
    return {
      blocks: [
        { kind: 'text', text: `Opening **${navMatch.label}** for you.` },
        { kind: 'navigate', nav: [navMatch] },
      ],
    };
  }

  /* ------------------------ Standards info --------------------------- */
  if (
    has(input, 'standard') &&
    hasAny(input, 'list', 'all', 'supported', 'available', 'show', 'which', 'what')
  ) {
    return {
      blocks: [
        { kind: 'text', text: 'Here are the standards currently supported in the system:' },
        {
          kind: 'cards',
          cards: STANDARDS.map((s) => ({ title: s.code, subtitle: s.name })),
        },
      ],
      suggestions: ['What is ISO 9001?', 'What is ISO 27001?', 'What is ISO 42001?'],
    };
  }

  // Difference between two standards: "difference between iso 9001 and iso 14001"
  const diffPair = input.match(/iso\s*(\d{3,5})[^\d]+iso\s*(\d{3,5})/);
  if (diffPair && hasAny(input, 'difference', 'compare', 'vs', 'versus')) {
    const a = STANDARDS.find((s) => s.code.startsWith(`ISO ${diffPair[1]}`));
    const b = STANDARDS.find((s) => s.code.startsWith(`ISO ${diffPair[2]}`));
    if (a && b) {
      return {
        blocks: [
          {
            kind: 'text',
            text: `**${a.code}** vs **${b.code}** — both are ISO management system standards but cover different domains.`,
          },
          {
            kind: 'cards',
            cards: [
              { title: a.code, subtitle: a.name, meta: describeStandard(a.code) },
              { title: b.code, subtitle: b.name, meta: describeStandard(b.code) },
            ],
          },
        ],
      };
    }
  }

  // "What is ISO XXXX"
  const isoMatch = input.match(/iso\s*(\d{3,5})(?::?\s*(\d{4}))?/);
  if (isoMatch) {
    const code = `ISO ${isoMatch[1]}`;
    const exact = STANDARDS.find((s) => s.code.startsWith(code));
    if (exact) {
      return {
        blocks: [
          { kind: 'text', text: `**${exact.code}** — ${exact.name}.` },
          { kind: 'text', text: describeStandard(exact.code) },
        ],
        suggestions: ['List supported standards', 'How do I create an audit scope?'],
      };
    }
  }

  /* ------------------------ How-to guides ---------------------------- */
  const howto = matchHowTo(input);
  if (howto) return howto;

  /* ------------------------ Knowledge base --------------------------- */
  const kb = matchKnowledge(input);
  if (kb) return kb;

  /* ------------------------ Data lookups ----------------------------- */
  const dataResp = matchData(input, ctx);
  if (dataResp) return dataResp;

  /* ------------------------ Profile ---------------------------------- */
  if (has(input, 'profile')) {
    const d = data();
    if (ctx.role === 'Audit Coordinator') {
      return {
        blocks: [
          {
            kind: 'text',
            text: d.profile?.name
              ? `Your profile is set up as **${d.profile.name}**. You can edit name, photo and details from the profile page.`
              : 'You can set up your profile (name, photo and details) from the profile page.',
          },
          {
            kind: 'navigate',
            nav: [{ label: 'Open My Profile', path: '/auditor-coordinator/profile' }],
          },
        ],
      };
    }
    return {
      blocks: [
        { kind: 'text', text: 'Profile editing is currently available for the Audit Coordinator role.' },
      ],
    };
  }

  /* ------------------------ Smart fallback --------------------------- */
  return smartFallback(input, ctx);
};

/* --------------------------------------------------------------------- */
/*  Live data lookups                                                    */
/* --------------------------------------------------------------------- */

function matchData(input: string, _ctx: AssistantContext): AssistantResponse | null {
  const d = data();

  if (hasAny(input, 'auditor') && hasAny(input, 'how many', 'count', 'total', 'number of')) {
    return {
      blocks: [
        {
          kind: 'kpi',
          kpis: [
            { label: 'Total auditors', value: d.auditors.length },
            { label: 'Active', value: d.auditors.filter((a: any) => a.status === 'Active').length },
          ],
        },
      ],
      suggestions: ['List auditors', 'Open auditor profiles'],
    };
  }

  if ((hasAny(input, 'list', 'show', 'all') && has(input, 'auditor')) || input === 'auditors') {
    if (!d.auditors.length) {
      return {
        blocks: [{ kind: 'text', text: 'No auditors found yet. Add some in **Auditor Profiles**.' }],
      };
    }
    return {
      blocks: [
        {
          kind: 'cards',
          cards: d.auditors.slice(0, 8).map((a: any) => ({
            title: a.name || 'Unnamed',
            subtitle: a.role || 'Auditor',
            meta: [a.department, a.specialization].filter(Boolean).join(' • '),
          })),
        },
      ],
      suggestions: ['How many auditors?', 'Open auditor profiles'],
    };
  }

  if (hasAny(input, 'client', 'organization') && hasAny(input, 'how many', 'count', 'total', 'number of')) {
    return {
      blocks: [
        {
          kind: 'kpi',
          kpis: [
            { label: 'Clients registered', value: d.clients.length },
            { label: 'Approved', value: d.clients.filter((c: any) => c.status === 'Client Approved').length },
            { label: 'Pending', value: d.clients.filter((c: any) => c.status === 'Pending').length },
          ],
        },
      ],
      suggestions: ['Show pending clients', 'Open client registration'],
    };
  }

  if (has(input, 'pending') && hasAny(input, 'client', 'application', 'register')) {
    const pending = d.clients.filter((c: any) => c.status === 'Pending');
    if (!pending.length) {
      return { blocks: [{ kind: 'text', text: 'No pending clients right now.' }] };
    }
    return {
      blocks: [
        { kind: 'text', text: `${pending.length} pending client(s):` },
        {
          kind: 'cards',
          cards: pending.slice(0, 8).map((c: any) => ({
            title: c.organizationName || 'Unnamed organization',
            subtitle: c.standard,
            meta: c.contactPerson,
          })),
        },
      ],
      suggestions: ['Open client registration', 'How many clients?'],
    };
  }

  if (has(input, 'schedule') && hasAny(input, 'how many', 'upcoming', 'today', 'pending')) {
    return {
      blocks: [
        {
          kind: 'kpi',
          kpis: [
            { label: 'Total schedules', value: d.schedules.length },
            {
              label: 'Upcoming',
              value: d.schedules.filter((s: any) => {
                const dt = new Date(s.date || s.scheduledDate || 0);
                return dt.getTime() > Date.now();
              }).length,
            },
          ],
        },
      ],
      suggestions: ['Open audit schedules'],
    };
  }

  if (has(input, 'scope') && hasAny(input, 'how many', 'list', 'show', 'count')) {
    if (!d.scopes.length) {
      return { blocks: [{ kind: 'text', text: 'No audit scopes defined yet.' }] };
    }
    return {
      blocks: [
        {
          kind: 'cards',
          cards: d.scopes.slice(0, 8).map((s: any) => ({
            title: s.scopeName || s.name || 'Unnamed scope',
            subtitle: s.standard,
            meta: s.description,
          })),
        },
      ],
      suggestions: ['Open audit scope', 'How do I create an audit scope?'],
    };
  }

  if (has(input, 'certification') && hasAny(input, 'how many', 'list', 'show')) {
    if (!d.certifications.length) {
      return { blocks: [{ kind: 'text', text: 'No certifications recorded yet.' }] };
    }
    return {
      blocks: [
        {
          kind: 'cards',
          cards: d.certifications.slice(0, 8).map((c: any) => ({
            title: c.name || c.certificateNumber || 'Certification',
            subtitle: c.standard,
            meta: c.duration ? `${c.duration} months` : undefined,
          })),
        },
      ],
      suggestions: ['Open audit certifications'],
    };
  }

  // System-wide stats
  if (hasAny(input, 'stat', 'overview', 'summary', 'dashboard data', 'numbers')) {
    return {
      blocks: [
        { kind: 'text', text: 'Here is a quick overview of your CMS data:' },
        {
          kind: 'kpi',
          kpis: [
            { label: 'Auditors', value: d.auditors.length },
            { label: 'Clients', value: d.clients.length },
            { label: 'Schedules', value: d.schedules.length },
            { label: 'Scopes', value: d.scopes.length },
            { label: 'Certifications', value: d.certifications.length },
            { label: 'Reports', value: d.reports.length },
          ],
        },
      ],
    };
  }

  return null;
}

/* --------------------------------------------------------------------- */
/*  Knowledge base — concepts, terminology, processes                    */
/* --------------------------------------------------------------------- */

interface KBEntry {
  match: (input: string) => boolean;
  build: () => AssistantResponse;
}

const KB: KBEntry[] = [
  /* ------------------ "What is required to conduct an audit" ------- */
  {
    match: (i) =>
      hasAny(i, 'required', 'requirement', 'requirements', 'need', 'needed', 'prerequisite') &&
      has(i, 'audit') &&
      hasAny(i, 'conduct', 'run', 'do', 'perform', 'carry'),
    build: () => ({
      blocks: [
        { kind: 'text', text: '**To conduct an audit you typically need:**' },
        {
          kind: 'list',
          items: [
            '**Audit scope** — what processes, sites and standard clauses will be audited.',
            '**Audit objectives** — what the audit must achieve (e.g. confirm conformity to ISO 9001:2015).',
            '**Audit criteria** — the standard, policies, procedures and legal requirements being checked.',
            '**Audit plan / schedule** — dates, locations, sessions and people involved.',
            '**Competent audit team** — at least one Lead Auditor plus auditors with the right qualifications.',
            '**Approved checklist** — questions and clauses to be verified during the audit.',
            '**Auditee readiness** — documented information, records, and stakeholder availability.',
            '**Resources** — meeting rooms, PPE for site visits, access to systems.',
          ],
        },
        {
          kind: 'text',
          text: 'Inside the CMS, you create the **scope**, define **audit types**, register the **client**, dispatch the **application**, prepare **checklists**, and create a **schedule** with the assigned auditors. Then the team can conduct the audit and submit reports.',
        },
      ],
      suggestions: [
        'Stages of a certification audit',
        'How do I create an audit scope?',
        'How do I conduct an audit?',
      ],
    }),
  },

  /* ------------------ Stages / phases of audit --------------------- */
  {
    match: (i) =>
      hasAny(i, 'stage', 'stages', 'phase', 'phases', 'step', 'steps') &&
      hasAny(i, 'audit', 'certification'),
    build: () => ({
      blocks: [
        { kind: 'text', text: '**Stages of a certification audit:**' },
        {
          kind: 'list',
          items: [
            '**Application** — Auditee applies, Coordinator registers them and dispatches the application.',
            '**Stage 1 audit (documentation review)** — Verify management system documentation, readiness and scope.',
            '**Stage 2 audit (on-site implementation)** — Confirm the system is implemented and effective.',
            '**Findings & corrective actions** — Non-conformities are recorded; auditee submits corrective action.',
            '**Certification decision** — Independent review and certificate issuance.',
            '**Surveillance audits** — Periodic checks (typically yearly) during the 3-year cycle.',
            '**Recertification audit** — Conducted before the certificate expires.',
          ],
        },
      ],
      suggestions: ['What is a surveillance audit?', 'How does the certification flow work?'],
    }),
  },

  /* ------------------ What is an audit ----------------------------- */
  {
    match: (i) =>
      (i === 'what is an audit' || i === 'what is audit' || i === 'define audit' ||
        (has(i, 'what', 'audit') && !hasAny(i, 'scope', 'plan', 'type', 'report', 'checklist', 'evidence', 'finding', 'criteria', 'objective', 'team', 'trail', 'log', 'history'))),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**An audit** is a systematic, independent and documented process for obtaining evidence and evaluating it objectively to determine the extent to which audit criteria (a standard, policy or requirement) are fulfilled.',
        },
        {
          kind: 'list',
          items: [
            '**Internal audit** — performed by the organization on itself.',
            '**External audit** — performed by an outside party (e.g. a certification body).',
            '**Certification audit** — leads to the issuance of an ISO certificate.',
            '**Surveillance audit** — periodic check during the certification cycle.',
          ],
        },
      ],
    }),
  },

  /* ------------------ Audit scope ---------------------------------- */
  {
    match: (i) => has(i, 'what', 'audit', 'scope') || (i === 'audit scope') || (has(i, 'define', 'scope')),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Audit scope** defines the extent and boundaries of an audit — which processes, departments, locations, products, services and standard clauses are included. A clear scope keeps the audit focused and prevents disputes about what was assessed.',
        },
      ],
      suggestions: ['How do I create an audit scope?', 'What is audit criteria?'],
    }),
  },

  /* ------------------ Audit criteria ------------------------------- */
  {
    match: (i) => has(i, 'audit', 'criteria') || has(i, 'what', 'criteria'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Audit criteria** are the set of policies, procedures, standards (like ISO 9001:2015), legal requirements and contractual commitments used as a reference against which audit evidence is compared.',
        },
      ],
    }),
  },

  /* ------------------ Audit evidence ------------------------------- */
  {
    match: (i) => has(i, 'audit', 'evidence') || has(i, 'what', 'evidence'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Audit evidence** is the verifiable information (records, statements of fact, observations) collected during an audit and used to evaluate conformity against the audit criteria. It must be accurate, sufficient and relevant.',
        },
      ],
    }),
  },

  /* ------------------ Audit findings ------------------------------- */
  {
    match: (i) => has(i, 'audit', 'finding') || has(i, 'what', 'finding'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Audit findings** are the results of evaluating audit evidence against audit criteria. They can be:',
        },
        {
          kind: 'list',
          items: [
            '**Conformity** — meets the requirement.',
            '**Non-conformity (NC)** — does not meet a requirement.',
            '**Observation** — potential improvement or risk worth noting, but not a non-conformity.',
            '**Opportunity for improvement (OFI)** — a recommendation for the auditee.',
          ],
        },
      ],
    }),
  },

  /* ------------------ Non-conformity ------------------------------- */
  {
    match: (i) =>
      has(i, 'non-conformity') ||
      has(i, 'nonconformity') ||
      has(i, 'non conformity') ||
      (has(i, 'what', 'nc')) ||
      (has(i, 'major', 'minor') && has(i, 'audit')),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Non-conformity (NC)** is the non-fulfilment of a requirement. There are two severities:',
        },
        {
          kind: 'list',
          items: [
            '**Major NC** — absence or total breakdown of a required process; raises serious doubt about the system. Must be closed before certification.',
            '**Minor NC** — an isolated lapse in implementation or evidence that does not threaten the overall system.',
          ],
        },
        { kind: 'text', text: 'Each NC requires a documented corrective action with root cause analysis.' },
      ],
      suggestions: ['What is corrective action?', 'What is root cause analysis?'],
    }),
  },

  /* ------------------ Corrective action / CAPA --------------------- */
  {
    match: (i) =>
      has(i, 'corrective', 'action') ||
      has(i, 'what', 'capa') ||
      i === 'capa',
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Corrective action** is the action taken to eliminate the cause of a detected non-conformity so it does not recur. **CAPA** combines Corrective Action and Preventive Action.',
        },
        {
          kind: 'list',
          items: [
            'Identify the issue (the non-conformity).',
            'Contain it / immediate fix.',
            'Determine root cause (e.g. 5-Whys, fishbone).',
            'Define and implement corrective action.',
            'Verify effectiveness over time.',
          ],
        },
      ],
    }),
  },

  /* ------------------ Root cause ----------------------------------- */
  {
    match: (i) => has(i, 'root', 'cause'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Root cause analysis (RCA)** is the practice of finding the underlying reason for a problem, not just its symptom. Common tools: **5-Whys**, **Ishikawa (fishbone) diagram**, **Pareto analysis**, **fault tree analysis**.',
        },
      ],
    }),
  },

  /* ------------------ Audit plan ----------------------------------- */
  {
    match: (i) => has(i, 'audit', 'plan') || has(i, 'audit', 'programme'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Audit plan** describes the activities and arrangements for a single audit — objectives, scope, criteria, dates, sessions, audit team and locations. **Audit programme** is the set of audits planned for a defined timeframe (often 3-year certification cycle).',
        },
      ],
    }),
  },

  /* ------------------ Audit team / lead auditor -------------------- */
  {
    match: (i) =>
      has(i, 'audit', 'team') ||
      has(i, 'lead', 'auditor') ||
      (has(i, 'who', 'auditor')),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Audit team** is the group of auditors performing an audit, supported as needed by technical experts. The **Lead Auditor** is responsible for:',
        },
        {
          kind: 'list',
          items: [
            'Planning and managing the audit.',
            'Communicating with the auditee.',
            'Leading opening and closing meetings.',
            'Resolving disagreements among the team.',
            'Submitting the final audit report.',
          ],
        },
      ],
    }),
  },

  /* ------------------ Opening / closing meeting -------------------- */
  {
    match: (i) =>
      has(i, 'opening', 'meeting') ||
      has(i, 'closing', 'meeting') ||
      has(i, 'kickoff', 'audit'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Opening meeting** starts the on-site audit: the team confirms scope, plan, methods and logistics with the auditee. **Closing meeting** presents findings, summarises NCs, and confirms next steps before the team leaves the site.',
        },
      ],
    }),
  },

  /* ------------------ Surveillance audit --------------------------- */
  {
    match: (i) => has(i, 'surveillance', 'audit'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Surveillance audit** is a periodic audit (typically once or twice a year) carried out during the 3-year certification cycle to confirm the management system is still implemented and effective. It is shorter than a full certification audit.',
        },
      ],
      suggestions: ['What is recertification?', 'Stages of a certification audit'],
    }),
  },

  /* ------------------ Recertification ------------------------------ */
  {
    match: (i) => has(i, 'recertification') || has(i, 'renewal') || (has(i, 'how long', 'certificate', 'valid')),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: 'An ISO certificate is typically valid for **3 years**. A **recertification audit** is performed before expiry to confirm continued conformity and renew the certificate. Surveillance audits are conducted in years 1 and 2.',
        },
      ],
    }),
  },

  /* ------------------ Internal vs external ------------------------- */
  {
    match: (i) => (has(i, 'internal') && has(i, 'external')) || has(i, 'internal', 'audit') || has(i, 'external', 'audit'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Internal audit (1st party)** — the organization audits itself to check its own management system. **External audits** are 2nd party (by a customer/interested party) or 3rd party (by an independent certification body).',
        },
      ],
    }),
  },

  /* ------------------ Certification body / accreditation ----------- */
  {
    match: (i) =>
      has(i, 'certification', 'body') ||
      i === 'cb' ||
      has(i, 'accreditation') ||
      has(i, 'what', 'accredited'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Certification body (CB)** — an independent organization that audits and issues ISO certificates. **Accreditation** is the formal recognition (by a national accreditation body, e.g. UKAS, ANAB, NABCB) that the CB is competent to issue those certificates.',
        },
      ],
    }),
  },

  /* ------------------ Audit checklist ------------------------------ */
  {
    match: (i) => has(i, 'audit', 'checklist') || (has(i, 'what', 'checklist')),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Audit checklist** is a structured list of clauses, questions and verification items the auditor uses while conducting the audit. It helps ensure consistency, traceability and complete coverage of the criteria.',
        },
        {
          kind: 'navigate',
          nav: [{ label: 'Open Audit Checklists', path: '/auditor-coordinator/audit-checklists' }],
        },
      ],
    }),
  },

  /* ------------------ PDCA ----------------------------------------- */
  {
    match: (i) => has(i, 'pdca') || has(i, 'plan', 'do', 'check', 'act'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**PDCA cycle** (Plan-Do-Check-Act) is the continual improvement loop at the heart of every ISO management system: **Plan** what to do, **Do** it, **Check** the results, **Act** to improve.',
        },
      ],
    }),
  },

  /* ------------------ Risk-based thinking -------------------------- */
  {
    match: (i) => has(i, 'risk') && hasAny(i, 'based', 'thinking', 'iso', 'management'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Risk-based thinking** means proactively identifying risks and opportunities that could affect the management system, then planning actions to address them. It is a core requirement in ISO 9001:2015, ISO 14001:2015, ISO 27001:2022 and others.',
        },
      ],
    }),
  },

  /* ------------------ Documented information ----------------------- */
  {
    match: (i) =>
      has(i, 'documented', 'information') ||
      (has(i, 'what', 'documents') && has(i, 'iso')) ||
      has(i, 'what', 'records'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Documented information** is the umbrella term ISO uses for both **documents** (procedures, manuals, work instructions) and **records** (audit reports, training records, calibration records). It must be controlled — versioned, approved, accessible and retained.',
        },
      ],
    }),
  },

  /* ------------------ Management review ---------------------------- */
  {
    match: (i) => has(i, 'management', 'review'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Management review** is a top-management evaluation of the management system at planned intervals to ensure its continuing suitability, adequacy and effectiveness. Inputs typically include audit results, customer feedback, NC trends, risks and opportunities.',
        },
      ],
    }),
  },

  /* ------------------ QMS / EMS / ISMS / OHSMS / AIMS -------------- */
  {
    match: (i) =>
      hasAny(i, 'qms', 'ems', 'isms', 'ohsms', 'aims') ||
      has(i, 'quality', 'management', 'system') ||
      has(i, 'environmental', 'management', 'system') ||
      has(i, 'information', 'security', 'management', 'system'),
    build: () => ({
      blocks: [
        { kind: 'text', text: '**Common management system acronyms used in ISO standards:**' },
        {
          kind: 'list',
          items: [
            '**QMS** — Quality Management System (ISO 9001).',
            '**EMS** — Environmental Management System (ISO 14001).',
            '**OHSMS / OH&S** — Occupational Health & Safety Management System (ISO 45001).',
            '**ISMS** — Information Security Management System (ISO 27001).',
            '**AIMS** — Artificial Intelligence Management System (ISO 42001).',
          ],
        },
      ],
    }),
  },

  /* ------------------ Auditee -------------------------------------- */
  {
    match: (i) => has(i, 'what', 'auditee') || i === 'auditee',
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Auditee** is the organization or part of an organization being audited. In this CMS, the Auditee role can view audit actions assigned to them and submit reports.',
        },
      ],
    }),
  },

  /* ------------------ Audit coordinator role ----------------------- */
  {
    match: (i) => has(i, 'audit', 'coordinator') || has(i, 'coordinator', 'role'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: 'The **Audit Coordinator** plans and orchestrates audits in the CMS:',
        },
        {
          kind: 'list',
          items: [
            'Registers clients and dispatches applications.',
            'Defines audit scope, types and certifications.',
            'Builds checklists and assigns audit teams.',
            'Schedules audits and tracks progress.',
            'Manages certificate issuance and delivery.',
          ],
        },
      ],
    }),
  },

  /* ------------------ Certificate delivery ------------------------- */
  {
    match: (i) => has(i, 'certificate', 'delivery') || has(i, 'issue', 'certificate'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text: '**Certificate delivery** happens after a successful audit and certification decision: the certificate (with scope, standard, validity, certification body and accreditation marks) is issued and sent to the client.',
        },
        {
          kind: 'navigate',
          nav: [{ label: 'Open Certificate Delivery', path: '/auditor-coordinator/certificate-delivery' }],
        },
      ],
    }),
  },

  /* ------------------ Help on CertMS / CMS itself ------------------ */
  {
    match: (i) =>
      has(i, 'about', 'cms') ||
      has(i, 'what', 'cms') ||
      has(i, 'what', 'this', 'app') ||
      has(i, 'what', 'application') ||
      has(i, 'what is', 'system') ||
      has(i, 'tell me about cms') ||
      has(i, 'explain cms') ||
      has(i, 'how does this app work') ||
      has(i, 'purpose'),
    build: () => ({
      blocks: [
        {
          kind: 'text',
          text:
            '**CertMS** (Certification Management System) is a web application from Qmics that manages the full ISO certification lifecycle — from a client first enquiring through their website all the way to the issued certificate and ongoing surveillance audits.',
        },
        {
          kind: 'text',
          text: 'Here is what each part of the app does:',
        },
        {
          kind: 'list',
          items: [
            '**Client Enquiry & Application** — capture website leads, send formal applications, track receipts.',
            '**Client Registration** — onboard the client with company, GST/CIN, contact, scope and standard.',
            '**Audit Scope, Types & Checklists** — define what will be audited and how.',
            '**Auditor Profiles** — coordinator creates them, Lead Auditor approves and validates.',
            '**Audit Schedules** — plan audits with calendar heatmap and conflict detection.',
            '**Conduct Audit** — Lead Auditor and Auditor run the audit, log evidence and findings.',
            '**Audit Report & Action Review** — draft, review, and approve the findings.',
            '**Certificate Delivery** — generate a certificate with QR code, dispatch via email or WhatsApp.',
            '**Surveillance Audit & Renewal** — auto-reminders for surveillance and recertification.',
          ],
        },
        {
          kind: 'text',
          text:
            'Five roles share the system: **Audit Coordinator**, **Lead Auditor**, **Auditor**, **Auditee** (the client), and **Management**.',
        },
      ],
      suggestions: [
        'How does the certification flow work?',
        'What roles are there?',
        'List supported standards',
        'How do I register a client?',
      ],
    }),
  },

  /* ------------------ Roles overview -------------------------------- */
  {
    match: (i) =>
      has(i, 'role') ||
      has(i, 'who', 'use') ||
      has(i, 'users') ||
      has(i, 'permissions') ||
      has(i, 'access'),
    build: () => ({
      blocks: [
        { kind: 'text', text: 'CertMS has **five roles**, each with their own dashboard and permissions:' },
        {
          kind: 'list',
          items: [
            '**Audit Coordinator** — plans audits end-to-end: clients, applications, scope, schedule, certificates.',
            '**Lead Auditor** — runs audits, approves reports, validates and approves auditor profiles.',
            '**Auditor** — conducts audits, captures evidence, drafts findings.',
            '**Auditee (Client)** — receives the application, approves schedules, submits reports for corrective actions.',
            '**Management** — oversight: client credentials, audit assignments, KPIs.',
          ],
        },
      ],
      suggestions: ['What does the Audit Coordinator do?', 'List supported standards'],
    }),
  },

  /* ------------------ Audit lifecycle -------------------------------- */
  {
    match: (i) =>
      (has(i, 'audit', 'lifecycle') || has(i, 'audit', 'workflow') || has(i, 'audit', 'process') ||
       has(i, 'how', 'audit', 'work') || has(i, 'stages')),
    build: () => ({
      blocks: [
        { kind: 'text', text: 'A typical certification audit flows through these **stages**:' },
        {
          kind: 'list',
          items: [
            '**1. Enquiry** — captured from the website / email / phone.',
            '**2. Application** — formal application sent and received.',
            '**3. Registration** — client onboarded with scope and standard.',
            '**4. Stage 1 (readiness)** — desktop review of documentation.',
            '**5. Stage 2 (certification)** — on-site evaluation against the standard.',
            '**6. Findings** — non-conformities, observations, opportunities.',
            '**7. Corrective actions** — client closes findings; verified by auditor.',
            '**8. Certification decision** — independent reviewer issues the certificate.',
            '**9. Surveillance audits** — annual checks during the certificate validity.',
            '**10. Recertification** — every three years.',
          ],
        },
      ],
      suggestions: ['What is a non-conformity?', 'What is surveillance audit?'],
    }),
  },

  /* ------------------ Why certify ------------------------------------ */
  {
    match: (i) => has(i, 'why', 'certif') || has(i, 'benefit') || has(i, 'value'),
    build: () => ({
      blocks: [
        { kind: 'text', text: 'Why organizations seek ISO certification:' },
        {
          kind: 'list',
          items: [
            'Customer & tender requirement — many RFPs require a recognized standard.',
            'Reduces risk and incidents through systematic management.',
            'Improves customer satisfaction with consistent processes.',
            'Strong signal of credibility for new markets and partners.',
            'Drives continual improvement via PDCA and internal audits.',
          ],
        },
      ],
    }),
  },

  /* ------------------ Generic question fallback (last resort) ------- */
  {
    match: (i) => /^(what|who|when|where|why|how|explain|define|describe|tell me about)\b/.test(i),
    build: () => null as any, // handled by smartFallback so we keep the signal that the rule matched a question shape
  },
];

function matchKnowledge(input: string): AssistantResponse | null {
  for (const entry of KB) {
    if (entry.match(input)) {
      const built = entry.build();
      if (built) return built;
    }
  }
  return null;
}

/* --------------------------------------------------------------------- */
/*  Smart fallback: keyword sniff before giving up                       */
/* --------------------------------------------------------------------- */

function smartFallback(input: string, ctx: AssistantContext): AssistantResponse {
  // Concept hints: when the user mentions a keyword we know about, send them
  // to the right answer with a single click.
  const conceptHints: { keys: string[]; suggestion: string }[] = [
    { keys: ['audit'], suggestion: 'What is required to conduct an audit?' },
    { keys: ['scope'], suggestion: 'How do I create an audit scope?' },
    { keys: ['report'], suggestion: 'How do I submit an audit report?' },
    { keys: ['client', 'organization'], suggestion: 'How do I register a client?' },
    { keys: ['enquiry', 'inquiry', 'lead'], suggestion: 'How do I capture a client enquiry?' },
    { keys: ['auditor'], suggestion: 'How do I add an auditor?' },
    { keys: ['approval', 'approve'], suggestion: 'How does Lead Auditor approval work?' },
    { keys: ['certificate', 'certification'], suggestion: 'How does the certification flow work?' },
    { keys: ['iso', 'standard'], suggestion: 'List supported standards' },
    { keys: ['nc', 'non-conformity', 'finding'], suggestion: 'What is a non-conformity?' },
    { keys: ['evidence'], suggestion: 'What is audit evidence?' },
    { keys: ['surveillance'], suggestion: 'What is a surveillance audit?' },
    { keys: ['risk'], suggestion: 'What is risk-based thinking?' },
    { keys: ['pdca'], suggestion: 'What is the PDCA cycle?' },
    { keys: ['role', 'permission'], suggestion: 'What roles are there?' },
  ];
  const matched: string[] = [];
  for (const hint of conceptHints) {
    if (hasAny(input, ...hint.keys)) matched.push(hint.suggestion);
  }

  // Detect question shape (what / who / when / where / why / how / explain / define)
  const qShape = input.match(/^(what|who|when|where|why|how|explain|define|describe|tell me about|is\s+\w+)\b/);
  const subject = input
    .replace(/^(what|who|when|where|why|how)\s+(is|are|does|do|can|should)\s+/i, '')
    .replace(/^(explain|define|describe|tell me about)\s+/i, '')
    .replace(/\?+$/, '')
    .trim();

  if (qShape && subject) {
    // We recognized this is a question but don't have a hardcoded answer.
    // Provide a structured, helpful response instead of the cold "I didn't catch that".
    return {
      blocks: [
        {
          kind: 'text',
          text: `**About "${subject}"** — I don't have a built-in answer for that yet, but here is how I can help:`,
        },
        {
          kind: 'list',
          items: [
            'I have detailed knowledge of ISO 9001, 14001, 45001, 27001, 22000, 13485, 50001 and 42001.',
            'I can walk you through the audit lifecycle, certification process, and CertMS workflow.',
            'I can navigate you to any page in the app — just say "open <page name>".',
            'I can look up live data: clients, auditors, schedules, certificates, reports.',
            'For general-knowledge questions, connect Claude (the ⚙ button) and I will answer anything.',
          ],
        },
      ],
      suggestions: matched.length
        ? Array.from(new Set(matched)).slice(0, 6)
        : suggestionsForRole(ctx.role),
    };
  }

  if (matched.length) {
    return {
      blocks: [
        {
          kind: 'text',
          text:
            'It looks like you are asking about one of the topics below. Pick the closest one — or rephrase your question.',
        },
      ],
      suggestions: Array.from(new Set(matched)).slice(0, 6),
    };
  }

  // Truly nothing recognized — keep it warm and useful, not "I didn't catch that".
  return {
    blocks: [
      {
        kind: 'text',
        text:
          "I am here to help with **CertMS**, **ISO standards**, **audits**, and **certification**. Pick a topic below or ask me a specific question.",
      },
    ],
    suggestions: suggestionsForRole(ctx.role),
  };
}

/* --------------------------------------------------------------------- */
/*  Helpers                                                              */
/* --------------------------------------------------------------------- */

function matchNavigation(
  input: string,
  role: string
): { label: string; path: string } | null {
  if (!hasAny(input, 'open', 'go to', 'take me', 'navigate', 'show me', 'visit')) {
    const directHit = lookupPath(input, role);
    if (directHit && input.split(/\s+/).length <= 4) return directHit;
    return null;
  }
  return lookupPath(input, role);
}

function lookupPath(input: string, role: string): { label: string; path: string } | null {
  const map = ROLE_PATHS[role];
  if (!map) return null;
  const sorted = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (input.includes(key)) {
      return { label: titleCase(key), path: map[key] };
    }
  }
  return null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function describeStandard(code: string): string {
  switch (code) {
    case 'ISO 9001:2015':
      return 'A widely used Quality Management System standard. It focuses on consistent processes, customer satisfaction and continual improvement using the PDCA cycle.';
    case 'ISO 14001:2015':
      return 'An Environmental Management System standard. It helps organizations identify, manage and reduce their environmental impact through a structured, risk-based system.';
    case 'ISO 45001:2018':
      return 'An Occupational Health and Safety standard for preventing work-related injury and ill health, and proactively improving OH&S performance.';
    case 'ISO 27001:2022':
      return 'An Information Security Management System (ISMS) standard built around risk-based controls protecting confidentiality, integrity and availability of information.';
    case 'ISO 42001:2023':
      return 'A new standard for managing the lifecycle and risks of Artificial Intelligence systems within an organization — covering governance, transparency and continuous improvement of AI.';
    default:
      return 'No additional description available.';
  }
}

function matchHowTo(input: string): AssistantResponse | null {
  const tip = (
    title: string,
    steps: string[],
    nav?: { label: string; path: string }
  ): AssistantResponse => ({
    blocks: [
      { kind: 'text', text: `**${title}**` },
      { kind: 'list', items: steps },
      ...(nav ? [{ kind: 'navigate' as const, nav: [nav] }] : []),
    ],
  });

  if (has(input, 'how') && has(input, 'create') && has(input, 'scope')) {
    return tip(
      'Create an audit scope',
      [
        'Open Audit Scope from the sidebar.',
        'Click "Add Scope" to open the form.',
        'Enter Scope Name, Description, then pick a Standard from the popup.',
        'Click "Create" — the new scope appears in the table.',
      ],
      { label: 'Open Audit Scope', path: '/auditor-coordinator/audit-scope' }
    );
  }

  if (has(input, 'how') && has(input, 'auditor') && hasAny(input, 'add', 'create', 'register', 'new')) {
    return tip(
      'Add a new auditor',
      [
        'Open Auditor Profiles from the sidebar.',
        'Click "Add Auditor" to open the form.',
        'Fill in Full Name, Email, Role, Specialization, and Department.',
        'Click "Click to select certifications" and pick from the popup or add custom.',
        'Click "Create" to save.',
      ],
      { label: 'Open Auditor Profiles', path: '/auditor-coordinator/auditor-profiles' }
    );
  }

  if (
    has(input, 'how') &&
    hasAny(input, 'register', 'add', 'create', 'onboard') &&
    hasAny(input, 'client', 'organization')
  ) {
    return tip(
      'Register a client',
      [
        'Open Client Registration from the sidebar.',
        'Click "Client Registration" (top-right).',
        'Fill organization details, contact, type, status, contact info.',
        'Pick a Standard from the popup.',
        'Click "Create" — an email notification is logged.',
      ],
      { label: 'Open Client Registration', path: '/auditor-coordinator/client-registration' }
    );
  }

  if (has(input, 'how') && hasAny(input, 'submit', 'create', 'write') && has(input, 'report')) {
    return tip(
      'Submit an audit report',
      [
        'Open Audit Report from the sidebar.',
        'Pick the audit you want to report on.',
        'Fill findings, observations and conclusions.',
        'Click "Create" (or "Save" when editing).',
      ]
    );
  }

  if (has(input, 'how') && has(input, 'conduct') && has(input, 'audit')) {
    return tip(
      'Conduct an audit',
      [
        'Open Conduct Audit from the sidebar.',
        'Pick the scheduled audit you are running.',
        'Walk through the checklist, marking findings and evidence.',
        'Save progress as you go and submit when complete.',
      ]
    );
  }

  if (has(input, 'how') && hasAny(input, 'create', 'add', 'build') && has(input, 'checklist')) {
    return tip(
      'Create an audit checklist',
      [
        'Open Audit Checklists from the sidebar.',
        'Click "Add Checklist" to open the form.',
        'Pick the standard, define title and description.',
        'Add items / clauses to be verified during the audit.',
        'Click "Create" to save.',
      ],
      { label: 'Open Audit Checklists', path: '/auditor-coordinator/audit-checklists' }
    );
  }

  if (has(input, 'how') && hasAny(input, 'create', 'add', 'schedule') && has(input, 'schedule')) {
    return tip(
      'Create an audit schedule',
      [
        'Open Audit Schedules from the sidebar.',
        'Click "Add Schedule" to open the form.',
        'Select the client, standard, audit type and dates.',
        'Assign a Lead Auditor and audit team.',
        'Click "Create" to save and notify the team.',
      ],
      { label: 'Open Audit Schedules', path: '/auditor-coordinator/audit-schedules' }
    );
  }

  if (has(input, 'how') && hasAny(input, 'login', 'log in', 'sign in')) {
    return tip(
      'Login to the CMS',
      [
        'Pick your role from the test credentials list on the login page.',
        'The form auto-fills email and password.',
        'Click "Sign In" to enter your role-specific dashboard.',
      ]
    );
  }

  if (has(input, 'how') && hasAny(input, 'change', 'update', 'edit') && has(input, 'profile')) {
    return tip(
      'Update your coordinator profile',
      [
        'Click your name/photo at the top of the sidebar (or the "My Profile" item).',
        'Click "Edit" to enable editing.',
        'Update name, photo, contact, employee ID, location and bio.',
        'Click "Save" — your sidebar updates instantly.',
      ],
      { label: 'Open My Profile', path: '/auditor-coordinator/profile' }
    );
  }

  if (has(input, 'flow') && has(input, 'certification')) {
    return {
      blocks: [
        { kind: 'text', text: '**Certification flow at a glance:**' },
        {
          kind: 'list',
          items: [
            'Coordinator registers the client and dispatches an application.',
            'Coordinator schedules a Stage 1 audit and assigns a Lead Auditor and team.',
            'Lead Auditor and Auditors conduct the audit and submit reports.',
            'Findings are reviewed and approved.',
            'On success, a certificate is issued and delivered.',
            'Surveillance audits follow during the certification cycle.',
          ],
        },
      ],
    };
  }

  return null;
}

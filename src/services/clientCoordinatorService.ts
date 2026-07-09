// Lightweight service to provide client-scoped read-only data for the
// Client Coordinator portal. Uses the global demo seed keys stored in
// localStorage by `globalDemoSeeder`.

const KEYS = {
  clients: 'cms_client_registrations',
  certifications: 'cms_audit_certifications',
  schedules: 'cms_audit_schedules',
  certificates: 'cms_certificates',
  reports: 'cms_audit_reports',
};

const read = (k: string) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export function getCurrentClientId(): any {
  // demo convenience: allow session override, else pick first client
  const override = sessionStorage.getItem('cms_current_client_id');
  if (override) return isNaN(Number(override)) ? override : Number(override);
  const clients = read(KEYS.clients);
  return clients && clients.length ? clients[0].id : null;
}

export function getCurrentClient() {
  const id = getCurrentClientId();
  if (!id) return null;
  const clients = read(KEYS.clients);
  return clients.find((c: any) => c.id === id) || clients[0] || null;
}

export function getBranchesForClient(_clientId?: any) {
  // demo data doesn't include explicit branches; return empty or mocked
  return [] as any[];
}

export function getCertificationsForClient(clientId?: any) {
  const id = clientId ?? getCurrentClientId();
  const certs = read(KEYS.certifications);
  return certs.filter((c: any) => String(c.clientId) === String(id));
}

export function getCertificatesForClient(clientId?: any) {
  const id = clientId ?? getCurrentClientId();
  const certs = read(KEYS.certificates);
  return certs.filter((c: any) => String(c.clientId) === String(id));
}

export function getSchedulesForClient(clientId?: any) {
  const id = clientId ?? getCurrentClientId();
  const schedules = read(KEYS.schedules);
  return schedules.filter((s: any) => String(s.clientId) === String(id));
}

export function getReportsForClient(clientId?: any) {
  const id = clientId ?? getCurrentClientId();
  const reports = read(KEYS.reports);
  return reports.filter((r: any) => String(r.clientId) === String(id));
}

export function getExpiringCertificates(clientId?: any, days = 30) {
  const id = clientId ?? getCurrentClientId();
  const certs = getCertificatesForClient(id);
  const now = Date.now();
  const limit = now + days * 24 * 60 * 60 * 1000;
  return certs.filter((c: any) => {
    if (!c.expirationDate) return false;
    const t = new Date(c.expirationDate).getTime();
    return t <= limit && t >= now;
  });
}

export default {
  getCurrentClientId,
  getCurrentClient,
  getBranchesForClient,
  getCertificationsForClient,
  getCertificatesForClient,
  getSchedulesForClient,
  getReportsForClient,
  getExpiringCertificates,
};

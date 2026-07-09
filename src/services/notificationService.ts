import clientSvc from './clientCoordinatorService';
import emailSvc from './emailService';

const KEY = 'cms_notifications_v1';

type Notification = {
  id: string;
  clientId: any;
  title: string;
  body: string;
  level: 'info' | 'warning' | 'critical';
  createdAt: string;
  read?: boolean;
};

const read = (): Notification[] => {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
};

const write = (items: Notification[]) => {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cms-notifications-updated'));
};

export function listNotifications(clientId?: any) {
  const id = clientId ?? clientSvc.getCurrentClientId();
  return read().filter(n => String(n.clientId) === String(id));
}

export function createNotification(n: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
  const items = read();
  const payload: Notification = {
    id: `notif-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    createdAt: new Date().toISOString(),
    read: false,
    ...n,
  };
  items.unshift(payload);
  write(items);
  return payload;
}

export function markRead(id: string) {
  const items = read().map(i => i.id === id ? { ...i, read: true } : i);
  write(items);
}

export async function notifyExpiryEmailForClient(clientId?: any, days = 30) {
  const id = clientId ?? clientSvc.getCurrentClientId();
  const exp = clientSvc.getExpiringCertificates(id, days);
  if (!exp || exp.length === 0) return [];

  const client = clientSvc.getCurrentClient();
  const results = [] as any[];

  for (const c of exp) {
    const title = `Certificate expiring: ${c.certificateNumber || c.standard}`;
    const body = `Certificate ${c.certificateNumber || c.standard} for ${client.organizationName} (${c.clientId}) is expiring on ${c.expirationDate}. Please schedule a Surveillance or Recertification audit.`;
    createNotification({ clientId: id, title, body, level: 'warning' });
    const email = {
      to: client.email || 'unknown@example.com',
      subject: title,
      body,
    };
    const res = await emailSvc.sendEmail(email as any);
    results.push({ cert: c, email: res });
  }
  return results;
}

export default { listNotifications, createNotification, markRead, notifyExpiryEmailForClient };

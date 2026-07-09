// Client credential store
// -----------------------------------------------------------------------------
// Generates and persists a username/password for each registered client so they
// can log in as the "Auditee" role. Credentials live in localStorage and stay
// in sync with the client list. The Management role can read all credentials
// from here for the "Client Credentials" page.

export interface ClientCredential {
  clientId: number;
  organizationName: string;
  contactPerson: string;
  email: string;
  username: string;
  password: string;
  status: 'Active' | 'Locked';
  createdAt: string;
  updatedAt: string;
}

export const CLIENT_CREDENTIALS_KEY = 'cms_client_credentials';

const SAFE = (s: string | undefined | null) => (s || '').toString().trim();

const slug = (input: string) =>
  SAFE(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24);

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomPassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const pick = (s: string) => s[randInt(0, s.length - 1)];
  const body = [
    pick(upper),
    pick(lower), pick(lower), pick(lower), pick(lower), pick(lower),
    pick(digits), pick(digits),
    pick(symbols), pick(symbols),
  ];
  const head = body[0];
  const tail = body.slice(1);
  for (let i = tail.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [tail[i], tail[j]] = [tail[j], tail[i]];
  }
  return head + tail.join('');
};

const buildUsername = (
  client: { organizationName?: string; contactPerson?: string; email?: string; id: number },
  taken: Set<string>
): string => {
  const fromEmail = SAFE(client.email).split('@')[0];
  const fromOrg = slug(client.organizationName || '');
  const fromContact = slug(client.contactPerson || '');
  const base =
    slug(fromEmail) ||
    fromOrg ||
    fromContact ||
    `client.${client.id}`;

  let candidate = base;
  let n = 1;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${base}${n}`;
  }
  taken.add(candidate);
  return candidate;
};

export const readCredentials = (): ClientCredential[] => {
  try {
    const raw = localStorage.getItem(CLIENT_CREDENTIALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeCredentials = (creds: ClientCredential[]): void => {
  localStorage.setItem(CLIENT_CREDENTIALS_KEY, JSON.stringify(creds));
  try {
    window.dispatchEvent(
      new CustomEvent('client-credentials-updated', { detail: creds })
    );
  } catch {
    /* ignore */
  }
};

/**
 * Make sure every client in the supplied list has a credential record.
 * - Creates a new credential (username + password) for unseen clients.
 * - Keeps stored username/password for existing clients (does not regenerate).
 * - Updates display fields so the credentials list stays accurate when a
 *   client record is edited.
 * - Drops credentials whose client no longer exists.
 */
export const ensureCredentialsForClients = (
  clients: Array<{
    id: number;
    organizationName?: string;
    contactPerson?: string;
    email?: string;
  }>
): ClientCredential[] => {
  const existing = readCredentials();
  const byId = new Map<number, ClientCredential>();
  existing.forEach((c) => byId.set(c.clientId, c));

  const taken = new Set<string>(existing.map((c) => c.username));
  const now = new Date().toISOString();
  const next: ClientCredential[] = [];

  clients.forEach((client) => {
    const prev = byId.get(client.id);
    if (prev) {
      next.push({
        ...prev,
        organizationName: client.organizationName || prev.organizationName,
        contactPerson: client.contactPerson || prev.contactPerson,
        email: client.email || prev.email,
        updatedAt: now,
      });
    } else {
      const username = buildUsername(client, taken);
      next.push({
        clientId: client.id,
        organizationName: SAFE(client.organizationName) || 'Unknown Organization',
        contactPerson: SAFE(client.contactPerson) || '—',
        email: SAFE(client.email),
        username,
        password: randomPassword(),
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  writeCredentials(next);
  return next;
};

/** Reset a single client's password to a freshly generated value. */
export const resetCredential = (clientId: number): ClientCredential | null => {
  const all = readCredentials();
  const idx = all.findIndex((c) => c.clientId === clientId);
  if (idx === -1) return null;
  const updated: ClientCredential = {
    ...all[idx],
    password: randomPassword(),
    status: 'Active',
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  writeCredentials(all);
  return updated;
};

/** Toggle Lock / Unlock on a credential. */
export const toggleLockCredential = (clientId: number): ClientCredential | null => {
  const all = readCredentials();
  const idx = all.findIndex((c) => c.clientId === clientId);
  if (idx === -1) return null;
  const updated: ClientCredential = {
    ...all[idx],
    status: all[idx].status === 'Active' ? 'Locked' : 'Active',
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  writeCredentials(all);
  return updated;
};

/** Find a client credential by either email or username (case-insensitive). */
export const findCredentialByLogin = (
  identifier: string,
  password: string
): ClientCredential | null => {
  const id = SAFE(identifier).toLowerCase();
  if (!id) return null;
  const all = readCredentials();
  const match = all.find(
    (c) =>
      (c.username.toLowerCase() === id || c.email.toLowerCase() === id) &&
      c.password === password &&
      c.status === 'Active'
  );
  return match ?? null;
};


// =============================================================================
// Client roster helpers — used by the Management "Client Credentials" page so
// it can also create / edit / delete clients in one place. The roster lives in
// localStorage under `cms_client_registrations` (same key the AuditorCoordinator
// page uses), so changes show up everywhere.
// =============================================================================

export const CLIENT_REGISTRATIONS_KEY = 'cms_client_registrations';

export interface ClientRecord {
  id: number;
  organizationName: string;
  contactPerson: string;
  registrationNumber?: string;
  clientType?: string;
  standard?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  attachment?: string;
}

const readClients = (): ClientRecord[] => {
  try {
    const raw = localStorage.getItem(CLIENT_REGISTRATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeClients = (items: ClientRecord[]): void => {
  localStorage.setItem(CLIENT_REGISTRATIONS_KEY, JSON.stringify(items));
  try {
    window.dispatchEvent(
      new CustomEvent('client-registrations-updated', { detail: items })
    );
  } catch {
    /* ignore */
  }
};

export const getAllClients = (): ClientRecord[] => readClients();

export const getNextClientId = (): number => {
  const items = readClients();
  return items.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;
};

const buildRegistrationNumber = (id: number): string => {
  const year = new Date().getFullYear();
  return `REG-${year}-${String(id).padStart(3, '0')}`;
};

export interface CredentialOverrides {
  username?: string;
  password?: string;
}

/** Returns true if the given username is already taken by a different client. */
export const isUsernameTaken = (username: string, excludeClientId?: number): boolean => {
  const u = SAFE(username).toLowerCase();
  if (!u) return false;
  return readCredentials().some(
    (c) => c.username.toLowerCase() === u && c.clientId !== excludeClientId
  );
};

/** Create a brand-new client + matching credential. Username/password
 *  overrides are optional — anything blank is auto-generated.
 */
export const addClient = (
  input: Omit<ClientRecord, 'id'>,
  overrides?: CredentialOverrides
): { client: ClientRecord; credential: ClientCredential } => {
  const clients = readClients();
  const id = getNextClientId();

  const client: ClientRecord = {
    id,
    organizationName: SAFE(input.organizationName) || 'Unknown Organization',
    contactPerson: SAFE(input.contactPerson) || '—',
    registrationNumber: SAFE(input.registrationNumber) || buildRegistrationNumber(id),
    clientType: SAFE(input.clientType) || 'Initial Audit',
    standard: SAFE(input.standard) || 'ISO 9001:2015',
    email: SAFE(input.email),
    phone: SAFE(input.phone),
    address: SAFE(input.address),
    status: SAFE(input.status) || 'Pending',
    attachment: SAFE(input.attachment),
  };

  clients.push(client);
  writeClients(clients);

  // Seed credentials from the full roster (this preserves existing creds and
  // creates a fresh one for the new client).
  ensureCredentialsForClients(clients);

  // Apply user-supplied overrides on top of the auto-generated credential.
  let credential = readCredentials().find((c) => c.clientId === id);
  if (credential && (overrides?.username || overrides?.password)) {
    const all = readCredentials();
    const idx = all.findIndex((c) => c.clientId === id);
    if (idx !== -1) {
      const desiredUsername = SAFE(overrides?.username);
      const desiredPassword = SAFE(overrides?.password);
      const updated: ClientCredential = {
        ...all[idx],
        username: desiredUsername && !isUsernameTaken(desiredUsername, id)
          ? desiredUsername
          : all[idx].username,
        password: desiredPassword || all[idx].password,
        updatedAt: new Date().toISOString(),
      };
      all[idx] = updated;
      writeCredentials(all);
      credential = updated;
    }
  }

  return { client, credential: credential as ClientCredential };
};

/** Update a client record and (optionally) its credential. */
export const updateClientAndCredential = (
  clientId: number,
  patch: Partial<Omit<ClientRecord, 'id'>>,
  credentialPatch?: { username?: string; password?: string; status?: 'Active' | 'Locked' }
): { client: ClientRecord | null; credential: ClientCredential | null } => {
  const clients = readClients();
  const idx = clients.findIndex((c) => c.id === clientId);
  if (idx === -1) return { client: null, credential: null };

  const updatedClient: ClientRecord = {
    ...clients[idx],
    ...patch,
    organizationName: SAFE(patch.organizationName ?? clients[idx].organizationName) || clients[idx].organizationName,
    contactPerson: SAFE(patch.contactPerson ?? clients[idx].contactPerson) || clients[idx].contactPerson,
  };
  clients[idx] = updatedClient;
  writeClients(clients);

  // Sync credential display fields with the new client info.
  ensureCredentialsForClients(clients);

  // Apply explicit credential overrides if any.
  let credential: ClientCredential | null = readCredentials().find((c) => c.clientId === clientId) || null;
  if (credential && credentialPatch) {
    const all = readCredentials();
    const cIdx = all.findIndex((c) => c.clientId === clientId);
    if (cIdx !== -1) {
      const desiredUsername = SAFE(credentialPatch.username);
      const desiredPassword = SAFE(credentialPatch.password);
      const updated: ClientCredential = {
        ...all[cIdx],
        username: desiredUsername && !isUsernameTaken(desiredUsername, clientId)
          ? desiredUsername
          : all[cIdx].username,
        password: desiredPassword || all[cIdx].password,
        status: credentialPatch.status ?? all[cIdx].status,
        updatedAt: new Date().toISOString(),
      };
      all[cIdx] = updated;
      writeCredentials(all);
      credential = updated;
    }
  }

  return { client: updatedClient, credential };
};

/** Delete a client + its credential. */
export const deleteClient = (clientId: number): boolean => {
  const clients = readClients();
  const next = clients.filter((c) => c.id !== clientId);
  if (next.length === clients.length) return false;
  writeClients(next);
  // Re-sync (this also drops the orphan credential).
  ensureCredentialsForClients(next);
  return true;
};

export const getClientById = (clientId: number): ClientRecord | null =>
  readClients().find((c) => c.id === clientId) || null;

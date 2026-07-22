/**
 * Global product configuration
 * ----------------------------
 * Single source of truth for organisation-level settings that drive the
 * "global product" feel of CertiSphere — accreditation body, default
 * country, timezone, currency, contact details, and supported languages.
 *
 * Persisted to localStorage; consumers should subscribe to the
 * `cms-global-config-updated` event to re-render when it changes.
 */

export interface GlobalConfig {
  orgName: string;
  orgShortName: string;
  accreditationBody: string;
  defaultCountry: string;
  defaultCountryCode: string;       // ISO 3166-1 alpha-2 e.g. 'IN'
  defaultTimezone: string;          // IANA e.g. 'Asia/Kolkata'
  defaultCurrency: string;          // ISO 4217 e.g. 'USD'
  defaultLanguage: string;          // ISO 639-1 e.g. 'en'
  supportedLanguages: string[];
  supportedCountries: string[];
  contactEmail: string;
  contactPhone: string;
  website: string;
  taxId: string;
  /** Free-form footer/legal blurb displayed app-wide. */
  legalFooter: string;
  /** When the config was last touched. */
  updatedAt: string;
}

const KEY = 'cms_global_config_v1';

export const DEFAULT_CONFIG: GlobalConfig = {
  orgName: 'CertiSphere Global Certification Body',
  orgShortName: 'CertiSphere',
  accreditationBody: '',
  defaultCountry: 'India',
  defaultCountryCode: 'IN',
  defaultTimezone: 'Asia/Kolkata',
  defaultCurrency: 'USD',
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'es', 'pt', 'de', 'fr', 'ar', 'zh', 'hi', 'ja'],
  supportedCountries: ['India', 'USA', 'UK', 'Germany', 'UAE', 'Singapore', 'Australia', 'Brazil'],
  contactEmail: 'info@certification.com',
  contactPhone: '+91 98494 99111',
  website: 'https://qmicscertifications.com',
  taxId: '',
  legalFooter: 'CertiSphere is an independent certification body operating under ISO/IEC 17021-1.',
  updatedAt: new Date(0).toISOString(),
};

export const readGlobalConfig = (): GlobalConfig => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
};

export const writeGlobalConfig = (cfg: Partial<GlobalConfig>): GlobalConfig => {
  const next: GlobalConfig = { ...readGlobalConfig(), ...cfg, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('cms-global-config-updated', { detail: next }));
  } catch { /* ignore */ }
  return next;
};

/** React hook helper: subscribes to config changes. */
export const onGlobalConfigChange = (cb: (cfg: GlobalConfig) => void): (() => void) => {
  const handler = (e: Event) => cb((e as CustomEvent).detail ?? readGlobalConfig());
  window.addEventListener('cms-global-config-updated', handler);
  window.addEventListener('storage', handler as EventListener);
  return () => {
    window.removeEventListener('cms-global-config-updated', handler);
    window.removeEventListener('storage', handler as EventListener);
  };
};

/** Country flag emoji from an ISO 3166-1 alpha-2 code. */
export const flagOf = (code: string): string => {
  if (!code || code.length !== 2) return '';
  const A = 0x1F1E6;
  return String.fromCodePoint(A + code.toUpperCase().charCodeAt(0) - 65, A + code.toUpperCase().charCodeAt(1) - 65);
};

/**
 * AI on/off switch — lets anyone show CertiSphere as a purely manual system.
 * Off: AI suggestions, AI insights, "Draft with AI", quality badges, the AI hub,
 * AI panels and the QCSAI chat are hidden. Every workflow step still works,
 * because every step is a button a person clicks. Remembered in this browser.
 */
import React from 'react';

const KEY = 'certi_ai_off';
export const isAIOn = (): boolean => { try { return localStorage.getItem(KEY) !== '1'; } catch { return true; } };
export const setAIOn = (on: boolean): void => {
  try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  window.location.reload();
};

/** Wrap an AI component: renders nothing while AI is switched off. */
export function withAI<P extends object>(C: React.ComponentType<P>): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => (isAIOn() ? <C {...props} /> : null);
  Wrapped.displayName = `withAI(${C.displayName || C.name || 'Component'})`;
  return Wrapped;
}

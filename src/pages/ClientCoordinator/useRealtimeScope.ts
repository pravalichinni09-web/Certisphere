/**
 * useRealtimeScope — React hook for real-time Client Coordinator data.
 *
 * Usage:
 *   const { data, refresh, lastUpdated, isLive } = useRealtimeScope(getCertifications);
 *
 * - Subscribes to localStorage 'storage' events (cross-tab changes)
 * - Listens to same-tab 'cms-cc-data-changed' custom events
 * - Polls every POLL_MS milliseconds as a safety net
 * - Returns refresh() so the user can manually force a reload
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToCCChanges } from './scope';

const POLL_MS = 15_000; // 15 seconds

interface RealtimeResult<T> {
  data: T;
  refresh: () => void;
  lastUpdated: Date;
  isLive: boolean;
}

export function useRealtimeScope<T>(
  getFn: () => T,
  pollMs: number = POLL_MS,
): RealtimeResult<T> {
  const getFnRef = useRef(getFn);
  getFnRef.current = getFn;

  const [data, setData] = useState<T>(() => getFn());
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [isLive, setIsLive] = useState(true);

  const refresh = useCallback(() => {
    try {
      setData(getFnRef.current());
      setLastUpdated(new Date());
      setIsLive(true);
    } catch {
      setIsLive(false);
    }
  }, []);

  useEffect(() => {
    // Subscribe to localStorage + custom events
    const unsub = subscribeToCCChanges(refresh);

    // Polling fallback
    const timer = setInterval(refresh, pollMs);

    // Initial load
    refresh();

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [refresh, pollMs]);

  return { data, refresh, lastUpdated, isLive };
}

/** Compact "Live" indicator badge — drop into any page header */
export function liveLabel(lastUpdated: Date, isLive: boolean): string {
  if (!isLive) return 'Offline';
  const diffMs = Date.now() - lastUpdated.getTime();
  if (diffMs < 5000) return 'Just now';
  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s ago`;
  if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m ago`;
  return lastUpdated.toLocaleTimeString();
}

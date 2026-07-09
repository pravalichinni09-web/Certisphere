/**
 * Auditor availability calculations from saved schedules + workflows.
 * Builds a date -> auditor map with workload per day, used for heatmap UI.
 */

import type { Auditor, AuditSchedule } from '../pages/AuditorCoordinator/mockData';

export interface AvailabilityCell {
  date: string;            // YYYY-MM-DD
  auditorName: string;
  status: 'free' | 'busy' | 'overbooked';
  bookings: number;
}

export interface AvailabilityGrid {
  /** Sorted YYYY-MM-DD strings, exactly `daysAhead` long. */
  dates: string[];
  /** Map keyed by `${name}|${date}` → cell. */
  cells: Record<string, AvailabilityCell>;
  /** Auditor names in display order. */
  auditors: string[];
}

const formatDate = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const range = (start: Date, days: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(formatDate(d));
  }
  return out;
};

export const buildAvailability = (
  auditors: Auditor[],
  schedules: AuditSchedule[],
  daysAhead = 14,
  start: Date = new Date()
): AvailabilityGrid => {
  const dates = range(start, daysAhead);
  const auditorNames = auditors.filter((a) => a.status !== 'Inactive').map((a) => a.name);
  const cells: Record<string, AvailabilityCell> = {};

  // initialize free
  for (const name of auditorNames) {
    for (const d of dates) {
      const key = `${name}|${d}`;
      cells[key] = { date: d, auditorName: name, status: 'free', bookings: 0 };
    }
  }

  // fold in bookings
  for (const s of schedules) {
    if (s.status === 'Completed') continue;
    const date = s.date || s.scheduledDate;
    if (!date) continue;
    if (!dates.includes(date)) continue;
    for (const name of [s.leadAuditor, s.auditor]) {
      if (!name) continue;
      const key = `${name}|${date}`;
      const cell = cells[key];
      if (!cell) continue;
      cell.bookings += 1;
      cell.status = cell.bookings === 1 ? 'busy' : 'overbooked';
    }
  }

  return { dates, cells, auditors: auditorNames };
};

export const detectConflict = (
  auditorName: string,
  date: string,
  schedules: AuditSchedule[]
): boolean => {
  return schedules.some((s) => {
    if (s.status === 'Completed') return false;
    const d = s.date || s.scheduledDate;
    if (d !== date) return false;
    return s.leadAuditor === auditorName || s.auditor === auditorName;
  });
};

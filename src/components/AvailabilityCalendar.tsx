import React, { useMemo } from 'react';
import type { Auditor, AuditSchedule } from '../pages/AuditorCoordinator/mockData';
import { buildAvailability } from '../utils/availability';

interface Props {
  auditors: Auditor[];
  schedules: AuditSchedule[];
  daysAhead?: number;
  startDate?: Date;
  selectedDate?: string;
  onCellClick?: (auditorName: string, date: string) => void;
  highlightAuditor?: string;
}

const AvailabilityCalendar: React.FC<Props> = ({
  auditors,
  schedules,
  daysAhead = 14,
  startDate,
  selectedDate,
  onCellClick,
  highlightAuditor,
}) => {
  const grid = useMemo(
    () => buildAvailability(auditors, schedules, daysAhead, startDate || new Date()),
    [auditors, schedules, daysAhead, startDate]
  );

  if (grid.auditors.length === 0) {
    return (
      <div className="avail-empty">
        No active auditors. Add auditors via Auditor Profiles to see the heatmap.
      </div>
    );
  }

  const dayLabel = (iso: string): { dow: string; dom: string } => {
    const d = new Date(iso + 'T00:00:00');
    return {
      dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
      dom: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    };
  };

  return (
    <div className="avail-calendar">
      <table className="avail-table">
        <thead>
          <tr>
            <th className="avail-name-col">Auditor</th>
            {grid.dates.map((d) => {
              const lbl = dayLabel(d);
              const isSel = d === selectedDate;
              return (
                <th key={d} className={isSel ? 'is-selected' : ''}>
                  <small>{lbl.dow}</small>
                  <strong>{lbl.dom}</strong>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {grid.auditors.map((name) => {
            const isHi = name === highlightAuditor;
            return (
              <tr key={name} className={isHi ? 'is-highlight' : ''}>
                <th scope="row" className="avail-name-col">{name}</th>
                {grid.dates.map((d) => {
                  const cell = grid.cells[`${name}|${d}`];
                  const cls = ['avail-cell', `is-${cell.status}`];
                  if (d === selectedDate) cls.push('is-selected-col');
                  return (
                    <td key={d} className={cls.join(' ')}>
                      <button
                        type="button"
                        className="avail-pill"
                        onClick={() => onCellClick?.(name, d)}
                        title={
                          cell.status === 'free'
                            ? `${name} is free on ${d}`
                            : `${name}: ${cell.bookings} booking(s) on ${d}`
                        }
                      >
                        {cell.bookings || '·'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="avail-legend">
        <span className="avail-key is-free">Free</span>
        <span className="avail-key is-busy">Busy (1)</span>
        <span className="avail-key is-overbooked">Overbooked (2+)</span>
      </div>
    </div>
  );
};

export default AvailabilityCalendar;

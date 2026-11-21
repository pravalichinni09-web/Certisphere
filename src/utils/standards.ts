/**
 * The one list of standards QMICS certifies — every form reads it from here
 * (Client Registration, enquiries, self-registration, requirements review).
 */
export const STANDARDS: { value: string; title: string; subtitle: string }[] = [
  { value: 'ISO 9001:2015', title: 'ISO 9001:2015', subtitle: 'Quality Management System' },
  { value: 'ISO 14001:2015', title: 'ISO 14001:2015', subtitle: 'Environmental Management System' },
  { value: 'ISO 45001:2018', title: 'ISO 45001:2018', subtitle: 'Occupational Health & Safety' },
  { value: 'ISO 27001:2022', title: 'ISO 27001:2022', subtitle: 'Information Security Management' },
  { value: 'ISO 22000:2018', title: 'ISO 22000:2018', subtitle: 'Food Safety Management System' },
  { value: 'ISO 13485:2016', title: 'ISO 13485:2016', subtitle: 'Medical Devices Quality Management' },
  { value: 'ISO 50001:2018', title: 'ISO 50001:2018', subtitle: 'Energy Management System' },
  { value: 'ISO 42001:2023', title: 'ISO 42001:2023', subtitle: 'AI Management System' },
  { value: 'CMMI', title: 'CMMI', subtitle: 'Capability Maturity Model Integration' },
  { value: 'HACCP', title: 'HACCP', subtitle: 'Hazard Analysis & Critical Control Points (Food Safety)' },
  { value: 'GDP', title: 'GDP', subtitle: 'Good Distribution Practice' },
];

export const STANDARD_VALUES: string[] = STANDARDS.map((s) => s.value);

/** Seeded field plots and check points for demo readings (no partner branding). */

export type ReadingKind = 'moisture_pct' | 'equipment_ok' | 'equipment_issue';

export type SeededPlot = {
  plotId: string;
  name: string;
  crop: string;
  acres: number;
};

export const DEMO_FARM = {
  farmId: 'farm-demo-harbor',
  name: 'Harbor Creek Cooperative — demo season',
} as const;

export const SEEDED_PLOTS: SeededPlot[] = [
  { plotId: 'P-N1', name: 'North ridge', crop: 'Corn', acres: 42 },
  { plotId: 'P-S2', name: 'South dip', crop: 'Soy', acres: 38 },
  { plotId: 'P-E3', name: 'East pivot', crop: 'Alfalfa', acres: 55 },
  { plotId: 'EQ-01', name: 'Irrigation pump #1', crop: 'Equipment', acres: 0 },
];

export function findPlot(plotId: string): SeededPlot | undefined {
  const id = plotId.trim().toUpperCase();
  return SEEDED_PLOTS.find((p) => p.plotId === id);
}

export type DemoReadingTemplate = {
  plotId: string;
  kind: ReadingKind;
  label: string;
  value: string;
  unit: string;
};

/** Quick-log buttons on the field collector screen. */
export const DEMO_READING_TEMPLATES: DemoReadingTemplate[] = [
  { plotId: 'P-N1', kind: 'moisture_pct', label: 'North ridge moisture', value: '18', unit: '%' },
  { plotId: 'P-S2', kind: 'moisture_pct', label: 'South dip moisture', value: '22', unit: '%' },
  { plotId: 'P-E3', kind: 'moisture_pct', label: 'East pivot moisture', value: '16', unit: '%' },
  { plotId: 'EQ-01', kind: 'equipment_ok', label: 'Pump #1 OK', value: 'ok', unit: '' },
];

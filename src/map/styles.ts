import type { PathOptions } from 'leaflet';
import type { Readiness } from '../types';

export const PALETTE = [
  '#2563eb', '#16a34a', '#f59e0b', '#e11d48', '#0ea5e9', '#a855f7',
  '#10b981', '#f97316', '#ef4444', '#84cc16', '#14b8a6', '#d946ef'
];

export const UNLABELED_COLOR = '#2563eb';

/** Boise County's own Ready/Set/Go renderer colors. */
export const READINESS_COLORS: Record<Exclude<Readiness, 'None'>, string> = {
  Ready: '#85e71d',
  Set: '#fcec0a',
  Go: '#cc1714'
};

export const READINESS_LABELS: Record<Exclude<Readiness, 'None'>, string> = {
  Ready: 'READY – be aware',
  Set: 'SET – be ready to leave',
  Go: 'GO – evacuate now'
};

/** WFCA-style age banding for VIIRS detection footprints. */
export function viirsStyle(hoursOld: number): PathOptions {
  if (hoursOld <= 24) return { color: '#b40808', weight: 1.5, fillColor: '#d60a0a', fillOpacity: 0.6 };
  if (hoursOld <= 48) return { color: '#963214', weight: 1, fillColor: '#ba3f18', fillOpacity: 0.45 };
  return { color: '#533720', weight: 1, fillColor: '#674528', fillOpacity: 0.3 };
}

/** Faint translucent orange: coarse 2km GOES pixels are advisory only. */
export function goesStyle(hoursOld: number): PathOptions {
  if (hoursOld <= 2) return { color: '#f97316', opacity: 0.25, weight: 1, fillColor: '#fdba74', fillOpacity: 0.1 };
  return { color: '#fdba74', opacity: 0.15, weight: 1, fillColor: '#fed7aa', fillOpacity: 0.05 };
}

export const CLUSTER_HULL_STYLE: PathOptions = {
  color: '#00b4c8', weight: 2, dashArray: '4 3', fillColor: '#00c8dc', fillOpacity: 0.15
};

export const PERIMETER_STYLE: PathOptions = {
  color: '#b91c1c', weight: 2, dashArray: '4 3', fillColor: '#b91c1c', fillOpacity: 0.08
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
  )[c]);
}

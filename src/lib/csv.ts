import Papa from 'papaparse';
import type { HouseholdRow } from '../types';

export function detectLatLonKeys(row: HouseholdRow): { latKey: string | null; lonKey: string | null } {
  const keys = Object.keys(row);
  return {
    latKey: keys.find(k => /^lat(itude)?$/i.test(k)) ?? null,
    lonKey: keys.find(k => /^(lon(gitude)?|lng)$/i.test(k)) ?? null
  };
}

/**
 * Strict coordinate parse. parseFloat, never Number: blank/null coords must
 * come back NaN, not coerce to 0 (which would plot rows at 0,0).
 */
export function parseCoord(v: unknown): number {
  const n = parseFloat(v as string);
  return Number.isFinite(n) ? n : NaN;
}

export function parseCsvFile(file: File): Promise<HouseholdRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<HouseholdRow>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: 'greedy',
      complete: res => resolve((res.data as HouseholdRow[]) || []),
      error: err => reject(err)
    });
  });
}

export function toCsv(rows: HouseholdRow[], columns?: string[]): string {
  return Papa.unparse(rows as object[], columns ? { columns } : { quotes: false });
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Columns whose names look like household name / phone — dispatch defaults. */
export function defaultDispatchColumns(columns: string[]): Set<string> {
  return new Set(columns.filter(c => /name|household/i.test(c) || /phone|tel|mobile|cell/i.test(c)));
}

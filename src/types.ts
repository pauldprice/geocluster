export type HouseholdRow = Record<string, string | number | null | undefined>;

export type Readiness = 'None' | 'Ready' | 'Set' | 'Go';

export interface ZoneAlert {
  zone: string;
  status: string;
  color: string;
  name?: string;
}

export interface AwareZoneStatus {
  status: string;
  color: string;
  updatedAt?: string;
  desc?: string;
}

export interface AdaZoneProps {
  zone: string;
  name: string;
  status: string;
  color: string;
  lat: string | number | null;
  lon: string | number | null;
}

export interface FirePoint {
  lon: number;
  lat: number;
  name: string;
}

export interface SatStats {
  count: number;
  newestHours: number | null;
  clusters: number;
}

export interface GoesStats {
  count: number;
  newestMin: number | null;
}

export interface StatusPollResult {
  time: Date;
  checked: number;
  errors: number;
}

export interface DataWarnings {
  suspect: number;
  noZone: number;
  noCoord: number;
}

export interface LegendEntry {
  label: string;
  color: string;
}

/** Ring is [lon, lat] pairs; polys is Polygon coordinates (outer ring + holes). */
export type Ring = number[][];
export type PolygonCoords = Ring[];

export interface ZoneFeatureIndex {
  name: string;
  polys: PolygonCoords[];
  bbox: [number, number, number, number];
}

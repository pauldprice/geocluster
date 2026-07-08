import { useSyncExternalStore } from 'react';
import type {
  DataWarnings, GoesStats, LegendEntry, SatStats, StatusPollResult, ZoneAlert
} from './types';

export interface PanelRow {
  idx: number;
  zone: string;
  cells: (string | number)[];
  label: string;
}

export interface AppState {
  status: string;
  rowCount: number;
  markerCount: number;
  zonesReady: boolean;
  lassoEnabled: boolean;
  lassoSelectionCount: number;
  selectionCount: number; // union used by Download selected
  selectedZones: string[];
  panelColumns: string[];
  panelRows: PanelRow[];
  zoneChipColors: Record<string, string>;
  legend: LegendEntry[];
  warnings: DataWarnings;
  alerts: ZoneAlert[];
  showZones: boolean;
  showFires: boolean;
  showGoes: boolean;
  fireCount: number;
  lastFireUpdate: Date | null;
  satStats: SatStats | null;
  goesStats: GoesStats | null;
  statusPoll: StatusPollResult | null;
  downloadableColumns: string[];
}

export const initialState: AppState = {
  status: '',
  rowCount: 0,
  markerCount: 0,
  zonesReady: false,
  lassoEnabled: false,
  lassoSelectionCount: 0,
  selectionCount: 0,
  selectedZones: [],
  panelColumns: [],
  panelRows: [],
  zoneChipColors: {},
  legend: [],
  warnings: { suspect: 0, noZone: 0, noCoord: 0 },
  alerts: [],
  showZones: true,
  showFires: true,
  showGoes: true,
  fireCount: 0,
  lastFireUpdate: null,
  satStats: null,
  goesStats: null,
  statusPoll: null,
  downloadableColumns: []
};

type Listener = () => void;

export class Store {
  private state: AppState = initialState;
  private listeners = new Set<Listener>();

  getState = (): AppState => this.state;

  set = (patch: Partial<AppState>): void => {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());
  };

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export const store = new Store();

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState);
}

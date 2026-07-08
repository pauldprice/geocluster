import L from 'leaflet';
import 'leaflet-lasso';
import boiseRaw from '../../data/boise_county_evacuation_zones.geojson?raw';
import adaRaw from '../../data/ada_county_evacuation_zones.geojson?raw';
import {
  bboxOfPolys, clusterDetections, convexHull, pixelHalfExtents, zoneForPoint
} from '../lib/geo';
import { defaultDispatchColumns, detectLatLonKeys, downloadCsv, parseCoord, parseCsvFile, toCsv } from '../lib/csv';
import {
  awareLookup, fetchBoiseReadiness, fetchJson, FIRES_URL, HMS_URL, hmsAgeHours, PERIMS_URL, VIIRS_URL
} from '../lib/sources';
import {
  CLUSTER_HULL_STYLE, escapeHtml, goesStyle, PALETTE, PERIMETER_STYLE,
  READINESS_COLORS, READINESS_LABELS, UNLABELED_COLOR, viirsStyle
} from './styles';
import { store, type PanelRow } from '../store';
import type {
  AdaZoneProps, AwareZoneStatus, FirePoint, HouseholdRow, PolygonCoords, Readiness, ZoneAlert, ZoneFeatureIndex
} from '../types';

const STATUS_POLL_MS = 60_000;
const FIRES_POLL_MS = 300_000;

/**
 * Owns the Leaflet map, all layers, all polling, and all household state.
 * React components render from the store and call methods on this class.
 */
export class MapController {
  private map!: L.Map;
  private lasso!: L.Lasso;

  // Households
  private rawRows: HouseholdRow[] = [];
  private latKey: string | null = null;
  private lonKey: string | null = null;
  private markers: L.Marker[] = [];
  private idxByLayerId = new Map<number, number>();
  private markerByIdx = new Map<number, L.Marker>();
  private selectedLayerIds = new Set<number>();
  private labelByIndex: Record<number, string> = {};
  private zoneByIndex: Record<number, string> = {};
  private suspectByIndex = new Set<number>();
  private colorByLabel = new Map<string, string>();

  // Zones
  private zoneFeatures: ZoneFeatureIndex[] = [];
  private zonesLayer: L.GeoJSON | null = null;
  private adaZonesLayer: L.GeoJSON | null = null;
  private zoneLayerByName = new Map<string, L.Path & { getBounds(): L.LatLngBounds }>();
  private zoneColorByPrefix = new Map<string, string>();
  private adaMetaByZone = new Map<string, AdaZoneProps>();
  private awareStatusByZone = new Map<string, AwareZoneStatus>();
  private boiseReadinessByZone = new Map<string, Readiness>();
  private selectedZoneNames = new Set<string>();
  private alertLabelZones = new Set<string>();

  // Fires
  private firesLayer: L.LayerGroup | null = null;
  private perimetersLayer: L.GeoJSON | null = null;
  private satLayer: L.LayerGroup | null = null;
  private goesLayer: L.LayerGroup | null = null;
  private firePoints: FirePoint[] = [];
  private pollBusy = false;
  private pollTimer: number | null = null;

  init(el: HTMLElement): void {
    if (this.map) return; // React StrictMode double-invokes effects in dev
    this.map = L.map(el, { preferCanvas: true }).setView([43.6, -116.2], 8);
    // GOES pixels render between base tiles (200) and overlayPane (400) so
    // they always sit under zones and VIIRS.
    this.map.createPane('goesPane').style.zIndex = '350';
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(this.map);

    this.lasso = L.lasso(this.map, {});
    this.map.on('lasso.finished', (event: any) => {
      this.selectedLayerIds.clear();
      (event.layers as L.Layer[]).forEach(layer => {
        const id = L.Util.stamp(layer);
        if (!this.idxByLayerId.has(id)) return; // ignore zone polygons etc.
        this.selectedLayerIds.add(id);
      });
      this.markers.forEach(m => this.refreshMarkerIcon(m));
      this.setStatus(`${this.selectedLayerIds.size} selected`);
      this.pushSelection();
    });
    this.map.on('lasso.enabled', () => store.set({ lassoEnabled: true }));
    this.map.on('lasso.disabled', () => store.set({ lassoEnabled: false }));

    this.loadZoneLayers();
    void this.refreshFires();
    window.setInterval(() => void this.refreshFires(), FIRES_POLL_MS);
  }

  // ---------- Zones ----------

  private loadZoneLayers(): void {
    const boise = JSON.parse(boiseRaw);
    boise.features.forEach((f: any) => {
      const polys: PolygonCoords[] = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
      this.zoneFeatures.push({ name: this.zoneName(f.properties), polys, bbox: bboxOfPolys(polys) });
    });
    this.zonesLayer = L.geoJSON(boise, {
      style: f => this.zoneStyle(this.zoneName(f!.properties)),
      onEachFeature: (f, layer) => {
        const name = this.zoneName(f.properties);
        this.zoneLayerByName.set(name, layer as any);
        (layer as L.Path).bindTooltip(name, { permanent: true, direction: 'center', className: 'zone-label' });
        layer.on('click', () => this.toggleZoneSelection(name));
      }
    }).addTo(this.map);

    const ada = JSON.parse(adaRaw);
    ada.features.forEach((f: any) => {
      const p = f.properties as AdaZoneProps;
      this.adaMetaByZone.set(p.zone, p);
      const polys: PolygonCoords[] = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
      this.zoneFeatures.push({ name: p.zone, polys, bbox: bboxOfPolys(polys) });
    });
    this.adaZonesLayer = L.geoJSON(ada, {
      style: f => this.zoneStyle((f!.properties as AdaZoneProps).zone),
      onEachFeature: (f, layer) => {
        const p = f.properties as AdaZoneProps;
        this.zoneLayerByName.set(p.zone, layer as any);
        (layer as L.Path).bindTooltip(p.name ? `${p.zone} · ${p.name}` : p.zone, { sticky: true });
        layer.on('click', () => this.toggleZoneSelection(p.zone));
      }
    }).addTo(this.map);

    store.set({ zonesReady: true });
    this.setStatus(`${this.zoneFeatures.length} evacuation zones loaded.`);
    this.startLivePolling();
  }

  private zoneName(props: any): string {
    return (props && (props.Zone || props.Name)) || 'Zone';
  }

  private zoneColor(name: string): string {
    const prefix = name.split('-')[0];
    if (!this.zoneColorByPrefix.has(prefix)) {
      this.zoneColorByPrefix.set(prefix, PALETTE[this.zoneColorByPrefix.size % PALETTE.length]);
    }
    return this.zoneColorByPrefix.get(prefix)!;
  }

  private zoneStyle(name: string): L.PathOptions {
    const selected = this.selectedZoneNames.has(name);
    if (this.adaMetaByZone.has(name)) {
      const live = this.awareStatusByZone.get(name);
      const meta = this.adaMetaByZone.get(name)!;
      const status = live ? live.status : meta.status;
      const statusColor = (live && live.color) || meta.color || '#F2F2F2';
      const normal = /normal/i.test(status);
      if (!normal) return { color: '#7f1d1d', weight: selected ? 4 : 3, fillColor: statusColor, fillOpacity: 0.45 };
      if (selected) return { color: '#111827', weight: 3, fillColor: '#9ca3af', fillOpacity: 0.35 };
      return { color: '#9ca3af', weight: 1, fillColor: '#9ca3af', fillOpacity: 0.04 };
    }
    const readiness = this.boiseReadinessByZone.get(name);
    if (readiness && readiness !== 'None') {
      return {
        color: selected ? '#111827' : '#7f1d1d',
        weight: selected ? 4 : 3,
        fillColor: READINESS_COLORS[readiness],
        fillOpacity: 0.5
      };
    }
    const color = this.zoneColor(name);
    return {
      color: selected ? '#111827' : color,
      weight: selected ? 3 : 1.5,
      fillColor: color,
      fillOpacity: selected ? 0.35 : 0.12
    };
  }

  toggleZoneSelection(name: string): void {
    if (this.selectedZoneNames.has(name)) this.selectedZoneNames.delete(name);
    else this.selectedZoneNames.add(name);
    const layer = this.zoneLayerByName.get(name);
    if (layer) {
      layer.setStyle(this.zoneStyle(name));
      if (this.selectedZoneNames.has(name)) layer.bringToFront();
    }
    this.pushSelection();
    this.pushZonePanel();
  }

  clearZoneSelection(): void {
    Array.from(this.selectedZoneNames).forEach(name => {
      this.selectedZoneNames.delete(name);
      this.zoneLayerByName.get(name)?.setStyle(this.zoneStyle(name));
    });
    this.pushSelection();
    this.pushZonePanel();
  }

  selectZoneAndZoom(name: string): void {
    if (!this.selectedZoneNames.has(name)) this.toggleZoneSelection(name);
    const layer = this.zoneLayerByName.get(name);
    if (layer) this.map.fitBounds(layer.getBounds().pad(0.3));
  }

  toggleZonesVisible(): void {
    const showing = store.getState().showZones;
    [this.zonesLayer, this.adaZonesLayer].forEach(l => {
      if (!l) return;
      if (showing) this.map.removeLayer(l);
      else l.addTo(this.map);
    });
    store.set({ showZones: !showing });
  }

  // ---------- Live status polling ----------

  private startLivePolling(): void {
    if (this.pollTimer) return;
    void this.pollLiveStatus();
    this.pollTimer = window.setInterval(() => void this.pollLiveStatus(), STATUS_POLL_MS);
  }

  private restyleBoiseZone(zn: string): void {
    const layer = this.zoneLayerByName.get(zn);
    if (!layer || this.adaMetaByZone.has(zn)) return;
    layer.setStyle(this.zoneStyle(zn));
    const rd = this.boiseReadinessByZone.get(zn) || 'None';
    if (rd !== 'None') {
      layer.unbindTooltip();
      layer.bindTooltip(`${zn} · ${rd.toUpperCase()}`, { permanent: true, direction: 'center', className: 'zone-label zone-label-alert' });
      layer.bringToFront();
      this.alertLabelZones.add(zn);
    } else if (this.alertLabelZones.has(zn)) {
      layer.unbindTooltip();
      layer.bindTooltip(zn, { permanent: true, direction: 'center', className: 'zone-label' });
      this.alertLabelZones.delete(zn);
    }
  }

  private restyleAdaZone(zn: string): void {
    const layer = this.zoneLayerByName.get(zn);
    if (!layer) return;
    layer.setStyle(this.zoneStyle(zn));
    const live = this.awareStatusByZone.get(zn);
    const alerted = !!live && !/normal/i.test(live.status);
    if (alerted && !this.alertLabelZones.has(zn)) {
      this.alertLabelZones.add(zn);
      layer.unbindTooltip();
      layer.bindTooltip(`${zn} · ${live!.status}`, { permanent: true, direction: 'center', className: 'zone-label zone-label-alert' });
      layer.bringToFront();
    } else if (!alerted && this.alertLabelZones.has(zn)) {
      this.alertLabelZones.delete(zn);
      layer.unbindTooltip();
      const meta = this.adaMetaByZone.get(zn);
      layer.bindTooltip(meta?.name ? `${zn} · ${meta.name}` : zn, { sticky: true });
    }
  }

  private watchedPoints(): [number, number][] {
    const pts = new Map<string, [number, number]>();
    this.rawRows.forEach((row, idx) => {
      const z = this.zoneForIndex(idx);
      if (z && z.startsWith('ADA-') && !pts.has(z)) {
        const lat = parseCoord(row[this.latKey!]);
        const lon = parseCoord(row[this.lonKey!]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) pts.set(z, [lon, lat]);
      }
    });
    this.awareStatusByZone.forEach((v, z) => {
      if (!/normal/i.test(v.status) && !pts.has(z)) {
        const meta = this.adaMetaByZone.get(z);
        if (meta?.lon && meta?.lat) pts.set(z, [Number(meta.lon), Number(meta.lat)]);
      }
    });
    this.firePoints.forEach((f, i) => pts.set('fire-' + i, [f.lon, f.lat]));
    return Array.from(pts.values()).slice(0, 40);
  }

  async pollLiveStatus(): Promise<void> {
    if (this.pollBusy) return;
    this.pollBusy = true;
    let checked = 0;
    let errors = 0;
    try {
      try {
        const readiness = await fetchBoiseReadiness();
        readiness.forEach((rd, zn) => {
          if (this.boiseReadinessByZone.get(zn) !== rd) {
            this.boiseReadinessByZone.set(zn, rd);
            this.restyleBoiseZone(zn);
          }
        });
        checked++;
      } catch {
        errors++;
      }
      for (const [lon, lat] of this.watchedPoints()) {
        try {
          const zone = await awareLookup(lon, lat);
          checked++;
          if (zone) {
            const short = zone.identifier.replace('US-ID-ADA-', '');
            this.awareStatusByZone.set(short, zone);
            this.restyleAdaZone(short);
          }
        } catch {
          errors++;
        }
        await new Promise(res => setTimeout(res, 150)); // be polite
      }
    } finally {
      this.pollBusy = false;
      store.set({ statusPoll: { time: new Date(), checked, errors }, alerts: this.nonNormalZones() });
    }
  }

  private nonNormalZones(): ZoneAlert[] {
    const out: ZoneAlert[] = [];
    this.awareStatusByZone.forEach((v, z) => {
      if (!/normal/i.test(v.status)) out.push({ zone: z, status: v.status, color: v.color, name: this.adaMetaByZone.get(z)?.name });
    });
    this.adaMetaByZone.forEach((m, z) => {
      if (!this.awareStatusByZone.has(z) && !/normal/i.test(m.status)) {
        out.push({ zone: z, status: m.status, color: m.color, name: m.name });
      }
    });
    this.boiseReadinessByZone.forEach((rd, z) => {
      if (rd !== 'None') out.push({ zone: z, status: READINESS_LABELS[rd], color: READINESS_COLORS[rd] });
    });
    return out;
  }

  householdCountInZone(zone: string): number {
    let n = 0;
    this.rawRows.forEach((_row, idx) => {
      if (this.zoneForIndex(idx) === zone) n++;
    });
    return n;
  }

  // ---------- Fires ----------

  async refreshFires(): Promise<void> {
    try {
      const [pts, perims, viirs, goes] = await Promise.all([
        fetchJson(FIRES_URL),
        fetchJson(PERIMS_URL),
        fetchJson(VIIRS_URL).catch(() => null),
        fetchJson(HMS_URL).catch(() => null)
      ]);
      this.firesLayer?.remove();
      this.perimetersLayer?.remove();
      this.satLayer?.remove();
      this.goesLayer?.remove();

      this.firePoints = (pts.features || []).map((f: any) => ({
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        name: f.properties.IncidentName
      }));
      this.firesLayer = L.layerGroup(
        (pts.features || []).map((f: any) => {
          const p = f.properties;
          const [lon, lat] = f.geometry.coordinates;
          const m = L.marker([lat, lon], {
            icon: L.divIcon({ html: '🔥', className: 'fire-icon', iconSize: [26, 26], iconAnchor: [13, 13] })
          });
          const disc = p.FireDiscoveryDateTime ? new Date(p.FireDiscoveryDateTime).toLocaleString() : '?';
          m.bindPopup(`<div style="max-width:250px">
            <div><strong>🔥 ${escapeHtml(p.IncidentName || 'Fire')}</strong></div>
            <div><strong>Size:</strong> ${escapeHtml(String(p.IncidentSize ?? '?'))} acres</div>
            <div><strong>Contained:</strong> ${escapeHtml(String(p.PercentContained ?? '?'))}%</div>
            <div><strong>Discovered:</strong> ${escapeHtml(disc)}</div>
          </div>`);
          return m;
        })
      );
      this.perimetersLayer = L.geoJSON(perims, {
        style: PERIMETER_STYLE,
        onEachFeature: (f, layer) =>
          (layer as L.Path).bindTooltip(`${f.properties.attr_IncidentName || 'Fire'} perimeter`, { sticky: true })
      });
      this.satLayer = viirs ? this.buildSatLayer(viirs) : null;
      this.goesLayer = goes ? this.buildGoesLayer(goes) : null;

      const s = store.getState();
      if (s.showGoes && this.goesLayer) this.goesLayer.addTo(this.map); // lowest pane
      if (s.showFires) {
        this.satLayer?.addTo(this.map);
        this.firesLayer.addTo(this.map);
        this.perimetersLayer.addTo(this.map);
      }
      store.set({ fireCount: this.firePoints.length, lastFireUpdate: new Date() });
    } catch (e: any) {
      this.setStatus('Fire data unavailable: ' + e.message);
    }
  }

  private buildSatLayer(geojson: any): L.LayerGroup {
    const rects = (geojson.features || []).map((f: any) => {
      const p = f.properties;
      const [lon, lat] = f.geometry.coordinates;
      const { dLat, dLon } = pixelHalfExtents(Number(p.track) || 0.375, lat);
      const { dLon: dLonScan } = pixelHalfExtents(Number(p.scan) || 0.375, lat);
      const r = L.rectangle(
        [[lat - dLat, lon - dLonScan], [lat + dLat, lon + dLonScan]] as any,
        viirsStyle(p.hours_old)
      );
      void dLon;
      r.bindTooltip(
        `Satellite detection · ${escapeHtml(String(p.satellite || '?'))} · ` +
          `${p.hours_old}h ago · FRP ${p.frp ?? '?'} · ${escapeHtml(String(p.confidence || ''))}`,
        { sticky: true }
      );
      return r;
    });

    const fresh: [number, number][] = (geojson.features || [])
      .filter((f: any) => f.properties.hours_old <= 24)
      .map((f: any) => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
    const hulls: L.Polygon[] = [];
    clusterDetections(fresh, 2).forEach(group => {
      const hull = convexHull(group);
      if (!hull) return;
      const poly = L.polygon(hull as any, CLUSTER_HULL_STYLE);
      poly.bindTooltip(`Active detection cluster · ${group.length} detections <24h`, { sticky: true });
      hulls.push(poly);
    });

    const hours = (geojson.features || []).map((f: any) => f.properties.hours_old).filter((h: any) => h != null);
    store.set({
      satStats: {
        count: rects.length,
        newestHours: hours.length ? Math.min(...hours) : null,
        clusters: hulls.length
      }
    });
    return L.layerGroup([...hulls, ...rects]);
  }

  private buildGoesLayer(geojson: any): L.LayerGroup {
    // Repeat scans stack the same ~2km pixels dozens of times; keep only the
    // newest detection per grid cell so the faint opacity stays faint.
    const byCell = new Map<string, { lat: number; lon: number; h: number; p: any }>();
    (geojson.features || []).forEach((f: any) => {
      const p = f.properties;
      const h = hmsAgeHours(p);
      if (!Number.isFinite(h) || h > 6) return; // GOES is for recency; VIIRS covers history
      const [lon, lat] = f.geometry.coordinates;
      const key = Math.round(lat / 0.02) + ',' + Math.round(lon / 0.02);
      const cur = byCell.get(key);
      if (!cur || h < cur.h) byCell.set(key, { lat, lon, h, p });
    });
    const rects: L.Rectangle[] = [];
    let newest = Infinity;
    byCell.forEach(({ lat, lon, h, p }) => {
      newest = Math.min(newest, h);
      const { dLat, dLon } = pixelHalfExtents(2, lat);
      const r = L.rectangle(
        [[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]] as any,
        { ...goesStyle(h), pane: 'goesPane' }
      );
      const age = h < 2 ? `${Math.round(h * 60)} min` : `${Math.round(h)}h`;
      r.bindTooltip(
        `GOES detection · ${escapeHtml(String(p.Satellite))} · ${age} ago · FRP ${p.FRP ?? '?'} (NOAA HMS)`,
        { sticky: true }
      );
      rects.push(r);
    });
    store.set({ goesStats: { count: rects.length, newestMin: rects.length ? Math.round(newest * 60) : null } });
    return L.layerGroup(rects);
  }

  toggleFiresVisible(): void {
    const showing = store.getState().showFires;
    [this.firesLayer, this.perimetersLayer, this.satLayer].forEach(l => {
      if (!l) return;
      if (showing) this.map.removeLayer(l);
      else l.addTo(this.map);
    });
    store.set({ showFires: !showing });
  }

  toggleGoesVisible(): void {
    const showing = store.getState().showGoes;
    if (this.goesLayer) {
      if (showing) this.map.removeLayer(this.goesLayer);
      else this.goesLayer.addTo(this.map);
    }
    store.set({ showGoes: !showing });
  }

  // ---------- Households ----------

  async loadCsv(file: File): Promise<void> {
    this.resetHouseholds();
    let rows: HouseholdRow[];
    try {
      rows = await parseCsvFile(file);
    } catch (e: any) {
      this.setStatus('CSV parse error: ' + e.message);
      return;
    }
    this.rawRows = rows;
    if (!rows.length) {
      this.setStatus('No rows found.');
      return;
    }
    const { latKey, lonKey } = detectLatLonKeys(rows[0]);
    this.latKey = latKey;
    this.lonKey = lonKey;
    if (!latKey || !lonKey) {
      this.setStatus('Could not find lat/lon columns. Expected headers like lat/latitude and lon/lng/longitude.');
      return;
    }
    this.loadExistingLabels();
    this.drawRows();
    this.fitToData();
    const labelCount = Object.keys(this.labelByIndex).length;
    this.setStatus(
      labelCount
        ? `Loaded ${rows.length} rows with ${labelCount} existing labels.`
        : `Loaded ${rows.length} rows.`
    );
    store.set({ rowCount: rows.length, markerCount: this.markers.length, downloadableColumns: this.downloadableColumns() });
    this.pushSelection();
    this.pushZonePanel();
    if (this.adaMetaByZone.size) void this.pollLiveStatus(); // new households -> new watched zones
  }

  private loadExistingLabels(): void {
    const firstRow = this.rawRows[0];
    const labelKey = Object.keys(firstRow).find(k => /^label$/i.test(k));
    if (!labelKey) return;
    this.rawRows.forEach((row, idx) => {
      const label = row[labelKey];
      if (label != null && String(label).trim()) this.labelByIndex[idx] = String(label).trim();
    });
  }

  /**
   * Rows sharing identical coordinates with another row are almost always
   * geocoder fallbacks (city/state/ZIP centroids) — flag them as suspect.
   */
  private computeSuspects(): void {
    this.suspectByIndex = new Set();
    const byCoord = new Map<string, number[]>();
    this.rawRows.forEach((row, idx) => {
      const lat = parseCoord(row[this.latKey!]);
      const lon = parseCoord(row[this.lonKey!]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const key = lat + ',' + lon;
      if (!byCoord.has(key)) byCoord.set(key, []);
      byCoord.get(key)!.push(idx);
    });
    byCoord.forEach(list => {
      if (list.length > 1) list.forEach(idx => this.suspectByIndex.add(idx));
    });
  }

  private iconFor(idx: number, selected: boolean): L.DivIcon {
    const row = this.rawRows[idx];
    const residents = Number(row.Residents || row.residents) || 1;
    const color = this.colorForLabel(this.labelByIndex[idx] || '');
    const size = 24;
    let symbol = '●';
    if (residents === 1) symbol = '👤';
    else if (residents === 2) symbol = '👥';
    else if (residents >= 3) symbol = '👪';

    const suspect = this.suspectByIndex.has(idx);
    const noZone = !suspect && this.zoneFeatures.length > 0 && !this.zoneForIndex(idx);
    let border = selected ? '3px solid #111827' : '2px solid #11182733';
    if (suspect) border = '3px dashed #dc2626';
    else if (noZone) border = '3px dashed #d97706';

    return L.divIcon({
      html: `<div style="width:${size}px;height:${size}px;background-color:${color};border:${border};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;${selected ? 'box-shadow: 0 0 8px rgba(17,24,39,.5);' : ''}">${symbol}</div>`,
      className: 'custom-household-icon',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  private refreshMarkerIcon(m: L.Marker): void {
    const id = L.Util.stamp(m);
    const idx = this.idxByLayerId.get(id);
    if (idx == null) return;
    m.setIcon(this.iconFor(idx, this.selectedLayerIds.has(id)));
  }

  private drawRows(): void {
    this.computeSuspects();
    this.rawRows.forEach((row, idx) => {
      const lat = parseCoord(row[this.latKey!]);
      const lon = parseCoord(row[this.lonKey!]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const m = L.marker([lat, lon], { icon: this.iconFor(idx, false) }).addTo(this.map);
      m.bindPopup(() => this.buildPopup(idx)); // built at click time so evac zone is current
      this.markers.push(m);
      this.idxByLayerId.set(L.Util.stamp(m), idx);
      this.markerByIdx.set(idx, m);
    });
    this.refreshColors();
  }

  private buildPopup(idx: number): string {
    const row = this.rawRows[idx];
    const entries = Object.entries(row)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => {
        const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
        return `<div><strong>${escapeHtml(displayKey)}:</strong> ${escapeHtml(String(value))}</div>`;
      });
    const zone = this.zoneForIndex(idx);
    if (zone) entries.push(`<div><strong>Evac zone:</strong> ${escapeHtml(zone)}</div>`);
    if (!entries.length) return '<div><strong>Household</strong></div>';
    return `<div style="max-width: 250px;">${entries.join('')}</div>`;
  }

  zoneForIndex(idx: number): string {
    if (idx == null || !this.zoneFeatures.length) return '';
    if (!(idx in this.zoneByIndex)) {
      const row = this.rawRows[idx];
      const lat = parseCoord(row?.[this.latKey!]);
      const lon = parseCoord(row?.[this.lonKey!]);
      this.zoneByIndex[idx] =
        Number.isFinite(lat) && Number.isFinite(lon) ? zoneForPoint(lat, lon, this.zoneFeatures) : '';
    }
    return this.zoneByIndex[idx];
  }

  private colorForLabel(label: string): string {
    if (!label) return UNLABELED_COLOR;
    if (!this.colorByLabel.has(label)) {
      this.colorByLabel.set(label, PALETTE[this.colorByLabel.size % PALETTE.length]);
    }
    return this.colorByLabel.get(label)!;
  }

  private refreshColors(): void {
    this.markers.forEach(m => this.refreshMarkerIcon(m));
    this.pushLegend();
  }

  private fitToData(): void {
    const latLngs = this.markers.map(m => m.getLatLng());
    if (latLngs.length) this.map.fitBounds(L.latLngBounds(latLngs).pad(0.2));
  }

  // ---------- Selection / labeling ----------

  toggleLasso(): void {
    if (this.lasso.enabled()) this.lasso.disable();
    else this.lasso.enable();
  }

  clearSelection(): void {
    this.selectedLayerIds.clear();
    this.markers.forEach(m => this.refreshMarkerIcon(m));
    this.setStatus('Selection cleared');
    this.pushSelection();
  }

  applyLabel(label: string): void {
    const trimmed = label.trim();
    if (!trimmed || this.selectedLayerIds.size === 0) return;
    this.selectedLayerIds.forEach(id => {
      const idx = this.idxByLayerId.get(id);
      if (idx != null) this.labelByIndex[idx] = trimmed;
    });
    this.refreshColors();
    this.pushZonePanel();
    this.setStatus(`Labeled ${this.selectedLayerIds.size} as “${trimmed}”`);
  }

  panToHousehold(idx: number): void {
    const m = this.markerByIdx.get(idx);
    if (m) {
      this.map.panTo(m.getLatLng());
      m.openPopup();
    }
  }

  // ---------- Export ----------

  getSelectionIndices(): number[] {
    const set = new Set<number>();
    this.selectedLayerIds.forEach(id => {
      const idx = this.idxByLayerId.get(id);
      if (idx != null) set.add(idx);
    });
    if (this.selectedZoneNames.size) {
      this.rawRows.forEach((_row, idx) => {
        const z = this.zoneForIndex(idx);
        if (z && this.selectedZoneNames.has(z)) set.add(idx);
      });
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  downloadableColumns(): string[] {
    const cols = this.rawRows.length ? Object.keys(this.rawRows[0]) : [];
    ['label', 'evac_zone'].forEach(c => {
      if (!cols.includes(c)) cols.push(c);
    });
    return cols;
  }

  defaultDownloadColumns(): Set<string> {
    return defaultDispatchColumns(this.downloadableColumns());
  }

  exportAll(): void {
    if (!this.rawRows.length) return;
    const rows = this.rawRows.map((r, i) => ({
      ...r,
      label: this.labelByIndex[i] || '',
      evac_zone: this.zoneForIndex(i)
    }));
    downloadCsv(toCsv(rows), 'households_labeled.csv');
  }

  downloadSelected(chosen: string[]): number {
    const sel = this.getSelectionIndices();
    const rows = sel.map(i => {
      const out: HouseholdRow = {};
      chosen.forEach(c => {
        if (c === 'label') out[c] = this.labelByIndex[i] || '';
        else if (c === 'evac_zone') out[c] = this.zoneForIndex(i);
        else out[c] = this.rawRows[i][c] ?? '';
      });
      return out;
    });
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
    downloadCsv(toCsv(rows, chosen), `dispatch_households_${stamp}.csv`);
    this.setStatus(`Downloaded ${rows.length} households (${chosen.length} columns).`);
    return rows.length;
  }

  // ---------- Store pushes ----------

  private setStatus(msg: string): void {
    store.set({ status: msg });
  }

  private pushSelection(): void {
    store.set({
      lassoSelectionCount: this.selectedLayerIds.size,
      selectionCount: this.getSelectionIndices().length
    });
  }

  private pushLegend(): void {
    const entries = new Map<string, string>();
    this.colorByLabel.forEach((v, k) => entries.set(k, v));
    const anyUnlabeled = this.markers.some(m => {
      const idx = this.idxByLayerId.get(L.Util.stamp(m));
      return idx != null && !this.labelByIndex[idx];
    });
    if (anyUnlabeled) entries.set('(unlabeled)', UNLABELED_COLOR);

    let noZone = 0;
    if (this.zoneFeatures.length) {
      this.markers.forEach(m => {
        const idx = this.idxByLayerId.get(L.Util.stamp(m));
        if (idx != null && !this.suspectByIndex.has(idx) && !this.zoneForIndex(idx)) noZone++;
      });
    }
    store.set({
      legend: Array.from(entries.entries()).map(([label, color]) => ({ label, color })),
      warnings: {
        suspect: this.suspectByIndex.size,
        noZone,
        noCoord: this.rawRows.length ? this.rawRows.length - this.markers.length : 0
      },
      markerCount: this.markers.length
    });
  }

  private pushZonePanel(): void {
    const selected = Array.from(this.selectedZoneNames).sort();
    const cols = this.rawRows.length ? Object.keys(this.rawRows[0]) : [];
    const rows: PanelRow[] = [];
    this.rawRows.forEach((row, idx) => {
      const z = this.zoneForIndex(idx);
      if (z && this.selectedZoneNames.has(z)) {
        rows.push({
          idx,
          zone: z,
          cells: cols.map(c => (row[c] == null ? '' : (row[c] as string | number))),
          label: this.labelByIndex[idx] || ''
        });
      }
    });
    const chipColors: Record<string, string> = {};
    selected.forEach(z => {
      chipColors[z] = this.adaMetaByZone.has(z) ? '#9ca3af' : this.zoneColor(z);
    });
    store.set({ selectedZones: selected, panelColumns: cols, panelRows: rows, zoneChipColors: chipColors });
  }

  private resetHouseholds(): void {
    this.markers.forEach(m => m.remove());
    this.markers = [];
    this.idxByLayerId.clear();
    this.markerByIdx.clear();
    this.selectedLayerIds.clear();
    this.labelByIndex = {};
    this.zoneByIndex = {};
    this.suspectByIndex = new Set();
    this.colorByLabel.clear();
    this.rawRows = [];
    this.latKey = this.lonKey = null;
    if (this.lasso.enabled()) this.lasso.disable();
    store.set({
      rowCount: 0, markerCount: 0, legend: [], status: '',
      warnings: { suspect: 0, noZone: 0, noCoord: 0 },
      lassoSelectionCount: 0, selectionCount: 0,
      panelRows: [], panelColumns: [], downloadableColumns: []
    });
    this.pushZonePanel();
  }
}

export const controller = new MapController();

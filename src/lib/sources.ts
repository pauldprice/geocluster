import type { AwareZoneStatus, Readiness } from '../types';

/** All external data endpoints. Every one is keyless and CORS-open; see data/README.md. */

const IDAHO_BBOX = '-117.25,41.98,-111.04,49.01';

// Genasys aware API (official surface behind protect.genasys.com; Ada County only in Idaho)
const AWARE_URL = 'https://api-aware.zonehaven.com/v2/zone?coordinates=';

// Boise County's own ArcGIS org: live Ready/Set/Go per zone
const BOISE_READINESS_URL =
  'https://services6.arcgis.com/GtUQURjsVQCZqPXM/arcgis/rest/services/' +
  'Evac_Zones/FeatureServer/0/query?where=1%3D1&outFields=Zone,Readiness&returnGeometry=false&f=json';

// NIFC WFIGS: active incidents + perimeters
const WFIGS = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/';
export const FIRES_URL =
  WFIGS + 'WFIGS_Incident_Locations_Current/FeatureServer/0/query?where=' +
  encodeURIComponent("POOState='US-ID' AND IncidentTypeCategory='WF'") +
  '&outFields=IncidentName,IncidentSize,PercentContained,FireDiscoveryDateTime,ModifiedOnDateTime_dt,IrwinID&f=geojson';
export const PERIMS_URL =
  WFIGS + 'WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=' +
  encodeURIComponent("attr_POOState='US-ID'") + '&outFields=attr_IncidentName,poly_GISAcres&f=geojson';

// NASA FIRMS VIIRS detections via Esri Living Atlas (points; footprints synthesized client-side)
export const VIIRS_URL =
  'https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/' +
  'Satellite_VIIRS_Thermal_Hotspots_and_Fire_Activity/FeatureServer/0/query' +
  '?where=' + encodeURIComponent('hours_old<=96') +
  `&geometry=${IDAHO_BBOX}&geometryType=esriGeometryEnvelope&inSR=4326` +
  '&spatialRel=esriSpatialRelIntersects' +
  '&outFields=satellite,confidence,frp,scan,track,hours_old&f=geojson';

// NOAA HMS: analyst-QC'd GOES detections (~1-2h latency). NASA FIRMS API does NOT serve GOES.
export const HMS_URL =
  'https://services2.arcgis.com/C8EMgrsFcRFL6LrL/arcgis/rest/services/' +
  'NOAA_Satellite_Fire_Detections_(v1)/FeatureServer/0/query' +
  '?where=' + encodeURIComponent("Satellite IN ('GOES-EAST','GOES-WEST')") +
  `&geometry=${IDAHO_BBOX}&geometryType=esriGeometryEnvelope&inSR=4326` +
  '&spatialRel=esriSpatialRelIntersects&outFields=YearDay,Time,Satellite,Method,FRP&f=geojson';

export async function fetchJson<T = any>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json() as Promise<T>;
}

/**
 * Look up the Genasys zone containing a point. Returns null when the point
 * has no Genasys zone (their API 404s for such points — not an error).
 */
export async function awareLookup(lon: number, lat: number): Promise<
  ({ identifier: string } & AwareZoneStatus) | null
> {
  const r = await fetch(AWARE_URL + lon + ',' + lat);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const zone = ((await r.json()).zones || [])[0];
  if (!zone || !zone.identifier) return null;
  return {
    identifier: zone.identifier as string,
    status: zone.status || 'Normal',
    color: zone.statusColor || '#F2F2F2',
    updatedAt: zone.updatedAt,
    desc: zone.statusDescription || ''
  };
}

export async function fetchBoiseReadiness(): Promise<Map<string, Readiness>> {
  const json = await fetchJson<{ features?: { attributes: { Zone: string; Readiness: string | null } }[] }>(
    BOISE_READINESS_URL
  );
  const out = new Map<string, Readiness>();
  (json.features || []).forEach(f => {
    out.set(f.attributes.Zone, (f.attributes.Readiness as Readiness) || 'None');
  });
  return out;
}

/** Age in hours of an HMS detection (YearDay like 2026189, Time 'HHMM' UTC). */
export function hmsAgeHours(p: { YearDay: number | string; Time: number | string }, now = Date.now()): number {
  const yd = String(p.YearDay);
  const t = String(p.Time).padStart(4, '0');
  const ts =
    Date.UTC(+yd.slice(0, 4), 0, 1) +
    (+yd.slice(4) - 1) * 86400000 +
    +t.slice(0, 2) * 3600000 +
    +t.slice(2) * 60000;
  return (now - ts) / 3600000;
}

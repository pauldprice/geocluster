# Evacuation Zone Data

## boise_county_evacuation_zones.geojson

Official evacuation zone polygons for Boise County, Idaho (106 zones), as established by Boise County Emergency Management in 2025. These are the same zones used by Genasys Protect (protect.genasys.com) and the Watch Duty app.

- **Source**: Public ArcGIS Online feature service `ID_Boise_Evacuation_Zones` (owner `sraddigan`, item `6b2b141365c348ef8311c43dd711b5f7`)
- **Service URL**: https://services3.arcgis.com/5dR74OZF27kwYZJF/arcgis/rest/services/ID_Boise_Evacuation_Zones/FeatureServer/0
- **Downloaded**: 2026-07-07
- **CRS**: WGS84 (EPSG:4326), coordinates rounded to 6 decimal places
- **Properties per feature**: `Name`, `Zone` (e.g. `GV-04`), `Label`, `Jurisdiction`, `StructuresWithin`, `PopulationWithin` (the last four are sparsely populated)

Zone code prefixes map to communities, e.g. GV = Garden Valley, IC = Idaho City, HSB = Horseshoe Bend, LOW = Lowman, CEN = Centerville, PLA = Placerville, WR = Wilderness Ranch.

To refresh from the source:

```bash
curl -s "https://services3.arcgis.com/5dR74OZF27kwYZJF/arcgis/rest/services/ID_Boise_Evacuation_Zones/FeatureServer/0/query?where=1%3D1&outFields=Name,Zone,Label,Jurisdiction,StructuresWithin,PopulationWithin&outSR=4326&f=geojson&geometryPrecision=6" \
  -o data/boise_county_evacuation_zones.geojson
```

The same feature service also has a layer 2 (`County Boundary`) if the county outline is ever needed.

## ada_county_evacuation_zones.geojson

Snapshot of all 542 Ada County, Idaho evacuation zones from the Genasys Protect (Zonehaven) GeoServer WFS, normalized to properties `zone` (e.g. `ADA-2256`), `name` (commonly known as), `status`, `color`, `lat`, `lon` (centroid), coordinates rounded to 5 decimals, EPSG:4326.

- **Downloaded**: 2026-07-07
- **Live status**: the app does NOT rely on this snapshot for status - it polls the keyless Genasys aware API (`https://api-aware.zonehaven.com/v2/zone?coordinates=lng,lat`, CORS-enabled) for zones containing loaded households and zones at active fire locations. The snapshot provides geometry only (plus a status fallback).
- **Why a snapshot**: the WFS itself is origin-allowlisted to `protect.genasys.com`, so browsers cannot call it directly; geometry changes rarely, status is fetched live.

To refresh the snapshot (server-side only; HTTP Basic credentials are the ones Genasys ships in plaintext in their public web bundle - unofficial, may rotate):

```bash
curl -s -u 'ui-client:QceJ62zsY4fb' "https://cdngeospatialcei.zonehaven.com/geoserver/zonehavenv2/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=zonehavenv2:evacuation_zone&outputFormat=application/json&srsName=EPSG:4326&cql_filter=identifer%20LIKE%20%27US-ID-ADA%25%27" -o ada_raw.json
# then normalize props/precision as in the properties list above
```

Note the WFS field is genuinely spelled `identifer`. Boise County is NOT in the public Genasys feed (verified 2026-07-07); for live Boise County status, ask Boise County Emergency Management for an official `zms.zonehaven.com` authkey WMS.

## Fire data

Active Idaho wildfires and perimeters come live from NIFC WFIGS (public ArcGIS, no auth, polled every 5 min by the app):
- Points: `WFIGS_Incident_Locations_Current` layer 0, `where=POOState='US-ID' AND IncidentTypeCategory='WF'`
- Perimeters: `WFIGS_Interagency_Perimeters_Current` layer 0, `where=attr_POOState='US-ID'`

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

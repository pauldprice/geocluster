# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neighborhood Cluster Lasso: a browser-only web app for loading household CSV data (with lat/lon), plotting it on a Leaflet map, lasso-selecting groups of households, assigning color-coded labels, and exporting the CSV back out with a `label` column.

Live demo is deployed via GitHub Pages at https://pauldprice.github.io/geocluster/ (served straight from `main`, so anything merged to `main` is live).

## Architecture

The entire application is `index.html`: one file containing the CSS, the DOM (header toolbar, `#map`, footer legend), and all JavaScript in a single inline `<script>`. There is no build step, no package.json, no framework, and no tests. Dependencies (Leaflet 1.9.4, leaflet-lasso 2.2.13, Papa Parse 5.4.1) are loaded from unpkg CDN via `<script>` tags; adding a library means adding another CDN tag.

Key state lives in module-level variables in that script:

- `rawRows`: parsed CSV rows (objects keyed by original headers). All original columns are preserved through export.
- `markers` + `idxByLayerId`: one Leaflet marker per valid row, mapped back to its row index via `_leaflet_id`.
- `labelByIndex`: row index -> assigned label. This is the source of truth for labels; export merges it into rows as a `label` column.
- `colorByLabel`: label -> color, assigned first-come from a fixed 12-color `palette`. Unlabeled points use `#2563eb`.

Flow: CSV upload -> Papa Parse -> `detectLatLonKeys` (accepts lat/latitude and lon/lng/longitude, case-insensitive) -> `loadExistingLabels` (a `label` column in the input CSV pre-populates `labelByIndex`) -> `drawRows` -> lasso selection fills `selectedLayerIds` -> Apply writes to `labelByIndex` -> `refreshColors`/`updateLegend`.

Markers are `L.divIcon` HTML icons chosen by the `Residents` column (👤 1, 👥 2, 👪 3+); selection state is rendered by rebuilding the icon with a heavier border in `highlightLayer`. Popups show every non-empty column, HTML-escaped via `escapeHtml`.

## Data

`data/boise_county_evacuation_zones.geojson` holds the official Boise County, Idaho evacuation zone polygons (106 zones, WGS84). See `data/README.md` for the ArcGIS source service and the curl command to refresh it.

The app fetches this file on startup and renders it as a toggleable `L.geoJSON` overlay (`zonesLayer`), colored by zone-code prefix (community), with each zone's code shown as a permanent centered tooltip (`.zone-label`). Households are assigned to zones lazily via ray-cast point-in-polygon (`zoneForIndex`, cached in `zoneByIndex`); the zone appears in marker popups and as an `evac_zone` column in the export. The fetch requires an HTTP server (opening index.html via file:// leaves zones unavailable but the rest of the app working). The lasso handler filters out non-marker layers via `idxByLayerId.has(...)` so zone polygons are never selected.

"Download selected…" (`downloadSelectedBtn`) exports the union of lasso-selected households and households in selected zones (`getSelectionIndices`) via a column-picker modal (`#dlOverlay`); name/phone-like columns are checked by default and picks are remembered in `lastChosenCols` for the session.

Clicking a zone toggles it in `selectedZoneNames` (restyled via `zoneStyle`) and opens `#zonePanel`, a fixed-position panel listing the households inside all selected zones (`updateZonePanel`). The panel has per-zone chips (click to deselect), a close button that clears the selection, and table rows that pan to the household's marker (`markerByIdx`) and open its popup. `updateZonePanel` is re-run on CSV load, label apply, and reset so the table stays current.

## Development

No build or test commands. Run locally with any static server:

```bash
python -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000. Verify changes manually in the browser; loading a small CSV with lat/lon columns is the basic smoke test.

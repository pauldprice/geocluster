# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neighborhood Cluster Lasso: a browser-only web app for loading household CSV data (with lat/lon), plotting it on a Leaflet map, lasso-selecting groups of households, assigning color-coded labels, and exporting the CSV back out with `label` and `evac_zone` columns. Used operationally during wildfire evacuations to build dispatch call lists (select affected zones, download name+phone CSV). It overlays official Boise County and Ada County (Genasys) evacuation zones with live status polling, live Idaho fire locations/perimeters (NIFC), NASA FIRMS VIIRS satellite fire footprints with cluster hulls, and NOAA HMS GOES detections.

Live at https://pauldprice.github.io/geocluster/ - deployed by `.github/workflows/deploy.yml` on push to main. Changes can go live mid-incident; verify in the browser before pushing. NEVER commit household CSVs (names/phones/addresses).

## Commands

```bash
npm run dev      # Vite dev server with hot reload
npm test         # vitest unit tests; single test: npx vitest run src/lib/geo.test.ts
npm run build    # tsc --noEmit + vite build -> single self-contained dist/index.html
npm run preview  # serve dist/ locally
```

The build inlines everything (JS, CSS, both zone GeoJSONs) into ONE `dist/index.html` (~3 MB) via vite-plugin-singlefile so it also runs from `file://` during field deployments.

## Architecture

Two worlds, deliberately separated:

- **`src/map/controller.ts` (`MapController`, singleton `controller`)**: imperative Leaflet. Owns the map, every layer, all polling loops, and all household state (rows, markers, labels, zone assignments, selections). Do NOT wrap Leaflet in react-leaflet; plugins (leaflet-lasso) and custom panes fight it.
- **React components (`src/components/`)**: stateless-ish UI chrome (toolbar, zone panel, download modal, alert banner, footer/legend) rendering from `src/store.ts` - a tiny observable store consumed via `useSyncExternalStore` (`useAppState()`). User actions call `controller` methods; the controller pushes state back via `store.set`.

Supporting modules: `src/lib/geo.ts` (ray-cast point-in-polygon, union-find clustering, convex hull - unit tested), `src/lib/csv.ts` (parse/export; `parseCoord` uses parseFloat, never Number, so blank coords don't become 0,0), `src/lib/sources.ts` (every external endpoint + fetchers), `src/map/styles.ts` (palette, status colors, detection age-band styles).

Zone data is imported at build time (`?raw` + JSON.parse) from `data/*.geojson` - see `data/README.md` for sources and refresh commands. Zone name matching keys everything: Boise zones are `IC-01`-style, Ada zones `ADA-2256`-style (stripped of the `US-ID-ADA-` prefix).

### Live data flows (all keyless; see data/README.md)

- `pollLiveStatus()` every 60s: Boise County Ready/Set/Go from the county's ArcGIS (`fetchBoiseReadiness`) restyles zones with `READINESS_COLORS` + swaps labels; Genasys aware API per-point lookups for Ada zones containing households and fire locations (their 404 = "no zone here", not an error). Both feed the alert banner (`nonNormalZones`).
- `refreshFires()` every 5 min: NIFC incidents/perimeters, VIIRS footprints (rectangles synthesized from scan/track pixel km) + <24h cluster hulls, GOES detections deduped to newest-per-2km-cell in the dedicated `goesPane` (z-index 350, under the overlay pane) so they can never paint over zones.

### Gotchas

- The Genasys bulk WFS is origin-allowlisted to protect.genasys.com - browsers cannot call it; that is why Ada geometry is a build-time snapshot with live status fetched per-point instead.
- The NASA FIRMS API does not serve GOES; GOES comes from NOAA HMS (~1-2h latency).
- Households sharing byte-identical coordinates are geocoder centroid fallbacks - flagged as "suspect" (red dashed ring); valid-but-zoneless get amber; the legend chips count both plus coordinate-less rows.
- Lasso results must be filtered to layers in `idxByLayerId` - zone polygons also land in `lasso.finished`.
- `controller.init` is guarded against React StrictMode's double effect invocation.
- `window.__geocluster = { controller, store }` exists for browser-driven QA.

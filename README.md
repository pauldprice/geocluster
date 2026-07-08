# Neighborhood Cluster Lasso

🗺️ **Live Demo**: https://pauldprice.github.io/geocluster/

An interactive web application for geographic clustering and labeling of household data using map-based lasso selection tools.

## Features

### 📍 Interactive Mapping
- **Visual household representation**: Custom icons based on resident count
  - 👤 Single person (1 resident)
  - 👥 Couple (2 residents)  
  - 👪 Family (3+ residents)
- **Dynamic popups**: Click any household to see all CSV data for that location
- **OpenStreetMap integration**: No API keys required

### 🎯 Lasso Selection
- **Interactive selection tool**: Draw custom shapes to select multiple households
- **Visual feedback**: Selected households are highlighted with enhanced borders
- **Flexible grouping**: Select households across any geographic pattern

### 🏷️ Labeling System
- **Custom labels**: Assign meaningful names to selected household groups
- **Color-coded visualization**: Each label gets a unique color from a 12-color palette
- **Auto-legend**: Dynamically generated legend shows all active labels
- **Persistent labels**: Labels are preserved during export

### 🚨 Evacuation Zones
- **Boise County, Idaho zones**: 106 official evacuation zone polygons (same zones used by Genasys Protect and Watch Duty), rendered as a map overlay
- **Toggleable overlay**: Show or hide zones with the "Evac zones" button; zones are colored by community (Garden Valley, Idaho City, Horseshoe Bend, etc.)
- **Always-visible labels**: Every zone shows its code (e.g. `IC-01`) directly on the map
- **Click to highlight**: Click zones to select them (click again to deselect); selected zones are emphasized and a panel pops out listing every household inside them, with per-zone counts
- **Household table**: The panel table shows all CSV columns plus zone and label; click a row to pan to that household and open its popup
- **Automatic assignment**: Each household is matched to its evacuation zone (point-in-polygon); the zone shows in the household popup and is included in the CSV export as an `evac_zone` column
- **Ada County live status**: 542 Ada County zones (Genasys Protect) with live evacuation status polled every 60s for zones containing your households and zones at fire locations; non-Normal zones turn status-colored with an alert banner (click it to jump to the zone)
- **Active fires**: Idaho wildfire locations and perimeters from NIFC, refreshed every 5 minutes, with a "Fires" toggle
- **Geocode warnings**: households sharing identical coordinates (geocoder fallbacks) get a red dashed ring, households outside all zones get an amber dashed ring, and rows without coordinates are counted in the legend
- **Data source**: See `data/README.md` for the ArcGIS feature service and how to refresh the data

### 📊 Data Management
- **CSV import**: Supports standard CSV files with lat/lon coordinates
- **Flexible headers**: Accepts `lat/latitude` and `lon/lng/longitude` variations
- **Auto-label loading**: Automatically applies existing labels if CSV contains a `label` column
- **Data preservation**: All original CSV columns are maintained and displayed
- **Enhanced export**: Download labeled data as CSV with new `label` and `evac_zone` columns
- **Dispatch download**: "Download selected…" exports just the households in the current lasso selection and/or selected evac zones, with a column picker (defaults to name and phone) for quick call lists

## Usage

1. **Load Data**: Upload a CSV file containing household data with latitude/longitude coordinates
2. **Explore**: Click on household icons to view detailed information
3. **Select**: Enable the lasso tool and draw around households to group them
4. **Label**: Assign descriptive names to your selected groups
5. **Export**: Download your labeled dataset for further analysis

## CSV Format

Your CSV should include:
- **Location columns**: `lat/latitude` and `lon/lng/longitude` (case-insensitive)
- **Optional resident count**: `Residents` column for custom icon display
- **Additional data**: Any other columns (address, name, etc.) will be preserved and shown in popups
- **Existing labels**: Include a `label` column to automatically load previously assigned labels

## Technical Details

- **Single-file application**: No build process required
- **Modern web technologies**: HTML5, CSS3, JavaScript (ES6+)
- **External dependencies**: 
  - Leaflet.js for mapping
  - leaflet-lasso for selection tools
  - Papa Parse for CSV handling
- **No server required**: Runs entirely in the browser

## Development

To run locally:
```bash
# Serve with any HTTP server
python -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000 in your browser.

## License

This project is open source and available under the MIT License.
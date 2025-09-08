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

### 📊 Data Management
- **CSV import**: Supports standard CSV files with lat/lon coordinates
- **Flexible headers**: Accepts `lat/latitude` and `lon/lng/longitude` variations
- **Auto-label loading**: Automatically applies existing labels if CSV contains a `label` column
- **Data preservation**: All original CSV columns are maintained and displayed
- **Enhanced export**: Download labeled data as CSV with new label column

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
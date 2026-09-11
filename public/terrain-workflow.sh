#!/usr/bin/env bash
# Ojai Permaculture terrain handoff. Requires GDAL/OGR installed separately.
# Usage: bash terrain-workflow.sh raw-elevation.tif parcel.geojson NEW_OUTPUT_DIR
# Input: USGS raw single-band metre-valued DEM and authoritative parcel polygon.
# Keep site-check.json beside the output for acquisition date and vertical datum.
# Output is concept-planning data, not engineering or legal approval.
set -euo pipefail
if [ "$#" -ne 3 ]; then
  echo "Usage: bash terrain-workflow.sh raw-elevation.tif parcel.geojson NEW_OUTPUT_DIR" >&2
  exit 1
fi
for cmd in gdalwarp gdal_contour gdaldem; do
  command -v "$cmd" >/dev/null || { echo "GDAL is required: $cmd missing" >&2; exit 1; }
done
terrain_input="$1"
parcel_input="$2"
terrain_output="$3"
# Refuse to overwrite existing output.
mkdir "$terrain_output"
gdalwarp -t_srs EPSG:32611 -cutline "$parcel_input" -crop_to_cutline \
  -dstnodata -9999 -r bilinear "$terrain_input" "$terrain_output/parcel-dem.tif"
# 5 feet = 1.524 metres. Interval is a display choice, not an accuracy claim.
gdal_contour -3d -a elevation_m -i 1.524 -f GPKG \
  "$terrain_output/parcel-dem.tif" "$terrain_output/contours.gpkg"
gdaldem slope "$terrain_output/parcel-dem.tif" "$terrain_output/slope-percent.tif" -p -s 1
gdaldem hillshade "$terrain_output/parcel-dem.tif" "$terrain_output/hillshade.tif" -multidirectional -s 1
echo "Open the outputs in QGIS. Verify source accuracy, datum, and site conditions before design."

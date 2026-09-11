# Groundwork — Land & Clients

Interactive UI prototype inspired by the Ground Truth field dashboard. The original Ground Truth project remains unchanged.

## Included

- Project directory with search, stage filtering, and project creation.
- Property workspace with illustrative aerial, selectable features, layers, zoom, polygon drawing, image replacement, and two-point calibration.
- Deterministic plan geometry and planting spacing calculations.
- Scope editor with inclusions, descriptions, quantities, sample rates, totals, and print/PDF styling.
- Versioned client-preview snapshot, comments, approval/change requests, and project updates.
- Imperative browser agent tools: `get_land_workspace` and `set_demo_tree_spacing`.

## Prototype boundary

All data is sample data or kept only in the current browser session. Reloading resets changes. Client preview is a simulated role, not an authorization boundary. Telegram and Hermes are not connected. Nothing is emailed or sent externally. No production CRM, client authentication, durable database, surveying service, or client messaging integration is implemented.

The aerial image is AI-generated for a fictional farm. The initial calibration is illustrative, not a real-world measurement of land. User-added images must be top-down and calibrated from a known distance. Shape dimensions are axis-aligned extents, not surveyed dimensions. Pond volumes, soil conditions, engineering, and permitting are outside scope.

Draft edits increment the revision once after a share. A shared proposal stores its own image, geometry, scale, spacing, descriptions, prices, and totals; later edits do not change the client's copy.

## Development

`npm run dev` starts the UI. `npm run build` builds the Sites-compatible Cloudflare Worker. `node --experimental-strip-types --test tests/geometry.test.mjs` exercises measurement, spacing, unscaled input, and snapshot behavior. `npx tsc --noEmit` checks TypeScript.

The two WebMCP contracts were exercised through the supported browser context: read state, valid spacing change and readback, and invalid spacing rejection. General browser screenshot/interaction QA was not performed because it was not requested.

## Ojai Permaculture planning desk

The opening view now lets Connor compare an installation budget, a 6–60 month implementation window, work priority, contingency, and annual tree care. Costs and quantities come from the mapped scope. Whole phases are funded in order; an unaffordable phase defers all subsequent work. The automatic schedule divides the selected window across all included phases. Tree care is prorated from planting completion through year five, additional to installation funding. No inflation, financial ROI, crop yield, or biological maturity is modeled.

The scenario cards compare the same property under three budget/timing assumptions. Year controls show delivered tree counts, restored pond edge, installed access, and time since planting. An accessible annual table accompanies the cumulative cost chart. Concept drawings can be downloaded as standalone SVG or printed; dimensions are image-axis extents and require site verification. These are not surveyed or construction-ready documents.

Sharing freezes the financial and timing assumptions alongside scope, quantities, and geometry. The client preview shows only funded work as the proposed installation, with deferred phases identified separately. Everything remains session-only demo data.

Validation: 15 geometry/planning tests cover calibration, exclusions, whole-phase affordability, priority, timing, prorated care, empty scope, and snapshot independence. The browser agent interface also verified a $25,000 / 36-month draft, $31,627.05 five-year allowance, unchanged shared settings, and rejection of negative budgets.

## Address, parcel, and terrain pilot

Site check is a live, read-only Ventura County integration. It uses the county ArcGISPro address locator, public parcel polygons and nullable acreage, incorporated city boundaries (Cities layer1), planning zoning (LandUse11), and overlays (LandUse10). Users choose an address match, confirm a nearby parcel/APN, then create an empty scoped project with georeferenced USGS terrain. It never places fictional demo work areas on a real address.

USGS3DEP supplies hillshade, a5ft contour visualization, and17 explicitly positioned elevation samples across the map's west-east centerline. Source acquisition date, native resolution, and vertical datum accompany the profile. Sample extrema describe only this line, including land outside the parcel. Native DEM resolution is not accuracy, and resampling or choosing a contour interval does not improve accuracy. USGS ImageryTopo supplies the optional aerial/topographic layer. Map output is EPSG3857 at a matching3:2 aspect ratio; local feet/pixel corrects for WebMercator latitude distortion and remains a planning approximation.

Google Maps opens the selected address using official Maps URLs. Embedding uses the official Maps Embed API only when the server runtime variable GOOGLE_MAPS_EMBED_API_KEY is configured. It is currently not configured. Restrict an eventual key to Maps Embed API and the site origin. No key was created, purchased, copied from another project, or added during this implementation.

Legal/buildable area is always unverified. GIS acreage/APN does not establish legal lot status. Municipal placeholders such as ZONE=Ojai and DEFINITION=City are excluded from zoning results. A postal Ojai address can be unincorporated. No zoning number is interpreted as a construction allowance, and no use, setback, water, grading, easement, or permit rule is automatically approved. Multiple intersecting zones/overlays are preserved; failed or truncated source checks remain visible. City of Ojai routes to its planning division. Other incorporated cities require their own authority lookup; the UI links jurisdiction data instead of applying county ordinances.

Export options: authoritative GeoJSON parcel polygon, raw single-band Float32 elevation GeoTIFF in EPSG32611, profile CSV, and JSON source report. The report includes DEM query, metre elevation units, source metadata, and the explicit unverified legal status. public/terrain-workflow.sh is a syntax-checked GDAL handoff script for clipping the DEM,5ft contours, percent slope, and hillshade; it was not executed as a droplet pipeline. It requires GDAL installed separately and a new output directory. Terrain data and no-data must be reviewed in QGIS.

All searches require an explicit submit. Fixed allowlisted provider endpoints, bounded input, numeric parcel IDs, per-request timeouts, partial-source failure states, and client cancellation are used. There is no database persistence; lookups and projects remain in the session. Sample prices, client review actions, Telegram intake, and Hermes remain prototype behavior.

Verified locally with the public Ojai City Hall address: matched PointAddress, selected APN0230090010,8.79 GIS acres, City of Ojai jurisdiction, correctly withheld city zoning,17/17 elevation samples, valid Polygon GeoJSON, live contours, and an empty imported project.21 focused geometry, planning, and GIS tests pass.

Sources: https://gis.ventura.org/arcgis/rest/services/Locator/VenturaCounty_ArcGISProLocator/GeocodeServer ; https://maps.venturacounty.gov/arcgis/rest/services/SDs/Parcels/MapServer/0 ; https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer ; https://rma.venturacounty.gov/divisions/planning/legal-lot-status/ ; https://www.ojai.ca.gov/246/Planning-Zoning-Division ; https://developers.google.com/maps/documentation/embed/embedding-map ; https://qgis.org/ ; https://gdal.org/en/stable/programs/gdal_contour.html .

## Client landscape proposal template

The Client portal now opens as a whole-property proposal inspired by the workflow in [Regrarians' Manna Hill Estate case study](https://www.regrarians.org/manna-hill-estate): survey/context, concept, work quantities, implementation, and ongoing care. The operator workspace and all site-check functions remain available in the tabs.

- Client copy continues to use the frozen shared revision, including geometry, imagery, site records, rates, budget, and schedule. Draft edits do not silently change that copy.
- Aerial/plan views select work areas, then link to the matching numbered scope package. GIS imports also offer contours, sampled terrain metadata, and source links.
- Keyline-informed considerations cover landform, water/access, and vegetation. No keyline layout, keypoint, grade, catchment model, soil result, or legal development envelope is generated.
- Two original AI-generated landscape reference renders illustrate design direction. They are visibly labeled fictional references, are not the selected parcel, and do not establish a particular year or guaranteed outcome. These static assets were generated for this template; there is no live image-generation integration.
- Installation, contingency, and five-year tree care reuse the existing planning model. Print styles include both reference renders. Proposal approval, change requests, and comments remain session-only demo actions.
- Reference assets: `public/keyline-aerial-concept.png` and `public/keyline-established-vision.png`. Regrarians photography and site plan were not copied into the product.
- Design reference sources: https://www.regrarians.org/manna-hill-estate ; https://www.regrarians.org/regrarians-platform ; https://keyline.com.au/detail01.htm .

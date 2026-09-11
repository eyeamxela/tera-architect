export type GeoPoint = [number, number];
export type Extent = [number, number, number, number];
export type AddressMatch = {
  address: string;
  score: number;
  kind: string;
  lon: number;
  lat: number;
};
export type Parcel = {
  containsAddress?: boolean;
  id: number;
  apn: string;
  situs: string | null;
  acres: number | null;
  rings: GeoPoint[][];
};
export type LayerRecord = Record<string, string | number | null>;
export type ProfileSample = {
  distanceFt: number;
  elevationFt: number | null;
  lon: number;
  lat: number;
  resolutionM: number | null;
  source: string | null;
  acquired: string | null;
  datum: string | null;
};
export type SiteAssessment = {
  parcel: Parcel;
  retrievedAt: string;
  bounds: Extent;
  profile: ProfileSample[];
  cities: string[];
  jurisdiction: string;
  zoning: LayerRecord[];
  overlays: LayerRecord[];
  warnings: string[];
  sourceStatus: {
    jurisdiction: boolean;
    zoning: boolean;
    overlays: boolean;
    terrain: boolean;
  };
  imageryUrl: string;
  hillshadeUrl: string;
  contourUrl: string;
  googleEmbedUrl: string | null;
};
export const siteSources = {
  geocoder:
    'https://gis.ventura.org/arcgis/rest/services/Locator/VenturaCounty_ArcGISProLocator/GeocodeServer',
  parcels:
    'https://maps.venturacounty.gov/arcgis/rest/services/SDs/Parcels/MapServer/0',
  cities:
    'https://maps.venturacounty.gov/arcgis/rest/services/SDs/Cities/MapServer/1',
  zoning:
    'https://maps.ventura.org/arcgis/rest/services/SDs/LandUse/MapServer/11',
  overlays:
    'https://maps.ventura.org/arcgis/rest/services/SDs/LandUse/MapServer/10',
  elevation:
    'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
  imagery:
    'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer',
  countyPlanning:
    'https://rma.venturacounty.gov/divisions/planning/county-ordinances/',
  cityPlanning: 'https://www.ojai.ca.gov/246/Planning-Zoning-Division',
  legalLot:
    'https://rma.venturacounty.gov/divisions/planning/legal-lot-status/',
  qgis: 'https://qgis.org/',
  gdal: 'https://gdal.org/en/stable/programs/gdal_contour.html',
};
export function mercator([lon, lat]: GeoPoint): GeoPoint {
  return [
    (lon * 20037508.342789244) / 180,
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 20037508.342789244) /
      Math.PI,
  ];
}
export function unproject([x, y]: GeoPoint): GeoPoint {
  return [
    (x / 20037508.342789244) * 180,
    (Math.atan(Math.exp((y / 20037508.342789244) * Math.PI)) * 360) / Math.PI -
      90,
  ];
}
export function parcelBounds(rings: GeoPoint[][]): Extent {
  const pts = rings.flat().map(mercator);
  if (!pts.length || pts.some((p) => !p.every(Number.isFinite)))
    throw Error('Parcel geometry unavailable');
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let width = Math.max(150, Math.max(...xs) - Math.min(...xs)) * 1.35;
  let height = Math.max(100, Math.max(...ys) - Math.min(...ys)) * 1.35;
  width = Math.max(width, height * 1.5);
  height = width / 1.5;
  return [cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2];
}
export function pixelPoint(point: GeoPoint, bounds: Extent): GeoPoint {
  const [x, y] = mercator(point);
  return [
    ((x - bounds[0]) / (bounds[2] - bounds[0])) * 1200,
    ((bounds[3] - y) / (bounds[3] - bounds[1])) * 800,
  ];
}
export function profilePoints(bounds: Extent, count = 17): GeoPoint[] {
  return Array.from({ length: count }, (_, i) =>
    unproject([
      bounds[0] + ((bounds[2] - bounds[0]) * i) / (count - 1),
      (bounds[1] + bounds[3]) / 2,
    ]),
  );
}
export function feetPerPixel(bounds: Extent): number {
  const [, lat] = unproject([
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
  ]);
  return (
    ((bounds[2] - bounds[0]) * Math.cos((lat * Math.PI) / 180)) / 1200 / 0.3048
  );
}
export function readAcreage(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '')
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function usableZoning(
  zones: LayerRecord[],
  cities: string[],
): LayerRecord[] {
  if (cities.length) return [];
  return zones.filter((z) => String(z.DEFINITION).toLowerCase() !== 'city');
}
export function planningAuthority(a: SiteAssessment): string {
  if (!a.sourceStatus.jurisdiction) return siteSources.cities;
  if (a.cities.includes('Ojai')) return siteSources.cityPlanning;
  return a.cities.length ? siteSources.cities : siteSources.countyPlanning;
}
export function googleMapUrl(address: string): string {
  return (
    'https://www.google.com/maps/search/?' +
    new URLSearchParams({ api: '1', query: address })
  );
}
export function mapImageUrl(
  bounds: Extent,
  layer: 'imagery' | 'hillshade' | 'contours',
): string {
  const params = new URLSearchParams({
    bbox: bounds.join(','),
    bboxSR: '3857',
    imageSR: '3857',
    size: '1200,800',
    format: 'png32',
    f: 'image',
  });
  if (layer === 'imagery') return siteSources.imagery + '/export?' + params;
  params.set(
    'renderingRule',
    JSON.stringify({
      rasterFunction:
        layer === 'contours'
          ? 'Preset 5ft Contour Interval'
          : 'Hillshade Multidirectional',
    }),
  );
  return siteSources.elevation + '/exportImage?' + params;
}

export function containsPoint(point: GeoPoint, rings: GeoPoint[][]): boolean {
  let inside = false;
  const [x, y] = point;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i],
        [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
  return inside;
}

export function demExportUrl(bounds: Extent): string {
  return (
    siteSources.elevation +
    '/exportImage?' +
    new URLSearchParams({
      bbox: bounds.join(','),
      bboxSR: '3857',
      imageSR: '32611',
      size: '1200,800',
      format: 'tiff',
      pixelType: 'F32',
      renderingRule: JSON.stringify({ rasterFunction: 'None' }),
      f: 'image',
    })
  );
}

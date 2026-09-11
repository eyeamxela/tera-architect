import { env } from 'cloudflare:workers';
import {
  apiError,
  readBody,
  parcelQuery,
  parcelFromFeature,
  fetchPublicJSON,
} from '../site-service';
import {
  siteSources,
  parcelBounds,
  profilePoints,
  feetPerPixel,
  mapImageUrl,
  usableZoning,
  type SiteAssessment,
  type ProfileSample,
} from '../../site-data';

export async function POST(request: Request) {
  try {
    const { parcelId } = await readBody(request);
    if (!Number.isInteger(parcelId) || Number(parcelId) < 1)
      return Response.json(
        { error: 'Choose a parcel from the search results.' },
        { status: 400 },
      );
    const parcelData = await parcelQuery({ objectIds: String(parcelId) });
    if (parcelData.features?.length !== 1)
      return Response.json(
        { error: 'Parcel no longer available. Search again.' },
        { status: 404 },
      );
    const parcel = parcelFromFeature(parcelData.features[0]);
    const bounds = parcelBounds(parcel.rings);
    if (bounds[2] - bounds[0] > 25000)
      throw Error(
        'This parcel is too large for the detailed terrain preview. Use the county map or GIS export.',
      );
    const points = profilePoints(bounds);
    const base = {
      f: 'json',
      geometry: JSON.stringify({
        rings: parcel.rings,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      returnGeometry: 'false',
      outFields: '*',
    };
    const layer = (url: string) =>
      fetchPublicJSON(url + '/query', new URLSearchParams(base));
    const sampleParams = new URLSearchParams({
      f: 'json',
      geometry: JSON.stringify({ points, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryMultipoint',
      returnFirstValueOnly: 'true',
      outFields: 'Name,VerticalDatum,AcquisitionDate',
    });
    const checks = await Promise.allSettled([
      layer(siteSources.cities),
      layer(siteSources.zoning),
      layer(siteSources.overlays),
      fetchPublicJSON(siteSources.elevation + '/getSamples?' + sampleParams),
    ]);
    const read = (i: number) =>
      checks[i].status === 'fulfilled'
        ? (checks[i] as PromiseFulfilledResult<any>).value
        : null;
    const cityData = read(0),
      zones = read(1),
      overlays = read(2),
      terrain = read(3);
    const cities = [
      ...new Set<string>(
        (cityData?.features || []).map((f: any) =>
          String(f.attributes.CITY_NAME),
        ),
      ),
    ];
    const zoning = usableZoning(
      (zones?.features || []).map((f: any) => f.attributes),
      cities,
    );
    const warnings: string[] = [];
    ['Jurisdiction', 'Zoning', 'Overlay', 'Terrain'].forEach((name, i) => {
      if (checks[i].status === 'rejected')
        warnings.push(`${name} source unavailable; this check is incomplete.`);
    });
    for (const [name, d] of [
      ['Jurisdiction', cityData],
      ['Zoning', zones],
      ['Overlay', overlays],
    ] as const)
      if (d?.exceededTransferLimit)
        warnings.push(
          `${name} records were truncated; verify complete coverage at the source.`,
        );
    const profile: ProfileSample[] = points.map(([lon, lat], i) => {
      const sample = terrain?.samples?.find((s: any) => s.locationId === i);
      const raw = sample?.value;
      const n =
        raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
      const valid = Number.isFinite(n) && n > -500 && n < 9000;
      const a = sample?.attributes || {};
      return {
        lon,
        lat,
        distanceFt: (feetPerPixel(bounds) * 1200 * i) / (points.length - 1),
        elevationFt: valid ? n / 0.3048 : null,
        resolutionM: Number.isFinite(sample?.resolution)
          ? sample.resolution
          : null,
        source: a.Name || null,
        acquired:
          typeof a.AcquisitionDate === 'number'
            ? new Date(a.AcquisitionDate).toISOString().slice(0, 10)
            : null,
        datum: a.VerticalDatum || null,
      };
    });
    if (profile.some((p) => p.elevationFt === null))
      warnings.push(
        'Some elevation samples are missing; gaps are not interpolated.',
      );
    const key = (env as unknown as Record<string, unknown>)
      .GOOGLE_MAPS_EMBED_API_KEY;
    const center = points[Math.floor(points.length / 2)];
    const assessment: SiteAssessment = {
      parcel,
      bounds,
      profile,
      retrievedAt: new Date().toISOString(),
      cities,
      jurisdiction: cityData
        ? cities.length
          ? cities.join(' / ')
          : 'Unincorporated Ventura County'
        : 'Not confirmed',
      zoning,
      overlays: (overlays?.features || []).map((f: any) => f.attributes),
      warnings,
      sourceStatus: {
        jurisdiction: !!cityData,
        zoning: !!zones,
        overlays: !!overlays,
        terrain: !!terrain,
      },
      imageryUrl: mapImageUrl(bounds, 'imagery'),
      hillshadeUrl: mapImageUrl(bounds, 'hillshade'),
      contourUrl: mapImageUrl(bounds, 'contours'),
      googleEmbedUrl:
        typeof key === 'string' && key
          ? `https://www.google.com/maps/embed/v1/view?${new URLSearchParams({ key, center: `${center[1]},${center[0]}`, zoom: '17', maptype: 'satellite' })}`
          : null,
    };
    return Response.json(assessment, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}

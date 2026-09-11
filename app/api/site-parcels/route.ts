import { containsPoint } from '../../site-data';
import {
  apiError,
  readBody,
  parcelQuery,
  parcelFromFeature,
} from '../site-service';

export async function POST(request: Request) {
  try {
    const { lon, lat } = await readBody(request);
    if (
      typeof lon !== 'number' ||
      typeof lat !== 'number' ||
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lon < -120 ||
      lon > -118.5 ||
      lat < 33 ||
      lat > 35
    )
      return Response.json(
        { error: 'This pilot currently covers Ventura County, California.' },
        { status: 400 },
      );
    const data = await parcelQuery({
      geometry: `${lon},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '70',
      units: 'esriSRUnit_Meter',
    });
    return Response.json(
      {
        parcels: (data.features || [])
          .map(parcelFromFeature)
          .map((p: any) => ({
            ...p,
            containsAddress: containsPoint([lon, lat], p.rings),
          }))
          .sort(
            (a: any, b: any) =>
              Number(b.containsAddress) - Number(a.containsAddress),
          ),
        truncated: !!data.exceededTransferLimit,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}

import { apiError, readBody, parcelQuery } from '../site-service';
export async function POST(request: Request) {
  try {
    const { parcelId } = await readBody(request);
    if (!Number.isInteger(parcelId) || Number(parcelId) < 1)
      return Response.json(
        { error: 'Choose a parcel first.' },
        { status: 400 },
      );
    const data = await parcelQuery({
      objectIds: String(parcelId),
      f: 'geojson',
    });
    if (data.type !== 'FeatureCollection' || data.features?.length !== 1)
      throw Error('Parcel polygon export was unavailable.');
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return apiError(e);
  }
}

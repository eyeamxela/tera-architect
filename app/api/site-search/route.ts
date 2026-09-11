import { siteSources } from '../../site-data';
import { fetchPublicJSON, readBody, apiError } from '../site-service';

export async function POST(request: Request) {
  try {
    const input = await readBody(request);
    const address =
      typeof input.address === 'string' ? input.address.trim() : '';
    if (address.length < 5 || address.length > 240)
      return Response.json(
        {
          error: 'Enter a street number, street, and city (5–240 characters).',
        },
        { status: 400 },
      );
    const q = new URLSearchParams({
      f: 'json',
      SingleLine: address,
      outSR: '4326',
      outFields: 'Match_addr,Addr_type,City',
      maxLocations: '5',
    });
    const data = await fetchPublicJSON(
      siteSources.geocoder + '/findAddressCandidates?' + q,
    );
    const matches = (data.candidates || [])
      .filter(
        (c: any) =>
          Number.isFinite(c.location?.x) &&
          Number.isFinite(c.location?.y) &&
          c.score >= 70,
      )
      .map((c: any) => ({
        address: String(c.address),
        score: c.score,
        kind: String(c.attributes?.Addr_type || 'Address'),
        lon: c.location.x,
        lat: c.location.y,
      }));
    return Response.json(
      { matches, source: siteSources.geocoder },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}

import type { Parcel } from '../site-data';
import { readAcreage, siteSources } from '../site-data';

export async function fetchPublicJSON(url: string, body?: URLSearchParams) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(22000),
    method: body ? 'POST' : 'GET',
    body: body?.toString(),
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
  });
  if (!r.ok)
    throw Error(
      'A public map service is temporarily unavailable. Try again shortly.',
    );
  const j = (await r.json()) as any;
  if (j.error)
    throw Error(
      'A public map service could not complete this lookup. Try again shortly.',
    );
  return j;
}
export async function readBody(request: Request) {
  const raw = await request.text();
  if (raw.length > 1200) throw Error('Request is too large.');
  return JSON.parse(raw) as Record<string, unknown>;
}
export function apiError(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof Error && e.name === 'TimeoutError'
          ? 'The public map service took too long. Please try again.'
          : e instanceof SyntaxError
            ? 'Invalid request.'
            : e instanceof Error
              ? e.message
              : 'Lookup unavailable.',
    },
    { status: 502, headers: { 'Cache-Control': 'no-store' } },
  );
}
export function parcelFromFeature(f: any): Parcel {
  const a = f.attributes;
  if (!Number.isInteger(a?.OBJECTID) || !f.geometry?.rings?.length)
    throw Error('No usable parcel geometry was returned.');
  return {
    id: a.OBJECTID,
    apn: String(a.APN10 || a.APN),
    situs: a.SITUS || null,
    acres: readAcreage(a.ACREAGE),
    rings: f.geometry.rings.map((r: number[][]) => r.map((p) => [p[0], p[1]])),
  };
}
export async function parcelQuery(params: Record<string, string>) {
  const q = new URLSearchParams({
    f: 'json',
    outFields: 'OBJECTID,APN,APN10,SITUS,ACREAGE',
    outSR: '4326',
    returnGeometry: 'true',
    returnZ: 'false',
    resultRecordCount: '12',
    ...params,
  });
  return fetchPublicJSON(siteSources.parcels + '/query?' + q);
}

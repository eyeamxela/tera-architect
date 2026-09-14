import { env } from 'cloudflare:workers';

async function proxy(request: Request) {
  const config = env as unknown as Record<string, string | undefined>;
  const development = import.meta.env.DEV;
  const origin =
    config.BUILD_API_ORIGIN || (development ? 'http://127.0.0.1:4312' : '');
  if (!origin)
    return Response.json(
      { error: 'TERA is not connected to its API yet.' },
      { status: 503 },
    );
  const url = new URL(request.url);
  const headers = new Headers();
  if (Number(request.headers.get('content-length') || 0) > 11 * 1024 * 1024)
    return Response.json(
      { error: 'Files must be 10 MB or smaller.' },
      { status: 413 },
    );
  headers.set(
    'x-build-client-ip',
    request.headers.get('cf-connecting-ip') || 'local',
  );
  for (const name of [
    'content-type',
    'cookie',
    'origin',
    'idempotency-key',
    'x-file-name',
    'x-telegram-bot-api-secret-token',
    'authorization',
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (config.BUILD_PROXY_SECRET)
    headers.set('x-build-proxy-secret', config.BUILD_PROXY_SECRET);
  try {
    const upstream = await fetch(`${origin}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      redirect: 'manual',
      signal: AbortSignal.timeout(40000),
    });
    const responseHeaders = new Headers();
    for (const name of [
      'content-type',
      'content-disposition',
      'set-cookie',
      'x-content-type-options',
    ]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set('cache-control', 'no-store');
    responseHeaders.set('referrer-policy', 'no-referrer');
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        error:
          'The project service is unavailable. Your last saved work is safe.',
      },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;

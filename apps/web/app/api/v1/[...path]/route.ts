import { NextRequest } from 'next/server';

import { API_BASE } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const REQUEST_HEADERS = [
  'content-type',
  'authorization',
  'cookie',
  'range',
  'accept',
  'x-requested-with',
] as const;

const RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-disposition',
  'cache-control',
  'accept-ranges',
  'content-range',
] as const;

async function proxy(req: NextRequest, path: string[]) {
  const dest = `${API_BASE}/api/v1/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  const res = await fetch(dest, {
    method,
    headers,
    body: hasBody ? req.body : undefined,
    cache: 'no-store',
    redirect: 'manual',
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);

  const out = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(method === 'HEAD' ? null : res.body, {
    status: res.status,
    headers: out,
  });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;

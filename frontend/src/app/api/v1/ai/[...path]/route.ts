import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:3021/api/v1/ai';

async function proxy(req: NextRequest, path: string[]) {
  const url = `${BACKEND}/${path.join('/')}${req.nextUrl.search}`;
  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;

  const headers: Record<string, string> = { Cookie: req.headers.get('cookie') ?? '' };
  if (body !== undefined) headers['Content-Type'] = req.headers.get('content-type') ?? 'application/json';

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(120_000),
    });
    const data = await upstream.text();
    return new NextResponse(data, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Error al conectar con el servidor.' }, { status: 503 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}

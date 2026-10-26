import { NextRequest, NextResponse } from 'next/server';
import { verifiedPreviewRole } from '@/lib/auth/internalPreviewEdge';

export async function middleware(request: NextRequest) {
  const role = await verifiedPreviewRole(request.cookies.get('asab_internal_session')?.value, process.env.ASAB_INTERNAL_SESSION_SECRET);
  const response = role ? NextResponse.next() : NextResponse.json({ error: 'Acces rezervat administratorilor si designerilor ASAB.' }, { status: 403 });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie');
  return response;
}
export const config = { matcher: ['/cont/:path*', '/api/portal/:path*', '/models/catalogue/:path*', '/models/catalogue-optimized/:path*', '/models/catalogue-pilot/:path*', '/dev/:path*'] };

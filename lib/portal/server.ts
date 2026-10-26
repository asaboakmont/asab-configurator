/** Server-only portal transport. Never use a service-role key for customer requests.
 * Verified user tokens are forwarded to PostgREST, which enforces database RLS.
 * Login/session refresh and WooCommerce account linking belong to phase 2.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInternalRole } from '@/lib/auth/internalSession';
import { cookies } from 'next/headers';

export class PortalError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function portalSettings() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new PortalError(503, 'Portalul nu este configurat.');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new PortalError(503, 'Configurare portal invalida.'); }
  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.hostname === '127.0.0.1')) {
    throw new PortalError(503, 'Configurare portal invalida.');
  }
  if (key.startsWith('sb_secret_')) throw new PortalError(503, 'Configurare portal invalida.');
  // Legacy anon JWTs are supported, but service_role JWTs must fail closed.
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      if (payload.role !== 'anon') throw new Error('Not an anon key');
    } catch { throw new PortalError(503, 'Configurare portal invalida.'); }
  }
  return { url, key };
}

export function requireInternalPreview(request: NextRequest) {
  if (!getInternalRole(request)) throw new PortalError(403, "Portalul este disponibil momentan numai pentru administrator si designer.");
}

export async function portalSession(request: NextRequest) {
  requireInternalPreview(request);
  const bearer = request.headers.get('authorization');
  if (bearer && !/^Bearer [^\s]+$/i.test(bearer)) throw new PortalError(401, 'Autentificare necesara.');
  const cookieToken = request.cookies.get('asab_portal_access')?.value;
  if (!bearer && !['GET','HEAD','OPTIONS'].includes(request.method)) portalSameOrigin(request);
  let authorization = bearer || (cookieToken ? `Bearer ${cookieToken}` : '');
  if (!authorization && !request.cookies.get('asab_portal_refresh')?.value) throw new PortalError(401, 'Autentificare necesara.');
  const config = portalSettings();
  const headers = { apikey: config.key, Authorization: authorization };
  let response: Response;
  try {
    response = await fetch(`${config.url}/auth/v1/user`, { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  } catch { throw new PortalError(503, 'Serviciul de autentificare este indisponibil.'); }
  if ((response.status === 401 || response.status === 403) && !bearer) {
    const refresh = request.cookies.get('asab_portal_refresh')?.value;
    if (refresh) {
      let session;
      try { session = await portalAuth('token?grant_type=refresh_token', { refresh_token: refresh }); }
      catch (error) { if (error instanceof PortalError && error.status === 400) { portalClearSession(); throw new PortalError(401, 'Sesiune expirata. Autentifica-te din nou.'); } throw error; }
      portalSetSession(session);
      authorization = `Bearer ${session.access_token}`;
      headers.Authorization = authorization;
      response = await fetch(`${config.url}/auth/v1/user`, { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    }
  }
  if (response.status === 401 || response.status === 403) throw new PortalError(401, 'Sesiune expirata sau invalida.');
  if (!response.ok) throw new PortalError(503, 'Serviciul de autentificare este indisponibil.');
  const user = await response.json();
  if (!user?.id || user.is_anonymous === true) throw new PortalError(401, 'Cont autentificat necesar.');
  return {
    user: { id: user.id as string, email: user.email as string | undefined },
    async data<T>(path: string, body?: Record<string, unknown>): Promise<T> {
      let result: Response;
      try {
        result = await fetch(`${config.url}/rest/v1/${path}`, {
          method: body ? 'POST' : 'GET',
          headers: { ...headers, 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
          cache: 'no-store', signal: AbortSignal.timeout(10000),
        });
      } catch { throw new PortalError(503, 'Baza de date este indisponibila.'); }
      if (!result.ok) {
        const error = await result.json().catch(() => ({}));
        if (error.code === '40001') throw new PortalError(409, 'Configuratia a fost modificata. Reincarca proiectul.');
        if (error.code === '42501' || result.status === 403) throw new PortalError(403, 'Acces nepermis.');
        if (['22023', '23514', '23502', '22P02'].includes(error.code)) throw new PortalError(400, 'Date invalide.');
        if (result.status === 401) throw new PortalError(401, 'Sesiune expirata sau invalida.');
        throw new PortalError(503, 'Operatia nu poate fi finalizata.');
      }
      if (result.status === 204 || result.headers.get('content-length') === '0') return undefined as T;
      const content = await result.text();
      return (content ? JSON.parse(content) : undefined) as T;
    },
  };
}

/** PostgREST may wrap a composite-returning function in a one-row array. */
export function portalRow<T>(value: T | T[]): T {
  const row = Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value;
  if (!row || typeof row !== 'object') throw new PortalError(503, 'Raspuns de date invalid.');
  return row;
}
export function portalResponse(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' } });
}
export function portalFailure(error: unknown) {
  return portalResponse({ error: error instanceof PortalError ? error.message : 'Operatia nu poate fi finalizata.' }, error instanceof PortalError ? error.status : 500);
}
export async function portalBody(request: NextRequest): Promise<Record<string, unknown>> {
  // Stream limit also covers requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new PortalError(400, 'Date lipsa.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1048576) { await reader.cancel(); throw new PortalError(413, 'Datele depasesc limita de 1 MB.'); }
      chunks.push(chunk.value);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Invalid object');
    return value;
  } catch (error) {
    if (error instanceof PortalError) throw error;
    throw new PortalError(400, 'Date JSON invalide.');
  } finally { reader.releaseLock(); }
}
export function portalId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new PortalError(400, 'Identificator invalid.');
  return value;
}
export function portalText(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new PortalError(400, 'Text invalid.');
  return value.trim();
}

export function portalOrigin(request: NextRequest): string {
  const configured = process.env.PORTAL_PUBLIC_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV !== 'production' && ['127.0.0.1','localhost'].includes(request.nextUrl.hostname)) return request.nextUrl.origin;
  throw new PortalError(503, 'Adresa portalului nu este configurata.');
}
export function portalSameOrigin(request: NextRequest) {
  if (request.headers.get('origin') !== portalOrigin(request)) throw new PortalError(403, 'Origine nepermisa.');
}
export function portalSetSession(session: { access_token: string; refresh_token: string; expires_in?: number }) {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  cookies().set('asab_portal_access', session.access_token, { ...options, maxAge: session.expires_in || 3600 });
  cookies().set('asab_portal_refresh', session.refresh_token, { ...options, maxAge: 60 * 60 * 24 * 30 });
}
export function portalClearSession() {
  for (const name of ['asab_portal_access','asab_portal_refresh']) cookies().set(name, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}
export async function portalAuth(path: string, body: Record<string, unknown>, accessToken?: string) {
  const config = portalSettings();
  let result: Response;
  try {
    result = await fetch(`${config.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: config.key, 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000) });
  } catch { throw new PortalError(503, 'Serviciul de autentificare este indisponibil.'); }
  if (!result.ok) {
    if (result.status === 429) throw new PortalError(429, 'Prea multe incercari. Asteapta cateva minute.');
    throw new PortalError(result.status >= 500 ? 503 : 400, 'Autentificarea nu a putut fi finalizata. Verifica datele si confirmarea emailului.');
  }
  return result.status === 204 ? {} : result.json();
}

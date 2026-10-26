import { NextRequest, NextResponse } from 'next/server';
import {cookies} from 'next/headers';
import {randomBytes,createHash} from 'crypto';
import { requireInternalPreview, portalAuth, portalBody, portalClearSession, portalFailure, portalOrigin, portalResponse, portalSameOrigin, portalSession, portalSetSession, portalSettings, PortalError } from '@/lib/portal/server';
export const dynamic = 'force-dynamic';
type Context = { params: { action: string } };
const pkceOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/api/portal/auth',maxAge:3600};
function beginEmailFlow(email:string,mode:'signup'|'recovery'){
  const verifier=randomBytes(32).toString('base64url');
  cookies().set('asab_portal_pkce',Buffer.from(JSON.stringify({verifier,email,mode,expires:Date.now()+3600000})).toString('base64url'),pkceOptions);
  return {code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'s256'};
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    requireInternalPreview(request);
    portalSameOrigin(request);
    if (params.action === 'logout') {
      const token = request.cookies.get('asab_portal_access')?.value;
      if (token) await portalAuth('logout?scope=local', {}, token).catch(() => {});
      portalClearSession();
      cookies().set('asab_portal_pkce','',{...pkceOptions,maxAge:0});
      return portalResponse({ ok: true });
    }
    const body = await portalBody(request);
    if (params.action === 'password') {
      await portalSession(request);
      if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) throw new PortalError(400, 'Parola trebuie sa aiba intre 10 si 128 de caractere.');
      const config = portalSettings();
      // Use the refreshed cookie when portalSession rotated it.
      const { cookies } = await import('next/headers');
      const token = cookies().get('asab_portal_access')?.value;
      const response = await fetch(`${config.url}/auth/v1/user`, { method: 'PUT', headers: { apikey: config.key, Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ password: body.password }), cache:'no-store', signal:AbortSignal.timeout(15000) });
      if (!response.ok) throw new PortalError(400, 'Parola nu a putut fi actualizata. Solicita un nou link de resetare.');
      return portalResponse({ ok: true });
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new PortalError(400, 'Introdu o adresa de email valida.');
    if (params.action === 'email') {
      await portalAuth('otp', { email, create_user: true });
      return portalResponse({ sent: true, message: 'Verifica emailul pentru codul de autentificare.' });
    }
    if (params.action === 'verify-email') {
      const token = typeof body.code === 'string' ? body.code.trim() : '';
      if (!/^\d{6,10}$/.test(token)) throw new PortalError(400, 'Introdu codul primit pe email.');
      let session;
      try { session = await portalAuth('verify', { email, token, type: 'email' }); }
      catch (error) {
        if (error instanceof PortalError && error.status === 400) throw new PortalError(400, 'Cod invalid sau expirat. Verifica mesajul sau solicita un cod nou.');
        throw error;
      }
      if (session.user?.email?.toLowerCase() !== email || !session.access_token || !session.refresh_token) throw new PortalError(400, 'Autentificarea nu a putut fi confirmata.');
      portalSetSession(session);
      return portalResponse({ authenticated: true });
    }
    if (params.action === 'forgot') {
      await portalAuth(`recover?redirect_to=${encodeURIComponent(portalOrigin(request)+'/api/portal/auth/confirm')}`, { email,...beginEmailFlow(email,'recovery') });
      return portalResponse({ message: 'Daca adresa are un cont, vei primi instructiunile pe email.' });
    }
    if (params.action !== 'login' && params.action !== 'register') throw new PortalError(404, 'Operatie inexistenta.');
    if (typeof body.password !== 'string' || body.password.length < (params.action === 'register' ? 10 : 1) || body.password.length > 128) throw new PortalError(400, 'Verifica parola. Conturile noi necesita cel putin 10 caractere.');
    const session = await portalAuth(params.action === 'login' ? 'token?grant_type=password' : `signup?redirect_to=${encodeURIComponent(portalOrigin(request)+'/api/portal/auth/confirm')}`, { email, password: body.password, ...(params.action==='register'?beginEmailFlow(email,'signup'):{}) });
    if (session.access_token && session.refresh_token) {
      portalSetSession(session);
      return portalResponse({ authenticated: true });
    }
    return portalResponse({ authenticated: false, message: 'Verifica emailul pentru confirmarea contului, apoi autentifica-te.' });
  } catch (error) { return portalFailure(error); }
}
export async function GET(request: NextRequest, { params }: Context) {
  if (params.action !== 'confirm') return portalResponse({ error: 'Operatie inexistenta.' }, 404);
  try {
    requireInternalPreview(request);
    const code=request.nextUrl.searchParams.get('code');
    if(code){
      const raw=request.cookies.get('asab_portal_pkce')?.value;
      if(!raw)throw new PortalError(400,'Deschide linkul in browserul in care ai inceput.');
      const flow=JSON.parse(Buffer.from(raw,'base64url').toString());
      cookies().set('asab_portal_pkce','',{...pkceOptions,maxAge:0});
      if(flow.expires<Date.now()||typeof flow.verifier!=='string'||!['signup','recovery'].includes(flow.mode))throw new PortalError(400,'Link expirat.');
      const session=await portalAuth('token?grant_type=pkce',{auth_code:code,code_verifier:flow.verifier});
      if(session.user?.email?.toLowerCase()!==flow.email||!session.access_token||!session.refresh_token)throw new PortalError(400,'Cont diferit.');
      portalSetSession(session);
      const response=NextResponse.redirect(new URL(flow.mode==='recovery'?'/cont/resetare':'/cont',portalOrigin(request)));
      response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');
      return response;
    }
    const token = request.nextUrl.searchParams.get('token_hash');
    const type = request.nextUrl.searchParams.get('type');
    if (!token || !['signup','email','recovery'].includes(type || '')) throw new PortalError(400, 'Link invalid.');
    // Confirmation verifies email; ordinary signup does not sign the browser into an unsolicited account.
    const session = await portalAuth('verify', { token_hash: token, type });
    if (type === 'recovery') portalSetSession(session);
    const response = NextResponse.redirect(new URL(type === 'recovery' ? '/cont/resetare' : '/cont/autentificare?confirmed=1', portalOrigin(request)));
    response.headers.set('Cache-Control','no-store'); response.headers.set('Referrer-Policy','no-referrer');
    return response;
  } catch {
    return NextResponse.redirect(new URL('/cont/autentificare?expired=1', portalOrigin(request)));
  }
}

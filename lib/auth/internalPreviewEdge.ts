export async function verifiedPreviewRole(token: string | undefined, secret: string | undefined): Promise<'admin' | 'designer' | null> {
  if (!token || !secret) return null;
  try {
    const [encoded, signature, extra] = token.split('.');
    if (!encoded || !signature || extra !== undefined) return null;
    const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, decode(signature), new TextEncoder().encode(encoded))) return null;
    const payload = JSON.parse(new TextDecoder().decode(decode(encoded)));
    return (payload.role === 'admin' || payload.role === 'designer') && Number.isFinite(payload.expiresAt) && payload.expiresAt > Date.now() ? payload.role : null;
  } catch { return null; }
}

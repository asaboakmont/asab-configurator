import { NextRequest } from 'next/server';
import { portalSession, portalRow, portalResponse, portalFailure, portalBody, portalText } from '@/lib/portal/server';
import type { PortalProfile, PortalMembership } from '@/lib/portal/types';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await portalSession(request);
    const [profiles, memberships] = await Promise.all([
      session.data<PortalProfile[]>(`portal_profiles?id=eq.${session.user.id}&select=*`),
      session.data<PortalMembership[]>(`portal_memberships?user_id=eq.${session.user.id}&active=eq.true&select=*`),
    ]);
    return portalResponse({ user: session.user, profile: profiles[0] ?? null, memberships });
  } catch (error) { return portalFailure(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    const session = await portalSession(request);
    const body = await portalBody(request);
    const profile = portalRow(await session.data<PortalProfile | PortalProfile[]>('rpc/portal_update_profile', {
      p_display_name: portalText(body.displayName, 120), p_phone: portalText(body.phone, 40), p_city: portalText(body.city, 120),
    }));
    return portalResponse({ profile });
  } catch (error) { return portalFailure(error); }
}

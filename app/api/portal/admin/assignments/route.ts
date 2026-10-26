import { NextRequest } from 'next/server';
import { portalSession, portalResponse, portalFailure, portalBody, portalId, PortalError } from '@/lib/portal/server';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const session = await portalSession(request);
    const body = await portalBody(request);
    if (body.remove !== undefined && typeof body.remove !== 'boolean') throw new PortalError(400, 'Operatie invalida.');
    await session.data('rpc/portal_assign_project', {
      p_project_id: portalId(body.projectId), p_organization_id: portalId(body.organizationId), p_user_id: portalId(body.userId), p_remove: body.remove ?? false,
    });
    return portalResponse({ ok: true });
  } catch (error) { return portalFailure(error); }
}

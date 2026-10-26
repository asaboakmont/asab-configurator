import { NextRequest } from 'next/server';
import { portalSession, portalRow, portalResponse, portalFailure, portalBody, portalText, portalId, PortalError } from '@/lib/portal/server';
import type { PortalProject } from '@/lib/portal/types';
export const dynamic = 'force-dynamic';
type Context = { params: { projectId: string } };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const session = await portalSession(request);
    const projects = await session.data<PortalProject[]>(`portal_projects?id=eq.${portalId(params.projectId)}&select=*`);
    if (!projects[0]) throw new PortalError(404, 'Proiect indisponibil.');
    return portalResponse({ project: projects[0] });
  } catch (error) { return portalFailure(error); }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const session = await portalSession(request);
    const body = await portalBody(request);
    const project = portalRow(await session.data<PortalProject | PortalProject[]>('rpc/portal_rename_project', { p_project_id: portalId(params.projectId), p_title: portalText(body.title, 120, true) }));
    return portalResponse({ project });
  } catch (error) { return portalFailure(error); }
}

import { NextRequest } from 'next/server';
import { portalSession, portalRow, portalResponse, portalFailure, portalBody, portalId, PortalError } from '@/lib/portal/server';
import type { ConfigurationRevision, PortalProject } from '@/lib/portal/types';
export const dynamic = 'force-dynamic';
type Context = { params: { projectId: string } };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const session = await portalSession(request);
    const id = portalId(params.projectId);
    const projects = await session.data<PortalProject[]>(`portal_projects?id=eq.${id}&select=id`);
    if (!projects.length) throw new PortalError(404, 'Proiect indisponibil.');
    const rawBefore = request.nextUrl.searchParams.get('before');
    if (rawBefore !== null && !/^[1-9]\d{0,8}$/.test(rawBefore)) throw new PortalError(400, 'Revizie invalida.');
    const revisions = await session.data<ConfigurationRevision[]>(`portal_configuration_revisions?project_id=eq.${id}&select=*&order=revision.desc&limit=10${rawBefore ? `&revision=lt.${rawBefore}` : ''}`);
    return portalResponse({ revisions, nextBefore: revisions.length === 10 ? revisions[9].revision : null });
  } catch (error) { return portalFailure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const session = await portalSession(request);
    const body = await portalBody(request);
    if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 0) throw new PortalError(400, 'Versiune invalida.');
    if (!body.configuration || Array.isArray(body.configuration) || typeof body.configuration !== 'object') throw new PortalError(400, 'Configuratie invalida.');
    const revision = portalRow(await session.data<ConfigurationRevision | ConfigurationRevision[]>('rpc/portal_save_revision', { p_project_id: portalId(params.projectId), p_expected_version: body.expectedVersion, p_configuration: body.configuration }));
    return portalResponse({ revision }, 201);
  } catch (error) { return portalFailure(error); }
}

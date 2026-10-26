import { NextRequest } from 'next/server';
import { portalSession, portalRow, portalResponse, portalFailure, portalBody, portalText, PortalError } from '@/lib/portal/server';
import type { PortalProject } from '@/lib/portal/types';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await portalSession(request);
    const rawOffset = request.nextUrl.searchParams.get('offset') ?? '0';
    if (!/^\d{1,7}$/.test(rawOffset)) throw new PortalError(400, 'Paginare invalida.');
    const projects = await session.data<PortalProject[]>(`portal_projects?select=*&order=updated_at.desc,id.asc&limit=50&offset=${Number(rawOffset)}`);
    return portalResponse({ projects, nextOffset: projects.length === 50 ? Number(rawOffset) + 50 : null });
  } catch (error) { return portalFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const session = await portalSession(request);
    const body = await portalBody(request);
    // Owner always comes from verified auth.uid(), never client input.
    const project = portalRow(await session.data<PortalProject | PortalProject[]>('rpc/portal_create_project', { p_title: portalText(body.title, 120, true) }));
    return portalResponse({ project }, 201);
  } catch (error) { return portalFailure(error); }
}

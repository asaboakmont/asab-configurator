import { NextRequest } from 'next/server';
import { portalSession,portalResponse,portalFailure,PortalError } from '@/lib/portal/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  try{
    const session=await portalSession(request);
    const offset=request.nextUrl.searchParams.get('offset')||'0';
    if(!/^\d{1,7}$/.test(offset))throw new PortalError(400,'Paginare invalida.');
    const projects=await session.data<unknown[]>('rpc/portal_dashboard',{p_offset:Number(offset)});
    return portalResponse({projects,nextOffset:projects.length===50?Number(offset)+50:null});
  }catch(error){return portalFailure(error);}
}

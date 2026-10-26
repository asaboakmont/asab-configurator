import {NextRequest} from 'next/server';
import {portalSession,portalId,portalRow,portalResponse,portalFailure,PortalError} from '@/lib/portal/server';
import type {PortalProject} from '@/lib/portal/types';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:{projectId:string;action:string}}){
 try{
  const session=await portalSession(request);
  const id=portalId(params.projectId);
  if(params.action==='archive'){await session.data('rpc/portal_archive_project',{p_project_id:id});return portalResponse({ok:true});}
  if(params.action==='duplicate'){const project=portalRow(await session.data<PortalProject|PortalProject[]>('rpc/portal_duplicate_project',{p_project_id:id}));return portalResponse({project},201);}
  throw new PortalError(404,'Operatie inexistenta.');
 }catch(error){return portalFailure(error);}
}

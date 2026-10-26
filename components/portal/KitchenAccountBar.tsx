'use client';
import {useEffect,useRef,useState} from 'react';
import {useConfigStore} from '@/store/configuratorStore';
import {kitchenSnapshot,restoreKitchenSnapshot} from '@/lib/portal/kitchenSnapshot';
import {portalFetch} from '@/lib/portal/client';
import {guestEmail,PENDING_KITCHEN_KEY} from '@/lib/portal/guest';
import type {PortalProject} from '@/lib/portal/types';
export default function KitchenAccountBar(){
 const [guest,setGuest]=useState('');
 const store=useConfigStore();const serialized=JSON.stringify(kitchenSnapshot(store));
 const [authenticated,setAuthenticated]=useState(false);const [checked,setChecked]=useState(false);const [project,setProject]=useState<PortalProject|null>(null);const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);const [naming,setNaming]=useState(false);const [title,setTitle]=useState('Bucataria mea');const [paused,setPaused]=useState(false);const [blocked,setBlocked]=useState(false);
 const baseline=useRef('');const current=useRef(serialized);current.current=serialized;const inFlight=useRef(false);const loaded=useRef(false);
 useEffect(()=>{
  let active=true;setGuest(guestEmail(sessionStorage));const q=new URLSearchParams(location.search);const id=q.get('project');if(id)setBlocked(true);
  if(q.get('guestDraft')==='1'){try{const pending=sessionStorage.getItem(PENDING_KITCHEN_KEY);if(pending){const draft=JSON.parse(pending);restoreKitchenSnapshot(draft,useConfigStore.getState());if(['collection','room','dimensions','constraints','sink','hob','dishwasher','hood','style','viewer','cart'].includes(draft.guestStep))useConfigStore.getState().setStep(draft.guestStep);sessionStorage.removeItem(PENDING_KITCHEN_KEY);}}catch{setError('Configuratia locala nu a putut fi restaurata.');}}
  async function init(){
   try{await portalFetch('/api/portal/me');if(!active)return;setAuthenticated(true);
    if(id){setLoading(true);const [data,history]=await Promise.all([portalFetch(`/api/portal/projects/${id}`),portalFetch(`/api/portal/projects/${id}/revisions`)]);if(!active)return;if(history.revisions[0])restoreKitchenSnapshot(history.revisions[0].configuration,useConfigStore.getState());baseline.current=JSON.stringify(kitchenSnapshot(useConfigStore.getState()));setProject(data.project);setTitle(data.project.title);loaded.current=true;setBlocked(false);setSaved(true);}
    else if(q.get('saveDraft')==='1'){
     const pending=sessionStorage.getItem('asab_pending_kitchen');if(pending){restoreKitchenSnapshot(JSON.parse(pending),useConfigStore.getState());setNaming(true);sessionStorage.removeItem('asab_pending_kitchen');}
    }
   }catch(e){if((e as any).status!==401)setError((e as Error).message);else if(id)setError('Autentifica-te pentru a deschide aceasta bucatarie.');}
   finally{if(active){setChecked(true);setLoading(false);}}
  }void init();return()=>{active=false;};
 },[]);
 async function save(snapshot:string=current.current){
  if(inFlight.current||loading||(project&&snapshot===baseline.current))return;inFlight.current=true;setSaving(true);setError('');
  try{
   let target=project;
   if(!target){target=(await portalFetch<{project:PortalProject}>('/api/portal/projects',{title})).project;setProject(target);history.replaceState(null,'',`/?project=${target.id}`);}
   const data=await portalFetch(`/api/portal/projects/${target.id}/revisions`,{expectedVersion:target.version,configuration:JSON.parse(snapshot)});
   baseline.current=snapshot;loaded.current=true;setProject({...target,version:data.revision.revision});setSaved(true);setNaming(false);setPaused(false);
  }catch(e){setPaused(true);setError((e as Error).message);}finally{inFlight.current=false;setSaving(false);}
 }
 useEffect(()=>{
  if(!project||!loaded.current||loading||paused||!['draft','changes_requested'].includes(project.status)||serialized===baseline.current)return;
  setSaved(false);const timer=setTimeout(()=>void save(serialized),2000);return()=>clearTimeout(timer);
  // Save version is updated only after the request completes; this schedules subsequent edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[serialized,project,loading,paused]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(inFlight.current||(project&&current.current!==baseline.current)){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[project]);
 const login=(intent:'save'|'login'|'guest'='save')=>{try{sessionStorage.setItem(PENDING_KITCHEN_KEY,JSON.stringify({...JSON.parse(current.current),guestStep:useConfigStore.getState().step}));}catch{setError('Browserul nu permite pastrarea configuratiei. Activeaza stocarea locala inainte de autentificare.');return;}location.assign('/cont/autentificare?intent='+intent+'&next='+encodeURIComponent('/?saveDraft=1'));};
 const editable=!blocked&&(!project||['draft','changes_requested'].includes(project.status));
 return <><div className="shrink-0 bg-[#f5f0e8] border-b border-asab-warm/30 px-4 py-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs z-40">{authenticated?<a href="/cont" className="min-h-[36px] flex items-center font-medium">Bucatariile mele</a>:<span className="min-h-[36px] flex items-center font-medium">{store.internalRole ? `Portal in test · ${store.internalRole === 'admin' ? 'Administrator' : 'Designer'}` : guest?'Mod vizitator · Email neverificat':'Configureaza fara cont'}</span>}<div className="flex items-center gap-3"><span className="text-asab-stone" role="status">{loading?'Se deschide…':saving?'Se salveaza…':project&&!editable?'Configuratie blocata':project?(saved&&serialized===baseline.current?'Salvat in cont':'Modificari nesalvate'):''}</span><button disabled={!checked||saving||loading||!editable} className="underline disabled:opacity-40 text-xs" onClick={()=>{if(!authenticated)login();else if(!project)setNaming(true);else void save();}}>{project?'Salveaza acum':'Salveaza in cont'}</button>{!authenticated&&checked&&!guest&&<button className="underline text-xs" onClick={()=>login('guest')}>Incepe cu emailul</button>}{!authenticated&&checked&&<button className="underline text-xs" onClick={()=>login('login')}>Intra in cont</button>}</div></div>{error&&<div role="alert" className="shrink-0 px-4 py-2 bg-red-50 text-red-900 text-xs">{error}{project&&<a className="underline ml-2" href={`/?project=${project.id}`}>Reincarca proiectul</a>}</div>}{naming&&<div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-labelledby="save-title"><form className="card w-full max-w-sm" onSubmit={e=>{e.preventDefault();void save();}}><h2 id="save-title" className="font-display text-3xl mb-3">Salveaza bucataria</h2><p className="text-sm text-asab-stone mb-5">Da-i un nume. Modificarile urmatoare se salveaza automat.</p><label className="field-label" htmlFor="kitchen-title">Numele proiectului</label><input id="kitchen-title" className="field" maxLength={120} required autoFocus value={title} onChange={e=>setTitle(e.target.value)}/><button className="btn-primary mt-5" disabled={saving||!title.trim()}>{saving?'Se salveaza…':'Salveaza in cont'}</button><button className="w-full text-sm underline mt-2" type="button" onClick={()=>setNaming(false)} disabled={saving}>Anuleaza</button></form></div>}</>;
}

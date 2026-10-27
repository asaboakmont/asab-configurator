"use client";
import { useState } from 'react';
import type { Cabinet, CabinetBand, Colorway, DesignCollectionId, DesignPieceKind, WallDimensions, WallSide } from '@/types/kitchen';
import { createDesignPiece, freeDesignPiece, designPieceCenter, effectiveCabinetColorway, priceDesignPiece, validateDesignPiece } from '@/lib/asab/designPieces';
import { automaticWorktopSpan, isWorktopSupport, validateWorktopRun } from '@/lib/asab/worktopRuns';
import { COLORWAYS, HANDLE_OPTIONS, WORKTOP_OPTIONS } from '@/data/colorways';

type Props={cabinets:Cabinet[];colorway:Colorway;dimensions:WallDimensions;collection:DesignCollectionId;wall:WallSide;walls:WallSide[];selectedId?:string;className?:string;onCommit:(items:Cabinet[],selected?:Cabinet|null)=>void;onSelect:(c:Cabinet)=>void};
export default function DesignPieceEditor(p:Props){
 const [band,setBand]=useState<CabinetBand>('base'),[newPlacement,setNewPlacement]=useState<'wall'|'free'>('wall'),[error,setError]=useState('');
 const selected=p.cabinets.find(c=>c.id===p.selectedId), finish=selected?effectiveCabinetColorway(selected,p.colorway):p.colorway;
 function save(c:Cabinet){
   const problem=validateDesignPiece(c,p.dimensions);if(problem){setError(problem);return;}
   if(c.designPiece?.replacesRun&&p.cabinets.some(other=>other.id!==c.id&&other.designPiece?.replacesRun===c.designPiece?.replacesRun)){setError('Exista deja un blat care inlocuieste acest tronson.');return;}
   const priced=c.designPiece?priceDesignPiece(c,p.collection):c;
   p.onCommit(p.cabinets.map(item=>item.id===c.id?priced:item),priced);setError('');
 }
 function add(kind:DesignPieceKind){
   let c=createDesignPiece(kind,band,p.wall,crypto.randomUUID());
   if(kind==='worktop'||newPlacement==='free')c=freeDesignPiece(c,p.dimensions);
   // Find the first free slot at the same elevation, without shifting existing cabinets.
   else {
     const length=p.wall==='A'?p.dimensions.wallA:p.dimensions.wallB??220;
     let found=false;
     for(let x=0;x+c.width<=length;x+=.1){
       const bottom=c.mountHeightCm??0;
       if(!p.cabinets.some(other=>other.placementMode!=='free'&&other.wall===c.wall&&x<other.xPos+other.width&&x+c.width>other.xPos&&bottom<(other.mountHeightCm??(other.type.startsWith('wall')?220-other.height:0))+other.height&&bottom+c.height>(other.mountHeightCm??(other.type.startsWith('wall')?220-other.height:0)))){c.xPos=Math.round(x*10)/10;found=true;break;}
     }
     if(!found){setError('Nu exista spatiu liber pe peretele selectat. Alegeti amplasare Libera pentru o piesa independenta sau alegeti alt perete.');return;}
   }
   const problem=validateDesignPiece(c,p.dimensions);if(problem){setError(problem);return;}
   c=priceDesignPiece(c,p.collection);p.onCommit([...p.cabinets,c],c);p.onSelect(c);setError('');
 }
 function override(value:Partial<Colorway>){if(selected)save({...selected,finishOverride:{...selected.finishOverride,...value}});}
 return <details className={p.className??'rounded-xl border bg-white p-3'}>
  <summary className="cursor-pointer text-sm font-semibold">Piese si finisaje individuale{p.cabinets.some(c=>c.pricePending)?" · preturi de confirmat":""}</summary>
  <div className="space-y-3 pt-3 text-xs">
   <label className="block">Inaltime piese noi<select aria-label="Gama piesei" value={band} onChange={e=>setBand(e.target.value as CabinetBand)} className="mt-1 w-full rounded border p-2"><option value="base">Inferioare · 862 mm</option><option value="wall">Suspendate · 700 mm, cota 1500</option><option value="tall">Coloane · 2200 mm</option></select></label>
   <label className="block">Amplasare piese noi<select aria-label="Amplasare piese noi" value={newPlacement} onChange={e=>{setNewPlacement(e.target.value as 'wall'|'free');setError('');}} className="mt-1 w-full rounded border p-2"><option value="wall">La perete</option><option value="free">Libera · in camera</option></select></label>
   <p>Perete {p.wall}. Filler frontal / panou lateral pe intreaga inaltime. Dimensiunile pot fi ajustate dupa adaugare.</p>
   <div className="flex flex-wrap gap-2">{(['filler','end-panel','worktop'] as const).map(kind=><button key={kind} type="button" onClick={()=>add(kind)} className="rounded border px-2 py-2 font-semibold">{kind==='filler'?'+ Filler':kind==='end-panel'?'+ Panou lateral':'+ Blat liber'}</button>)}</div>
   <label className="block">Selecteaza piesa / corp<select aria-label="Piesa pentru finisaj" value={selected?.id??''} onChange={e=>{const c=p.cabinets.find(c=>c.id===e.target.value);if(c){p.onSelect(c);setError('');}}} className="mt-1 w-full rounded border p-2"><option value="">Alegeti un corp</option>{p.cabinets.map((c,i)=><option key={c.id??i} value={c.id}>{i+1}. {c.label??c.sku} · {c.wall}</option>)}</select></label>
   {selected&&<>
    <p className="break-all font-semibold">{selected.displaySku??selected.sku}</p>
    {selected.designPiece&&<form key={`${selected.id}-${selected.width}-${selected.height}-${selected.depth}-${selected.mountHeightCm}-${selected.placementMode}-${selected.xPos}-${selected.freePosition?.x}-${selected.freePosition?.z}-${selected.rotationYDegrees}`} onSubmit={e=>{
      e.preventDefault();const f=new FormData(e.currentTarget),mode=String(f.get('mode')) as 'wall'|'free';
      const c={...selected,width:Number(f.get('width'))/10,height:Number(f.get('height'))/10,depth:Number(f.get('depth'))/10,mountHeightCm:Number(f.get('bottom'))/10,xPos:Number(f.get('along'))/10,placementMode:mode,rotationYDegrees:Number(f.get('rotation')) as 0|90|180|270,
       freePosition:mode==='free'?{x:Number(f.get('x'))/10,z:Number(f.get('z'))/10}:undefined,
       manualPrice:String(f.get('price')).trim()===''?undefined:Number(f.get('price')),
       designPiece:{...selected.designPiece!,replacesRun:(String(f.get('replaces'))||undefined) as WallSide|undefined}};
      if((c.width!==selected.width||c.height!==selected.height||c.depth!==selected.depth)&&c.manualPrice===selected.manualPrice)c.manualPrice=undefined;
      save(c);
    }} className="space-y-2 rounded border p-2">
     <p className="font-semibold">Dimensiuni si pozitie (mm)</p>
     {selected.placementMode==='free'&&selected.freePosition&&<div><p className="mb-1">Muta imediat cu 50 mm (axe camera)</p><div className="grid grid-cols-4 gap-1">{([['-X',-5,0],['+X',5,0],['-Z',0,-5],['+Z',0,5]] as const).map(([label,dx,dz])=><button key={label} type="button" aria-label={`Muta piesa ${label}`} onClick={()=>save({...selected,freePosition:{x:selected.freePosition!.x+dx,z:selected.freePosition!.z+dz}})} className="rounded border p-2 font-semibold">{label}</button>)}</div></div>}
     <p className="text-gray-500">X/Z reprezinta centrul in camera. Introduceti coordonatele si apasati Aplica pentru pozitionare exacta.</p>
     <div className="grid grid-cols-2 gap-2">{([['width','Latime',selected.width],['height','Inaltime',selected.height],['depth','Adancime',selected.depth],['bottom','Cota inferioara',selected.mountHeightCm??0],['along','Distanta pe perete',selected.xPos],['x','Centru X liber',designPieceCenter(selected,p.dimensions.wallA).x],['z','Centru Z liber',designPieceCenter(selected,p.dimensions.wallA).z]] as const).map(([name,label,value])=><label key={name}>{label}<input aria-label={`${label} piesa`} name={name} type="number" required step="1" defaultValue={Math.round(value*10)} className="w-full rounded border p-1.5" /></label>)}</div>
     <label className="block">Amplasare<select name="mode" aria-label="Amplasare piesa" defaultValue={selected.placementMode??'wall'} onChange={e=>{
       const mode=e.target.value as 'wall'|'free',center=designPieceCenter(selected,p.dimensions.wallA);
       save({...selected,placementMode:mode,freePosition:mode==='free'?{x:center.x,z:center.z}:undefined,rotationYDegrees:center.rotationYDegrees});
     }} className="w-full rounded border p-2"><option value="wall">La perete {selected.wall}</option><option value="free">Libera</option></select></label>
     <label className="block">Rotatie libera<select name="rotation" defaultValue={selected.rotationYDegrees??0} className="w-full rounded border p-2">{[0,90,180,270].map(n=><option key={n} value={n}>{n}°</option>)}</select></label>
     {selected.designPiece.kind==='worktop'&&<label className="block">Inlocuieste blatul automat<select name="replaces" aria-label="Inlocuieste blatul automat" defaultValue={selected.designPiece.replacesRun??''} className="w-full rounded border p-2"><option value="">Nu · blat suplimentar</option>{p.walls.map(w=><option key={w} value={w}>Perete {w}</option>)}</select></label>}
     <label className="block">Pret manual TVA inclus (RON)<input name="price" aria-label="Pret manual piesa" type="number" min="0" step="0.01" defaultValue={selected.manualPrice??''} placeholder="Gol = pret stoc sau de confirmat" className="w-full rounded border p-2" /></label>
     <p>{selected.pricingNote}</p>
     <button className="rounded bg-gray-900 px-3 py-2 font-semibold text-white">Aplica dimensiuni si pozitie</button>
     <p className="text-gray-500">Pozitionarea libera necesita verificarea coliziunilor in plan. Blaturile independente se factureaza separat; puteti inlocui explicit un tronson automat.</p>
    </form>}
    <label className="block">Finisaj individual<select aria-label="Finisaj individual" value={selected.finishOverride?.id??''} onChange={e=>{const c=COLORWAYS.find(c=>c.id===e.target.value);if(c)override({id:c.id,name:c.name,doorHex:c.doorHex,finish:c.finish});else save({...selected,finishOverride:undefined});}} className="w-full rounded border p-2"><option value="">Mosteneste finisajul bucatariei</option>{COLORWAYS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-2"><label>Culoare front / panou<input aria-label="Culoare individuala front" type="color" value={finish.doorHex} onChange={e=>override({doorHex:e.target.value})} className="block w-full" /></label><label>Culoare carcasa<input aria-label="Culoare individuala carcasa" type="color" value={finish.carcassHex} onChange={e=>override({carcassHex:e.target.value})} className="block w-full" /></label></div>
    <label className="block">Feronerie individuala<select aria-label="Feronerie individuala" value={selected.finishOverride?.handle??''} onChange={e=>{const h=HANDLE_OPTIONS.find(h=>h.id===e.target.value);save({...selected,finishOverride:{...selected.finishOverride,handle:h?.id,handleHex:h?.hex}});}} className="w-full rounded border p-2"><option value="">Mosteneste</option>{HANDLE_OPTIONS.map(h=><option key={h.id} value={h.id}>{h.label}</option>)}</select></label>
    <label className="block">{selected.designPiece?.kind==='worktop'?'Finisaj blat individual':'Finisaj blat automat pe acest perete'}<select aria-label="Finisaj blat selectat" value={(selected.designPiece?.kind==='worktop'?selected.finishOverride?.worktop:selected.runWorktopOverride?.worktop)??''} onChange={e=>{
      const w=WORKTOP_OPTIONS.find(w=>w.id===e.target.value);
      if(selected.designPiece?.kind==='worktop'){save({...selected,finishOverride:{...selected.finishOverride,worktop:w?.id,worktopHex:w?.hex}});}
      else p.onCommit(p.cabinets.map(c=>c.wall===selected.wall&&c.type.startsWith('base')?{...c,runWorktopOverride:w?{worktop:w.id,worktopHex:w.hex}:undefined}:c),selected);
    }} className="w-full rounded border p-2"><option value="">Mosteneste</option>{WORKTOP_OPTIONS.map(w=><option key={w.id} value={w.id}>{w.label}</option>)}</select></label>
    <button type="button" onClick={()=>save({...selected,finishOverride:undefined})} className="underline">Reseteaza finisajul individual</button>
    {selected.designPiece&&<button type="button" onClick={()=>p.onCommit(p.cabinets.filter(c=>c.id!==selected.id),null)} className="ml-3 text-red-700 underline">Elimina piesa</button>}
   </>}
   {p.cabinets.some(c=>c.pricePending)&&<p role="status" className="rounded bg-amber-50 p-2 text-amber-900">Total partial: exista piese cu pret de confirmat. Completati pretul manual inaintea ofertei finale.</p>}
   {error&&<p role="alert" className="text-red-700">{error}</p>}
  </div>
 </details>;
}

export function WallWorktopEditor(p:Props){
 const [error,setError]=useState('');
 return <details className={p.className??"rounded-xl border bg-white p-3"}><summary className="cursor-pointer text-sm font-semibold">Dimensiuni blat pe perete</summary><div className="space-y-2 pt-2">{p.walls.map(wall=>{
   const span=automaticWorktopSpan(p.cabinets,wall);if(!span)return null;
   const replaced=p.cabinets.some(c=>c.designPiece?.replacesRun===wall);
   return <form key={`${wall}-${span.startCm}-${span.lengthCm}-${span.depthCm}-${span.thicknessCm}-${span.manualPrice}-${span.custom}`} onSubmit={e=>{
    e.preventDefault();const data=new FormData(e.currentTarget),startCm=Number(data.get('start'))/10,lengthCm=Number(data.get('length'))/10,depthCm=Number(data.get('depth'))/10,thicknessCm=Number(data.get('thickness'))/10,manualPrice=String(data.get('price')).trim()===''?undefined:Number(data.get('price'));
    const problem=validateWorktopRun(startCm,lengthCm,wall==='A'?p.dimensions.wallA:wall==='I'?p.dimensions.wallA:p.dimensions.wallB??220,depthCm,thicknessCm,wall==='A'||wall==='I'?p.dimensions.wallB??220:p.dimensions.wallA,manualPrice);
    if(problem){setError(problem);return;}
    p.onCommit(p.cabinets.map(c=>c.wall===wall&&isWorktopSupport(c)?{...c,runWorktopDimensions:{startCm,lengthCm,depthCm,thicknessCm,manualPrice}}:c));setError('');
   }} className="space-y-2 rounded bg-gray-50 p-2">
    <p className="font-semibold">Perete {wall} · dimensiuni in mm{span.custom?' · manual':' · automat'}{replaced?' · inlocuit de blat independent':''}</p>
    <div className="grid grid-cols-2 gap-2"><label>Inceput<input aria-label={`Inceput blat ${wall}`} name="start" type="number" step="1" required defaultValue={Math.round(span.startCm*10)} className="w-full rounded border p-1" /></label><label>Lungime<input aria-label={`Lungime blat ${wall}`} name="length" type="number" step="1" min="1" required defaultValue={Math.round(span.lengthCm*10)} className="w-full rounded border p-1" /></label></div>
    <div className="grid grid-cols-2 gap-2"><label>Adancime<input aria-label={`Adancime blat ${wall}`} name="depth" type="number" step="1" min="1" required defaultValue={Math.round(span.depthCm*10)} className="w-full rounded border p-1" /></label><label>Grosime<input aria-label={`Grosime blat ${wall}`} name="thickness" type="number" step="1" min="1" required defaultValue={Math.round(span.thicknessCm*10)} className="w-full rounded border p-1" /></label></div>
    <label className="block">Pret manual tronson TVA inclus (RON)<input aria-label={`Pret manual blat ${wall}`} name="price" type="number" min="0" step="0.01" defaultValue={span.manualPrice??''} placeholder="Gol = pret stoc / de confirmat" className="w-full rounded border p-1" /></label>
    {(span.depthCm>60||Math.abs(span.thicknessCm-3.8)>.001)&&span.manualPrice==null&&<p role="status" className="rounded bg-amber-50 p-2 text-amber-900">Blat {wall}: pret de confirmat. Totalul este partial.</p>}
    <div className="flex gap-2"><button className="rounded border bg-white p-2" disabled={replaced}>Aplica blat {wall}</button><button type="button" className="underline" onClick={()=>{p.onCommit(p.cabinets.map(c=>c.wall===wall?{...c,runWorktopDimensions:undefined}:c));setError('');}}>Automat {wall}</button></div>
   </form>;
 })}<p>Stoc: adancime pana la 600 mm si grosime 38 mm. Alte dimensiuni necesita pret manual pe tronson; pana atunci, totalul este partial.</p><p>In modul automat, blatul urmareste corpurile inferioare, fillerele si panourile laterale. Modificarea manuala ramane pana la resetarea pe Automat. Racordul de colt este dedus o singura data la pret.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}</div></details>;
}

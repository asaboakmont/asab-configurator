"use client";
import type { Cabinet, Colorway, DesignCollectionId } from '@/types/kitchen';
import { designPieceCenter } from '@/lib/asab/designPieces';
import { cabinetExportData, cabinetObjectName } from '@/lib/asab/exportGLB';
import * as THREE from 'three';
import { useMemo, useEffect } from 'react';
import { Edges } from '@react-three/drei';

export default function DesignPieceMesh({cabinet:c,colorway,wallA,collection,editMode,selected,onSelect}:{cabinet:Cabinet;colorway:Colorway;wallA:number;collection:DesignCollectionId;editMode?:boolean;selected?:boolean;onSelect?:()=>void}) {
  const center=designPieceCenter(c,wallA),top=c.designPiece?.kind==='worktop';
  // Scene uses decimetres. Solid boards have their own export root and no invented interiors/hardware.
  return <group name={cabinetObjectName(c)} userData={cabinetExportData(c,colorway,collection)} position={[center.x*.1,((c.mountHeightCm??0)+c.height/2)*.1,center.z*.1]} rotation={[0,center.rotationYDegrees*Math.PI/180,0]}>
    <mesh name={top?'worktop':'panel'} castShadow receiveShadow onClick={event=>{if(editMode){event.stopPropagation();onSelect?.();}}}>
      <boxGeometry args={[c.width*.1,c.height*.1,c.depth*.1]} />
      {top ? <BoardMaterial colorway={colorway} /> : <meshStandardMaterial color={colorway.doorHex} roughness={colorway.finish==='lucios'?.22:.65} />}
      {editMode && selected && <Edges threshold={20} color="#e49d28" lineWidth={0.8} transparent opacity={0.65} depthWrite={false} userData={{excludeFromGLB:true}} />}
    </mesh>
  </group>;
}

function BoardMaterial({colorway:c}:{colorway:Colorway}) {
 const texture=useMemo(()=>{
  const map=new THREE.TextureLoader().load(c.worktop==='stejar'||c.worktop==='darkwood'?'/textures/worktop-stejar.jpg':c.worktop==='white-stone'?'/textures/whitestone.webp':'/textures/worktop-piatra.jpg');
  map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,1);return map;
 },[c.worktop]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <meshStandardMaterial map={texture} color={c.worktop==='stejar'?'#d4b896':c.worktop==='darkwood'?'#3f3328':c.worktop==='white-stone'?'#faf8f2':'#7a7570'} roughness={.82} />;
}

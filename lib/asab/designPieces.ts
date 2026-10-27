import type { Cabinet, CabinetBand, Colorway, DesignCollectionId, DesignPieceKind, WallSide } from '@/types/kitchen';

const bands = { base: {height:86.2,bottom:0,depth:52.8}, wall:{height:70,bottom:150,depth:31.8}, tall:{height:220,bottom:0,depth:57.8} };
const names = { filler:'Filler frontal', 'end-panel':'Panou lateral', worktop:'Blat independent' };
/** A base filler starts on the same Z plane (560 mm) as the dishwasher front. */
export function createDesignPiece(kind:DesignPieceKind, band:CabinetBand, wall:WallSide, id:string):Cabinet {
  if(kind==='worktop')band='base';
  const spec=bands[band];
  return {id,sku:'',type:kind==='worktop'?'accessory':'panel',wall,xPos:0,
    width:kind==='filler'?5:kind==='end-panel'?1.8:120,
    height:kind==='worktop'?3.8:spec.height,
    depth:kind==='filler'?1.8:kind==='end-panel'?spec.depth:60,
    mountHeightCm:kind==='worktop'?86.2:spec.bottom,
    designPiece:{kind,band},label:names[kind],price:0,pricePending:true};
}
/** Start free pieces in the room, independently of occupied wall slots. */
export function freeDesignPiece(c:Cabinet, room:{wallA:number;wallB?:number}):Cabinet {
  return {...c,placementMode:'free',freePosition:{x:room.wallA/2,z:(room.wallB??220)/2},rotationYDegrees:0};
}
export function priceDesignPiece(c:Cabinet, collection:DesignCollectionId):Cabinet {
  if(!c.designPiece)return c;
  const {kind}=c.designPiece;
  const band=kind==='worktop'?'base':c.designPiece.band;
  const code=kind==='filler'?'FIL':kind==='end-panel'?'END':'BLAT';
  const size=[c.width,c.height,c.depth].map(n=>String(Math.round(n*10)).padStart(4,'0')).join('X');
  const sku=`ASAB-${code}-${band.toUpperCase()}-${size}-${collection.toUpperCase()}`;
  const stock=kind==='worktop'&&c.width<=410&&c.depth<=60&&Math.abs(c.height-3.8)<.001;
  const price=c.manualPrice??(stock?(c.width<=205?370:740):undefined);
  return {...c,designPiece:{...c.designPiece,band},sku,baseSku:sku,displaySku:sku,price:price??0,pricePending:price==null,
    label:`${names[kind]} ${band} ${Math.round(c.width*10)} mm`,priceSource:'custom',
    pricingNote:price==null?'Pret de confirmat; exclus din totalul partial.':c.manualPrice!=null?'Pret manual TVA inclus, confirmat de proiectant.':`Blat separat: ${c.width<=205?'1/2 placa 2050':'1 placa 4100'} x 600 x 38 mm. ${c.width<=205?370:740} RON TVA inclus.`};
}
export function effectiveCabinetColorway(c:Cabinet, base:Colorway):Colorway {
  return {...base,...Object.fromEntries(Object.entries(c.finishOverride??{}).filter(([,value])=>value!=null))};
}
export function designPieceCenter(c:Cabinet, wallA:number):{x:number;z:number;rotationYDegrees:0|90|180|270} {
  if(c.placementMode==='free'&&c.freePosition)return {...c.freePosition,rotationYDegrees:c.rotationYDegrees??0};
  const gap=designPieceWallGapCm(c);
  const distance=gap+c.depth/2,along=c.xPos+c.width/2;
  if(c.wall==='B'||(c.wall==='P'&&c.runSide==='left'))return {x:distance,z:along,rotationYDegrees:90};
  if(c.wall==='C'||c.wall==='P')return {x:wallA-distance,z:along,rotationYDegrees:270};
  return {x:along,z:c.wall==='I'?(c.zPos??140):distance,rotationYDegrees:0};
}
export function validateDesignPiece(c:Cabinet, room:{wallA:number;wallB?:number;height:number}):string|undefined {
  if(!c.designPiece)return;
  if(![c.width,c.height,c.depth,c.mountHeightCm??0,c.xPos].every(Number.isFinite)||Math.min(c.width,c.height,c.depth)<=0)return 'Introduceti dimensiuni pozitive, finite.';
  if(c.width>600||c.depth>300||c.height>350)return 'Dimensiuni prea mari (maxim L 6000 / A 3000 / H 3500 mm).';
  const bottom=c.mountHeightCm??0;
  if(bottom<0||bottom+c.height>room.height+.001)return 'Piesa depaseste inaltimea camerei.';
  const center=designPieceCenter(c,room.wallA),turned=center.rotationYDegrees===90||center.rotationYDegrees===270;
  if(!Number.isFinite(center.x)||!Number.isFinite(center.z))return 'Pozitia trebuie sa fie un numar finit.';
  const halfX=(turned?c.depth:c.width)/2,halfZ=(turned?c.width:c.depth)/2;
  if(center.x-halfX<-.001||center.x+halfX>room.wallA+.001||center.z-halfZ<-.001||center.z+halfZ>(room.wallB??220)+.001)return 'Piesa depaseste limitele camerei.';
  if(c.manualPrice!=null&&(!Number.isFinite(c.manualPrice)||c.manualPrice<0))return 'Pretul trebuie sa fie pozitiv sau zero.';
}

/** Back-plane offset, shared with editor footprints. */
export function designPieceWallGapCm(c:Pick<Cabinet,'type'> & Partial<Pick<Cabinet,'designPiece'|'depth'>>):number {
 const band=c.designPiece?.band??'base';
 if(c.designPiece?.kind==='filler')return band==='base'?56:(band==='wall'?33.3:57.8)-(c.depth??1.8);
 return band==='wall'?1.5:band==='base'?5:0;
}

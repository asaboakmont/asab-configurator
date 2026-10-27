import type { Cabinet, WallSide } from '@/types/kitchen';
export function isWorktopSupport(c:Cabinet):boolean {
 return c.placementMode!=='free' && (c.type?.startsWith('base') || c.designPiece?.band==='base' && ['filler','end-panel'].includes(c.designPiece.kind));
}
/** Physical run envelope. Fillers/end panels extend the same top as the adjacent bases. */
export function automaticWorktopSpan(cabinets:Cabinet[],wall:WallSide) {
 const supports=cabinets.filter(c=>c.wall===wall&&isWorktopSupport(c));
 if(!supports.length)return undefined;
 const custom=supports.find(c=>c.runWorktopDimensions)?.runWorktopDimensions;
 const cornerAllowance=(wall==='B'||wall==='C')&&supports.some(c=>c.type==='base-corner')?5:0;
 const startCm=custom?.startCm??Math.min(...supports.map(c=>c.xPos)) - cornerAllowance;
 const lengthCm=custom?.lengthCm??Math.max(...supports.map(c=>c.xPos+c.width))-startCm;
 return {startCm,lengthCm,depthCm:custom?.depthCm??60,thicknessCm:custom?.thicknessCm??3.8,manualPrice:custom?.manualPrice,custom:!!custom};
}
export function validateWorktopRun(startCm:number,lengthCm:number,wallLengthCm:number,depthCm=60,thicknessCm=3.8,roomDepthCm=300,manualPrice?:number):string|undefined {
 if(!Number.isFinite(depthCm)||!Number.isFinite(thicknessCm)||depthCm<=0||depthCm>Math.min(300,roomDepthCm)||thicknessCm<=0||thicknessCm>30)return 'Adancimea trebuie sa incapa in camera (maxim 3000 mm), iar grosimea trebuie sa fie intre 1 si 300 mm.';
 if(manualPrice!=null&&(!Number.isFinite(manualPrice)||manualPrice<0))return 'Pretul manual trebuie sa fie pozitiv sau zero.';
 if(!Number.isFinite(startCm)||!Number.isFinite(lengthCm)||startCm< -5||lengthCm<=0||startCm+lengthCm>wallLengthCm+.001)return 'Tronsonul trebuie sa aiba lungime pozitiva si sa se incadreze pe perete (maxim 50 mm racord la colt).';
}

/** Base design pieces extend the recessed plinth just as they extend the top.
 * Keep ordinary cabinet eligibility unchanged; free pieces never extend a wall run.
 */
export function isPlinthSupport(c: Cabinet): boolean {
 if (c.placementMode === 'free') return false;
 if (c.designPiece) return c.designPiece.band === 'base' && ['filler', 'end-panel'].includes(c.designPiece.kind);
 return !['wall', 'wall-corner', 'wall-hood'].includes(c.type);
}

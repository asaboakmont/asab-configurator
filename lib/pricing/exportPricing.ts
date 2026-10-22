import type { Cabinet, LayoutType, WallDimensions } from "@/types/kitchen";
export const WORKTOP_RON_PER_CM = 740 / 410;
export const FULL_WORKTOP_CM = 410, HALF_WORKTOP_CM = 205;
export const FULL_WORKTOP_PRICE = 740, HALF_WORKTOP_PRICE = 370;
const money = (value: number) => Math.round(value * 100) / 100;
export function worktopProduct(style: string) {
  return ({ stejar: { label: "Blat stejar", sku: "BL-STEJAR" }, "gri-piatra": { label: "Blat gri piatra", sku: "BL-GRIS" }, darkwood: { label: "Blat darkwood", sku: "BL-DARKWOOD" }, "white-stone": { label: "Blat white stone", sku: "BL-WHITE-STONE" } } as Record<string,{label:string;sku:string}>)[style] ?? { label: "Blat stejar", sku: "BL-STEJAR" };
}
/** Pack continuous cuts into stock. A 205 cm half-board cannot supply a longer piece. */
export function allocateWorktopBoards(lengths: number[]) {
  const pieces: number[] = [];
  for(const length of lengths){let remaining=Math.ceil(Math.max(0,length)*100-1e-8);while(remaining>41000){pieces.push(41000);remaining-=41000;}if(remaining>0)pieces.push(remaining);}
  pieces.sort((a,b)=>b-a);
  type Bin = { capacity: number; used: number; cuts: number[] };
  let best: Bin[] = pieces.map(p=>({capacity:p<=20500?20500:41000,used:p,cuts:[p]}));
  let bestCost=best.reduce((sum,b)=>sum+b.capacity/20500,0);
  const search=(index:number,bins:Bin[],cost:number)=>{
    if(cost>bestCost)return;
    if(index===pieces.length){if(cost<bestCost||cost===bestCost&&bins.length<best.length){bestCost=cost;best=bins.map(b=>({...b,cuts:[...b.cuts]}));}return;}
    const piece=pieces[index],seen=new Set<string>();
    for(let i=0;i<bins.length;i++){
      const b=bins[i],key=`${b.capacity}:${b.used}`;if(seen.has(key))continue;seen.add(key);
      const used=b.used+piece;if(used>41000)continue;
      const capacity=used<=b.capacity?b.capacity:41000;
      const previous={...b,cuts:[...b.cuts]};bins[i]={capacity,used,cuts:[...b.cuts,piece]};
      search(index+1,bins,cost+(capacity-b.capacity)/20500);bins[i]=previous;
    }
    const capacity=piece<=20500?20500:41000;bins.push({capacity,used:piece,cuts:[piece]});search(index+1,bins,cost+capacity/20500);bins.pop();
  };
  search(0,[],0);
  const fullWorktops=best.filter(b=>b.capacity===41000).length,halfWorktops=best.filter(b=>b.capacity===20500).length;
  return { fullWorktops,halfWorktops,stockLengthCm:fullWorktops*410+halfWorktops*205,boards:best.map(b=>({lengthCm:b.capacity/100,cutsCm:b.cuts.map(c=>c/100)})) };
}

/** Shared stock-board billing for the viewer, PDF and PowerPoint. */
export function calculateExportPricing(cabinets: Cabinet[], layout: LayoutType, dimensions: WallDimensions) {
  const tallA=cabinets.filter(c=>c.wall==="A"&&c.placementMode!=="free"&&c.type?.startsWith("tall")).reduce((s,c)=>s+c.width,0);
  const tallReturn=cabinets.filter(c=>(c.wall==="B"||c.wall==="C")&&c.placementMode!=="free"&&c.type?.startsWith("tall")).reduce((s,c)=>s+c.width,0);
  const a=Math.max(0,dimensions.wallA-tallA),b=layout==="l-shape"?Math.max(0,(dimensions.wallB??0)-tallReturn):0;
  const island=cabinets.filter(c=>c.wall==="I"&&c.type?.startsWith("base")).reduce((s,c)=>s+c.width,0);
  const peninsula=cabinets.filter(c=>c.wall==="P"&&c.type?.startsWith("base")).reduce((s,c)=>s+c.width,0);
  const islandLength=(layout==="island"||dimensions.hasIsland)?(island||dimensions.islandWidth||0):island;
  const peninsulaLength=layout==="peninsula"?(peninsula||dimensions.peninsulaWidth||0):peninsula;
  const overlap=a>0&&b>0?Math.min(60,a,b):0;
  const worktopCuts=[{run:"A",lengthCm:a},{run:dimensions.cornerSide==="left"?"B":"C",lengthCm:b-overlap},{run:"Insula",lengthCm:islandLength},{run:"Peninsula",lengthCm:peninsulaLength}].filter(c=>c.lengthCm>0);
  const worktopLengthCm=money(worktopCuts.reduce((s,c)=>s+c.lengthCm,0));
  const allocation=allocateWorktopBoards(worktopCuts.map(c=>c.lengthCm));
  const worktopPrice=allocation.fullWorktops*FULL_WORKTOP_PRICE+allocation.halfWorktops*HALF_WORKTOP_PRICE;
  const cabinetSubtotal=money(cabinets.reduce((s,c)=>s+(c.price??0),0));
  const worktopDescription=[allocation.fullWorktops?`${allocation.fullWorktops} x 410 cm`:"",allocation.halfWorktops?`${allocation.halfWorktops} x 205 cm`:""].filter(Boolean).join(" + ")||"Fara blat";
  return {cabinetSubtotal,worktopLengthCm,worktopPrice,worktopDescription,worktopCuts,...allocation,total:money(cabinetSubtotal+worktopPrice)};
}

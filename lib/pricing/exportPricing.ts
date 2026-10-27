import { automaticWorktopSpan, isWorktopSupport } from "@/lib/asab/worktopRuns";
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
export function calculateExportPricing(cabinets: Cabinet[], layout: LayoutType, dimensions: WallDimensions, globalWorktop = "stejar") {
  const tallA=cabinets.filter(c=>c.wall==="A"&&c.placementMode!=="free"&&c.type?.startsWith("tall")).reduce((s,c)=>s+c.width,0);
  const tallReturn=cabinets.filter(c=>(c.wall==="B"||c.wall==="C")&&c.placementMode!=="free"&&c.type?.startsWith("tall")).reduce((s,c)=>s+c.width,0);
  const a=Math.max(0,dimensions.wallA-tallA),b=layout==="l-shape"?Math.max(0,(dimensions.wallB??0)-tallReturn):0;
  const island=cabinets.filter(c=>c.wall==="I"&&c.type?.startsWith("base")).reduce((s,c)=>s+c.width,0);
  const peninsula=cabinets.filter(c=>c.wall==="P"&&c.type?.startsWith("base")).reduce((s,c)=>s+c.width,0);
  const islandLength=(layout==="island"||dimensions.hasIsland)?(island||dimensions.islandWidth||0):island;
  const peninsulaLength=layout==="peninsula"?(peninsula||dimensions.peninsulaWidth||0):peninsula;
  const overlap=a>0&&b>0?Math.min(60,a,b):0;
  const returnRun = cabinets.some(c=>c.wall==="C"&&c.type?.startsWith("base"))?"C":cabinets.some(c=>c.wall==="B"&&c.type?.startsWith("base"))?"B":dimensions.cornerSide==="right"?"B":"C";
  let worktopCuts=[{run:"A",lengthCm:a},{run:returnRun,lengthCm:b-overlap},{run:"Insula",lengthCm:islandLength},{run:"Peninsula",lengthCm:peninsulaLength}].filter(c=>c.lengthCm>0);
  const replaced = new Set(cabinets.flatMap(c => c.designPiece?.replacesRun ? [c.designPiece.replacesRun] : []));
  let jointOverlapCm=overlap;
  // Explicit run editing and fillers use the same physical spans as the renderer.
  if(cabinets.some(c=>!!c.runWorktopDimensions || !!c.designPiece?.replacesRun || isWorktopSupport(c)&&!!c.designPiece)){
    const spans=(["A","B","C","I","P"] as const).flatMap(wall=>{const span=replaced.has(wall)?undefined:automaticWorktopSpan(cabinets,wall);return span?[{run:wall==="I"?"Insula":wall==="P"?"Peninsula":wall,lengthCm:span.lengthCm}]:[];});
    const aSpan=replaced.has("A")?undefined:automaticWorktopSpan(cabinets,"A");
    const rSpan=replaced.has(returnRun as Cabinet["wall"])?undefined:automaticWorktopSpan(cabinets,returnRun as Cabinet["wall"]);
    const crossDepth=rSpan?.depthCm??60,aDepth=aSpan?.depthCm??60;
    const crossStart=returnRun==="B"?0:dimensions.wallA-crossDepth;
    const overlapX=aSpan?Math.max(0,Math.min(aSpan.startCm+aSpan.lengthCm,crossStart+crossDepth)-Math.max(aSpan.startCm,crossStart)):0;
    const overlapZ=rSpan?Math.max(0,Math.min(rSpan.startCm+rSpan.lengthCm,aDepth)-Math.max(rSpan.startCm,0)):0;
    jointOverlapCm=layout==="l-shape"?overlapX*overlapZ/crossDepth:0;
    worktopCuts=spans.map(s=>({...s,lengthCm:s.run===returnRun?Math.max(0,s.lengthCm-jointOverlapCm):s.lengthCm})).filter(s=>s.lengthCm>0);
  }
  const billedCuts = worktopCuts.filter(c => !replaced.has((c.run === "Insula" ? "I" : c.run === "Peninsula" ? "P" : c.run) as Cabinet["wall"])).map(c=>{
    const wall=(c.run==="Insula"?"I":c.run==="Peninsula"?"P":c.run) as Cabinet["wall"];
    const span=automaticWorktopSpan(cabinets,wall),depthCm=span?.depthCm??60,thicknessCm=span?.thicknessCm??3.8;
    const amount=span?.manualPrice,manualPrice=amount!=null&&Number.isFinite(amount)&&amount>=0?amount:undefined;
    const stock=depthCm>0&&depthCm<=60&&Math.abs(thicknessCm-3.8)<.001;
    const finish=cabinets.find(item=>item.wall===wall&&isWorktopSupport(item)&&item.runWorktopOverride)?.runWorktopOverride?.worktop??globalWorktop;
    return {...c,depthCm,thicknessCm,manualPrice,stock:stock&&manualPrice==null,pricePending:!stock&&manualPrice==null,finish};
  });
  const worktopLengthCm=money(billedCuts.reduce((s,c)=>s+c.lengthCm,0));
  const finishGroups=new Map<string,number[]>();
  for(const cut of billedCuts.filter(c=>c.stock)){
    finishGroups.set(cut.finish,[...(finishGroups.get(cut.finish)??[]),cut.lengthCm]);
  }
  const stockByFinish=Array.from(finishGroups,([finish,lengths])=>({finish,...allocateWorktopBoards(lengths)}));
  const allocation={fullWorktops:stockByFinish.reduce((s,g)=>s+g.fullWorktops,0),halfWorktops:stockByFinish.reduce((s,g)=>s+g.halfWorktops,0),stockLengthCm:stockByFinish.reduce((s,g)=>s+g.stockLengthCm,0),boards:stockByFinish.flatMap(g=>g.boards)};
  const worktopPrice=money(allocation.fullWorktops*FULL_WORKTOP_PRICE+allocation.halfWorktops*HALF_WORKTOP_PRICE+billedCuts.reduce((sum,c)=>sum+(c.manualPrice??0),0));
  const worktopPricePending=billedCuts.some(c=>c.pricePending),stockCutLengthCm=money(billedCuts.filter(c=>c.stock).reduce((sum,c)=>sum+c.lengthCm,0));
  const cabinetSubtotal=money(cabinets.reduce((s,c)=>s+(c.price??0),0));
  const customCuts=billedCuts.filter(c=>!c.stock);
  const worktopDescription=[allocation.fullWorktops?`${allocation.fullWorktops} x 410 cm`:"",allocation.halfWorktops?`${allocation.halfWorktops} x 205 cm`:"",customCuts.length?`${customCuts.length} tronson(e) la comanda${worktopPricePending?" - pret de confirmat":""}`:""].filter(Boolean).join(" + ")||"Fara blat";
  return {worktopPricePending,stockCutLengthCm,cabinetSubtotal,worktopLengthCm,worktopPrice,worktopDescription,worktopCuts:billedCuts,jointOverlapCm,stockByFinish,...allocation,total:money(cabinetSubtotal+worktopPrice)};
}

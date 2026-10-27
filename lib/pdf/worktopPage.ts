import type jsPDF from "jspdf";
import type { PDFExportOptions } from "@/lib/pdf/exportPDF";
import { calculateExportPricing,worktopProduct } from "@/lib/pricing/exportPricing";

export function addWorktopPage(doc:jsPDF,opts:PDFExportOptions){
  const p=calculateExportPricing(opts.cabinets,opts.layout,opts.dimensions,opts.colorway.worktop);if(!p.worktopLengthCm)return;
  const product=new Set(p.worktopCuts.map(c=>c.finish)).size>1?{label:"Blat - finisaje mixte",sku:"BL-MIXT"}:worktopProduct(p.stockByFinish[0]?.finish??p.worktopCuts[0]?.finish??opts.colorway.worktop);
  const line=(s:string,x:number,y:number,size=9,bold=false)=>{doc.setTextColor(20);doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);doc.text(s,x,y);};
  doc.addPage();line("ASAB DESIGN",16,17,10,true);line("Blat - detalii",16,30,16,true);
  doc.setDrawColor(150);doc.setLineWidth(.2);doc.setFillColor(238,238,238);doc.rect(16,40,178,9,"FD");
  line(`Produs ${opts.cabinets.length+1}: ${product.label}`,19,46,10,true);doc.setFontSize(10);doc.text(`${p.worktopPrice.toLocaleString("ro-RO")} RON${p.worktopPricePending?" · partial":" TVA inclus"}`,191,46,{align:"right"});
  const sizes=Array.from(new Set(p.worktopCuts.map(c=>`${Math.round(c.depthCm*10)} / ${Math.round(c.thicknessCm*10)} mm`)));
  const rows=[["SKU",product.sku],["Stoc achizitionat",`${p.worktopDescription} | ${p.fullWorktops+p.halfWorktops*.5} blaturi`],["Lungime utila",`${Math.round(p.worktopLengthCm*10)} mm`],["Adancime / grosime",sizes.length===1?sizes[0]:"Variabile - vezi tronsoane"]];
  let y=49;for(const [label,value]of rows){doc.setFontSize(9);const lines=doc.splitTextToSize(value,126),h=Math.max(8,lines.length*4+3);doc.rect(16,y,178,h);doc.line(61,y,61,y+h);line(label,19,y+5.5,9,true);lines.forEach((v:string,i:number)=>line(v,64,y+5.5+i*4,9));y+=h;}
  const imageTop=Math.max(96,y+14);
  line(opts.worktopView?"Vedere izometrica":"Schema izometrica",16,imageTop-5,10,true);
  if(opts.worktopView){const h=Math.min(204-imageTop,178*opts.worktopView.aspect),w=h/opts.worktopView.aspect;doc.addImage(opts.worktopView.dataUrl,"PNG",16+(178-w)/2,imageTop,w,h,undefined,"FAST");}
  else drawWorktopIsometric(doc,p.worktopCuts,opts,imageTop);
  y=209;line("TRONSOANE UTILE (L x A x G, mm)",16,y,9,true);y+=7;
  for(const cut of p.worktopCuts){
    const wall=cut.run==="Insula"?"I":cut.run==="Peninsula"?"P":cut.run;
    const finish=opts.cabinets.find(c=>c.wall===wall&&c.runWorktopOverride)?.runWorktopOverride;
    const product=worktopProduct(cut.finish??finish?.worktop??opts.colorway.worktop);
    line(`${cut.run}: ${Math.round(cut.lengthCm*10)} x ${Math.round(cut.depthCm*10)} x ${Math.round(cut.thicknessCm*10)} | ${product.label} (${product.sku})${cut.pricePending?" - pret de confirmat":cut.manualPrice!=null?` - ${cut.manualPrice} RON`:""}`,19,y,8);y+=6;
  }
  line(`Achizitie: ${p.stockLengthCm*10} mm | Rest nominal: ${Math.round((p.stockLengthCm-p.stockCutLengthCm)*10)} mm`,16,y+3,8);
  const notes=[...(opts.layout==="l-shape"?[`Racord comun dedus o singura data: ${Math.round(p.jointOverlapCm*10)} mm.`]:[]),"Plan nominal de debitare; pierderile de taiere si rosturile se confirma la montaj.",...(p.worktopCuts.some(c=>c.lengthCm>410)?["Tronsoanele peste 4100 mm necesita imbinare."]:[])];
  for(const note of notes){y+=8;line(note,16,y,7.5);}
  if(opts.configuratorUrl){line("Vizualizeaza in configurator",70,277,9,true);doc.link(70,273,75,7,{url:opts.configuratorUrl});}
}
function drawWorktopIsometric(doc:jsPDF,cuts:Array<{run:string;lengthCm:number;depthCm:number;thicknessCm:number}>,opts:PDFExportOptions,top:number){
  const a=cuts.find(c=>c.run==="A")?.lengthCm??0,sign=opts.dimensions.cornerSide==="right"?-1:1;
  const aDepth=cuts.find(c=>c.run==="A")?.depthCm??60;
  const boxes=cuts.map(c=>({...c,...(c.run==="A"?{x:0,z:0,w:c.lengthCm,d:c.depthCm}:c.run==="B"||c.run==="C"?{x:c.run==="B"?0:Math.max(0,a-c.depthCm),z:aDepth,w:c.depthCm,d:c.lengthCm}:{x:40,z:c.run==="Insula"?160:80,w:c.lengthCm,d:c.depthCm})}));
  const project=(x:number,y:number,z:number)=>[.866*(sign*x-z),.5*(sign*x+z)-y];
  const faces=boxes.flatMap(b=>[
    [[b.x,0,b.z],[b.x+b.w,0,b.z],[b.x+b.w,b.thicknessCm,b.z],[b.x,b.thicknessCm,b.z]],
    [[b.x+b.w,0,b.z],[b.x+b.w,0,b.z+b.d],[b.x+b.w,b.thicknessCm,b.z+b.d],[b.x+b.w,b.thicknessCm,b.z]],
    [[b.x,b.thicknessCm,b.z],[b.x+b.w,b.thicknessCm,b.z],[b.x+b.w,b.thicknessCm,b.z+b.d],[b.x,b.thicknessCm,b.z+b.d]],
  ].map(face=>face.map(v=>project(v[0],v[1],v[2]))));
  const points=faces.flat(),minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  const scale=Math.min(160/(maxX-minX),97/(maxY-minY));
  for(const face of faces){const pts=face.map(p=>[105+(p[0]-(minX+maxX)/2)*scale,top+52+(p[1]-(minY+maxY)/2)*scale]);doc.setFillColor(250,250,250);doc.setDrawColor(30);doc.setLineWidth(.3);doc.lines(pts.slice(1).map((p,i)=>[p[0]-pts[i][0],p[1]-pts[i][1]]),pts[0][0],pts[0][1],[1,1],"FD",true);}
}

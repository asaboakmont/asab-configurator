import type jsPDF from "jspdf";
import type { PDFExportOptions } from "@/lib/pdf/exportPDF";
import { calculateExportPricing,worktopProduct } from "@/lib/pricing/exportPricing";

export function addWorktopPage(doc:jsPDF,opts:PDFExportOptions){
  const p=calculateExportPricing(opts.cabinets,opts.layout,opts.dimensions);if(!p.worktopLengthCm)return;
  const product=worktopProduct(opts.colorway.worktop);
  const line=(s:string,x:number,y:number,size=9,bold=false)=>{doc.setTextColor(20);doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);doc.text(s,x,y);};
  doc.addPage();line("ASAB DESIGN",16,17,10,true);line("Blat - detalii",16,30,16,true);
  doc.setDrawColor(150);doc.setLineWidth(.2);doc.setFillColor(238,238,238);doc.rect(16,40,178,9,"FD");
  line(`Produs ${opts.cabinets.length+1}: ${product.label}`,19,46,10,true);doc.setFontSize(10);doc.text(`${p.worktopPrice.toLocaleString("ro-RO")} RON TVA inclus`,191,46,{align:"right"});
  const rows=[["SKU",product.sku],["Stoc achizitionat",`${p.worktopDescription} | ${p.fullWorktops+p.halfWorktops*.5} blaturi`],["Lungime utila",`${Math.round(p.worktopLengthCm*10)} mm`],["Adancime / grosime","600 / 38 mm"]];
  let y=49;for(const [label,value]of rows){doc.rect(16,y,178,8);doc.line(61,y,61,y+8);line(label,19,y+5.5,9,true);line(value,64,y+5.5,9);y+=8;}
  line(opts.worktopView?"Vedere izometrica":"Schema izometrica",16,91,10,true);
  if(opts.worktopView){const h=Math.min(105,178*opts.worktopView.aspect),w=h/opts.worktopView.aspect;doc.addImage(opts.worktopView.dataUrl,"PNG",16+(178-w)/2,96,w,h,undefined,"FAST");}
  else drawWorktopIsometric(doc,p.worktopCuts,opts,96);
  y=209;line("TRONSOANE UTILE (L x A x G, mm)",16,y,9,true);y+=7;
  for(const cut of p.worktopCuts){line(`${cut.run}: ${Math.round(cut.lengthCm*10)} x 600 x 38`,19,y);y+=6;}
  line(`Achizitie: ${p.stockLengthCm*10} mm | Rest nominal: ${Math.round((p.stockLengthCm-p.worktopLengthCm)*10)} mm`,16,y+3,8);
  const notes=[...(opts.layout==="l-shape"?["Racordul de colt de 600 mm este contabilizat o singura data."]:[]),"Plan nominal de debitare; pierderile de taiere si rosturile se confirma la montaj.",...(p.worktopCuts.some(c=>c.lengthCm>410)?["Tronsoanele peste 4100 mm necesita imbinare."]:[])];
  for(const note of notes){y+=8;line(note,16,y,7.5);}
  if(opts.configuratorUrl){line("Vizualizeaza in configurator",70,277,9,true);doc.link(70,273,75,7,{url:opts.configuratorUrl});}
}
function drawWorktopIsometric(doc:jsPDF,cuts:Array<{run:string;lengthCm:number}>,opts:PDFExportOptions,top:number){
  const a=cuts.find(c=>c.run==="A")?.lengthCm??0,sign=opts.dimensions.cornerSide==="right"?-1:1;
  const boxes=cuts.map(c=>c.run==="A"?{x:0,z:0,w:c.lengthCm,d:60}:c.run==="B"||c.run==="C"?{x:c.run==="B"?0:Math.max(0,a-60),z:60,w:60,d:c.lengthCm}:{x:40,z:c.run==="Insula"?160:80,w:c.lengthCm,d:60});
  const project=(x:number,y:number,z:number)=>[.866*(sign*x-z),.5*(sign*x+z)-y];
  const faces=boxes.flatMap(b=>[
    [[b.x,0,b.z],[b.x+b.w,0,b.z],[b.x+b.w,3.8,b.z],[b.x,3.8,b.z]],
    [[b.x+b.w,0,b.z],[b.x+b.w,0,b.z+b.d],[b.x+b.w,3.8,b.z+b.d],[b.x+b.w,3.8,b.z]],
    [[b.x,3.8,b.z],[b.x+b.w,3.8,b.z],[b.x+b.w,3.8,b.z+b.d],[b.x,3.8,b.z+b.d]],
  ].map(face=>face.map(v=>project(v[0],v[1],v[2]))));
  const points=faces.flat(),minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  const scale=Math.min(160/(maxX-minX),97/(maxY-minY));
  for(const face of faces){const pts=face.map(p=>[105+(p[0]-(minX+maxX)/2)*scale,top+52+(p[1]-(minY+maxY)/2)*scale]);doc.setFillColor(250,250,250);doc.setDrawColor(30);doc.setLineWidth(.3);doc.lines(pts.slice(1).map((p,i)=>[p[0]-pts[i][0],p[1]-pts[i][1]]),pts[0][0],pts[0][1],[1,1],"FD",true);}
}

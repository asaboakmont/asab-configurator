import { doorHingeSides } from "@/lib/pdf/hinges";
import type jsPDF from "jspdf";
import type { PDFExportOptions } from "@/lib/pdf/exportPDF";
import type { Cabinet } from "@/types/kitchen";
import { cabinetDocumentSku } from "@/lib/pricing/catalogPrices";
import { cabinetKey } from "@/lib/pdf/technicalViews";

const clean=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[șş]/g,"s").replace(/[țţ]/g,"t");
/** Interior is explicitly schematic: shelf locations and hardware aren't present in catalogue data. */
export function drawCabinetSchematic(doc:jsPDF,c:Cabinet,x:number,y:number,w:number,h:number,inside:boolean){
  const scale=Math.min((w-20)/c.width,(h-20)/c.height),cw=c.width*scale,ch=c.height*scale;
  const left=x+(w-cw)/2,top=y+(h-ch)/2;
  doc.setLineWidth(.3);doc.setDrawColor(20);doc.rect(left,top,cw,ch);
  doc.setTextColor(20);doc.setFontSize(8);
  doc.line(left,top+ch+4,left+cw,top+ch+4);
  for(const px of [left,left+cw])doc.line(px,top+ch+2,px,top+ch+6);
  doc.text(`${Math.round(c.width*10)} mm`,left+cw/2,top+ch+9,{align:"center"});
  doc.text(`${Math.round(c.height*10)} mm`,left-3,top+ch/2,{angle:90,align:"center"});
  const name=clean(c.label??"").toLowerCase();
  const unknown=!!c.catalogProduct||c.type.includes("corner")||["panel","accessory","base-dishwasher","tall-fridge"].includes(c.type);
  if(inside){
    doc.setLineDashPattern([1.2,1.2],0);doc.setDrawColor(100);
    if(!unknown&&(c.type==="base-drawer"||c.type==="base-hob")){
      for(let i=0;i<3;i++)doc.rect(left+cw*.08,top+ch*i/3+ch*.04,cw*.84,ch*.24);
    }else if(!unknown&&(c.type==="base-oven"||c.type==="tall-oven")){
      doc.rect(left+cw*.08,top+ch*.25,cw*.84,ch*.5);doc.text("Nisa aparat",left+cw/2,top+ch*.53,{align:"center"});
    }else if(!unknown&&c.type!=="base-sink")doc.line(left+1,top+ch/2,left+cw-1,top+ch/2);
    doc.setLineDashPattern([],0);
  }else if(c.type==="base-drawer"||c.type==="base-hob"){
    for(let i=1;i<3;i++)doc.line(left,top+ch*i/3,left+cw,top+ch*i/3);
  }else if(!unknown&&/2 us|2u/.test(name))doc.line(left+cw/2,top,left+cw/2,top+ch);
  doc.setDrawColor(20);
}

export function addCabinetPages(doc:jsPDF,opts:PDFExportOptions){
  const line=(s:string,x:number,y:number,size=10,bold=false)=>{doc.setTextColor(20);doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);doc.text(clean(s),x,y);};
  const para=(s:string,y:number)=>{doc.setFont("helvetica","normal");doc.setFontSize(9);const lines=doc.splitTextToSize(clean(s),178);doc.text(lines,16,y);return y+lines.length*4.5;};
  const page=(title:string,sub:string)=>{doc.addPage();line("ASAB DESIGN",16,17,10,true);line(title,16,30,16,true);line(sub,16,39,9);};
  for(let cIndex=0;cIndex<opts.cabinets.length;cIndex++){
    const c=opts.cabinets[cIndex];
    page(`Corpul ${cIndex+1}`,cabinetDocumentSku(c));
    const hingeSides = doorHingeSides(c);
    const opening = hingeSides.length === 2 ? "stanga + dreapta" : hingeSides[0] === "left" ? "stanga (S)" : "dreapta (D)";
    const name = c.catalogProduct?.name ?? c.label ?? c.type;
    let y=para(hingeSides.length ? `${name} - Deschidere: ${opening}` : name,50);
    line(`L x H x A: ${Math.round(c.width*10)} x ${Math.round(c.height*10)} x ${Math.round(c.depth*10)} mm`,16,y+8);
    line(`Amplasare: ${c.placementMode==="free"?"libera":c.wall} - Pret TVA inclus: ${c.price.toFixed(2)} RON`,16,y+16);
    const actual=opts.cabinetViews?.find(v=>v.cabinetId===cabinetKey(c));
    line("Exterior",16,88,11,true);line(actual?.interior ? "Interior din modelul 3D" : "Interior schematic",110,88,11,true);
    if(actual){const h=Math.min(104,84*actual.image.aspect);doc.addImage(actual.image.dataUrl,"PNG",16,103,84,h,undefined,"FAST");}
    else drawCabinetSchematic(doc,c,16,96,84,104,false);
    if(actual?.interior){const h=Math.min(104,84*actual.interior.aspect);doc.addImage(actual.interior.dataUrl,"PNG",110,103,84,h,undefined,"FAST");}
    else drawCabinetSchematic(doc,c,110,96,84,104,true);
    line(actual?"Contur din modelul 3D redimensionat":"Schema exterioara orientativa",16,211,8);
    y=para(actual?.interior ? "Interior extras din geometria GLB, cu fronturile si manerele ascunse. Detaliile absente din model nu sunt reconstruite. Compartimentarea si feroneria se confirma inainte de productie." : "Interior schematic orientativ. Pozitiile politelor, compartimentarea, feroneria si degajarile aparatelor se confirma inainte de productie. Acesta nu este un desen de executie.",222);
    if(!actual?.interior && (c.type.includes("corner")||c.catalogProduct))y=para("Compartimentarea interioara nu este definita pentru acest model. Se afiseaza numai gabaritul.",y+3);
    if(c.isCustom)y=para("Dimensiune adaptata. Desenul foloseste dimensiunile curente ale corpului.",y+3);
    if(c.pricingNote)para(c.pricingNote,y+3);
  }
  for(const img of opts.technicalViews??[]){
    page(img.label,"Contur vizibil din geometria 3D. Proiectie ortografica.");
    const h=Math.min(124,178*img.aspect),w=h/img.aspect;
    doc.addImage(img.dataUrl,"PNG",16+(178-w)/2,48,w,h,undefined,"FAST");
    let y=186;
    const wall=img.label.match(/perete ([ABC])/i)?.[1]??(img.label.includes("insula")?"I":img.label.includes("peninsula")?"P":undefined);
    if(!wall){para(img.description ?? "Vederea foloseste pozitiile, rotatiile si dimensiunile corpurilor din configuratia curenta. Dimensiunile si numerele corpurilor sunt prezentate in paginile individuale.",y);continue;}
    line("Nr corp    X inceput mm    Latime mm    Inaltime mm    Adancime mm",16,y,9,true);y+=8;
    opts.cabinets.forEach((c,i)=>{if(c.wall!==wall)return;if(y>264){page(img.label+" dimensiuni","Toate dimensiunile sunt in mm.");y=52;}
      line(`${i+1}`,18,y,9,true);line(`${Math.round(c.xPos*10)}`,48,y,9);line(`${Math.round(c.width*10)}`,88,y,9);line(`${Math.round(c.height*10)}`,127,y,9);line(`${Math.round(c.depth*10)}`,166,y,9);y+=7;});
  }
  if(opts.technicalWarnings?.length){page("Observatii modele 3D","Modelele indisponibile nu sunt inlocuite cu desene prezentate drept modele reale.");let y=52;for(const text of opts.technicalWarnings){if(y>250){page("Observatii continuare","");y=52;}y=para(text,y)+4;}}
}

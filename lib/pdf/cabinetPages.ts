import { addWorktopPage } from "@/lib/pdf/worktopPage";
import { doorHingeSides } from "@/lib/pdf/hinges";
import type jsPDF from "jspdf";
import type { PDFExportOptions } from "@/lib/pdf/exportPDF";
import type { Cabinet } from "@/types/kitchen";
import { cabinetDocumentSku } from "@/lib/pricing/catalogPrices";
import { cabinetKey } from "@/lib/pdf/technicalViews";

const clean=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[șş]/g,"s").replace(/[țţ]/g,"t");
/** Interior is explicitly schematic: shelf locations and hardware aren't present in catalogue data. */
export function drawCabinetSchematic(doc:jsPDF,c:Cabinet,x:number,y:number,w:number,h:number,inside:boolean){
  const scale=Math.min((w-20)/c.width,(h-12)/c.height),cw=c.width*scale,ch=c.height*scale;
  const left=x+(w-cw)/2,top=y+2+(h-12-ch)/2;
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
    if(cIndex%2===0){
      page("Corpuri - detalii", "Dimensiuni L x H x A in mm. Preturi TVA inclus.");
      if(opts.configuratorUrl){
        doc.setTextColor(20);doc.setFont("helvetica","bold");doc.setFontSize(9);doc.text("Vizualizeaza in configurator",105,277,{align:"center"});
        const width=doc.getTextWidth("Vizualizeaza in configurator");
        doc.setDrawColor(40);doc.line(105-width/2,278,105+width/2,278);
        doc.link(105-width/2,273,width,7,{url:opts.configuratorUrl});
      }
    }
    const c=opts.cabinets[cIndex], top=cIndex%2===0?46:160;
    const hinges=doorHingeSides(c);
    const opening=hinges.length===2?"stanga + dreapta":hinges[0]==="left"?"stanga (S)":"dreapta (D)";
    const name=c.catalogProduct?.name??c.label??c.type;
    doc.setDrawColor(150);doc.setLineWidth(.2);doc.setFillColor(238,238,238);doc.rect(16,top,178,8,"FD");
    doc.line(145,top,145,top+8);
    line(`Corpul ${cIndex+1}`,19,top+5.5,10,true);
    doc.setFont("helvetica","bold");doc.setFontSize(9);doc.text(`${c.price.toFixed(2)} RON`,191,top+5.5,{align:"right"});
    // Native PDF table rules make SKU, name and price easy to scan and print.
    for(const [dy,height] of [[8,9],[17,14],[31,6],[37,6]] as const)doc.rect(16,top+dy,178,height);
    doc.line(36,top+8,36,top+31);
    line("SKU",19,top+14,8,true);line(cabinetDocumentSku(c),39,top+14,8.5,true);
    line("Nume",19,top+23,8,true);
    doc.setFontSize(9);doc.setFont("helvetica","bold");const names=doc.splitTextToSize(clean(name),152);doc.text(names,39,top+22);
    line(`L x H x A: ${Math.round(c.width*10)} x ${Math.round(c.height*10)} x ${Math.round(c.depth*10)} mm`,19,top+35.3,8);
    const detail=`Amplasare: ${c.placementMode==="free"?"libera":c.wall}${hinges.length?` | Deschidere: ${opening}`:""}${c.isCustom?" | Personalizat":""}`;
    line(detail,19,top+41.3,7.5);
    doc.setFillColor(247,247,247);doc.rect(16,top+43,178,6,"FD");doc.line(105,top+43,105,top+100);
    const actual=opts.cabinetViews?.find(v=>v.cabinetId===cabinetKey(c));
    line(actual?"Exterior":"Exterior schematic",19,top+47.3,8,true);
    line(actual?.interior?"Interior":"Interior schematic",108,top+47.3,8,true);
    doc.rect(16,top+49,178,51);
    const image=(img:{dataUrl:string;aspect:number},left:number)=>{const h=Math.min(45,82*img.aspect),w=h/img.aspect;doc.addImage(img.dataUrl,"PNG",left+(89-w)/2,top+52,w,h,undefined,"FAST");};
    if(actual)image(actual.image,16);else drawCabinetSchematic(doc,c,20,top+50,80,48,false);
    if(actual?.interior)image(actual.interior,105);else drawCabinetSchematic(doc,c,109,top+50,80,48,true);
    if(c.pricingNote){doc.setFontSize(7);doc.setFont("helvetica","normal");doc.text(doc.splitTextToSize(clean(c.pricingNote),178),16,top+104);}
  }
  if(opts.cabinets.length) addWorktopPage(doc,opts);
  for(const img of opts.technicalViews??[]){
    page(img.label, "");
    const h=Math.min(124,178*img.aspect),w=h/img.aspect;
    doc.addImage(img.dataUrl,"PNG",16+(178-w)/2,37,w,h,undefined,"FAST");
    const wall=img.label.match(/perete ([ABC])/i)?.[1]??(img.label.includes("insula")?"I":img.label.includes("peninsula")?"P":undefined);
    if(!wall)para(img.description ?? "Vederea foloseste pozitiile, rotatiile si dimensiunile corpurilor din configuratia curenta. Dimensiunile si numerele corpurilor sunt prezentate in paginile individuale.",37+h+10);
  }
  if(opts.technicalWarnings?.length){page("Observatii modele 3D","Modelele indisponibile nu sunt inlocuite cu desene prezentate drept modele reale.");let y=52;for(const text of opts.technicalWarnings){if(y>250){page("Observatii continuare","");y=52;}y=para(text,y)+4;}}
}

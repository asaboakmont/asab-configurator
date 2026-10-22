import type jsPDF from "jspdf";
import type { PDFExportOptions } from "@/lib/pdf/exportPDF";
import type { Cabinet } from "@/types/kitchen";

export interface PlanFootprint { minX: number; maxX: number; minZ: number; maxZ: number; }
const upper = (c: Cabinet) => c.type.startsWith("wall");
/** Nominal footprints, in cm, using the viewer's wall offsets and stored free centres. */
export function planFootprint(c: Cabinet, wallA: number): PlanFootprint {
  const isUpper = upper(c), isTall = c.type.startsWith("tall");
  const offset = isUpper ? 1.5 : isTall ? 2.5 : 5;
  const depthCenter = (isUpper ? 32 : 53) / 2 + offset;
  let x = c.xPos + c.width / 2, z = depthCenter, rotation = 0;
  if (c.placementMode === "free" && c.freePosition) { x = c.freePosition.x; z = c.freePosition.z; rotation = c.rotationYDegrees ?? 0; }
  else if (c.wall === "I") z = c.zPos ?? 140;
  else if (["B", "C", "P"].includes(c.wall)) {
    const left = c.wall === "B" || c.wall === "P" && c.runSide === "left";
    x = left ? depthCenter : wallA - depthCenter; z = c.xPos + c.width / 2; rotation = 90;
    if (c.type.includes("corner")) {
      const gap = isUpper ? 0 : 5;
      x = left ? gap + c.depth / 2 : wallA - gap - c.depth / 2;
      z = gap + c.width / 2;
    }
  }
  const turned = rotation === 90 || rotation === 270;
  const w = turned ? c.depth : c.width, d = turned ? c.width : c.depth;
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}
export function planSegments(cabinets: Cabinet[], wall: "A" | "B" | "C", wallLength: number, wallUnits: boolean) {
  const units = cabinets.map((c, index) => ({ c, index })).filter(({ c }) => c.type !== "accessory" && c.placementMode !== "free" && c.wall === wall && upper(c) === wallUnits)
    .sort((a, b) => a.c.xPos - b.c.xPos);
  const result: Array<{ start: number; end: number; label: string; gap: boolean }> = [];
  let end = 0;
  for (const { c } of units) {
    if (c.xPos > end + .05) result.push({ start: end, end: c.xPos, label: `${Math.round((c.xPos - end) * 10)}`, gap: true });
    result.push({ start: c.xPos, end: c.xPos + c.width, label: `${Math.round(c.width * 10)}`, gap: false });
    end = Math.max(end, c.xPos + c.width);
  }
  if (units.length && end < wallLength - .05) result.push({ start: end, end: wallLength, label: `${Math.round((wallLength - end) * 10)}`, gap: true });
  return result;
}

/** Vector dimension strings stay sharp when printed. No inferred door-swing geometry. */
export function addDimensionedTopPlan(doc: jsPDF, opts: PDFExportOptions) {
  if (!opts.enhancedPDF) return;
  const roomW = opts.dimensions.wallA, roomD = opts.dimensions.wallB ?? 220;
  if (!(roomW > 0 && roomD > 0)) return;
  doc.addPage();
  doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("ASAB DESIGN", 16, 17);
  doc.setFontSize(16); doc.text("Plan de sus cotat", 16, 30);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text("Cote nominale in mm. Numerele corespund listei de corpuri. Fara arce de deschidere.", 16, 39);
  const items = opts.cabinets.filter(c => c.type !== "accessory").map(c => ({ c, n: opts.cabinets.indexOf(c) + 1, box: planFootprint(c, roomW) }));
  // Keep out-of-room placements visible instead of cropping or changing room dimensions.
  const minX = Math.min(0, ...items.map(i => i.box.minX)), maxX = Math.max(roomW, ...items.map(i => i.box.maxX));
  const minZ = Math.min(0, ...items.map(i => i.box.minZ)), maxZ = Math.max(roomD, ...items.map(i => i.box.maxZ));
  const scale = Math.min(108 / (maxX - minX), 126 / (maxZ - minZ));
  const x0 = 105 - (maxX - minX) * scale / 2 - minX * scale;
  const y0 = 91 - minZ * scale;
  const x = (v: number) => x0 + v * scale, z = (v: number) => y0 + v * scale;
  const roomRight = x(roomW), roomBottom = z(roomD);
  const smallNotes: string[] = [];
  function text(value: string, px: number, py: number, angle = 0, size = 7) {
    doc.setFontSize(size); doc.setTextColor(20); doc.text(value, px, py, { align: "center", angle });
  }
  function dimension(a: number, b: number, baseline: number, vertical: boolean, label: string, gap = false, context = "") {
    if (b <= a) return;
    doc.setDrawColor(gap ? 125 : 55); doc.setLineWidth(.18);
    if (vertical) { doc.line(baseline, a, baseline, b); for (const p of [a,b]) doc.line(baseline-1,p+1,baseline+1,p-1); }
    else { doc.line(a,baseline,b,baseline); for (const p of [a,b]) doc.line(p-1,baseline+1,p+1,baseline-1); }
    const size = 6.5, labelWidth = doc.getStringUnitWidth(label) * size * .3528;
    if (b - a < labelWidth + 1.5) { smallNotes.push(`${context}${gap ? "gol" : "segment"} ${label} mm`); return; }
    const px = vertical ? baseline - 1.2 : (a+b)/2, py = vertical ? (a+b)/2 : baseline - 1.2;
    doc.setFillColor(255,255,255); if (!vertical) doc.rect(px-labelWidth/2-.6,py-2.3,labelWidth+1.2,3,"F");
    text(label,px,py,vertical?90:0,size);
  }
  // Room outline is schematic: the app does not hold a surveyed floor polygon.
  doc.setDrawColor(105); doc.setLineWidth(.6); doc.rect(x(0),z(0),roomW*scale,roomD*scale);
  for (const item of [...items.filter(i=>!upper(i.c)), ...items.filter(i=>upper(i.c))]) {
    const { c,n,box } = item, isUpper = upper(c);
    doc.setLineDashPattern(isUpper ? [1, .7] : [],0); doc.setDrawColor(isUpper ? 95 : 20); doc.setLineWidth(.25);
    if (!isUpper) doc.setFillColor(247,247,247);
    doc.rect(x(box.minX), z(box.minZ), (box.maxX-box.minX)*scale,(box.maxZ-box.minZ)*scale,isUpper?"S":"FD");
    doc.setLineDashPattern([],0);
    const px = x((box.minX+box.maxX)/2), py = z(isUpper ? box.minZ : box.maxZ) + (isUpper ? 3 : -1.5);
    text(`${isUpper?"S":"I"}${n}`,px,py,0,6.5);
    if (c.placementMode === "free" || c.wall === "I" || c.wall === "P") {
      dimension(x(box.minX),x(box.maxX),z(box.maxZ)+5,false,`${Math.round((box.maxX-box.minX)*10)}`);
      const nextToRight = items.some(other => other !== item && !upper(other.c) && Math.abs(other.box.minX-box.maxX)<.1 && Math.abs(other.box.minZ-box.minZ)<.1 && Math.abs(other.box.maxZ-box.maxZ)<.1);
      if (!nextToRight) dimension(z(box.minZ),z(box.maxZ),x(box.maxX)+5,true,`${Math.round((box.maxZ-box.minZ)*10)}`);
    }
  }
  for (const wall of ["A","B","C"] as const) for (const isUpper of [false,true]) {
    const length = wall === "A" ? roomW : roomD;
    const segments = planSegments(opts.cabinets,wall,length,isUpper);
    if (!segments.length) continue;
    const baseline = wall === "A" ? z(0)-(isUpper?20:10) : wall === "B" ? x(0)-(isUpper?20:10) : roomRight+(isUpper?20:10);
    doc.setDrawColor(190); doc.setLineWidth(.1);
    const endpoints = new Set(segments.flatMap(s=>[s.start,s.end]));
    for (const point of Array.from(endpoints)) {
      if(wall === "A") doc.line(x(point),z(0)-1,x(point),baseline-2);
      else doc.line(wall === "B"?x(0)-1:roomRight+1,z(point),baseline+(wall==="B"?-2:2),z(point));
    }
    for (const segment of segments) dimension(wall === "A"?x(segment.start):z(segment.start),wall === "A"?x(segment.end):z(segment.end),baseline,wall!=="A",segment.label,segment.gap,`${wall} ${isUpper?"S":"I"} (${Math.round(segment.start*10)}-${Math.round(segment.end*10)}): `);
    text(`${wall} ${isUpper?"S":"I"}`,wall === "A"?x(0)-5:baseline,wall === "A"?baseline: z(0)-4,0,6.5);
  }
  // Outermost strings are always the room's interior dimensions, not cabinet run totals.
  doc.setDrawColor(130); doc.setLineWidth(.15);
  for(const v of [0,roomW])doc.line(x(v),z(0)-1,x(v),z(0)-34);
  dimension(x(0),roomRight,z(0)-32,false,`Camera A: ${Math.round(roomW*10)}`);
  for(const v of [0,roomD])doc.line(roomRight+1,z(v),roomRight+34,z(v));
  dimension(z(0),roomBottom,roomRight+32,true,`${Math.round(roomD*10)}${opts.dimensions.wallB===undefined?"*":""} camera`);
  let y = Math.max(233, z(maxZ)+12);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(35);
  const notes = ["I = inferior / coloana; S = suspendat (linie intrerupta). Cotele gri indica goluri.",
    "Contururi nominale; nu reprezinta decupajele interioare ale corpurilor de colt.",
    ...(opts.dimensions.wallB===undefined?["* Adancime de reprezentare: 2200 mm (implicit viewer), neconfirmata ca masuratoare."]:[]),
    "Cotele camerei provin din peretii introdusi in configurator; se verifica pe santier.",
    ...(smallNotes.length?[`Segmente scurte: ${Array.from(new Set(smallNotes)).join("; ")}.`]:[]),
    `Adancimi corpuri (mm): ${items.map(i=>`${upper(i.c)?"S":"I"}${i.n}: ${Math.round(i.c.depth*10)}`).join("; ")}.`];
  for(const note of notes){ const lines=doc.splitTextToSize(note,178); if(y+lines.length*3.8>276){doc.addPage();y=25;}doc.text(lines,16,y);y+=lines.length*3.8+2; }
}

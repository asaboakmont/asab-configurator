import { addDimensionedTopPlan } from "@/lib/pdf/dimensionedPlan";
import { createPublicKitchenPDF } from "@/lib/pdf/publicKitchenPDF";
import { addCabinetPages } from "@/lib/pdf/cabinetPages";
import { cabinetDocumentSku } from "@/lib/pricing/catalogPrices";
import type { CabinetTechnicalImage, TechnicalImage } from "@/lib/pdf/technicalViews";
import { calculateExportPricing } from "@/lib/pricing/exportPricing";
import { customCabinetLabel } from "@/lib/asab/cabinetSizing";
import jsPDF from "jspdf";
import { BACKSPLASH_OPTIONS, BUDGET_OPTIONS, DESIGN_COLLECTIONS, FLOOR_TEXTURE_OPTIONS, WALL_COLOR_OPTIONS } from "@/data/designCollections";
import type { BudgetPreference, Cabinet, Colorway, DesignCollectionId, LayoutType, RoomConstraints, RoomFinishes, WallDimensions } from "@/types/kitchen";

export interface PDFExportOptions {
  cabinets:    Cabinet[];
  colorway:    Colorway;
  handle:      string;
  totalPrice:  number;
  includeCabinetTotal?: boolean;
  enhancedPDF?: boolean;
  layout:      LayoutType;
  dimensions:  WallDimensions;
  screenshot?: string;
  screenshots?: { label: string; dataUrl: string; aspect: number }[];
  technicalViews?: TechnicalImage[];
  worktopView?: TechnicalImage;
  cabinetViews?: CabinetTechnicalImage[];
  technicalWarnings?: string[];
  cartUrl?:    string;
  configuratorUrl?: string;
  contact?:    { name: string; email: string; phone: string; city?: string };
  constraints?: RoomConstraints;
  collection?: DesignCollectionId;
  budget?: BudgetPreference;
  roomFinishes?: RoomFinishes;
}

export function createKitchenPDF(opts: PDFExportOptions) {
  if (!opts.enhancedPDF) return createPublicKitchenPDF(opts);
  const { cabinets, colorway, handle, totalPrice, layout, dimensions, constraints, collection, budget, roomFinishes } = opts;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  const pageW = 210;
  const pageH = 297;
  const margin = 16;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ASAB Design", margin, 17);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Configurator Bucatarie", margin, 23);
  const date = new Date().toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFontSize(8);
  doc.text(date, pageW - margin, 17, { align: "right" });

  const renderImages = opts.screenshots && opts.screenshots.length > 0
    ? opts.screenshots
    : opts.screenshot
      ? [{ label: "Randare configuratie", dataUrl: opts.screenshot, aspect: 9 / 16 }]
      : [];

  renderImages.forEach((image, index) => {
    if (index > 0) doc.addPage();
    try {
      const maxW = pageW - margin * 2;
      const maxH = pageH - 60;
      const imgH = Math.min(maxH, maxW * image.aspect);
      const imgW = imgH / image.aspect;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 14, 13);
      doc.text(image.label, margin, 35);
      doc.addImage(image.dataUrl, "PNG", margin, 41, imgW, imgH, undefined, "SLOW");
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.rect(margin, 41, imgW, imgH);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 101, 96);
      doc.text("Randare generata din configuratia 3D. Configuratie preliminara, necesita verificare tehnica.", margin, 45 + imgH);
    } catch(e) { /* skip */ }
  });

  const isKitchenIsometric = (image: TechnicalImage) => /^Bucatarie (3D|izometrica)/.test(image.label);
  const kitchenIsometrics = (opts.technicalViews ?? []).filter(isKitchenIsometric);
  if (kitchenIsometrics.length) addCabinetPages(doc, { ...opts, cabinets: [], technicalViews: kitchenIsometrics, technicalWarnings: [] });

  const planNearRenders = renderImages.length > 0 || kitchenIsometrics.length > 0;
  if (planNearRenders) addDimensionedTopPlan(doc, opts);
  if (planNearRenders) {
    doc.addPage();
  }
  let y = 38;
  doc.setTextColor(15, 14, 13);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Rezumat configuratie", margin, y);
  y += 8;

  const clientText = (value: string) => value.replace(/\s+/g," ").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const summaryRows: [string, string][] = [
    ...(opts.contact?.name ? [["Client", clientText(opts.contact.name)] as [string, string]] : []),
    ...(opts.contact?.phone ? [["Telefon", clientText(opts.contact.phone)] as [string, string]] : []),
    ...(opts.contact?.city ? [["Localitate", clientText(opts.contact.city)] as [string, string]] : []),
    ["Configuratie", layoutLabel(layout)],
    ["Colectie", collectionLabel(collection)],
    ["Buget orientativ", budgetLabel(budget?.range)],
    ["Prioritate", budgetPriorityLabel(budget?.priority)],
    ["Perete A",     `${dimensions.wallA} cm`],
    ...(dimensions.wallB ? [["Perete B", `${dimensions.wallB} cm`] as [string, string]] : []),
    ...(layout === "island" || dimensions.hasIsland
      ? [
          ["Insula", `${dimensions.islandWidth ?? 180}x${dimensions.islandDepth ?? 90} cm`] as [string, string],
          ["Distanta insula", `${dimensions.islandDistance ?? 100} cm`] as [string, string],
        ]
      : []),
    ["Inaltime",     `${dimensions.height} cm`],
    ["Culoare",      `${colorway.name} (${colorway.finish})`],
    ["Manere",       handle === "inox" ? "Inox" : handle === "auriu" ? "Auriu" : "Negru Mat"],
    ["Pereti", wallColorLabel(roomFinishes?.wallColor)],
    ["Pardoseala", floorTextureLabel(roomFinishes?.floorTexture)],
    ["Faianta / backsplash", backsplashLabel(roomFinishes?.backsplashTexture)],
    ["Ferestre / usi", `${constraints?.openings?.length ?? 0}`],
    ["Gheuri / obstacole", `${constraints?.obstructions?.length ?? 0}`],
    ["Puncte tehnice", `${constraints?.servicePoints?.length ?? 0}`],
    ["Centrala", constraints?.boiler ? "Da" : "Nu"],
  ];

  doc.setFontSize(9);
  summaryRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 14, 13);
    doc.text(k, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 101, 96);
    const valueLines = doc.splitTextToSize(v, k === "Client" || k === "Telefon" || k === "Localitate" ? 92 : 100);
    doc.text(valueLines, 65, y);
    y += Math.max(6, valueLines.length * 5);
  });

  const swatchX = pageW - margin - 30;
  doc.setFillColor(...hexToRgb(colorway.doorHex));
  doc.roundedRect(swatchX, 38, 20, 28, 2, 2, "F");
  doc.setFillColor(...hexToRgb(colorway.worktopHex));
  doc.roundedRect(swatchX + 21, 38, 9, 28, 2, 2, "F");

  y = Math.max(y, 80) + 4;
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 14, 13);
  doc.text("Lista dulapuri", margin, y);
  y += 8;

  doc.setFillColor(238, 238, 238);
  doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 101, 96);
  doc.text("NR",        margin + 1,          y);
  doc.text("PRODUS",     margin + 22,          y);
  doc.text("DIM (cm)",   margin + 90,          y);
  doc.text("PERETE",     margin + 130,         y);
  doc.text("PRET (RON)", pageW - margin - 1,   y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 14, 13);
  cabinets.forEach((cab, i) => {
    doc.setFontSize(8);
    const labelLines = [cabinetDocumentSku(cab), ...doc.splitTextToSize(customCabinetLabel(cab.label ?? cab.sku, !!cab.isCustom), 64)];
    const rowHeight = Math.max(7, labelLines.length * 3.5 + 2);
    if (y + rowHeight > 274) { doc.addPage(); y = 20; }
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 4, pageW - margin * 2, rowHeight, "F");
    }
    doc.setFontSize(8);
    doc.text(`${i + 1}`, margin + 1, y);
    doc.text(labelLines, margin + 22, y);
    doc.text(`${cab.width}x${cab.height}x${cab.depth}`,  margin + 90,       y);
    doc.text(cab.placementMode === "free" ? "LIBER" : cab.wall, margin + 130, y);
    doc.text(cab.pricePending ? "De confirmat" : cab.price.toLocaleString("ro-RO"),          pageW - margin - 1, y, { align: "right" });
    y += rowHeight;
  });

  if (y > 270) { doc.addPage(); y = 20; }

  // Worktop row
const { cabinetSubtotal, worktopLengthCm, worktopPrice, worktopDescription, total, stockByFinish, worktopPricePending, worktopCuts } = calculateExportPricing(cabinets, layout, dimensions, colorway.worktop);

const worktopLabels: Record<string, { label: string; sku: string }> = {
  stejar: { label: "Blat stejar", sku: "BL-STEJAR" },
  "gri-piatra": { label: "Blat gri piatra", sku: "BL-GRIS" },
  darkwood: { label: "Blat darkwood", sku: "BL-DARKWOOD" },
  "white-stone": { label: "Blat white stone", sku: "BL-WHITE-STONE" },
};

const worktopFinishes=Array.from(new Set(worktopCuts.map(c=>c.finish)));
const worktopItem =
  worktopFinishes.length>1 ? {label:"Blat - finisaje mixte",sku:"BL-MIXT"} : worktopLabels[stockByFinish[0]?.finish??worktopFinishes[0]??colorway.worktop] ?? worktopLabels.stejar;


if(worktopLengthCm>0){
doc.setFontSize(8);
doc.setFont("helvetica", "normal");
doc.setTextColor(15, 14, 13);

const worktopLines = [worktopItem.sku, ...doc.splitTextToSize(`${worktopItem.label} (${worktopDescription})`,64)];
const worktopDimLines = doc.splitTextToSize(`${worktopLengthCm} cm utili`,35);
const worktopRowHeight = Math.max(8,Math.max(worktopLines.length,worktopDimLines.length)*3.5+2);
if(y+worktopRowHeight>274){doc.addPage();y=20;}
if(cabinets.length%2===0){doc.setFillColor(250,250,250);doc.rect(margin,y-4,178,worktopRowHeight,"F");}
doc.text(String(cabinets.length+1),margin+1,y);
doc.text(worktopLines,margin+22,y);
doc.text(worktopDimLines,margin+90,y);
doc.text("-",margin+130,y);
doc.text(worktopPrice.toLocaleString("ro-RO"),pageW-margin-1,y,{align:"right"});
y+=worktopRowHeight;
}


  y += 2;
  // Ensure total + button + footer fit — add page if needed
  if (y + (opts.includeCabinetTotal ? 31 : 17) > 277) { doc.addPage(); y = 20; }
  doc.setDrawColor(210, 210, 210);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  
  const rows: [string, number][] = [
    ["Subtotal corpuri TVA inclus", cabinetSubtotal],
    ...(opts.includeCabinetTotal ? [
      ["Blat", worktopPrice],
      [(cabinets.some(c=>c.pricePending)||worktopPricePending) ? "TOTAL PARTIAL (preturi neconfirmate)" : "TOTAL CORPURI + BLAT", total],
    ] as [string, number][] : []),
  ];
  for (const [label, value] of rows) {
    doc.text(label, margin, y);
    doc.text(`${value.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} RON`, pageW - margin, y, { align: "right" });
    y += 7;
  }
  if (opts.configuratorUrl) {
    if (y + 25 > 277) { doc.addPage(); y = 20; }
    doc.setDrawColor(50);doc.setLineWidth(.3);doc.roundedRect(margin,y+3,178,10,1,1,"S");
    doc.setFontSize(10);doc.setFont("helvetica","bold");doc.setTextColor(20);
    doc.text("Vizualizeaza in configurator",105,y+9.5,{align:"center"});
    doc.link(margin,y+3,178,10,{url:opts.configuratorUrl});
    doc.setFontSize(7);doc.setFont("helvetica","normal");doc.text("Link catre configuratia exportata, valabil 30 de zile.",margin,y+18);
  }
  addCabinetPages(doc, { ...opts, technicalViews: (opts.technicalViews ?? []).filter(image => !isKitchenIsometric(image) && !image.label.startsWith("Plan de sus")) });
  if (!planNearRenders) addDimensionedTopPlan(doc, opts);

  const footerY = 285;
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(238, 238, 238);
    doc.rect(0, footerY, pageW, 12, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 101, 96);
    doc.text("asab-design.ro - TVA inclus. Transportul si montajul se oferteaza separat.", margin, footerY + 7);
    doc.setTextColor(20, 20, 20);
    doc.text(`Pagina ${p} / ${totalPages}`, pageW - margin, footerY + 7, { align: "right" });
  }

  return doc;
}

function layoutLabel(layout: LayoutType): string {
  const labels: Record<LayoutType, string> = {
    linear: "Liniara",
    "l-shape": "In colt",
    island: "Cu insula",
    peninsula: "Liniara",
  };
  return labels[layout];
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}

function collectionLabel(collection?: DesignCollectionId): string {
  return DESIGN_COLLECTIONS.find((item) => item.id === collection)?.name ?? "Japandi";
}

function budgetLabel(range?: BudgetPreference["range"]): string {
  return BUDGET_OPTIONS.find((item) => item.id === range)?.label ?? "Nu stiu inca";
}

function budgetPriorityLabel(priority?: BudgetPreference["priority"]): string {
  const labels: Record<BudgetPreference["priority"], string> = {
    price: "Pret eficient",
    balanced: "Echilibru",
    premium: "Finisaje premium",
  };
  return labels[priority ?? "balanced"];
}

function wallColorLabel(color?: string): string {
  if (!color) return "Alb cald";
  return WALL_COLOR_OPTIONS.find((item) => item.value.toLowerCase() === color.toLowerCase())?.label ?? color;
}

function floorTextureLabel(texture?: RoomFinishes["floorTexture"]): string {
  return FLOOR_TEXTURE_OPTIONS.find((item) => item.id === texture)?.label ?? "Lemn deschis";
}

function backsplashLabel(texture?: RoomFinishes["backsplashTexture"]): string {
  return BACKSPLASH_OPTIONS.find((item) => item.id === texture)?.label ?? "Placi albe";
}

export async function exportKitchenPDF(opts: PDFExportOptions) {
  createKitchenPDF(opts).save(`ASAB-Bucatarie-${Date.now()}.pdf`);
}

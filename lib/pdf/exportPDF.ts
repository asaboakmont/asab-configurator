import jsPDF from "jspdf";
import { BACKSPLASH_OPTIONS, BUDGET_OPTIONS, DESIGN_COLLECTIONS, FLOOR_TEXTURE_OPTIONS, WALL_COLOR_OPTIONS } from "@/data/designCollections";
import type { BudgetPreference, Cabinet, Colorway, DesignCollectionId, LayoutType, RoomConstraints, RoomFinishes, WallDimensions } from "@/types/kitchen";

interface PDFExportOptions {
  cabinets:    Cabinet[];
  colorway:    Colorway;
  handle:      string;
  totalPrice:  number;
  layout:      LayoutType;
  dimensions:  WallDimensions;
  screenshot?: string;
  screenshots?: { label: string; dataUrl: string; aspect: number }[];
  cartUrl?:    string;
  contact?:    { name: string; email: string; phone: string };
  constraints?: RoomConstraints;
  collection?: DesignCollectionId;
  budget?: BudgetPreference;
  roomFinishes?: RoomFinishes;
}

export async function exportKitchenPDF(opts: PDFExportOptions) {
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

  doc.setFillColor(15, 14, 13);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(245, 240, 232);
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
      const imgW = pageW - margin * 2;                 // 178 mm
      const naturalH = imgW * image.aspect;            // mm at correct aspect
      const maxH = pageH - 60;                         // leave room for header + caption + footer
      const imgH = Math.min(maxH, naturalH);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 14, 13);
      doc.text(image.label, margin, 35);
      doc.addImage(image.dataUrl, "PNG", margin, 41, imgW, imgH, undefined, "SLOW");
      doc.setDrawColor(200, 184, 154);
      doc.setLineWidth(0.3);
      doc.rect(margin, 41, imgW, imgH);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 101, 96);
      doc.text("Randare generata din configuratia 3D. Configuratie preliminara, necesita verificare tehnica.", margin, 45 + imgH);
    } catch(e) { /* skip */ }
  });

  if (renderImages.length > 0) {
    doc.addPage();
  }
  let y = 38;
  doc.setTextColor(15, 14, 13);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Rezumat configuratie", margin, y);
  y += 8;

  const summaryRows: [string, string][] = [
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
    ["Manere",       handle === "inox" ? "Inox" : "Negru Mat"],
    ["Pereti", wallColorLabel(roomFinishes?.wallColor)],
    ["Pardoseala", floorTextureLabel(roomFinishes?.floorTexture)],
    ["Faianta / backsplash", backsplashLabel(roomFinishes?.backsplashTexture)],
    ["Ferestre / usi", `${constraints?.openings?.length ?? 0}`],
    ["Gheuri / obstacole", `${constraints?.obstructions?.length ?? 0}`],
    ["Puncte tehnice", `${constraints?.servicePoints?.length ?? 0}`],
    ["Centrala", constraints?.boiler ? "Da" : "Nu"],
  ];

  summaryRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 14, 13);
    doc.text(k, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 101, 96);
    doc.text(v, 65, y);
    y += 6;
  });

  const swatchX = pageW - margin - 30;
  doc.setFillColor(...hexToRgb(colorway.doorHex));
  doc.roundedRect(swatchX, 38, 20, 28, 2, 2, "F");
  doc.setFillColor(...hexToRgb(colorway.worktopHex));
  doc.roundedRect(swatchX + 21, 38, 9, 28, 2, 2, "F");

  y = Math.max(y, 80) + 4;
  doc.setDrawColor(200, 184, 154);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 14, 13);
  doc.text("Lista dulapuri", margin, y);
  y += 8;

  doc.setFillColor(237, 232, 223);
  doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 101, 96);
  doc.text("COD",        margin + 1,          y);
  doc.text("PRODUS",     margin + 22,          y);
  doc.text("DIM (cm)",   margin + 90,          y);
  doc.text("PERETE",     margin + 130,         y);
  doc.text("PRET (RON)", pageW - margin - 1,   y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 14, 13);
  cabinets.forEach((cab, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (i % 2 === 0) {
      doc.setFillColor(250, 248, 244);
      doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
    }
    doc.setFontSize(8);
    doc.text(cab.sku,                                    margin + 1,        y);
    doc.text(cab.label ?? cab.sku,                       margin + 22,       y);
    doc.text(`${cab.width}x${cab.height}x${cab.depth}`,  margin + 90,       y);
    doc.text(cab.wall,                                   margin + 130,      y);
    doc.text(cab.price.toLocaleString("ro-RO"),          pageW - margin - 1, y, { align: "right" });
    y += 7;
  });

  // Worktop row
  const worktopLengthCm =
    dimensions.wallA +
    (layout === "l-shape" ? (dimensions.wallB ?? 0) : 0) +
    (layout === "island" || dimensions.hasIsland ? (dimensions.islandWidth ?? 0) : 0);
  const worktopMeters = Math.ceil(worktopLengthCm / 100);
  const worktopLabel = colorway.worktop === "stejar" ? "Blat stejar" : "Blat gri piatra";
  const worktopPrice = worktopMeters * 180;
  if (cabinets.length % 2 === 0) {
    doc.setFillColor(250, 248, 244);
    doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
  }
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 14, 13);
  doc.text(colorway.worktop === "stejar" ? "BL-STEJAR" : "BL-GRIS", margin + 1, y);
  doc.text(worktopLabel, margin + 22, y);
  doc.text(`${worktopLengthCm} cm`, margin + 90, y);
  doc.text("-", margin + 130, y);
  doc.text(worktopPrice.toLocaleString("ro-RO"), pageW - margin - 1, y, { align: "right" });
  y += 7;

  y += 2;
  // Ensure total + button + footer fit — add page if needed
  if (y > 230) { doc.addPage(); y = 20; }
  doc.setDrawColor(200, 184, 154);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(140, 106, 63);
  doc.text("TOTAL ESTIMAT", margin, y);
  doc.text(`${totalPrice.toLocaleString("ro-RO")} RON`, pageW - margin, y, { align: "right" });

  y += 12;
  if (y > 246) { doc.addPage(); y = 20; }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 14, 13);
  doc.text("Urmatorii pasi", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  [
    "Verificam dimensiunile, peretii si obstacolele.",
    "Confirmam pozitia chiuvetei, plitei, hotei si electrocasnicelor.",
    "Actualizam configuratia daca este nevoie.",
    "Primesti oferta finala si instructiunile pentru comanda.",
  ].forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });
  doc.setTextColor(140, 106, 63);
  doc.text("Configuratie preliminara, necesita verificare tehnica inainte de productie.", margin, y + 2);

  if (opts.cartUrl) {
    y += 12;
    if (y > 260) { doc.addPage(); y = 20; }
    const btnW = pageW - margin * 2;
    const btnH = 14;
    doc.setFillColor(140, 106, 63);
    doc.roundedRect(margin, y, btnW, btnH, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("CONTINUA SPRE COMANDA", pageW / 2, y + 9, { align: "center" });
    doc.link(margin, y, btnW, btnH, { url: opts.cartUrl });
    y += btnH + 4;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 101, 96);
    doc.text(opts.cartUrl.substring(0, 80), pageW / 2, y, { align: "center" });
  }

  const footerY = 285;
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(237, 232, 223);
    doc.rect(0, footerY, pageW, 12, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 101, 96);
    doc.text("asab-design.ro  ·  Preturile sunt estimative si nu includ TVA, transport sau montaj.", margin, footerY + 7);
    doc.setTextColor(140, 106, 63);
    doc.text(`Pagina ${p} / ${totalPages}`, pageW - margin, footerY + 7, { align: "right" });
  }

  doc.save(`ASAB-Bucatarie-${Date.now()}.pdf`);
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
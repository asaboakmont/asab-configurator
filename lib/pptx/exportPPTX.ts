import { cabinetDocumentSku } from "@/lib/pricing/catalogPrices";
import JSZip from "jszip";
import type { PDFExportOptions } from "@/lib/pdf/exportPDF";
import { calculateExportPricing } from "@/lib/pricing/exportPricing";

const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const parse = (xml: string) => new DOMParser().parseFromString(xml.replace(/^\uFEFF/, ""), "application/xml");
const serialize = (xml: Document) => new XMLSerializer().serializeToString(xml);
const money = (value: number) => `${value.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} RON`;

function setText(doc: Document, name: string, value: string) {
  const shape = Array.from(doc.getElementsByTagNameNS(P, "sp")).find(sp =>
    sp.getElementsByTagNameNS(P, "cNvPr")[0]?.getAttribute("name") === name);
  if (!shape) throw new Error(`Lipseste campul PowerPoint: ${name}`);
  const body = shape.getElementsByTagNameNS(P, "txBody")[0];
  let texts = Array.from(body.getElementsByTagNameNS(A, "t"));
  if (!texts.length) {
    const paragraph = body.getElementsByTagNameNS(A, "p")[0];
    const run = doc.createElementNS(A, "a:r");
    const properties = doc.createElementNS(A, "a:rPr");
    properties.setAttribute("sz", "1400");
    run.appendChild(properties);
    const text = doc.createElementNS(A, "a:t");
    run.appendChild(text);
    paragraph.insertBefore(run, paragraph.getElementsByTagNameNS(A, "endParaRPr")[0] ?? null);
    texts = [text];
  }
  texts[0].textContent = value;
  texts.slice(1).forEach(text => { text.textContent = ""; });
}

/** Fill the same native slide objects used by the Blender add-on. */
export async function buildKitchenPPTX(template: ArrayBuffer, opts: PDFExportOptions): Promise<Blob> {
  const zip = await JSZip.loadAsync(template);
  const read = async (path: string) => {
    const file = zip.file(path);
    if (!file) throw new Error(`Sablon PowerPoint incomplet: ${path}`);
    return parse(await file.async("string"));
  };
  const write = (path: string, doc: Document) => zip.file(path, serialize(doc));
  const patch = async (number: number, values: Record<string, string>) => {
    const path = `ppt/slides/slide${number}.xml`;
    const doc = await read(path);
    Object.entries(values).forEach(([name, value]) => setText(doc, name, value));
    write(path, doc);
  };
  const { cabinetSubtotal, worktopPrice, worktopDescription, total } = calculateExportPricing(opts.cabinets, opts.layout, opts.dimensions);
  const project = `ASAB-${new Date().toISOString().slice(0, 10)}`;
  await patch(1, {
    CLIENT: `Client: ${opts.contact?.name || ""}`,
    DATE: `Data: ${new Date().toLocaleDateString("ro-RO")}`,
    CONSULTANT: "ASAB Design",
  });
  // Add native, editable customer fields beneath the existing cover information.
  const cover = await read("ppt/slides/slide1.xml");
  const clientShape = Array.from(cover.getElementsByTagNameNS(P, "sp")).find(sp => sp.getElementsByTagNameNS(P, "cNvPr")[0]?.getAttribute("name") === "CLIENT")!;
  const allIds = Array.from(cover.getElementsByTagNameNS(P, "cNvPr")).map(node => Number(node.getAttribute("id")));
  let nextId = Math.max(...allIds) + 1;
  clientShape.getElementsByTagNameNS(A, "ext")[0].setAttribute("cy", "457200");
  const bodyProperties = clientShape.getElementsByTagNameNS(A, "bodyPr")[0];
  for (const inset of ["lIns", "rIns", "tIns", "bIns"]) bodyProperties.setAttribute(inset, "0");
  bodyProperties.setAttribute("wrap", "square");
  for (const [name, y] of [["DATE", 4500000], ["CONSULTANT", 4900050]] as const) {
    const shape = Array.from(cover.getElementsByTagNameNS(P, "sp")).find(sp => sp.getElementsByTagNameNS(P, "cNvPr")[0]?.getAttribute("name") === name)!;
    shape.getElementsByTagNameNS(A, "off")[0].setAttribute("y", String(y));
  }
  for (const [name, text, y] of [
    ["CUSTOMER_PHONE", opts.contact?.phone ? `Telefon: ${opts.contact.phone}` : "", 5300100],
    ["CUSTOMER_CITY", opts.contact?.city ? `Localitate: ${opts.contact.city}` : "", 5700150],
  ] as const) {
    const shape = clientShape.cloneNode(true) as Element;
    const properties = shape.getElementsByTagNameNS(P, "cNvPr")[0];
    properties.setAttribute("id", String(nextId++)); properties.setAttribute("name", name);
    Array.from(properties.children).forEach(child => child.remove());
    shape.getElementsByTagNameNS(A, "off")[0].setAttribute("y", String(y));
    clientShape.parentNode!.appendChild(shape);
    setText(cover, name, text);
  }
  if (opts.configuratorUrl) {
    const shape = clientShape.cloneNode(true) as Element;
    const properties = shape.getElementsByTagNameNS(P, "cNvPr")[0];
    properties.setAttribute("id", String(nextId++)); properties.setAttribute("name", "CONFIGURATOR_CTA");
    Array.from(properties.children).forEach(child => child.remove());
    shape.getElementsByTagNameNS(A, "off")[0].setAttribute("y", "6200000");
    shape.getElementsByTagNameNS(A, "ext")[0].setAttribute("cy", "190500");
    clientShape.parentNode!.appendChild(shape); setText(cover, "CONFIGURATOR_CTA", "Vizualizeaza in configurator");
    const run = shape.getElementsByTagNameNS(A, "rPr")[0];run.setAttribute("sz","1100");run.setAttribute("u","sng");
    const click = cover.createElementNS(A,"a:hlinkClick");click.setAttributeNS(R,"r:id","rIdASABConfigurator");run.appendChild(click);
    const rels = await read("ppt/slides/_rels/slide1.xml.rels");
    const rel = rels.createElementNS(REL,"Relationship");rel.setAttribute("Id","rIdASABConfigurator");rel.setAttribute("Type",`${R}/hyperlink`);rel.setAttribute("Target",opts.configuratorUrl);rel.setAttribute("TargetMode","External");rels.documentElement.appendChild(rel);
    write("ppt/slides/_rels/slide1.xml.rels",rels);
  }
  write("ppt/slides/slide1.xml", cover);
  await patch(4, {
    TITLE: "Dulapuri si blat",
    SUBTITLE: "Valoarea dulapurilor si a blatului",
    TERMS_TITLE: "Calcul oferta",
    DELIVERY_LABEL: "Subtotal dulapuri", DELIVERY: money(cabinetSubtotal),
    LEAD_TIME_LABEL: "Blat", LEAD_TIME: money(worktopPrice),
    ADVANCE_LABEL: "Numar corpuri", ADVANCE: String(opts.cabinets.length),
    WORKTOP_LINE: `Blat inclus: ${worktopDescription || "0 cm"}.`,
    TOTAL_LABEL: "TOTAL DULAPURI + BLAT", GRAND_TOTAL: money(total),
    TOTAL_NOTE: "Pret estimativ. TVA, transportul si montajul nu sunt incluse.",
  });

  const listTemplate = await zip.file("ppt/slides/slide2.xml")!.async("string");
  const listRels = await read("ppt/slides/_rels/slide2.xml.rels");
  // Duplicated slides must not share the source slide's notes relationship.
  Array.from(listRels.documentElement.children).forEach(rel => {
    if (rel.getAttribute("Type")?.endsWith("/notesSlide")) rel.remove();
  });
  const pages = Math.max(1, Math.ceil(opts.cabinets.length / 12));
  const listNumbers = Array.from({ length: pages }, (_, i) => i === 0 ? 2 : i === 1 ? 3 : i + 6);
  for (let page = 0; page < pages; page++) {
    const number = listNumbers[page];
    const doc = parse(listTemplate);
    setText(doc, "PROJECT_ID", `Proiect: ${project}`);
    setText(doc, "SUBTITLE", `${opts.colorway.name} / ${opts.collection ?? "Japandi"}`);
    setText(doc, "NOTES", "Dimensiuni L x H x A in cm. Preturi dulapuri.");
    for (let i = 0; i < 12; i++) {
      const cabinet = opts.cabinets[page * 12 + i];
      setText(doc, `CABINET_${i + 1}`, cabinet
        ? `${page * 12 + i + 1}. ${cabinetDocumentSku(cabinet)}${cabinet.drainerSku ? " + scurgator inclus" : ""}${cabinet.isCustom ? " ***dimensiune personalizata" : ""} / ${cabinet.width}x${cabinet.height}x${cabinet.depth} / ${cabinet.placementMode === "free" ? "Liber" : cabinet.wall} / ${money(cabinet.price ?? 0)}`
        : "");
    }
    write(`ppt/slides/slide${number}.xml`, doc);
    write(`ppt/slides/_rels/slide${number}.xml.rels`, listRels);
  }

  const order = [1, ...listNumbers, 4, 5, 6, 7];
  const presentation = await read("ppt/presentation.xml");
  const ids = presentation.getElementsByTagNameNS(P, "sldIdLst")[0];
  ids.replaceChildren();
  const relationships = await read("ppt/_rels/presentation.xml.rels");
  Array.from(relationships.documentElement.children).forEach(rel => {
    if (rel.getAttribute("Type") === `${R}/slide`) rel.remove();
  });
  const types = await read("[Content_Types].xml");
  for (let i = 0; i < order.length; i++) {
    const number = order[i];
    const relId = `rIdASAB${number}`;
    const id = presentation.createElementNS(P, "p:sldId");
    id.setAttribute("id", String(256 + i));
    id.setAttributeNS(R, "r:id", relId);
    ids.appendChild(id);
    const rel = relationships.createElementNS(REL, "Relationship");
    rel.setAttribute("Id", relId); rel.setAttribute("Type", `${R}/slide`);
    rel.setAttribute("Target", `slides/slide${number}.xml`);
    relationships.documentElement.appendChild(rel);
    if (number >= 8) {
      const override = types.createElementNS(CT, "Override");
      override.setAttribute("PartName", `/ppt/slides/slide${number}.xml`);
      override.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.presentationml.slide+xml");
      types.documentElement.appendChild(override);
    }
    await patch(number, { ASAB_PAGE: String(i + 1).padStart(2, "0") });
  }
  write("ppt/presentation.xml", presentation);
  write("ppt/_rels/presentation.xml.rels", relationships);
  const app = await read("docProps/app.xml");
  const count = app.getElementsByTagName("Slides")[0];
  if (count) count.textContent = String(order.length);
  write("docProps/app.xml", app);

  const screenshots = opts.screenshots ?? [];
  // Native pictures remain individually replaceable in PowerPoint.
  for (const [number, image] of [[1, screenshots[0]], [5, screenshots[0]], [6, screenshots[1]], [7, screenshots[2]]] as const) {
    if (!image) continue;
    if (!image.dataUrl.startsWith("data:image/png;base64,")) throw new Error("Format randare invalid.");
    const media = `asab-render-${number}.png`;
    zip.file(`ppt/media/${media}`, image.dataUrl.split(",")[1], { base64: true });
    const doc = await read(`ppt/slides/slide${number}.xml`);
    const rels = await read(`ppt/slides/_rels/slide${number}.xml.rels`);
    const picture = doc.getElementsByTagNameNS(P, "pic")[0];
    if (!picture) throw new Error("Lipseste cadrul pentru randare.");
    const blip = picture.getElementsByTagNameNS(A, "blip")[0];
    const imageId = blip.getAttributeNS(R, "embed");
    const rel = Array.from(rels.documentElement.children).find(node => node.getAttribute("Id") === imageId);
    if (!rel) throw new Error("Lipseste imaginea din sablon.");
    rel.setAttribute("Target", `../media/${media}`);
    const transform = picture.getElementsByTagNameNS(A, "xfrm")[0];
    const off = transform.getElementsByTagNameNS(A, "off")[0];
    const ext = transform.getElementsByTagNameNS(A, "ext")[0];
    const width = Number(ext.getAttribute("cx")), height = Number(ext.getAttribute("cy"));
    const fittedWidth = Math.min(width, height / image.aspect), fittedHeight = fittedWidth * image.aspect;
    off.setAttribute("x", String(Math.round(Number(off.getAttribute("x")) + (width - fittedWidth) / 2)));
    off.setAttribute("y", String(Math.round(Number(off.getAttribute("y")) + (height - fittedHeight) / 2)));
    ext.setAttribute("cx", String(Math.round(fittedWidth))); ext.setAttribute("cy", String(Math.round(fittedHeight)));
    Array.from(picture.getElementsByTagNameNS(A, "srcRect")).forEach(node => node.remove());
    if (number > 1) setText(doc, "RENDER_TITLE", image.label);
    write(`ppt/slides/slide${number}.xml`, doc);
    write(`ppt/slides/_rels/slide${number}.xml.rels`, rels);
  }
  write("[Content_Types].xml", types);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", compression: "DEFLATE" });
}

export async function exportKitchenPPTX(opts: PDFExportOptions) {
  const response = await fetch("/api/exports/pptx-template", { cache: "no-store" });
  if (!response.ok) throw new Error(`Sablonul PowerPoint nu este disponibil (HTTP ${response.status}). Reincarcati pagina; daca eroarea persista, versiunea publicata necesita redeploy.`);
  const template = await response.arrayBuffer();
  const signature = new Uint8Array(template, 0, Math.min(4, template.byteLength));
  if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) {
    throw new Error("Serverul nu a returnat un sablon PowerPoint valid. Verificati versiunea publicata.");
  }
  const blob = await buildKitchenPPTX(template, opts);
  // Keep the prepared file available for a direct user click. An automatic
  // click after asynchronous rendering can lose the browser's user activation.
  return { url: URL.createObjectURL(blob), filename: `ASAB-Bucatarie-${Date.now()}.pptx` };
}

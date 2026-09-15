import type { CatalogProduct } from "./schema";
export const CSV_COLUMNS = ["sku", "name", "description", "collectionId", "category", "widthMm", "heightMm", "depthMm", "price", "modelUrl", "active"] as const;
/** Quoted fields, escaped quotes, CRLF, UTF-8 BOM and comma/semicolon delimiters. */
export function parseProductCSV(input: string): CatalogProduct[] {
  if (input.length > 2_000_000) throw new Error("CSV prea mare (maxim 2 MB).");
  const text = input.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter = first.includes(";") ? ";" : ",";
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false, closed = false;
  const addField = () => { row.push(field); field = ""; closed = false; };
  const addRow = () => { addField(); if (row.some(v => v.trim())) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += c;
    } else if (c === delimiter) addField();
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; addRow(); }
    else if (c === '"' && !field && !closed) quoted = true;
    else { if (closed || c === '"') throw new Error("Ghilimele CSV invalide."); field += c; }
  }
  if (quoted) throw new Error("Camp CSV cu ghilimele neinchise.");
  if (field || row.length || closed) addRow();
  const header = rows.shift()?.map(v => v.trim()) ?? [];
  if (header.length !== CSV_COLUMNS.length || new Set(header).size !== header.length || CSV_COLUMNS.some(key => !header.includes(key))) throw new Error(`Coloane necesare: ${CSV_COLUMNS.join(", ")}`);
  if (!rows.length || rows.length > 500) throw new Error("CSV trebuie sa contina 1–500 produse.");
  return rows.map((values, i) => {
    if (values.length !== header.length) throw new Error(`Rand ${i + 2}: numar incorect de coloane.`);
    const r = Object.fromEntries(header.map((key, j) => [key, values[j].trim()]));
    if (!["true", "false"].includes(r.active)) throw new Error(`Rand ${i + 2}: active trebuie sa fie true sau false.`);
    const numeric = (key: string) => { if (!r[key]) throw new Error(`Rand ${i + 2}: lipseste ${key}.`); return Number(r[key].replace(",", ".")); };
    return { ...r, widthMm: numeric("widthMm"), heightMm: numeric("heightMm"), depthMm: numeric("depthMm"), price: numeric("price"), active: r.active === "true" } as unknown as CatalogProduct;
  });
}
export function productsCSV(products: CatalogProduct[]) {
  // Quoting alone does not prevent spreadsheet formula execution.
  const cell = (value: unknown) => { const text = String(value ?? ""); return '"' + (/^[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'; };
  return '\uFEFF' + [CSV_COLUMNS.join(","), ...products.map(p => CSV_COLUMNS.map(key => cell(p[key])).join(","))].join("\r\n");
}

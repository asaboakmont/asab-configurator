export const CATEGORIES = {
  base: "Corp inferior", wall: "Corp suspendat", tall: "Soldat",
  panel: "Placari si filler pieces", accessory: "Accesorii",
} as const;
export type ProductCategory = keyof typeof CATEGORIES;
export interface CatalogCollection { id: string; name: string; description: string; active: boolean; }
export interface CatalogProduct {
  sku: string; name: string; description: string; collectionId: string; category: ProductCategory;
  widthMm: number; heightMm: number; depthMm: number; price: number;
  modelUrl: string; active: boolean;
}
export interface Catalog { revision: number; collections: CatalogCollection[]; products: CatalogProduct[]; }
export const EMPTY_CATALOG: Catalog = { revision: 0, collections: [
  { id: "japandi", name: "Japandi", description: "", active: true },
  { id: "franc", name: "Franc", description: "", active: true },
  { id: "germain", name: "Germain", description: "", active: true },
], products: [] };
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Date invalide.");
  return value as Record<string, unknown>;
};
function text(value: unknown, name: string, max: number, optional = false): string {
  if (typeof value !== "string" || value.trim().length > max || (!optional && !value.trim())) throw new Error(`${name}: text obligatoriu, maxim ${max} caractere.`);
  return value.trim();
}
function active(value: unknown) {
  if (typeof value !== "boolean") throw new Error("Campul active trebuie sa fie true sau false.");
  return value;
}
function number(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name}: valoare intre ${min} si ${max}.`);
  return value;
}
export function parseCollection(value: unknown): CatalogCollection {
  const row = record(value);
  const id = text(row.id, "ID colectie", 60);
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error("ID colectie: litere mici, cifre si cratima.");
  return { id, name: text(row.name, "Nume colectie", 100), description: text(row.description ?? "", "Descriere", 2000, true), active: active(row.active) };
}
export function isCatalogModelUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname) && url.pathname.startsWith("/catalog/") && url.pathname.endsWith(".glb") && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}
export function parseProduct(value: unknown, collections: CatalogCollection[]): CatalogProduct {
  const row = record(value);
  const sku = text(row.sku, "SKU", 80);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(sku)) throw new Error("SKU: doar litere, cifre, punct, cratima si underscore.");
  const collectionId = text(row.collectionId, "Colectie", 60);
  if (!collections.some(c => c.id === collectionId)) throw new Error(`Colectie inexistenta: ${collectionId}. Creati colectia inaintea produselor.`);
  if (typeof row.category !== "string" || !Object.hasOwn(CATEGORIES, row.category)) throw new Error("Categorie invalida.");
  const modelUrl = text(row.modelUrl ?? "", "GLB", 500, true);
  if (modelUrl && !isCatalogModelUrl(modelUrl)) throw new Error("Folositi un GLB incarcat prin catalog.");
  const enabled = active(row.active);
  if (enabled && !modelUrl) throw new Error("Incarcati GLB inainte de activarea produsului.");
  return {
    sku, collectionId, category: row.category as ProductCategory,
    name: text(row.name, "Nume produs", 140), description: text(row.description ?? "", "Descriere", 4000, true),
    widthMm: number(row.widthMm, "Latime mm", 1, 10000), heightMm: number(row.heightMm, "Inaltime mm", 1, 10000), depthMm: number(row.depthMm, "Adancime mm", 1, 10000),
    price: Math.round(number(row.price, "Pret RON", 0, 1000000) * 100) / 100,
    modelUrl, active: enabled,
  };
}
export const productKey = (p: Pick<CatalogProduct, "sku" | "collectionId">) => `${p.collectionId}/${p.sku.toLowerCase()}`;
export function mergeProducts(catalog: Catalog, rows: unknown[]): CatalogProduct[] {
  if (!rows.length || rows.length > 500) throw new Error("Importati intre 1 si 500 produse odata.");
  const parsed = rows.map((row, i) => { try { return parseProduct(row, catalog.collections); } catch (e) { throw new Error(`Rand ${i + 2}: ${(e as Error).message}`); } });
  const keys = parsed.map(productKey);
  if (new Set(keys).size !== keys.length) throw new Error("SKU duplicat in aceeasi colectie in fisierul importat.");
  const products = new Map(catalog.products.map(p => [productKey(p), p]));
  parsed.forEach(p => products.set(productKey(p), p));
  if (products.size > 5000) throw new Error("Limita catalog: 5000 produse.");
  return [...products.values()];
}

export const catalogModelPath = (url: string) => `/api/internal/catalog/model?url=${encodeURIComponent(url)}`;

import rows from '@/data/nativeCatalogueData';
import { REVISED_CATALOGUE } from '@/data/revisedCatalogue';
import { MODEL_FAMILIES } from '@/lib/pricing/catalogPrices';
import type { Cabinet, CabinetType, DesignCollectionId } from '@/types/kitchen';

export interface NativeProduct {
  sku: string; baseSku: string; collection: string; label: string; type: CabinetType;
  widthMm: number; bodyHeightMm: number; bodyDepthMm: number; legHeightMm: number;
  price: number | null; active: boolean; modelUrl: string;
  mountHeightCm?: number; cornerSide?: 'STG' | 'DR'; note?: string;
}
// Keep the approved price table authoritative. Export-manifest prices are provenance only.
export const NATIVE_CATALOGUE: NativeProduct[] = (rows as NativeProduct[]).map(product => {
  if (!product.active) return product; // Oven drawer variants require explicit pricing approval.
  const priceKey = product.baseSku.replace(/-CPT-USA-W/, '-CPT-US-W').replace(/-COM$/, '');
  const source = REVISED_CATALOGUE.find(row => row.sku === priceKey);
  const collection = product.collection === 'smart' ? 'soho' : product.collection === 'common' ? 'japandi' : product.collection as 'japandi' | 'germain' | 'franc';
  const price = source?.prices[collection] ?? null;
  return { ...product, mountHeightCm: product.baseSku.startsWith("ASAB-SP-") ? 220 : product.sku === "ASB-SINA" ? 215 : product.mountHeightCm, price, active: price != null, note: product.sku === 'ASAB-CS-2F-LIFT-W1000-GRM' && price !== 415 ? undefined : product.note };
});
export const NATIVE_SUFFIXES: Record<DesignCollectionId, string> = { smart: 'SMT', japandi: 'JPN', germain: 'GRM', franc: 'FRC' };
export function nativeBase(sku: string) { return sku.replace(/-(SMT|JPN|GRM|FRC|SOH)$/i, ''); }
function family(sku: string) {
  const base = nativeBase(sku);
  return (MODEL_FAMILIES[base] ?? base.replace(/-W\d+$/, '')).replace(/-CPT-US$/, '-CPT-USA');
}
/** Exact nominal widths only. Unknown legacy products keep their existing renderer. */
export function nativeProduct(sku: string, widthCm: number, collection: DesignCollectionId) {
  if (nativeBase(sku) === "ASB-SINA" && widthCm === 200) return NATIVE_CATALOGUE.find(p => p.sku === "ASB-SINA");
  if (Math.abs(widthCm * 10 - Math.round(widthCm * 10)) > 1e-6) return undefined;
  const key = `${family(sku)}-W${String(Math.round(widthCm * 10)).padStart(4, '0')}-${NATIVE_SUFFIXES[collection]}`;
  return NATIVE_CATALOGUE.find(p => p.sku === key);
}
/** Custom widths retain the real source mesh and scale along X only. */
export function nativeModel(cabinet: Cabinet, collection: DesignCollectionId) {
  if (cabinet.catalogProduct) return undefined;
  const key = cabinet.baseSku ?? cabinet.sku;
  return nativeProduct(key, cabinet.width, collection)
    ?? nativeProduct(key, cabinet.standardWidth ?? cabinet.width, collection);
}
export function nativeDimensions(product: NativeProduct) {
  if (product.type === "accessory") return { height: product.bodyHeightMm / 10, depth: product.bodyDepthMm / 10 };
  return { height: (product.bodyHeightMm + product.legHeightMm) / 10, depth: (product.bodyDepthMm + 18) / 10 };
}
export function compatibleDrainer(cabinet: Cabinet, collection: DesignCollectionId) {
  const model = nativeModel(cabinet, collection);
  if (!model || !model.active || cabinet.type !== 'wall' ||
      !/^ASAB-CS-[12]U-RAFT-W/.test(model.baseSku) ||
      Math.abs(model.widthMm - cabinet.width * 10) > 1e-6) return undefined;
  return NATIVE_CATALOGUE.find(p => p.collection === 'common' && p.sku.startsWith('ASAB-ACC-SCURG-') && p.widthMm === model.widthMm);
}
export function installedDrainer(cabinet: Cabinet, collection: DesignCollectionId) {
  const product = compatibleDrainer(cabinet, collection);
  return product?.sku === cabinet.drainerSku ? product : undefined;
}
/** Recompute from the cabinet-only price, so restoring/switching never adds twice. */
export function priceWithDrainer(cabinet: Cabinet, collection: DesignCollectionId): Cabinet {
  const drainer = installedDrainer(cabinet, collection);
  return { ...cabinet, drainerSku: drainer?.sku, label: drainer ? `${cabinet.label ?? "Corp suspendat"} + scurgator` : cabinet.label,
    price: cabinet.price + (drainer?.price ?? 0),
    pricingNote: [cabinet.pricingNote, drainer ? `Scurgator inclus: ${drainer.sku}, ${drainer.price} RON. Polita inlocuita de scurgator.` : ''].filter(Boolean).join(' ') || undefined };
}

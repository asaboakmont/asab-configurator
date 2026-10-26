import { priceDesignPiece } from "@/lib/asab/designPieces";
import { NATIVE_CATALOGUE, nativeProduct, nativeModel, nativeDimensions, priceWithDrainer } from "@/lib/catalog/nativeCatalogue";
import { revisedPrice } from "@/lib/pricing/catalogPrices";
import { customCabinetLabel } from "@/lib/asab/cabinetSizing";
import type { Cabinet, CabinetType, CustomCabinetPricing, DesignCollectionId } from "@/types/kitchen";
import { calculateCustomCabinetPrice } from "@/lib/pricing/customCabinetPrice";

export interface SkuDefinition {
  catalogProduct?: import("@/lib/catalog/schema").CatalogProduct;
  sku:         string;
  type:        CabinetType;
  width:       number;
  height:      number;
  depth:       number;
  price:       number;
  label:       string;
  cornerSide?: "STG" | "DR";
  customPricing?: CustomCabinetPricing;
}

export const CUSTOM_CABINET_PRICING: Record<"base" | "wall" | "tall", CustomCabinetPricing> = {
  base: { extraWidthPerMeter: 350, customSurchargePercent: 15, minimumCustomPricePercent: 90 },
  wall: { extraWidthPerMeter: 280, customSurchargePercent: 15, minimumCustomPricePercent: 90 },
  tall: { extraWidthPerMeter: 450, customSurchargePercent: 18, minimumCustomPricePercent: 90 },
};

export const BASE_CABINETS: SkuDefinition[] = [
  { sku: "1001-DR",  type: "base-corner",     width: 95, height: 86.2, depth: 52.8, price: 706,  label: "CI Colt 950mm Dreapta",       cornerSide: "DR" },
  { sku: "1001-STG", type: "base-corner",     width: 95, height: 86.2, depth: 52.8, price: 706,  label: "CI Colt 950mm Stanga",        cornerSide: "STG" },
  { sku: "1003",     type: "base-drawer",     width: 60, height: 86.2, depth: 52.8, price: 794,  label: "CI 600mm 3 Sertare" },
  { sku: "1004",     type: "base",            width: 50, height: 86.2, depth: 52.8, price: 493,  label: "CI 500mm 1 Usa" },
  { sku: "1005",     type: "base-sink",       width: 80, height: 86.2, depth: 52.8, price: 571,  label: "CI 800mm Chiuveta 2 Usi" },
  { sku: "1006",     type: "base-oven",       width: 60, height: 86.2, depth: 52.8, price: 427,  label: "CI 600mm Cuptor 1 Usa" },
  { sku: "1007",     type: "base-sink",       width: 60, height: 86.2, depth: 52.8, price: 528,  label: "CI 600mm Chiuveta 1 Usa" },
  { sku: "1008",     type: "base",            width: 40, height: 86.2, depth: 52.8, price: 346,  label: "CI 400mm 1 Usa" },
  { sku: "1010",     type: "base",            width: 60, height: 86.2, depth: 52.8, price: 528,  label: "CI 600mm 1 Usa" },
  { sku: "1013",     type: "base",            width: 80, height: 86.2, depth: 52.8, price: 571,  label: "CI 800mm 2 Usi" },
  { sku: "1014",     type: "base",            width: 45, height: 86.2, depth: 52.8, price: 483,  label: "CI 450mm 1 Usa" },
  { sku: "1015",     type: "base-dishwasher", width: 60, height: 86, depth: 53, price: 290,  label: "CI 600mm Front Masina Vase" },
  { sku: "1015-45",  type: "base-dishwasher", width: 45, height: 86, depth: 53, price: 250,  label: "CI 450mm Front Masina Vase" },
  { sku: "1003-HOB-60", type: "base-hob",    width: 60, height: 86.2, depth: 52.8, price: 830,  label: "CI 600mm Plita 3 Sertare" },
  { sku: "1003-HOB-80", type: "base-hob",    width: 80, height: 86.2, depth: 52.8, price: 1000,  label: "CI 800mm Plita 3 Sertare" },
];

export const WALL_CABINETS: SkuDefinition[] = [
  { sku: "2001-DR",  type: "wall-corner", width: 100, height: 70, depth: 31.8, price: 802, label: "CS Colt 1000mm Dreapta", cornerSide: "DR" },
  { sku: "2001-STG", type: "wall-corner", width: 100, height: 70, depth: 31.8, price: 802, label: "CS Colt 1000mm Stanga",  cornerSide: "STG" },
  { sku: "2004",     type: "wall",        width: 50,  height: 70, depth: 31.8, price: 379, label: "CS 500mm 1 Usa" },
  { sku: "2007",     type: "wall-hood",   width: 60,  height: 66, depth: 31.8, price: 389, label: "CS 600mm Hota" },
  { sku: "2008",     type: "wall",        width: 40,  height: 70, depth: 31.8, price: 346, label: "CS 400mm 1 Usa" },
  { sku: "2010",     type: "wall",        width: 60,  height: 70, depth: 31.8, price: 401, label: "CS 600mm 1 Usa" },
  { sku: "2013",     type: "wall",        width: 80,  height: 70, depth: 31.8, price: 533, label: "CS 800mm 2 Usi" },
  { sku: "2014",     type: "wall",        width: 45,  height: 70, depth: 31.8, price: 369, label: "CS 450mm 1 Usa" },
];

export const TALL_CABINETS: SkuDefinition[] = [
  { sku: "1011A", type: "tall",        width: 60, height: 220, depth: 57.8, price: 1565, label: "Soldat 600mm 2 Usi" },
  { sku: "1011B", type: "tall-oven",   width: 60, height: 220, depth: 57.8, price: 1565, label: "Soldat 600mm Cuptor" },
  { sku: "1011C", type: "tall-oven",   width: 60, height: 220, depth: 57.8, price: 1760, label: "Soldat 600mm Cuptor + Microunde" },
  { sku: "1016",  type: "tall-fridge", width: 60, height: 216, depth: 58, price: 1310, label: "Soldat 600mm Frigider" },
];

export const WORKTOP_PRICE_PER_CM = 1.45; // 145 RON per linear meter
export const HANGING_RAIL = { sku: "ASB-SINA", label: "Sina Agatare Suspendate 2000mm", price: 40 };

export const ALL_SKUS: SkuDefinition[] = [
  ...BASE_CABINETS,
  ...WALL_CABINETS,
  ...TALL_CABINETS,
  ...NATIVE_CATALOGUE.filter(p => p.sku === "ASB-SINA" || p.collection === "japandi" && p.active && p.type !== "accessory").map(p => ({ sku: p.baseSku, type: p.type, width: p.widthMm / 10, ...nativeDimensions(p), price: p.price!, label: p.label, cornerSide: p.cornerSide })),
];

export const COLLECTION_SKU_SUFFIX: Record<DesignCollectionId, string> = {
  smart: "smt",
  japandi: "jpn",
  germain: "grm",
  franc: "frc",
};

export const COLLECTION_PRICE_MULTIPLIER: Record<DesignCollectionId, number> = {
  smart: 0.85,
  japandi: 0.85,
  germain: 1,
  franc: 1.48,
};

export function getCollectionFromSku(sku: string): DesignCollectionId | null {
  sku = sku.toLowerCase();
  if (sku.endsWith("-smt")) return "smart";
  if (sku.endsWith("-jpn")) return "japandi";
  if (sku.endsWith("-grm")) return "germain";
  if (sku.endsWith("-frc")) return "franc";
  return null;
}

export function applyCollectionPrice(price: number, collection: DesignCollectionId | null): number {
  if (!collection) return price;

  const multiplier = COLLECTION_PRICE_MULTIPLIER[collection] ?? 1;
  return Math.round(price * multiplier);
}


const COLLECTION_SUFFIX_PATTERN = /-(smt|jpn|grm|frc)$/i;

export function stripCollectionSku(sku: string): string {
  return sku.replace(COLLECTION_SUFFIX_PATTERN, "");
}

export function getCollectionSkuSuffix(collection: DesignCollectionId): string {
  return COLLECTION_SKU_SUFFIX[collection];
}

export function toCollectionSku(sku: string, collection: DesignCollectionId): string {
  const base = stripCollectionSku(sku);
  if (base === "ASB-SINA") return base;
  return `${base}-${base.startsWith("ASAB-") ? getCollectionSkuSuffix(collection).toUpperCase() : getCollectionSkuSuffix(collection)}`;
}

function applyCollectionToCabinetBase(cabinet: Cabinet, collection: DesignCollectionId): Cabinet {
  if (cabinet.catalogProduct) {
    const standardWidth = cabinet.catalogProduct.widthMm / 10;
    const standardPrice = revisedPrice(cabinet.catalogProduct.sku, standardWidth, collection)?.price ?? cabinet.catalogProduct.price;
    const isCustom = cabinet.width !== standardWidth;
    const customPriceBreakdown = isCustom ? calculateCustomCabinetPrice({ standardPrice, standardWidth, customWidth: cabinet.width, pricing: customPricingForType(cabinet.type) }) : undefined;
    const listed = revisedPrice(cabinet.catalogProduct.sku, cabinet.width, collection);
    return { ...cabinet, displaySku: listed?.displaySku, pricingNote: listed?.note, priceSource: listed ? "catalogue" : isCustom ? "custom" : "catalogue", standardWidth, standardPrice, isCustom, customPriceBreakdown: listed ? undefined : customPriceBreakdown, label: customCabinetLabel(cabinet.catalogProduct.name, isCustom), price: listed?.price ?? customPriceBreakdown?.finalPrice ?? standardPrice };
  }
  const baseSku = cabinet.baseSku ?? stripCollectionSku(cabinet.sku);
  const nextSku = toCollectionSku(baseSku, collection);
  const definition = getSkuByCode(nextSku);

  const standardWidth = cabinet.standardWidth ?? definition?.width ?? cabinet.width;
  const standardPrice = definition?.price ?? cabinet.standardPrice ?? cabinet.price;
  const isCustom = cabinet.width !== standardWidth;
  const customPriceBreakdown = isCustom
    ? calculateCustomCabinetPrice({
        standardPrice,
        standardWidth,
        customWidth: cabinet.width,
        pricing: definition?.customPricing ?? customPricingForType(cabinet.type),
      })
    : undefined;

  const listed = revisedPrice(baseSku, cabinet.width, collection);
  return {
    ...cabinet,
    displaySku: listed?.displaySku,
    pricingNote: listed?.note ?? (!listed && !isCustom ? "Pret anterior: modelul nu are echivalent confirmat in catalogul revizuit." : undefined),
    priceSource: listed ? "catalogue" : isCustom ? "custom" : "legacy",
    id: cabinet.id ?? `${baseSku}-${cabinet.wall}-${cabinet.type}-${cabinet.xPos}`,
    sku: nextSku,
    baseSku,
    standardWidth,
    standardPrice,
    isCustom,
    label: customCabinetLabel(listed ? `${listed.name} ${Math.round(cabinet.width * 10)} mm` : cabinet.label ?? definition?.label ?? baseSku, isCustom),
    customPriceBreakdown: listed ? undefined : customPriceBreakdown,
    price: listed?.price ?? customPriceBreakdown?.finalPrice ?? standardPrice,
  };
}

export function applyCollectionToCabinet(cabinet: Cabinet, collection: DesignCollectionId): Cabinet {
  if (cabinet.designPiece) return priceDesignPiece(cabinet, collection);
  const model = nativeModel(cabinet, collection);
  if (model && !model.active) throw new Error("Varianta cu sertar nu are pret confirmat.");
  const priced = applyCollectionToCabinetBase(cabinet, collection);
  if (!model) return { ...priced, drainerSku: undefined };
  const exact = nativeProduct(cabinet.baseSku ?? cabinet.sku, cabinet.width, collection);
  const result: Cabinet = { ...priced, ...nativeDimensions(model), mountHeightCm: model.mountHeightCm,
    displaySku: exact?.sku ?? priced.displaySku, pricingNote: model.note,
    label: customCabinetLabel(`${model.label} ${Math.round(cabinet.width * 10)} mm`, priced.isCustom ?? false),
    price: exact?.price ?? priced.price, priceSource: exact ? "catalogue" : priced.priceSource };
  return priceWithDrainer(result, collection);
}

export function customPricingForType(type: CabinetType): CustomCabinetPricing {
  if (type.startsWith("wall")) return CUSTOM_CABINET_PRICING.wall;
  if (type.startsWith("tall")) return CUSTOM_CABINET_PRICING.tall;
  return CUSTOM_CABINET_PRICING.base;
}

export function applyCollectionToCabinets(cabinets: Cabinet[], collection: DesignCollectionId): Cabinet[] {
  return cabinets.map((cabinet) => applyCollectionToCabinet(cabinet, collection));
}

export function getSkuByCode(sku: string): SkuDefinition | undefined {
  const baseSku = stripCollectionSku(sku);
  const collection = getCollectionFromSku(sku);
  const native = collection ? NATIVE_CATALOGUE.find(p => p.baseSku === baseSku && p.collection === collection) : undefined;
  if (native) return native.active && native.price != null ? { sku: baseSku, type: native.type, width: native.widthMm / 10, ...nativeDimensions(native), price: native.price, label: native.label, cornerSide: native.cornerSide } : undefined;
  const definition = ALL_SKUS.find((s) => s.sku === baseSku);

  if (!definition) return undefined;

  return {
    ...definition,
    price: collection ? (revisedPrice(baseSku, definition.width, collection)?.price ?? applyCollectionPrice(definition.price, collection)) : definition.price,
  };
}

export function findBestBase(targetWidth: number): SkuDefinition | undefined {
  return BASE_CABINETS
    .filter((c) => c.type === "base" && c.width <= targetWidth)
    .sort((a, b) => b.width - a.width)[0];
}

export function findBestWall(targetWidth: number): SkuDefinition | undefined {
  return WALL_CABINETS
    .filter((c) => c.type === "wall" && c.width <= targetWidth)
    .sort((a, b) => b.width - a.width)[0];
}

export function applyPublicCollectionToCabinets(cabinets: Cabinet[], collection: DesignCollectionId): Cabinet[] {
  const publicCollection = collection === 'smart' ? 'japandi' : collection;
  return cabinets.map(cabinet => {
    const sku = cabinet.baseSku ?? stripCollectionSku(cabinet.sku);
    if (sku.startsWith('ASAB-') || sku === 'ASB-SINA' || cabinet.designPiece || cabinet.finishOverride || cabinet.runWorktopOverride || cabinet.runWorktopDimensions || cabinet.catalogProduct || cabinet.drainerSku) throw new Error('Catalogul nou necesita acces intern.');
    const priced = applyCollectionToCabinetBase(cabinet, publicCollection);
    return { ...priced, drainerSku: undefined, mountHeightCm: cabinet.type.startsWith('wall') ? 146.9 : undefined };
  });
}

// scripts/apply-collection-price-helper.mjs
// Adds collection-based price multipliers to data/skus.ts.
//
// Japandi: 15% cheaper
// Germain: same price
// Franc: 30% more expensive
//
// Worktops are NOT affected because WORKTOP_PRICE_PER_CM is separate.
// This script patches getSkuByCode() so cabinet prices change automatically
// based on SKU suffix: -jpn, -grm, -frc.

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SKU_FILE = path.join(ROOT, "data", "skus.ts");

if (!fs.existsSync(SKU_FILE)) {
  throw new Error("Could not find data/skus.ts");
}

let source = fs.readFileSync(SKU_FILE, "utf8");

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(ROOT, "data", `skus.backup-${timestamp}.ts`);
fs.copyFileSync(SKU_FILE, backupFile);

const multiplierBlock = `
export const COLLECTION_PRICE_MULTIPLIER: Record<DesignCollectionId, number> = {
  japandi: 0.85,
  germain: 1,
  franc: 1.3,
};

export function getCollectionFromSku(sku: string): DesignCollectionId | null {
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
`;

// Insert helper block after COLLECTION_SKU_SUFFIX if not already present.
if (!source.includes("COLLECTION_PRICE_MULTIPLIER")) {
  source = source.replace(
    `export const COLLECTION_SKU_SUFFIX: Record<DesignCollectionId, string> = {
  japandi: "jpn",
  germain: "grm",
  franc: "frc",
};`,
    `export const COLLECTION_SKU_SUFFIX: Record<DesignCollectionId, string> = {
  japandi: "jpn",
  germain: "grm",
  franc: "frc",
};
${multiplierBlock}`
  );
}

// Replace getSkuByCode with collection-aware version.
const oldGetSkuByCode = `export function getSkuByCode(sku: string): SkuDefinition | undefined {
  const baseSku = stripCollectionSku(sku);
  return ALL_SKUS.find((s) => s.sku === baseSku);
}`;

const newGetSkuByCode = `export function getSkuByCode(sku: string): SkuDefinition | undefined {
  const baseSku = stripCollectionSku(sku);
  const collection = getCollectionFromSku(sku);
  const definition = ALL_SKUS.find((s) => s.sku === baseSku);

  if (!definition) return undefined;

  return {
    ...definition,
    price: applyCollectionPrice(definition.price, collection),
  };
}`;

if (!source.includes(newGetSkuByCode)) {
  if (!source.includes(oldGetSkuByCode)) {
    throw new Error("Could not find the expected getSkuByCode() function. Patch manually.");
  }

  source = source.replace(oldGetSkuByCode, newGetSkuByCode);
}

fs.writeFileSync(SKU_FILE, source, "utf8");

console.log("Collection pricing helper applied.");
console.log(`Backup created: ${path.relative(ROOT, backupFile)}`);
console.log("");
console.log("Pricing now works like this:");
console.log("- Japandi / -jpn: 15% cheaper");
console.log("- Germain / -grm: same price");
console.log("- Franc / -frc: 30% more expensive");
console.log("- Worktops unchanged");
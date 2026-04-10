// scripts/sync-configurator-prices.mjs
// Run: node scripts/sync-configurator-prices.mjs
// Fetches all carcass prices from Shopify, adds door prices, and prints
// the corrected skus.ts entries so configurator matches Shopify cart exactly.

const SHOPIFY_DOMAIN = "xuiduq-y4.myshopify.com";
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

// carcass SKU → Shopify handle
const CARCASS_HANDLES = {
  "1001-DR":     "ci-colt-950mm-dreapta",
  "1001-STG":    "ci-colt-950mm-stanga",
  "1003":        "ci-600mm-3-sertare",
  "1004":        "ci-500mm-1-usa",
  "1005":        "ci-800mm-chiuveta-2-usi",
  "1006":        "ci-600mm-cuptor-1-usa",
  "1007":        "ci-600mm-chiuveta-1-usa",
  "1008":        "ci-400mm-1-usa",
  "1010":        "ci-600mm-1-usa",
  "1013":        "ci-800mm-2-usi",
  "1014":        "ci-450mm-1-usa",
  "1015":        "ci-600mm-front-masina-vase",
  "1015-45":     "ci-450mm-front-masina-vase",
  "1003-HOB-60": "ci-600mm-plita-3-sertare",
  "1003-HOB-80": "ci-800mm-plita-3-sertare",
  "2001-DR":     "cs-colt-1000mm-dreapta",
  "2001-STG":    "cs-colt-1000mm-stanga",
  "2004":        "cs-500mm-1-usa",
  "2007":        "cs-600mm-hota",
  "2008":        "cs-400mm-1-usa",
  "2010":        "cs-600mm-1-usa",
  "2013":        "cs-800mm-2-usi",
  "2014":        "cs-450mm-1-usa",
  "1011A":       "soldat-600mm-2-usi",
  "1011B":       "soldat-600mm-cuptor",
  "1011C":       "soldat-600mm-cuptor-microunde",
  "1016":        "soldat-600mm-frigider",
};

// Door width per carcass SKU (to look up door price)
const CARCASS_DOOR_WIDTH = {
  "1001-DR": 95, "1001-STG": 95,
  "1003": 60, "1004": 50, "1005": 80, "1006": 60,
  "1007": 60, "1008": 40, "1010": 60, "1013": 80,
  "1014": 45, "1015": 60, "1015-45": 45,
  "1003-HOB-60": 60, "1003-HOB-80": 80,
  "2001-DR": 100, "2001-STG": 100,
  "2004": 50, "2007": 60, "2008": 40,
  "2010": 60, "2013": 80, "2014": 45,
  "1011A": 60, "1011B": 60, "1011C": 60, "1016": 60,
};

// Door type per carcass (B=base, W=wall, T=tall)
const CARCASS_DOOR_TYPE = {
  "1001-DR": "B", "1001-STG": "B",
  "1003": "B", "1004": "B", "1005": "B", "1006": "B",
  "1007": "B", "1008": "B", "1010": "B", "1013": "B",
  "1014": "B", "1015": null, "1015-45": null, // dishwasher — no door SKU
  "1003-HOB-60": "B", "1003-HOB-80": "B",
  "2001-DR": "W", "2001-STG": "W",
  "2004": "W", "2007": "W", "2008": "W",
  "2010": "W", "2013": "W", "2014": "W",
  "1011A": "T", "1011B": "T", "1011C": "T", "1016": "T",
};

async function fetchPrice(handle) {
  try {
    const res = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/products.json?handle=${handle}&fields=variants,title`,
      { headers: { "X-Shopify-Access-Token": ADMIN_TOKEN } }
    );
    const data = await res.json();
    const variant = data?.products?.[0]?.variants?.[0];
    return variant ? parseFloat(variant.price) : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("🔍 Fetching prices from Shopify...\n");

  // Fetch all door prices first (alb-mat as reference — all colorways same price)
  const doorPriceMap = {}; // "B-60" → price
  const doorTypes = ["B", "W", "T"];
  const doorWidths = [40, 45, 50, 60, 80, 95, 100];
  for (const type of doorTypes) {
    for (const width of doorWidths) {
      const handle = `front-${type.toLowerCase()}-${width}cm-alb-mat-s`;
      const price = await fetchPrice(handle);
      if (price !== null) doorPriceMap[`${type}-${width}`] = price;
    }
  }

  console.log("Door prices fetched:", doorPriceMap);
  console.log("");

  // Now fetch each carcass and compute combined price
  const results = [];
  let allMatch = true;

  for (const [sku, handle] of Object.entries(CARCASS_HANDLES)) {
    const carcassPrice = await fetchPrice(handle);
    const doorType     = CARCASS_DOOR_TYPE[sku];
    const doorWidth    = CARCASS_DOOR_WIDTH[sku];
    const doorPrice    = doorType ? (doorPriceMap[`${doorType}-${doorWidth}`] ?? 0) : 0;
    const combined     = carcassPrice !== null ? carcassPrice + doorPrice : null;

    results.push({ sku, handle, carcassPrice, doorPrice, combined });

    if (combined === null) {
      console.log(`❓ ${sku.padEnd(14)} handle not found: ${handle}`);
      allMatch = false;
    } else {
      console.log(`✅ ${sku.padEnd(14)} carcass: ${String(carcassPrice).padStart(5)} + door: ${String(doorPrice).padStart(4)} = ${String(combined).padStart(5)} RON`);
    }
  }

  // Worktop
  const worktopStejarPrice = await fetchPrice("blat-stejar");
  const worktopGrisPrice   = await fetchPrice("blat-gri-piatra");
  console.log(`\n✅ BL-STEJAR worktop: ${worktopStejarPrice} RON/linear meter`);
  console.log(`✅ BL-GRIS   worktop: ${worktopGrisPrice} RON/linear meter`);

  const worktopPricePerMeter = worktopStejarPrice ?? 180;

  // Print summary of what needs updating in skus.ts
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("PRICES TO UPDATE IN skus.ts");
  console.log("═══════════════════════════════════════════════════════════");

  // Current prices in skus.ts (from last run)
  const CURRENT_PRICES = {
    "1001-DR": 706, "1001-STG": 706, "1003": 794, "1004": 493,
    "1005": 571, "1006": 427, "1007": 528, "1008": 346, "1010": 528,
    "1013": 571, "1014": 483, "1015": 290, "1015-45": 250,
    "1003-HOB-60": 830, "1003-HOB-80": 1000,
    "2001-DR": 802, "2001-STG": 802, "2004": 379, "2007": 389,
    "2008": 346, "2010": 401, "2013": 533, "2014": 369,
    "1011A": 1565, "1011B": 1565, "1011C": 1760, "1016": 1310,
  };

  let changesNeeded = 0;
  for (const { sku, combined } of results) {
    if (combined === null) continue;
    const current = CURRENT_PRICES[sku];
    if (Math.abs(combined - current) > 0.5) {
      console.log(`  ${sku.padEnd(14)} ${current} → ${combined} RON  (diff: ${combined - current > 0 ? "+" : ""}${combined - current})`);
      changesNeeded++;
    }
  }

  if (changesNeeded === 0) {
    console.log("  ✅ All prices already correct!");
  }

  console.log(`\n  WORKTOP_PRICE_PER_CM: 2.64 → ${(worktopPricePerMeter / 100).toFixed(2)} RON/cm  (${worktopPricePerMeter} RON/m)`);

  // Print ready-to-paste skus.ts BASE_CABINETS prices
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("READY TO PASTE — updated price values for skus.ts");
  console.log("═══════════════════════════════════════════════════════════");
  for (const { sku, combined } of results) {
    if (combined !== null) {
      console.log(`  ${sku.padEnd(14)} price: ${combined},`);
    }
  }
  console.log(`  WORKTOP_PRICE_PER_CM = ${(worktopPricePerMeter / 100).toFixed(2)};`);
}

main().catch(console.error);

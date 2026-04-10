// scripts/check-prices.mjs
// Run: node scripts/check-prices.mjs
// Fetches all carcass + door prices from Shopify and compares with configurator calcTotalPrice

const SHOPIFY_DOMAIN = "xuiduq-y4.myshopify.com";
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

const CABINET_DISCOUNT = 0.20;

// ── SKU → handle map (from draft-order/route.ts) ─────────────────────────────
const SKU_TO_HANDLE = {
  "1001-DR":  "ci-colt-950mm-dreapta",
  "1001-STG": "ci-colt-950mm-stanga",
  "1003":     "ci-600mm-3-sertare",
  "1004":     "ci-500mm-1-usa",
  "1005":     "ci-800mm-chiuveta-2-usi",
  "1006":     "ci-600mm-cuptor-1-usa",
  "1007":     "ci-600mm-chiuveta-1-usa",
  "1008":     "ci-400mm-1-usa",
  "1010":     "ci-600mm-1-usa",
  "1013":     "ci-800mm-2-usi",
  "1014":     "ci-450mm-1-usa",
  "1015":     "ci-600mm-front-masina-vase",
  "1015-45":  "ci-450mm-front-masina-vase",
  "1003-HOB-60": "ci-600mm-plita-3-sertare",
  "1003-HOB-80": "ci-800mm-plita-3-sertare",
  "2001-DR":  "cs-colt-1000mm-dreapta",
  "2001-STG": "cs-colt-1000mm-stanga",
  "2004":     "cs-500mm-1-usa",
  "2007":     "cs-600mm-hota",
  "2008":     "cs-400mm-1-usa",
  "2010":     "cs-600mm-1-usa",
  "2013":     "cs-800mm-2-usi",
  "2014":     "cs-450mm-1-usa",
  "1011A":    "soldat-600mm-2-usi",
  "1011B":    "soldat-600mm-cuptor",
  "1011C":    "soldat-600mm-cuptor-microunde",
  "1016":     "soldat-600mm-frigider",
  "BL-STEJAR": "blat-stejar",
  "BL-GRIS":   "blat-gri-piatra",
};

// Door SKU → handle (use alb-mat as reference colorway)
const DOOR_HANDLES = {
  "F-B-40":  "front-b-40cm-alb-mat-s",
  "F-B-45":  "front-b-45cm-alb-mat-s",
  "F-B-50":  "front-b-50cm-alb-mat-s",
  "F-B-60":  "front-b-60cm-alb-mat-s",
  "F-B-80":  "front-b-80cm-alb-mat-s",
  "F-B-95":  "front-b-95cm-alb-mat-s",
  "F-W-40":  "front-w-40cm-alb-mat-s",
  "F-W-45":  "front-w-45cm-alb-mat-s",
  "F-W-50":  "front-w-50cm-alb-mat-s",
  "F-W-60":  "front-w-60cm-alb-mat-s",
  "F-W-80":  "front-w-80cm-alb-mat-s",
  "F-W-100": "front-w-100cm-alb-mat-s",
  "F-T-60":  "front-t-60cm-alb-mat-s",
};

// Carcass prices from skus.ts
const CARCASS_PRICES = {
  "1001-DR": 706, "1001-STG": 706,
  "1003": 794, "1004": 493, "1005": 571, "1006": 427,
  "1007": 528, "1008": 346, "1010": 528, "1013": 571,
  "1014": 483, "1015": 290, "1015-45": 250,
  "1003-HOB-60": 830, "1003-HOB-80": 1000,
  "2001-DR": 802, "2001-STG": 802,
  "2004": 379, "2007": 389, "2008": 346,
  "2010": 401, "2013": 533, "2014": 369,
  "1011A": 1565, "1011B": 1565, "1011C": 1760, "1016": 1310,
};

async function fetchPrice(handle) {
  try {
    const res = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/products.json?handle=${handle}&fields=variants,title`,
      { headers: { "X-Shopify-Access-Token": ADMIN_TOKEN } }
    );
    const data = await res.json();
    const variant = data?.products?.[0]?.variants?.[0];
    const title   = data?.products?.[0]?.title ?? handle;
    return { price: variant ? parseFloat(variant.price) : null, title };
  } catch {
    return { price: null, title: handle };
  }
}

async function main() {
  console.log("🔍 Fetching prices from Shopify...\n");

  // ── 1. Carcass prices ──────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════");
  console.log("CARCASS CABINETS — skus.ts vs Shopify");
  console.log("═══════════════════════════════════════════════════════════");

  let carcassMismatch = 0;
  const carcassResults = [];

  for (const [sku, localPrice] of Object.entries(CARCASS_PRICES)) {
    const handle = SKU_TO_HANDLE[sku];
    if (!handle) continue;
    const { price: shopifyPrice, title } = await fetchPrice(handle);
    const match = shopifyPrice !== null && Math.abs(shopifyPrice - localPrice) < 0.01;
    if (!match) carcassMismatch++;
    carcassResults.push({ sku, title, localPrice, shopifyPrice, match });
  }

  for (const r of carcassResults) {
    const icon = r.match ? "✅" : r.shopifyPrice === null ? "❓" : "❌";
    const diff = r.shopifyPrice !== null ? ` (diff: ${(r.shopifyPrice - r.localPrice).toFixed(0)} RON)` : "";
    console.log(`${icon} ${r.sku.padEnd(12)} local: ${String(r.localPrice).padStart(5)} RON | shopify: ${r.shopifyPrice !== null ? String(r.shopifyPrice).padStart(7) : "NOT FOUND"}${diff}`);
  }

  // ── 2. Door prices ─────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("DOOR FRONTS — Shopify prices (alb-mat reference)");
  console.log("═══════════════════════════════════════════════════════════");

  const doorPrices = {};
  for (const [key, handle] of Object.entries(DOOR_HANDLES)) {
    const { price, title } = await fetchPrice(handle);
    doorPrices[key] = price;
    console.log(`${price !== null ? "✅" : "❌"} ${key.padEnd(8)} shopify: ${price !== null ? `${price} RON` : "NOT FOUND"}`);
  }

  // ── 3. Worktop prices ──────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("WORKTOPS — skus.ts (2.64 RON/cm) vs Shopify");
  console.log("═══════════════════════════════════════════════════════════");

  for (const [sku, handle] of [["BL-STEJAR", "blat-stejar"], ["BL-GRIS", "blat-gri-piatra"]]) {
    const { price, title } = await fetchPrice(handle);
    const localPerMeter = 2.64 * 100; // 264 RON/m
    console.log(`${sku}: shopify: ${price !== null ? `${price} RON/unit` : "NOT FOUND"} | local calc: ${localPerMeter} RON/m`);
  }

  // ── 4. Example kitchen comparison ─────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("EXAMPLE KITCHEN — 300cm linear, alb-mat");
  console.log("Cabinets: sink-80, hob-60, base-60×2, wall-60×3, wall-hood-60");
  console.log("═══════════════════════════════════════════════════════════");

  // Carcass prices from skus.ts
  const exampleCarcassLocal = 571 + 830 + 528 + 528 + 401 + 401 + 401 + 389;
  // Door prices from Shopify
  const doorB80  = doorPrices["F-B-80"]  ?? 0;
  const doorB60  = doorPrices["F-B-60"]  ?? 0;
  const doorW60  = doorPrices["F-W-60"]  ?? 0;
  const exampleDoorShopify = doorB80 + doorB60 + doorB60 + doorW60 * 3 + doorW60; // hood same as wall

  const worktopLocal   = 300 * 2.64;
  const totalLocalFull = exampleCarcassLocal + worktopLocal;
  const totalLocalDiscounted = Math.round(exampleCarcassLocal * (1 - CABINET_DISCOUNT) + worktopLocal);

  // What Shopify cart actually charges (carcass at shopify price + doors + worktop)
  const carcassShopifyPrices = await Promise.all([
    fetchPrice("ci-800mm-chiuveta-2-usi"),
    fetchPrice("ci-600mm-plita-3-sertare"),
    fetchPrice("ci-600mm-1-usa"),
    fetchPrice("ci-600mm-1-usa"),
    fetchPrice("cs-600mm-1-usa"),
    fetchPrice("cs-600mm-1-usa"),
    fetchPrice("cs-600mm-1-usa"),
    fetchPrice("cs-600mm-hota"),
  ]);
  const worktopShopify = await fetchPrice("blat-stejar");
  const carcassShopifyTotal = carcassShopifyPrices.reduce((s, r) => s + (r.price ?? 0), 0);
  const worktopShopifyTotal = (worktopShopify.price ?? 0) * 3; // 3 linear meters

  const shopifyCartTotal     = carcassShopifyTotal + exampleDoorShopify + worktopShopifyTotal;
  const shopifyCartDiscounted = Math.round((carcassShopifyTotal + exampleDoorShopify) * (1 - CABINET_DISCOUNT) + worktopShopifyTotal);

  console.log(`\nConfigurator shows (before discount): ${totalLocalFull} RON`);
  console.log(`Configurator shows (after ${CABINET_DISCOUNT*100}% off):  ${totalLocalDiscounted} RON`);
  console.log(`\nShopify cart full price:              ${shopifyCartTotal.toFixed(0)} RON`);
  console.log(`Shopify cart after ${CABINET_DISCOUNT*100}% discount:     ${shopifyCartDiscounted.toFixed(0)} RON`);
  console.log(`\nGap (configurator vs shopify cart):   ${(shopifyCartTotal - totalLocalFull).toFixed(0)} RON (door fronts not in configurator price)`);

  if (carcassMismatch > 0) {
    console.log(`\n⚠️  ${carcassMismatch} carcass price(s) differ between skus.ts and Shopify — check above.`);
  } else {
    console.log(`\n✅ All carcass prices match between skus.ts and Shopify.`);
  }

  console.log("\nDone.");
}

main().catch(console.error);

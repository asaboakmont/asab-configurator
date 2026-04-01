import { readFileSync, writeFileSync } from "fs";

// Door prices by width (same for B/W/T)
const DOOR_PRICES = {
  40: 80, 45: 90, 50: 100, 60: 110, 80: 140, 95: 180, 100: 190
};

// Cabinet SKU → width mapping
const SKU_WIDTHS = {
  "1001-DR": 95, "1001-STG": 95,
  "1003": 60, "1003-HOB-60": 60, "1003-HOB-80": 80,
  "1004": 50, "1005": 80, "1006": 60, "1007": 60,
  "1008": 40, "1010": 60, "1013": 80, "1014": 45,
  "1015": 60, "1015-45": 45,
  "2001-DR": 100, "2001-STG": 100,
  "2004": 50, "2007": 60, "2008": 40, "2010": 60,
  "2013": 80, "2014": 45,
  "1011A": 60, "1011B": 60, "1011C": 60,
  "1016": 60, "1017": 80,
};

// Carcass prices from Shopify
const CARCASS_PRICES = {
  "1001-DR": 526, "1001-STG": 526,
  "1003": 684, "1003-HOB-60": 720, "1003-HOB-80": 860,
  "1004": 393, "1005": 431, "1006": 317, "1007": 418,
  "1008": 266, "1010": 418, "1013": 431, "1014": 393,
  "1015": 180, "1015-45": 160,
  "2001-DR": 612, "2001-STG": 612,
  "2004": 279, "2007": 279, "2008": 266, "2010": 291,
  "2013": 393, "2014": 279,
  "1011A": 1455, "1011B": 1455, "1011C": 1650,
  "1016": 1200, "1017": 1400,
};

let content = readFileSync("data/skus.ts", "utf8");
let updated = 0;

for (const [sku, width] of Object.entries(SKU_WIDTHS)) {
  const carcass = CARCASS_PRICES[sku];
  const door = DOOR_PRICES[width];
  if (!carcass || !door) { console.log(`Skipping ${sku} — missing price`); continue; }
  const combined = carcass + door;
  const escapedSku = sku.replace(/[-]/g, "\\$&");
  const regex = new RegExp(`(\\{[^}]*sku:\\s*"${escapedSku}"[^}]*price:\\s*)\\d+`, "gs");
  const newContent = content.replace(regex, `$1${combined}`);
  if (newContent !== content) {
    content = newContent;
    updated++;
    console.log(`${sku}: ${carcass} + ${door} = ${combined} RON`);
  }
}

writeFileSync("data/skus.ts", content);
console.log(`\nDone — updated ${updated} SKUs`);

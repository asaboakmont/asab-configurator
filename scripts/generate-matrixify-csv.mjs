import { writeFileSync } from "fs";

const GITHUB_BASE = "https://raw.githubusercontent.com/asaboakmont/asab-cabinet-images/main";

// Only CI/CS/Soldat handles — the correct configurator products
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
  "1015":     "ci-600mm-front-mv",
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
  "1016":     "soldat-600mm-frigider",
  "1017":     "soldat-800mm-frigider",
};

const COLORWAYS = [
  "alb-mat","gri-deschis-mat","gri-inchis-mat","olive-mat","negru-mat",
  "alb-lucios","gri-lucios","negru-lucios","stejar-furnir","nuc-furnir","gri-furnir"
];

// SKUs that have rendered images
const RENDERED_SKUS = ["1010","1013","1003","1001-DR","2010","2013","2001-DR","1011A"];

const rows = [["Handle", "Image Src", "Image Position", "Image Alt Text"]];

for (const [sku, handle] of Object.entries(SKU_TO_HANDLE)) {
  if (!RENDERED_SKUS.includes(sku)) continue;

  // Carcass image — position 1
  rows.push([
    handle,
    `${GITHUB_BASE}/carcass-${sku}.jpg`,
    "1",
    `${handle} carcass`
  ]);

  // Colorway door images
  let pos = 2;
  for (const cw of COLORWAYS) {
    rows.push([
      handle,
      `${GITHUB_BASE}/door-${sku}-${cw}.jpg`,
      String(pos),
      `${handle} ${cw}`
    ]);
    pos++;
  }
}

const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
writeFileSync("scripts/matrixify-images.csv", csv);
console.log(`Generated ${rows.length} rows for ${RENDERED_SKUS.length} products`);

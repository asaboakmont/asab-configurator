/**
 * ASAB Design – Generate Shopify image CSV from CDN URLs
 * Usage: node generate-image-csv.mjs
 *
 * Outputs: cabinet-images.csv  (ready for Shopify CSV import)
 * Place in: C:\Users\SEVEN HILLS\Desktop\asab-configurator-main\scripts\
 */

import fs from "fs";
import path from "path";
import os from "os";

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const CDN_BASE = "https://raw.githubusercontent.com/asaboakmont/asab-cabinet-images/main";
const CACHE_BUST = "?v=2";

const COLORWAYS = [
  "alb-mat", "gri-deschis-mat", "gri-inchis-mat", "olive-mat",
  "negru-mat", "albastru-mat", "stejar", "crem-lucios", "alb-lucios",
  "gri-deschis-lucios", "gri-inchis-lucios", "olive-lucios", "negru-lucios",
];

// handle → function(colorway) → [carcass filename, door filename]
const PRODUCT_IMAGE_MAP = {
  "ci-colt-950mm-dreapta":   (cw) => ["carcass-1001-DR", `door-1001-DR-${cw}`],
  "ci-colt-950mm-stanga":    (cw) => ["carcass-1001-DR", `door-1001-DR-${cw}`],
  "ci-600mm-3-sertare":      (cw) => ["carcass-1003",    `door-1003-${cw}`],
  "ci-500mm-1-usa":          (cw) => ["carcass-1010",    `door-1010-${cw}`],
  "ci-800mm-chiuveta-2-usi": (cw) => ["carcass-1013",    `door-1013-${cw}`],
  "ci-600mm-cuptor-1-usa":   (cw) => ["carcass-1006",    `door-1006-${cw}`],
  "ci-600mm-chiuveta-1-usa": (cw) => ["carcass-1006",    `door-1006-${cw}`],
  "ci-400mm-1-usa":          (cw) => ["carcass-1010",    `door-1010-${cw}`],
  "ci-600mm-1-usa":          (cw) => ["carcass-1010",    `door-1010-${cw}`],
  "ci-800mm-2-usi":          (cw) => ["carcass-1013",    `door-1013-${cw}`],
  "ci-450mm-1-usa":          (cw) => ["carcass-1010",    `door-1010-${cw}`],
  "ci-600mm-front-mv":       (cw) => ["carcass-1006",    `door-1006-${cw}`],
  "cs-colt-1000mm-dreapta":  (cw) => ["carcass-2001-DR", `door-2001-DR-${cw}`],
  "cs-colt-1000mm-stanga":   (cw) => ["carcass-2001-DR", `door-2001-DR-${cw}`],
  "cs-500mm-1-usa":          (cw) => ["carcass-2010",    `door-2010-${cw}`],
  "cs-600mm-hota":           (cw) => ["carcass-2007",    `door-2007-${cw}`],
  "cs-400mm-1-usa":          (cw) => ["carcass-2010",    `door-2010-${cw}`],
  "cs-600mm-1-usa":          (cw) => ["carcass-2010",    `door-2010-${cw}`],
  "cs-800mm-2-usi":          (cw) => ["carcass-2013",    `door-2013-${cw}`],
  "cs-450mm-1-usa":          (cw) => ["carcass-2010",    `door-2010-${cw}`],
  "soldat-600mm-2-usi":      (cw) => ["carcass-1011A",   `door-1011A-${cw}`],
  "soldat-600mm-cuptor":     (cw) => ["carcass-1011B",   `door-1011B-${cw}`],
  "soldat-600mm-frigider":   (cw) => ["carcass-1016",    `door-1016-${cw}`],
  "soldat-800mm-frigider":   (cw) => ["carcass-1017",    `door-1017-${cw}`],
};

// ─────────────────────────────────────────────
// BUILD CSV
// Shopify image CSV format:
// Handle, Image Src, Image Position, Image Alt Text
// First image (carcass) = position 1
// Door colorways = positions 2-14
// ─────────────────────────────────────────────

const rows = [["Handle", "Image Src", "Image Position", "Image Alt Text"]];

for (const [handle, imagesFn] of Object.entries(PRODUCT_IMAGE_MAP)) {
  // Collect unique images in order: carcass first, then all colorways
  const seen = new Set();
  const images = []; // [{filename, alt}]

  const carcass = imagesFn(COLORWAYS[0])[0];
  if (!seen.has(carcass)) {
    seen.add(carcass);
    images.push({ filename: carcass, alt: carcass });
  }

  for (const cw of COLORWAYS) {
    const door = imagesFn(cw)[1];
    if (!seen.has(door)) {
      seen.add(door);
      images.push({ filename: door, alt: door });
    }
  }

  images.forEach(({ filename, alt }, i) => {
    rows.push([
      handle,
      `${CDN_BASE}/${filename}.jpg${CACHE_BUST}`,
      String(i + 1),
      alt,
    ]);
  });
}

// ─────────────────────────────────────────────
// WRITE CSV
// ─────────────────────────────────────────────

const csvContent = rows
  .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
  .join("\n");

const outPath = process.platform === "win32"
  ? "C:\\Users\\SEVEN HILLS\\Desktop\\cabinet-images.csv"
  : path.join(os.homedir(), "Desktop", "cabinet-images.csv");

fs.writeFileSync(outPath, csvContent, "utf8");

console.log(`✅ CSV written to: ${outPath}`);
console.log(`   ${rows.length - 1} image rows across ${Object.keys(PRODUCT_IMAGE_MAP).length} products`);
console.log(`\nNext: import via Shopify Admin → Products → Import`);

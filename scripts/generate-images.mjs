import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const OUT_DIR = "scripts/cabinet-images";
mkdirSync(OUT_DIR, { recursive: true });

// Map of image name → colorway + SKU to render
const RENDERS = [
  // Carcass shots — use alb-mat colorway
  { name: "carcass-base-1door",    sku: "1010",     colorway: "alb-mat" },
  { name: "carcass-base-2door",    sku: "1013",     colorway: "alb-mat" },
  { name: "carcass-base-drawer",   sku: "1003",     colorway: "alb-mat" },
  { name: "carcass-base-corner",   sku: "1001-DR",  colorway: "alb-mat" },
  { name: "carcass-wall-1door",    sku: "2010",     colorway: "alb-mat" },
  { name: "carcass-wall-2door",    sku: "2013",     colorway: "alb-mat" },
  { name: "carcass-wall-corner",   sku: "2001-DR",  colorway: "alb-mat" },
  { name: "carcass-tall",          sku: "1011A",    colorway: "alb-mat" },
  // Door shots — one per colorway × type
  ...["alb-mat","gri-deschis-mat","gri-inchis-mat","olive-mat","negru-mat",
      "albastru-mat","bej-mat","alb-lucios","gri-lucios","negru-lucios",
      "stejar-furnir","nuc-furnir","gri-furnir"].flatMap(cw => [
    { name: `door-base-1door-${cw}`,  sku: "1010",    colorway: cw },
    { name: `door-base-2door-${cw}`,  sku: "1013",    colorway: cw },
    { name: `door-wall-1door-${cw}`,  sku: "2010",    colorway: cw },
    { name: `door-wall-2door-${cw}`,  sku: "2013",    colorway: cw },
    { name: `door-tall-${cw}`,        sku: "1011A",   colorway: cw },
  ]),
];

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 600 });

for (const render of RENDERS) {
  console.log(`Rendering ${render.name}...`);
  
  // Navigate to configurator with preset params
  await page.goto(`${BASE_URL}/render?sku=${render.sku}&colorway=${render.colorway}`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  
  // Wait for 3D to load
  await page.waitForSelector("canvas", { timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Screenshot just the canvas
  const canvas = await page.$("canvas");
  if (canvas) {
    await canvas.screenshot({ path: join(OUT_DIR, `${render.name}.jpg`) });
    console.log(`  ✓ Saved ${render.name}.jpg`);
  }
}

await browser.close();
console.log("\nDone! Images saved to scripts/cabinet-images/");

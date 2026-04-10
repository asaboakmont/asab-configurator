import type { CabinetType } from "@/types/kitchen";

export interface SkuDefinition {
  sku:         string;
  type:        CabinetType;
  width:       number;
  height:      number;
  depth:       number;
  price:       number;
  label:       string;
  cornerSide?: "STG" | "DR";
}

export const BASE_CABINETS: SkuDefinition[] = [
  { sku: "1001-DR",  type: "base-corner",     width: 95, height: 86, depth: 55, price: 706,  label: "CI Colt 950mm Dreapta",       cornerSide: "DR" },
  { sku: "1001-STG", type: "base-corner",     width: 95, height: 86, depth: 55, price: 706,  label: "CI Colt 950mm Stanga",        cornerSide: "STG" },
  { sku: "1003",     type: "base-drawer",     width: 60, height: 86, depth: 53, price: 794,  label: "CI 600mm 3 Sertare" },
  { sku: "1004",     type: "base",            width: 50, height: 86, depth: 53, price: 493,  label: "CI 500mm 1 Usa" },
  { sku: "1005",     type: "base-sink",       width: 80, height: 86, depth: 53, price: 571,  label: "CI 800mm Chiuveta 2 Usi" },
  { sku: "1006",     type: "base-oven",       width: 60, height: 86, depth: 53, price: 427,  label: "CI 600mm Cuptor 1 Usa" },
  { sku: "1007",     type: "base-sink",       width: 60, height: 86, depth: 53, price: 528,  label: "CI 600mm Chiuveta 1 Usa" },
  { sku: "1008",     type: "base",            width: 40, height: 86, depth: 53, price: 346,  label: "CI 400mm 1 Usa" },
  { sku: "1010",     type: "base",            width: 60, height: 86, depth: 53, price: 528,  label: "CI 600mm 1 Usa" },
  { sku: "1013",     type: "base",            width: 80, height: 86, depth: 53, price: 571,  label: "CI 800mm 2 Usi" },
  { sku: "1014",     type: "base",            width: 45, height: 86, depth: 53, price: 483,  label: "CI 450mm 1 Usa" },
  { sku: "1015",     type: "base-dishwasher", width: 60, height: 86, depth: 53, price: 290,  label: "CI 600mm Front Masina Vase" },
  { sku: "1015-45",  type: "base-dishwasher", width: 45, height: 86, depth: 53, price: 250,  label: "CI 450mm Front Masina Vase" },
  { sku: "1003-HOB-60", type: "base-hob",    width: 60, height: 86, depth: 53, price: 830,  label: "CI 600mm Plita 3 Sertare" },
  { sku: "1003-HOB-80", type: "base-hob",    width: 80, height: 86, depth: 53, price: 1000,  label: "CI 800mm Plita 3 Sertare" },
];

export const WALL_CABINETS: SkuDefinition[] = [
  { sku: "2001-DR",  type: "wall-corner", width: 100, height: 60, depth: 70, price: 802, label: "CS Colt 1000mm Dreapta", cornerSide: "DR" },
  { sku: "2001-STG", type: "wall-corner", width: 100, height: 60, depth: 70, price: 802, label: "CS Colt 1000mm Stanga",  cornerSide: "STG" },
  { sku: "2004",     type: "wall",        width: 50,  height: 70, depth: 32, price: 379, label: "CS 500mm 1 Usa" },
  { sku: "2007",     type: "wall-hood",   width: 60,  height: 66, depth: 32, price: 389, label: "CS 600mm Hota" },
  { sku: "2008",     type: "wall",        width: 40,  height: 70, depth: 32, price: 346, label: "CS 400mm 1 Usa" },
  { sku: "2010",     type: "wall",        width: 60,  height: 70, depth: 32, price: 401, label: "CS 600mm 1 Usa" },
  { sku: "2013",     type: "wall",        width: 80,  height: 70, depth: 32, price: 533, label: "CS 800mm 2 Usi" },
  { sku: "2014",     type: "wall",        width: 45,  height: 70, depth: 32, price: 369, label: "CS 450mm 1 Usa" },
];

export const TALL_CABINETS: SkuDefinition[] = [
  { sku: "1011A", type: "tall",        width: 60, height: 216, depth: 58, price: 1565, label: "Soldat 600mm 2 Usi" },
  { sku: "1011B", type: "tall-oven",   width: 60, height: 216, depth: 58, price: 1565, label: "Soldat 600mm Cuptor" },
  { sku: "1011C", type: "tall-oven",   width: 60, height: 216, depth: 58, price: 1760, label: "Soldat 600mm Cuptor + Microunde" },
  { sku: "1016",  type: "tall-fridge", width: 60, height: 216, depth: 58, price: 1310, label: "Soldat 600mm Frigider" },
];

export const WORKTOP_PRICE_PER_CM = 1.80; // 180 RON per linear meter
export const HANGING_RAIL = { sku: "4001", label: "Sina Agatare Suspendate 2000mm", price: 44 };

export const ALL_SKUS: SkuDefinition[] = [
  ...BASE_CABINETS,
  ...WALL_CABINETS,
  ...TALL_CABINETS,
];

export function getSkuByCode(sku: string): SkuDefinition | undefined {
  return ALL_SKUS.find((s) => s.sku === sku);
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

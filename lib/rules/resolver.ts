import type {
  Cabinet, WallDimensions, Appliances, LayoutType, WallSide
} from "@/types/kitchen";
import { BASE_CABINETS, WALL_CABINETS, TALL_CABINETS } from "@/data/skus";

export const RULES = {
  MIN_WALL:               120,
  SNAP_INCREMENT:         5,
  CORNER_SIZE_BASE:       95,
  CORNER_SIZE_WALL:       100,
  CORNER_BASE_OFFSET:     5,
  MIN_WALL_B:             100,
  WORKTOP_DEPTH:          60,
  WALL_CAB_FROM_FLOOR:    150,
  BASE_HEIGHT:            86,
  BASE_DEPTH:             53,
  BASE_WALL_GAP:          5,
  WALL_DEPTH:             32,
  WORKTOP_THICKNESS:      3.8,
  WORKTOP_FRONT_OVERHANG: 2,
};

const BASE_WIDTHS = [80, 60, 50, 45, 40];

export function snapDimension(raw: number): number {
  const snapped = Math.floor(raw / RULES.SNAP_INCREMENT) * RULES.SNAP_INCREMENT;
  return Math.max(RULES.MIN_WALL, snapped);
}

export function decomposeWall(wallLength: number): number[] {
  const sorted = [...BASE_WIDTHS].sort((a, b) => b - a);
  function solve(remaining: number): number[] | null {
    if (remaining === 0) return [];
    if (remaining < 40) return null;
    for (const w of sorted) {
      if (w <= remaining) {
        const rest = solve(remaining - w);
        if (rest !== null) return [w, ...rest];
      }
    }
    return null;
  }
  const exact = solve(wallLength);
  if (exact) return exact;
  function bestFit(remaining: number): number[] {
    if (remaining < 40) return [];
    for (const w of sorted) {
      if (w <= remaining) return [w, ...bestFit(remaining - w)];
    }
    return [];
  }
  return bestFit(wallLength);
}

function autoPlaceAppliances(
  startX: number,
  wallLength: number,
  appliances: Appliances
): { placements: Map<number, Cabinet["type"]>; customWidths: number[]; overflow: [Cabinet["type"], number][] } {
  const placements = new Map<number, Cabinet["type"]>();
  if (wallLength <= 0) return { placements, customWidths: [], overflow: [] };

  const sinkW = appliances.sinkSize ?? 60;
  const hobW  = appliances.hobSize ?? 60;
  const dishW = (appliances.dishwasherSize ?? 60) as number;
  const ovenUnderHob = appliances.hasOven === "under-hob";

  const required: [Cabinet["type"], number][] = [];
  if (appliances.hasSink) required.push(["base-sink", sinkW]);
  if (appliances.hasDishwasher) required.push(["base-dishwasher", dishW]);
  if (appliances.hasHob) {
    if (appliances.hasOven === "tall-column") {
      required.push(["base-hob", hobW]);
    } else if (ovenUnderHob && hobW === 60) {
      required.push(["base-oven", 60]);
    } else if (ovenUnderHob && hobW === 80) {
      required.push(["base-hob", 80]);
      required.push(["base-oven", 60]);
    } else {
      required.push(["base-hob", hobW]);
    }
  }
  if (required.length === 0) return { placements, customWidths: decomposeWall(wallLength), overflow: [] };

  const fitsOnWall: [Cabinet["type"], number][] = [];
  const overflowRequired: [Cabinet["type"], number][] = [];
  let runningTotal = 0;
  for (const [cabType, w] of required) {
    if (runningTotal + w <= wallLength) {
      fitsOnWall.push([cabType, w]);
      runningTotal += w;
    } else {
      overflowRequired.push([cabType, w]);
    }
  }

  const fitsWidths = fitsOnWall.map(([,w]) => w);
  const fitsTotal = fitsWidths.reduce((s,w) => s+w, 0);
  const fitsRemaining = wallLength - fitsTotal;
  const fillersFit = fitsRemaining > 0 ? decomposeWall(fitsRemaining) : [];

  // All fillers go to the RIGHT of appliances — gap at right end, not between cabs
  const allWidths = [...fitsWidths, ...fillersFit];

  const positions: number[] = [];
  let cur = startX;
  for (const w of allWidths) { positions.push(cur); cur += w; }

  for (let i = 0; i < fitsOnWall.length; i++) {
    const [cabType] = fitsOnWall[i];
    placements.set(positions[i], cabType);
  }

  return { placements, customWidths: allWidths, overflow: overflowRequired };
}

function autoPlaceHobWall(basePlacements: Map<number, Cabinet["type"]>, extraPlacements?: Map<number, Cabinet["type"]>): Map<number, Cabinet["type"]> {
  const map = new Map<number, Cabinet["type"]>();
  basePlacements.forEach((type, xPos) => {
    if (type === "base-oven" || type === "base-hob") map.set(xPos, "wall-hood");
  });
  if (extraPlacements) {
    extraPlacements.forEach((type, xPos) => {
      if (type === "base-oven" || type === "base-hob") map.set(xPos, "wall-hood");
    });
  }
  return map;
}

interface RunOptions {
  wallId:       WallSide;
  wallLength:   number;
  startX:       number;
  placements:   Map<number, Cabinet["type"]>;
  cabinets:     Cabinet[];
  customWidths?: number[];
}

function buildBaseRun({ wallId, wallLength, startX, placements, cabinets, customWidths }: RunOptions) {
  if (wallLength <= 0) return;
  const widths = customWidths ?? decomposeWall(wallLength);
  let cursor = startX;
  for (const w of widths) {
    const type = placements.get(cursor) ?? "base";
    const def  = BASE_CABINETS.find(s => s.type === type && s.width === w)
              ?? (type === "base-hob" ? BASE_CABINETS.find(s => s.type === "base-hob" && s.width === w) : undefined)
              ?? BASE_CABINETS.find(s => s.type === "base" && s.width === w);
    if (!def) { cursor += w; continue; }
    cabinets.push({ sku: def.sku, type: def.type, width: def.width, height: def.height, depth: def.depth, wall: wallId, xPos: cursor, price: def.price ?? 0, label: def.label, doorDirection: "S" });
    cursor += w;
  }
}

function buildWallRun({ wallId, wallLength, startX, placements, cabinets, customWidths }: RunOptions) {
  if (wallLength <= 0) return;
  const widths = customWidths ?? decomposeWall(wallLength);
  let cursor = startX;
  for (const w of widths) {
    const type = placements.get(cursor) ?? "wall";
    const def  = WALL_CABINETS.find(s => s.type === type && s.width === w)
              ?? WALL_CABINETS.find(s => s.type === "wall" && s.width === w);
    if (!def) { cursor += w; continue; }
    cabinets.push({ sku: def.sku, type: def.type, width: def.width, height: def.height, depth: def.depth, wall: wallId, xPos: cursor, price: def.price ?? 0, label: def.label, doorDirection: "S" });
    cursor += w;
  }
}

export function resolveLayout(
  layout:     LayoutType,
  dimensions: WallDimensions,
  appliances: Appliances
): { cabinets: Cabinet[]; warnings: string[] } {
  const cabinets: Cabinet[] = [];
  const warnings: string[] = [];
  const wallA = snapDimension(dimensions.wallA);
  const wallB = layout === "l-shape" ? snapDimension(dimensions.wallB ?? RULES.MIN_WALL_B) : 0;

  const cs           = dimensions.cornerSide ?? "right";
  const cornerAtLeft = cs === "right";
  const perpWall: WallSide = cornerAtLeft ? "B" : "C";

  // ── Tall cabinets ────────────────────────────────────────────────────────
  let tallWidth = 0;
  const tallList: Cabinet[] = [];
  if (appliances.hasOven === "tall-column") {
    const sku = TALL_CABINETS.find(t => t.type === "tall-oven");
    if (sku) { tallList.push({ ...sku, wall: "A", xPos: tallWidth, price: sku.price ?? 0, doorDirection: "S" as const }); tallWidth += sku.width; }
  }

  // ── Corner cabinets ──────────────────────────────────────────────────────
  if (layout === "l-shape") {
    const cSide = cornerAtLeft ? "STG" : "DR";
    const baseCorner = BASE_CABINETS.find(s => s.type === "base-corner" && s.cornerSide === cSide)
      ?? BASE_CABINETS.find(s => s.type === "base-corner");
    if (baseCorner) cabinets.push({
      ...baseCorner, wall: perpWall,
      xPos: RULES.CORNER_BASE_OFFSET,
      price: baseCorner.price ?? 0,
      cornerSide: cSide,
      doorDirection: "S" as const,
    });
    const wallCorner = WALL_CABINETS.find(s => s.type === "wall-corner" && s.cornerSide === cSide)
      ?? WALL_CABINETS.find(s => s.type === "wall-corner");
    if (wallCorner) cabinets.push({
      ...wallCorner, wall: perpWall,
      xPos: 0,
      price: wallCorner.price ?? 0,
      cornerSide: cSide,
      doorDirection: "S" as const,
    });
  }

  // ── Wall A base run ──────────────────────────────────────────────────────
  const cornerGap  = layout === "l-shape" ? 60 : 0;
  const baseStartX = cornerAtLeft ? cornerGap : tallWidth;
  const baseEndX   = cornerAtLeft ? wallA - tallWidth : wallA - cornerGap;
  const baseLength = Math.max(0, baseEndX - baseStartX);
  const { placements: basePlacements, customWidths: baseWidths, overflow: applianceOverflow } = autoPlaceAppliances(baseStartX, baseLength, appliances);
  if (applianceOverflow.length > 0 && layout !== "l-shape") {
    warnings.push("Spatiul selectat nu este suficient pentru toate aparatele alese. Va rugam mariti dimensiunea bucatariei.");
  }
  buildBaseRun({ wallId: "A", wallLength: baseLength, startX: baseStartX, placements: basePlacements, cabinets, customWidths: baseWidths });

  // Tall cabs: placed at right end (Wall B) or left end (Wall C)
  // Tall cabs: start exactly where base run ends
  const actualBaseEnd = baseStartX + baseWidths.reduce((s, w) => s + w, 0);
  tallList.forEach((t, i) => {
    const prevW = tallList.slice(0, i).reduce((s, c) => s + c.width, 0);
    const tallX = cornerAtLeft ? actualBaseEnd + prevW : prevW;
    cabinets.push({ ...t, xPos: tallX });
  });

  // Wall A wall run — same width as base run, no tall zone
  const wallRunStartX = cornerAtLeft ? cornerGap : tallWidth;
  const wallRunLen    = baseLength; // match base run exactly, not wallA
  const hobPlacement  = appliances.hasHob && appliances.hasHood
    ? autoPlaceHobWall(basePlacements) : new Map<number, Cabinet["type"]>();
  buildWallRun({ wallId: "A", wallLength: wallRunLen, startX: wallRunStartX, placements: hobPlacement, cabinets, customWidths: baseWidths });

  // ── Perpendicular wall ───────────────────────────────────────────────────
  if (layout === "l-shape" && wallB > 0) {
    const perpStartX   = 100;
    const perpLength   = Math.max(0, wallB - perpStartX);
    buildBaseRun({ wallId: perpWall, wallLength: perpLength, startX: perpStartX, placements: new Map(), cabinets });
    const perpWallLength = Math.max(0, wallB - 100);
    buildWallRun({ wallId: perpWall, wallLength: perpWallLength, startX: 100, placements: new Map(), cabinets });

    const perpHobXPos: number[] = [];
    if (applianceOverflow.length > 0) {
      warnings.push(`Unele aparate nu incap pe Peretele A si au fost mutate pe Peretele B.`);
    }

    if (applianceOverflow.length > 0) {
      for (const [cabType, prefW] of applianceOverflow) {
        const idx = cabinets.findIndex(c =>
          c.wall === perpWall && c.type === "base" && c.width === prefW
        );
        if (idx !== -1) {
          const existing = cabinets[idx];
          const def = BASE_CABINETS.find(s => s.type === cabType && s.width === prefW)
            ?? BASE_CABINETS.find(s => s.type === cabType);
          if (def) {
            cabinets[idx] = { ...def, wall: perpWall, xPos: existing.xPos, price: def.price ?? 0, label: def.label };
            if (cabType === "base-hob" || cabType === "base-oven") {
              perpHobXPos.push(existing.xPos);
            }
          }
        } else {
          const overflowPlacements = new Map<number, Cabinet["type"]>();
          const overflowWidths = decomposeWall(perpLength);
          let oCursor = perpStartX;
          const oPositions: number[] = [];
          for (const w of overflowWidths) { oPositions.push(oCursor); oCursor += w; }
          const usedXPos = new Set(cabinets.filter(c => c.wall === perpWall).map(c => c.xPos));
          for (let i = 0; i < oPositions.length; i++) {
            if (!usedXPos.has(oPositions[i])) {
              overflowPlacements.set(oPositions[i], cabType);
              break;
            }
          }
          if (overflowPlacements.size > 0) {
            buildBaseRun({ wallId: perpWall, wallLength: perpLength, startX: perpStartX, placements: overflowPlacements, cabinets });
          }
        }
      }

      if (appliances.hasHood && perpHobXPos.length > 0) {
        for (const xPos of perpHobXPos) {
          const hoodDef = WALL_CABINETS.find(s => s.type === "wall-hood");
          if (hoodDef) cabinets.push({ ...hoodDef, wall: perpWall, xPos, price: hoodDef.price ?? 0, label: hoodDef.label });
        }
      }
    }
  }

  return { cabinets, warnings };
}

const DOOR_PRICE_BY_WIDTH: Record<number, number> = {
  40: 80, 45: 90, 50: 100, 60: 110, 80: 140, 95: 180, 100: 190
};

export function calcTotalPrice(cabinets: Cabinet[], wallA: number, wallB?: number, layout?: LayoutType): number {
  const cabPrice      = cabinets.reduce((sum, c) => sum + (c.price ?? 0), 0);
  const worktopLength = wallA + (layout === "l-shape" ? (wallB ?? 0) : 0);
  const worktopPrice  = worktopLength * 2.64;
  return Math.round(cabPrice + worktopPrice);
}
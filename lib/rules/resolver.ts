import type {
  Cabinet,
  WallDimensions,
  Appliances,
  LayoutType,
  WallSide,
  RoomConstraints,
  Opening,
  Obstruction,
  Boiler,
  CabinetConflict,
} from "@/types/kitchen";
import { BASE_CABINETS, WALL_CABINETS, TALL_CABINETS } from "@/data/skus";
import { WORKTOP_PRICE_PER_CM } from "@/data/skus";

export const RULES = {
  MIN_WALL:               120,
  SNAP_INCREMENT:         5,
  CORNER_SIZE_BASE:       95,
  CORNER_SIZE_WALL:       100,
  CORNER_BASE_OFFSET:     5,
  MIN_WALL_B:             100,
  WORKTOP_DEPTH:          60,
  WALL_CAB_FROM_FLOOR:    146.9,
  BASE_HEIGHT:            86,
  BASE_DEPTH:             53,
  BASE_WALL_GAP:          5,
  WALL_DEPTH:             32,
  WORKTOP_THICKNESS:      3.8,
  WORKTOP_FRONT_OVERHANG: 2,
};

const BASE_WIDTHS = [80, 60, 50, 45, 40];
const WALL_CABINET_TYPES: Cabinet["type"][] = ["wall", "wall-corner", "wall-hood"];
const TALL_CABINET_TYPES: Cabinet["type"][] = ["tall", "tall-oven", "tall-fridge"];

type MountLayer = "ground" | "wall";

interface ConstraintInterval {
  start: number;
  end: number;
  mode?: "footprint" | "start";
}

interface ResolveContext {
  wallA: number;
  wallB: number;
  perpWall: "B" | "C";
  peninsulaWall?: "B" | "C";
  peninsulaSide?: "left" | "right";
  peninsulaDepth?: number;
  peninsulaClearance?: number;
  runBounds?: Partial<Record<"A" | "B" | "C", Partial<Record<MountLayer, { start: number; end: number }>>>>;
}

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

type RequiredPlacement = {
  type: Cabinet["type"];
  width: number;
  priority: number;
};

function autoPlaceAppliances(
  startX: number,
  wallLength: number,
  appliances: Appliances
): { placements: Map<number, Cabinet["type"]>; customWidths: number[]; overflow: [Cabinet["type"], number][] } {
  const placements = new Map<number, Cabinet["type"]>();
  if (wallLength <= 0) return { placements, customWidths: [], overflow: [] };

  const required = getRequiredAppliancePlacements(appliances);
  const selected: RequiredPlacement[] = [];
  const overflow: [Cabinet["type"], number][] = [];
  let requiredTotal = 0;

  required.forEach((item) => {
    if (requiredTotal + item.width <= wallLength) {
      selected.push(item);
      requiredTotal += item.width;
    } else {
      overflow.push([item.type, item.width]);
    }
  });

  const customWidths = chooseScoredWidthSequence(wallLength, selected.map((item) => item.width));
  const positions: number[] = [];
  let cur = startX;
  for (const width of customWidths) {
    positions.push(cur);
    cur += width;
  }

  const assignment = chooseScoredApplianceAssignment(selected, customWidths);
  assignment.forEach((slotIndex, itemIndex) => {
    const xPos = positions[slotIndex];
    if (xPos !== undefined) placements.set(xPos, selected[itemIndex].type);
  });

  selected.forEach((item, index) => {
    if (!assignment.has(index)) overflow.push([item.type, item.width]);
  });

  return { placements, customWidths, overflow };
}

function getRequiredAppliancePlacements(appliances: Appliances): RequiredPlacement[] {
  const required: RequiredPlacement[] = [];
  const sinkW = appliances.sinkSize ?? 60;
  const hobW = appliances.hobSize ?? 60;
  const dishW = (appliances.dishwasherSize ?? 60) as number;
  const ovenUnderHob = appliances.hasOven === "under-hob";

  if (appliances.hasSink) required.push({ type: "base-sink", width: sinkW, priority: 100 });
  if (appliances.hasHob) {
    if (appliances.hasOven === "tall-column") {
      required.push({ type: "base-hob", width: hobW, priority: 100 });
    } else if (ovenUnderHob && hobW === 60) {
      required.push({ type: "base-oven", width: 60, priority: 100 });
    } else if (ovenUnderHob && hobW === 80) {
      required.push({ type: "base-hob", width: 80, priority: 100 });
      required.push({ type: "base-oven", width: 60, priority: 92 });
    } else {
      required.push({ type: "base-hob", width: hobW, priority: 100 });
    }
  }
  if (appliances.hasDishwasher) required.push({ type: "base-dishwasher", width: dishW, priority: 90 });

  return required.sort((a, b) => b.priority - a.priority);
}

function chooseScoredWidthSequence(wallLength: number, requiredWidths: number[]): number[] {
  const target = Math.max(0, Math.floor(wallLength / RULES.SNAP_INCREMENT) * RULES.SNAP_INCREMENT);
  const requiredCounts = new Map<number, number>();
  requiredWidths.forEach((width) => requiredCounts.set(width, (requiredCounts.get(width) ?? 0) + 1));

  const memo = new Map<string, number[] | null>();
  const keyFor = (remaining: number, counts: Map<number, number>) =>
    `${remaining}:${BASE_WIDTHS.map((width) => counts.get(width) ?? 0).join(",")}`;
  const hasRequired = (counts: Map<number, number>) => BASE_WIDTHS.some((width) => (counts.get(width) ?? 0) > 0);
  const decrement = (counts: Map<number, number>, width: number) => {
    const next = new Map(counts);
    const count = next.get(width) ?? 0;
    if (count > 0) next.set(width, count - 1);
    return next;
  };

  const solve = (remaining: number, counts: Map<number, number>): number[] | null => {
    const key = keyFor(remaining, counts);
    if (memo.has(key)) return memo.get(key) ?? null;
    if (remaining < Math.min(...BASE_WIDTHS)) {
      const result = hasRequired(counts) ? null : [];
      memo.set(key, result);
      return result;
    }

    let best: number[] | null = null;
    for (const width of BASE_WIDTHS) {
      if (width > remaining) continue;
      const rest = solve(remaining - width, decrement(counts, width));
      if (!rest) continue;
      const candidate = [width, ...rest];
      if (!best || scoreWidthSequence(candidate, target) > scoreWidthSequence(best, target)) {
        best = candidate;
      }
    }

    if (!best && !hasRequired(counts)) best = decomposeWall(remaining);
    memo.set(key, best);
    return best;
  };

  const solved = solve(target, requiredCounts);
  if (solved && containsRequiredWidths(solved, requiredWidths)) return solved;
  return buildRequiredFirstWidthSequence(target, requiredWidths);
}

function containsRequiredWidths(widths: number[], requiredWidths: number[]): boolean {
  const counts = new Map<number, number>();
  widths.forEach((width) => counts.set(width, (counts.get(width) ?? 0) + 1));
  return requiredWidths.every((width) => {
    const count = counts.get(width) ?? 0;
    if (count <= 0) return false;
    counts.set(width, count - 1);
    return true;
  });
}

function buildRequiredFirstWidthSequence(target: number, requiredWidths: number[]): number[] {
  const sequence: number[] = [];
  const sortedRequired = [...requiredWidths].sort((a, b) => b - a);
  let used = 0;

  sortedRequired.forEach((width) => {
    if (used + width <= target) {
      sequence.push(width);
      used += width;
    }
  });

  const remaining = Math.max(0, target - used);
  sequence.push(...decomposeWall(remaining));
  return sequence;
}

function scoreWidthSequence(widths: number[], target: number): number {
  const filled = widths.reduce((sum, width) => sum + width, 0);
  const leftover = Math.max(0, target - filled);
  const average = widths.length > 0 ? filled / widths.length : 0;
  const variation = widths.reduce((sum, width) => sum + Math.abs(width - average), 0);
  return filled * 1000 - leftover * 200 - widths.length * 4 - variation * 0.2;
}

function chooseScoredApplianceAssignment(required: RequiredPlacement[], widths: number[]): Map<number, number> {
  const best = { score: Number.NEGATIVE_INFINITY, assignment: new Map<number, number>() };
  const usedSlots = new Set<number>();
  const current = new Map<number, number>();

  const visit = (itemIndex: number) => {
    if (itemIndex >= required.length) {
      const score = scoreApplianceAssignment(required, widths, current);
      if (score > best.score) {
        best.score = score;
        best.assignment = new Map(current);
      }
      return;
    }

    const item = required[itemIndex];
    widths.forEach((width, slotIndex) => {
      if (usedSlots.has(slotIndex) || width !== item.width) return;
      usedSlots.add(slotIndex);
      current.set(itemIndex, slotIndex);
      visit(itemIndex + 1);
      current.delete(itemIndex);
      usedSlots.delete(slotIndex);
    });
  };

  visit(0);
  return best.assignment;
}

function scoreApplianceAssignment(required: RequiredPlacement[], widths: number[], assignment: Map<number, number>): number {
  let score = assignment.size * 10000;
  const rowCenter = (widths.length - 1) / 2;

  required.forEach((item, itemIndex) => {
    const slot = assignment.get(itemIndex);
    if (slot === undefined) return;
    if (item.type === "base-hob" || item.type === "base-oven") {
      score -= Math.abs(slot - rowCenter) * 35;
    }
    if (item.type === "base-sink") {
      score -= Math.abs(slot - rowCenter) * 12;
    }
    if (slot === 0 || slot === widths.length - 1) score -= 20;
  });

  const sinkEntry = required.findIndex((item) => item.type === "base-sink");
  const dishwasherEntry = required.findIndex((item) => item.type === "base-dishwasher");
  const sinkSlot = assignment.get(sinkEntry);
  const dishwasherSlot = assignment.get(dishwasherEntry);
  if (sinkSlot !== undefined && dishwasherSlot !== undefined) {
    score += Math.max(0, 120 - Math.abs(sinkSlot - dishwasherSlot) * 60);
  }

  const cookingSlots = required
    .map((item, index) => (item.type === "base-hob" || item.type === "base-oven" ? assignment.get(index) : undefined))
    .filter((slot): slot is number => slot !== undefined);
  if (sinkSlot !== undefined && cookingSlots.length > 0) {
    const nearestCooking = Math.min(...cookingSlots.map((slot) => Math.abs(slot - sinkSlot)));
    score += Math.min(120, nearestCooking * 35);
  }

  return score;
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

function isCookingBase(cabinet: Cabinet): boolean {
  return cabinet.type === "base-hob" || cabinet.type === "base-oven";
}

function hoodXForCookingBase(cabinet: Cabinet, hoodWidth: number): number {
  return cabinet.xPos + Math.max(0, (cabinet.width - hoodWidth) / 2);
}

function getHoodDef(): Cabinet | undefined {
  return WALL_CABINETS.find((sku) => sku.type === "wall-hood") as Cabinet | undefined;
}

function getCookingBasesForHood(cabinets: Cabinet[]): Cabinet[] {
  const byWall = new Map<WallSide, Cabinet[]>();
  cabinets.forEach((cabinet) => {
    if (!isCookingBase(cabinet)) return;
    byWall.set(cabinet.wall, [...(byWall.get(cabinet.wall) ?? []), cabinet]);
  });

  const cookingBases: Cabinet[] = [];
  byWall.forEach((wallCabinets) => {
    const hobCabinets = wallCabinets.filter((cabinet) => cabinet.type === "base-hob");
    cookingBases.push(...(hobCabinets.length > 0 ? hobCabinets : wallCabinets));
  });

  return cookingBases.sort((a, b) => a.wall.localeCompare(b.wall) || a.xPos - b.xPos);
}

function appliancesForWall(appliances: Appliances, wall: Appliances["sinkWall"]): Appliances {
  const hasSink = wall === "A" && appliances.hasSink;
  const hasHob = wall === "A" && appliances.hasHob;
  return {
    ...appliances,
    hasSink,
    hasHob,
    hasDishwasher: wall === "A" ? appliances.hasDishwasher : false,
    hasOven: hasHob ? appliances.hasOven : "none",
  };
}

interface RunOptions {
  wallId:       WallSide;
  wallLength:   number;
  startX:       number;
  placements:   Map<number, Cabinet["type"]>;
  cabinets:     Cabinet[];
  customWidths?: number[];
  zPos?: number;
  runSide?: "left" | "right";
}

function buildBaseRun({ wallId, wallLength, startX, placements, cabinets, customWidths, zPos, runSide }: RunOptions) {
  if (wallLength <= 0) return;
  const widths = customWidths ?? decomposeWall(wallLength);
  let cursor = startX;
  for (const w of widths) {
    const type = placements.get(cursor) ?? "base";
    const def  = BASE_CABINETS.find(s => s.type === type && s.width === w)
              ?? (type === "base-hob" ? BASE_CABINETS.find(s => s.type === "base-hob" && s.width === w) : undefined)
              ?? BASE_CABINETS.find(s => s.type === "base" && s.width === w);
    if (!def) { cursor += w; continue; }
    cabinets.push({
      sku: def.sku,
      type: def.type,
      width: def.width,
      height: def.height,
      depth: def.depth,
      wall: wallId,
      xPos: cursor,
      zPos,
      runSide,
      price: def.price ?? 0,
      label: def.label,
      doorDirection: "S",
    });
    cursor += w;
  }
}

function buildWallRun({ wallId, wallLength, startX, placements, cabinets, customWidths, zPos, runSide }: RunOptions) {
  if (wallLength <= 0) return;
  const widths = customWidths ?? decomposeWall(wallLength);
  let cursor = startX;
  for (const w of widths) {
    const type = placements.get(cursor) ?? "wall";
    const def  = WALL_CABINETS.find(s => s.type === type && s.width === w)
              ?? WALL_CABINETS.find(s => s.type === "wall" && s.width === w);
    if (!def) { cursor += w; continue; }
    cabinets.push({
      sku: def.sku,
      type: def.type,
      width: def.width,
      height: def.height,
      depth: def.depth,
      wall: wallId,
      xPos: cursor,
      zPos,
      runSide,
      price: def.price ?? 0,
      label: def.label,
      doorDirection: "S",
    });
    cursor += w;
  }
}

const GENERATED_ISLAND_WALL_CLEARANCE = 130;

function islandStartX(
  wallA: number,
  islandWidth: number,
  position: WallDimensions["islandPosition"],
  activeLayout: LayoutType,
  perpWall: WallSide
): number {
  if (activeLayout === "l-shape") {
    if (perpWall === "B") return Math.min(GENERATED_ISLAND_WALL_CLEARANCE, Math.max(0, wallA - islandWidth));
    if (perpWall === "C") return Math.max(0, wallA - islandWidth - GENERATED_ISLAND_WALL_CLEARANCE);
  }
  if (position === "left") return 0;
  if (position === "right") return Math.max(0, wallA - islandWidth);
  return Math.max(0, (wallA - islandWidth) / 2);
}

function setRunBounds(
  context: ResolveContext,
  wall: "A" | "B" | "C",
  layer: MountLayer,
  start: number,
  end: number
): void {
  if (!context.runBounds) context.runBounds = {};
  context.runBounds[wall] ??= {};
  context.runBounds[wall]![layer] = {
    start: Math.max(0, start),
    end: Math.max(0, end),
  };
}

function getLayerBounds(
  wall: "A" | "B" | "C",
  layer: MountLayer,
  context: ResolveContext
): { start: number; end: number } {
  const wallLength = getWallLength(wall, context);
  const bounds = context.runBounds?.[wall]?.[layer];
  if (!bounds) return { start: 0, end: wallLength };

  return {
    start: Math.min(Math.max(0, bounds.start), wallLength),
    end: Math.min(Math.max(0, bounds.end), wallLength),
  };
}

export function resolveLayout(
  layout:     LayoutType,
  dimensions: WallDimensions,
  appliances: Appliances,
  constraints?: RoomConstraints
): { cabinets: Cabinet[]; warnings: string[] } {
  const cabinets: Cabinet[] = [];
  const warnings: string[] = [];
  const wallA = snapDimension(dimensions.wallA);
  const activeLayout = layout === "peninsula" ? "linear" : layout;
  const hasIsland = activeLayout === "island" || dimensions.hasIsland === true;
  const wallB = activeLayout === "l-shape" ? snapDimension(dimensions.wallB ?? RULES.MIN_WALL_B) : 0;

  const cs = dimensions.cornerSide ?? "right";
  const cornerAtLeft = cs === "right";
  const perpWall: WallSide = cornerAtLeft ? "B" : "C";
  const peninsulaGapStart = 0;
  const peninsulaGapEnd = 0;
  const context: ResolveContext = {
    wallA,
    wallB,
    perpWall: perpWall as "B" | "C",
    runBounds: {},
  };

  // ── Tall cabinets ────────────────────────────────────────────────────────
  let tallWidth = 0;
  const tallList: Cabinet[] = [];
  if (appliances.hasOven === "tall-column") {
    const sku = TALL_CABINETS.find(t => t.sku === (appliances.hasIntegratedMicrowave ? "1011C" : "1011B"));
    if (sku) { tallList.push({ ...sku, wall: "A", xPos: tallWidth, price: sku.price ?? 0, doorDirection: "S" as const }); tallWidth += sku.width; }
  }

  // ── Corner cabinets ──────────────────────────────────────────────────────
  if (activeLayout === "l-shape") {
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

    if (activeLayout === "l-shape") {
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
  }

  // ── Wall A base run ──────────────────────────────────────────────────────
  const cornerGap  = activeLayout === "l-shape" ? 60 : 0;
  const baseStartX = cornerAtLeft ? Math.max(cornerGap, peninsulaGapStart) : tallWidth + peninsulaGapStart;
  const baseEndX   = cornerAtLeft ? wallA - tallWidth - peninsulaGapEnd : wallA - Math.max(cornerGap, peninsulaGapEnd);
  const baseLength = Math.max(0, baseEndX - baseStartX);
  const wallAAppliances = appliancesForWall(appliances, "A");
  const { placements: basePlacements, customWidths: baseWidths, overflow: applianceOverflow } = autoPlaceAppliances(baseStartX, baseLength, wallAAppliances);
  if (applianceOverflow.length > 0 && activeLayout !== "l-shape") {
    warnings.push("Spatiul selectat nu este suficient pentru toate aparatele alese. Va rugam mariti dimensiunea bucatariei.");
  }
  const actualBaseWidth = baseWidths.reduce((s, w) => s + w, 0);
  const baseGap = baseLength - actualBaseWidth;
  const adjustedBaseStartX = !cornerAtLeft ? baseStartX + baseGap : baseStartX;
  setRunBounds(context, "A", "ground", adjustedBaseStartX, baseEndX);
  buildBaseRun({ wallId: "A", wallLength: baseLength, startX: adjustedBaseStartX, placements: basePlacements, cabinets, customWidths: baseWidths });

  // Tall cabs: placed at right end (Wall B) or left end (Wall C)
  // Tall cabs: start exactly where base run ends
  const actualBaseEnd = baseStartX + baseWidths.reduce((s, w) => s + w, 0);
  tallList.forEach((t, i) => {
    const prevW = tallList.slice(0, i).reduce((s, c) => s + c.width, 0);
    const tallX = cornerAtLeft ? actualBaseEnd + prevW : prevW + baseGap;
    cabinets.push({ ...t, xPos: tallX });
  });

  // Wall A wall run — same width as base run, no tall zone
  const wallRunStartX = cornerAtLeft ? Math.max(cornerGap, peninsulaGapStart) : tallWidth + baseGap + peninsulaGapStart;
  const wallRunLen    = baseLength - (!cornerAtLeft ? baseGap : 0);
  setRunBounds(context, "A", "wall", wallRunStartX, wallRunStartX + wallRunLen);
  const hobPlacement  = wallAAppliances.hasHob && appliances.hasHood
    ? autoPlaceHobWall(basePlacements) : new Map<number, Cabinet["type"]>();
  buildWallRun({ wallId: "A", wallLength: wallRunLen, startX: wallRunStartX, placements: hobPlacement, cabinets, customWidths: baseWidths });

  // ── Perpendicular wall ───────────────────────────────────────────────────
  if (activeLayout === "l-shape" && wallB > 0) {
    const perpStartX   = 100;
    const perpLength   = Math.max(0, wallB - perpStartX);
    setRunBounds(context, perpWall, "ground", perpStartX, wallB);
    const perpAppliances = appliancesForWall(appliances, "B");
    const { placements: perpPlacements, customWidths: perpWidths, overflow: perpOverflow } = autoPlaceAppliances(perpStartX, perpLength, perpAppliances);
    if (perpOverflow.length > 0) {
      warnings.push("Unele aparate selectate pentru peretele secundar nu incap in spatiul disponibil.");
    }
    buildBaseRun({ wallId: perpWall, wallLength: perpLength, startX: perpStartX, placements: perpPlacements, cabinets, customWidths: perpWidths });

    if (activeLayout === "l-shape") {
      const perpWallLength = Math.max(0, wallB - 100);
      setRunBounds(context, perpWall, "wall", 100, wallB);
      const perpWallPlacements = perpAppliances.hasHob && appliances.hasHood
        ? autoPlaceHobWall(perpPlacements)
        : new Map<number, Cabinet["type"]>();
      buildWallRun({ wallId: perpWall, wallLength: perpWallLength, startX: 100, placements: perpWallPlacements, cabinets, customWidths: perpWidths });
    }

    const perpHobXPos: number[] = [];
    if (activeLayout === "l-shape" && applianceOverflow.length > 0) {
      warnings.push(`Unele aparate nu incap pe Peretele A si au fost mutate pe Peretele B.`);
    }

    if (activeLayout === "l-shape" && applianceOverflow.length > 0) {
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
            // Remove any wall cabinet already placed above this position
            const wallCabIdx = cabinets.findIndex(c =>
              c.wall === perpWall &&
              ["wall", "wall-hood"].includes(c.type) &&
              c.xPos === existing.xPos
            );
            if (wallCabIdx !== -1) cabinets.splice(wallCabIdx, 1);
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

  if (hasIsland) {
    const islandWidth = snapDimension(dimensions.islandWidth ?? 180);
    const islandDepth = Math.max(60, dimensions.islandDepth ?? RULES.BASE_DEPTH);
    const islandDistance = GENERATED_ISLAND_WALL_CLEARANCE;
    const startX = islandStartX(wallA, islandWidth, dimensions.islandPosition ?? "center", activeLayout, perpWall);
    const islandAppliances = appliancesForWall(appliances, "I");
    const { placements: islandPlacements, customWidths: islandWidths, overflow: islandOverflow } = autoPlaceAppliances(startX, islandWidth, islandAppliances);
    if (islandOverflow.length > 0) {
      warnings.push("Unele aparate selectate pentru insula nu incap in dimensiunea aleasa.");
    }

    buildBaseRun({
      wallId: "I",
      wallLength: islandWidth,
      startX,
      placements: islandPlacements,
      cabinets,
      customWidths: islandWidths,
      zPos: islandDistance + islandDepth / 2,
    });
  }

  const constrained = applyRoomConstraints(cabinets, constraints, context, warnings);
  const applianceRepaired = repairMissingRequiredAppliances(constrained, appliances, constraints, context, warnings);
  const aligned = alignHoodsWithCookingBases(applianceRepaired, appliances, constraints, context, warnings);
  const applianceRepairedAfterHood = repairMissingRequiredAppliances(aligned, appliances, constraints, context, warnings);
  const optimized = fillAvailableCabinetGaps(applianceRepairedAfterHood, constraints, context);
  const compacted = compactPerpendicularRunToJoin(optimized, constraints, context);
  const synchronized = syncWallCabinetsWithBaseRows(compacted, appliances, constraints, context);
  return { cabinets: synchronized, warnings };
}

function compactPerpendicularRunToJoin(
  cabinets: Cabinet[],
  constraints: RoomConstraints | undefined,
  context: ResolveContext
): Cabinet[] {
  const wall = context.perpWall;
  const bounds = getLayerBounds(wall, "ground", context);
  if (bounds.end <= bounds.start) return cabinets;

  const movableRow = cabinets
    .filter((cabinet) => cabinet.wall === wall && getMountLayer(cabinet) === "ground")
    .filter((cabinet) => cabinet.type !== "base-corner" && !TALL_CABINET_TYPES.includes(cabinet.type))
    .filter((cabinet) => cabinet.xPos >= bounds.start && cabinet.xPos + cabinet.width <= bounds.end)
    .sort((a, b) => a.xPos - b.xPos);

  if (movableRow.length < 2) return cabinets;

  const placements = placeRowFromStart(movableRow, wall, "ground", bounds, constraints);
  if (!placements) return cabinets;

  return cabinets.map((cabinet) => {
    const xPos = placements.get(cabinet);
    return xPos === undefined ? cabinet : { ...cabinet, xPos };
  });
}

function placeRowFromStart(
  row: Cabinet[],
  wall: "A" | "B" | "C",
  layer: MountLayer,
  bounds: { start: number; end: number },
  constraints: RoomConstraints | undefined
): Map<Cabinet, number> | null {
  const segments = constraints
    ? getLegalRowSegments(wall, layer, bounds.start, bounds.end, constraints)
    : [{ start: bounds.start, end: bounds.end }];
  const placements = new Map<Cabinet, number>();
  let segmentIndex = 0;
  let cursor = segments[0]?.start ?? bounds.start;

  for (const cabinet of row) {
    let placed = false;

    while (segmentIndex < segments.length) {
      const segment = segments[segmentIndex];
      const candidateX = snapToIncrement(Math.max(cursor, segment.start));

      if (candidateX + cabinet.width <= segment.end) {
        const candidate = { ...cabinet, xPos: candidateX };
        if (isLegalCompactedPosition(candidate, bounds, constraints)) {
          placements.set(cabinet, candidateX);
          cursor = candidateX + cabinet.width;
          placed = true;
          break;
        }
      }

      segmentIndex += 1;
      cursor = segments[segmentIndex]?.start ?? bounds.end;
    }

    if (!placed) return null;
  }

  return placements;
}

function isLegalCompactedPosition(
  cabinet: Cabinet,
  bounds: { start: number; end: number },
  constraints: RoomConstraints | undefined
): boolean {
  if (cabinet.xPos < bounds.start || cabinet.xPos + cabinet.width > bounds.end) return false;
  if (!constraints) return true;
  if (findOverlapInterval(cabinet.xPos, cabinet.width, getForbiddenIntervals(cabinet, constraints))) return false;
  return getOpeningConflicts(cabinet, constraints).length === 0 && getCabinetConflicts(cabinet, constraints).length === 0;
}

function syncWallCabinetsWithBaseRows(
  cabinets: Cabinet[],
  appliances: Appliances,
  constraints: RoomConstraints | undefined,
  context: ResolveContext
): Cabinet[] {
  const preserved = cabinets.filter((cabinet) => {
    if (cabinet.wall !== "A" && cabinet.wall !== "B" && cabinet.wall !== "C") return true;
    if (getMountLayer(cabinet) !== "wall") return true;
    return cabinet.type === "wall-corner";
  });

  const rebuiltWallCabinets: Cabinet[] = [];
  for (const wall of ["A", "B", "C"] as const) {
    const baseRow = cabinets
      .filter((cabinet) => cabinet.wall === wall && getMountLayer(cabinet) === "ground")
      .filter((cabinet) => cabinet.type !== "base-corner" && !TALL_CABINET_TYPES.includes(cabinet.type))
      .sort((a, b) => a.xPos - b.xPos);

    const wallAnchors = preserved.filter((cabinet) => cabinet.wall === wall && getMountLayer(cabinet) === "wall");
    const hoodCabinets = appliances.hasHood
      ? baseRow
          .filter((cabinet) => isCookingBase(cabinet))
          .map((cabinet) => buildWallHoodForBase(cabinet, constraints, context))
          .filter((cabinet): cabinet is Cabinet => Boolean(cabinet))
      : [];

    hoodCabinets.forEach((hood) => rebuiltWallCabinets.push(hood));

    baseRow.forEach((baseCabinet) => {
      if (isCookingBase(baseCabinet) && appliances.hasHood) return;
      const wallCabinet = buildMirroredWallCabinet(baseCabinet, constraints, context);
      if (!wallCabinet) return;
      if (wallAnchors.some((anchor) => horizontalOverlap(anchor, wallCabinet))) return;
      if (hoodCabinets.some((hood) => horizontalOverlap(hood, wallCabinet))) return;
      rebuiltWallCabinets.push(wallCabinet);
    });
  }

  return [...preserved, ...rebuiltWallCabinets];
}

function buildWallHoodForBase(
  baseCabinet: Cabinet,
  constraints: RoomConstraints | undefined,
  context: ResolveContext
): Cabinet | null {
  const hoodDef = getHoodDef();
  if (!hoodDef) return null;
  const hood = buildAlignedHood(baseCabinet, hoodDef, context);
  if (!isValidHoodPlacement(hood, constraints, context)) return null;
  return hood;
}

function buildMirroredWallCabinet(
  baseCabinet: Cabinet,
  constraints: RoomConstraints | undefined,
  context: ResolveContext
): Cabinet | null {
  if (baseCabinet.wall !== "A" && baseCabinet.wall !== "B" && baseCabinet.wall !== "C") return null;
  const def = WALL_CABINETS.find((cabinet) => cabinet.type === "wall" && cabinet.width === baseCabinet.width);
  if (!def) return null;
  const bounds = getLayerBounds(baseCabinet.wall, "wall", context);
  const candidate: Cabinet = {
    ...def,
    wall: baseCabinet.wall,
    xPos: baseCabinet.xPos,
    price: def.price ?? 0,
    label: def.label,
    doorDirection: "S",
  };

  if (candidate.xPos < bounds.start || candidate.xPos + candidate.width > bounds.end) return null;
  if (!constraints) return candidate;
  if (findOverlapInterval(candidate.xPos, candidate.width, getForbiddenIntervals(candidate, constraints))) return null;
  if (getOpeningConflicts(candidate, constraints).length > 0 || getCabinetConflicts(candidate, constraints).length > 0) return null;
  return candidate;
}

function alignHoodsWithCookingBases(
  cabinets: Cabinet[],
  appliances: Appliances,
  constraints: RoomConstraints | undefined,
  context: ResolveContext,
  warnings: string[]
): Cabinet[] {
  if (!appliances.hasHood) {
    return cabinets.filter((cabinet) => cabinet.type !== "wall-hood");
  }

  if (!appliances.hasHob) return cabinets;

  const hoodDef = getHoodDef();
  if (!hoodDef) return cabinets;

  let workingCabinets = cabinets.filter((cabinet) => cabinet.type !== "wall-hood");
  const cookingBases = getCookingBasesForHood(workingCabinets);
  const alignedHoods: Cabinet[] = [];

  cookingBases.forEach((initialBaseCabinet) => {
    const currentBase = workingCabinets.find((cabinet) => cabinet === initialBaseCabinet) ?? initialBaseCabinet;
    let baseCabinet = currentBase;
    let hood: Cabinet | null = null;

    const currentBaseNeedsWallRelocation = (currentBase.wall !== "A" && currentBase.wall !== "B" && currentBase.wall !== "C")
      || currentBase.wall === context.peninsulaWall;

    if (currentBaseNeedsWallRelocation) {
      const relocation = findCookingBaseRelocation(currentBase, workingCabinets, hoodDef, constraints, context);
      if (relocation) {
        workingCabinets = relocation.cabinets;
        baseCabinet = relocation.baseCabinet;
        hood = relocation.hood;
        warnings.push("Plita/cuptorul a fost mutat pe un perete compatibil deoarece insula nu suporta hota.");
      } else {
        warnings.push("Hota pentru insula necesita verificare tehnica si nu a fost adaugata.");
        return;
      }
    } else {
      hood = buildAlignedHood(currentBase, hoodDef, context);
    }

    if (!hood || !isValidHoodPlacement(hood, constraints, context)) {
      const relocation = findCookingBaseRelocation(baseCabinet, workingCabinets, hoodDef, constraints, context);
      if (relocation) {
        workingCabinets = relocation.cabinets;
        baseCabinet = relocation.baseCabinet;
        hood = relocation.hood;
        warnings.push("Plita/cuptorul si hota au fost mutate intr-o pozitie compatibila cu obstacolele de pe perete.");
      }
    }

    if (!hood || !isValidHoodPlacement(hood, constraints, context)) {
      warnings.push("Hota nu a fost adaugata deoarece nu exista o pozitie libera compatibila cu plita si constrangerile peretelui.");
      return;
    }

    hood.conflicts = constraints ? getCabinetConflicts(hood, constraints) : [];
    alignedHoods.push(hood);
  });

  const hoodBlockedCabinets = new Set<Cabinet>();
  alignedHoods.forEach((hood) => {
    workingCabinets.forEach((cabinet) => {
      if (cabinet.wall !== hood.wall) return;
      if (!WALL_CABINET_TYPES.includes(cabinet.type)) return;
      if (cabinet.type === "wall-corner") return;
      if (!horizontalOverlap(cabinet, hood)) return;
      hoodBlockedCabinets.add(cabinet);
    });
  });

  return [
    ...workingCabinets.filter((cabinet) => !hoodBlockedCabinets.has(cabinet)),
    ...alignedHoods,
  ];
}

function buildAlignedHood(baseCabinet: Cabinet, hoodDef: Cabinet, context: ResolveContext): Cabinet {
  const wall = baseCabinet.wall as "A" | "B" | "C";
  const bounds = getLayerBounds(wall, "wall", context);
  const xPos = Math.min(
    Math.max(bounds.start, hoodXForCookingBase(baseCabinet, hoodDef.width)),
    Math.max(bounds.start, bounds.end - hoodDef.width)
  );

  return {
    ...hoodDef,
    wall: baseCabinet.wall,
    xPos,
    price: hoodDef.price ?? 0,
    label: hoodDef.label,
    doorDirection: "S",
  };
}

function isValidHoodPlacement(hood: Cabinet, constraints: RoomConstraints | undefined, context?: ResolveContext): boolean {
  if (context && (hood.wall === "A" || hood.wall === "B" || hood.wall === "C")) {
    const bounds = getLayerBounds(hood.wall, "wall", context);
    if (hood.xPos < bounds.start || hood.xPos + hood.width > bounds.end) return false;
  }
  if (!constraints) return true;
  return getOpeningConflicts(hood, constraints).length === 0 && getCabinetConflicts(hood, constraints).length === 0;
}

function canPackGenericWallAroundHood(hood: Cabinet, context: ResolveContext): boolean {
  if (hood.wall !== "A" && hood.wall !== "B" && hood.wall !== "C") return false;
  const bounds = getLayerBounds(hood.wall, "wall", context);
  const left = Math.max(0, hood.xPos - bounds.start);
  const right = Math.max(0, bounds.end - (hood.xPos + hood.width));
  return canFillOptionalWidth(left) && canFillOptionalWidth(right);
}

function canFillOptionalWidth(width: number): boolean {
  if (width === 0) return true;
  if (width < Math.min(...BASE_WIDTHS)) return true;
  return canFillWidth(width);
}

function repairMissingRequiredAppliances(
  cabinets: Cabinet[],
  appliances: Appliances,
  constraints: RoomConstraints | undefined,
  context: ResolveContext,
  warnings: string[]
): Cabinet[] {
  if (!constraints) return cabinets;
  let repaired = cabinets;
  const required = getRequiredAppliancePlacements(appliances);

  required.forEach((item) => {
    if (hasRequiredApplianceCabinet(repaired, item)) return;
    const replacement = findRequiredApplianceReplacement(repaired, item, constraints, context);
    if (!replacement) {
      warnings.push(`${applianceLabel(item.type)} nu a fost adaugat deoarece nu exista o pozitie libera compatibila cu dimensiunile si constrangerile peretelui.`);
      return;
    }

    repaired = repaired
      .filter((cabinet) => cabinet !== replacement.target)
      .concat(replacement.cabinet);
  });

  return repaired;
}

function hasRequiredApplianceCabinet(cabinets: Cabinet[], item: RequiredPlacement): boolean {
  return cabinets.some((cabinet) => cabinet.type === item.type && cabinet.width === item.width);
}

function findRequiredApplianceReplacement(
  cabinets: Cabinet[],
  item: RequiredPlacement,
  constraints: RoomConstraints,
  context: ResolveContext
): { target: Cabinet; cabinet: Cabinet } | null {
  const def = BASE_CABINETS.find((sku) => sku.type === item.type && sku.width === item.width);
  if (!def) return null;

  const candidates = cabinets
    .filter((cabinet) => getMountLayer(cabinet) === "ground")
    .filter((cabinet) => cabinet.wall === "A" || cabinet.wall === context.perpWall)
    .filter((cabinet) => isRepackableGenericCabinet(cabinet) && cabinet.width >= item.width)
    .map((target) => {
      const cabinet: Cabinet = {
        ...def,
        wall: target.wall,
        xPos: target.xPos,
        zPos: target.zPos,
        runSide: target.runSide,
        price: def.price ?? 0,
        label: def.label,
        doorDirection: "S",
      };
      return {
        target,
        cabinet,
        score: scoreRequiredApplianceReplacement(cabinet, cabinets, constraints, context) - Math.max(0, target.width - item.width) * 3,
      };
    })
    .filter((candidate) => candidate.score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score);

  return candidates[0] ? { target: candidates[0].target, cabinet: candidates[0].cabinet } : null;
}

function scoreRequiredApplianceReplacement(
  candidate: Cabinet,
  cabinets: Cabinet[],
  constraints: RoomConstraints,
  context: ResolveContext
): number {
  const bounds = candidate.wall === "A" || candidate.wall === "B" || candidate.wall === "C"
    ? getLayerBounds(candidate.wall, "ground", context)
    : { start: 0, end: 0 };
  if (candidate.xPos < bounds.start || candidate.xPos + candidate.width > bounds.end) return Number.NEGATIVE_INFINITY;
  if (findOverlapInterval(candidate.xPos, candidate.width, getForbiddenIntervals(candidate, constraints))) return Number.NEGATIVE_INFINITY;
  if (getOpeningConflicts(candidate, constraints).length > 0 || getCabinetConflicts(candidate, constraints).length > 0) return Number.NEGATIVE_INFINITY;

  let score = 1000;
  const center = (bounds.start + bounds.end) / 2;
  score -= Math.abs((candidate.xPos + candidate.width / 2) - center) * 0.25;

  if (candidate.type === "base-dishwasher") {
    const sink = cabinets.find((cabinet) => cabinet.type === "base-sink" && cabinet.wall === candidate.wall);
    if (sink) score += Math.max(0, 180 - Math.abs(candidate.xPos - sink.xPos) * 2);
  }

  return score;
}

function applianceLabel(type: Cabinet["type"]): string {
  const labels: Partial<Record<Cabinet["type"], string>> = {
    "base-sink": "Chiuveta",
    "base-dishwasher": "Masina de spalat vase",
    "base-hob": "Plita",
    "base-oven": "Cuptorul",
  };
  return labels[type] ?? "Aparatul selectat";
}


function findCookingBaseRelocation(
  baseCabinet: Cabinet,
  cabinets: Cabinet[],
  hoodDef: Cabinet,
  constraints: RoomConstraints | undefined,
  context: ResolveContext
): { cabinets: Cabinet[]; baseCabinet: Cabinet; hood: Cabinet } | null {
  const originalGeneric = BASE_CABINETS.find((sku) => sku.type === "base" && sku.width === baseCabinet.width)
    ?? BASE_CABINETS.find((sku) => sku.type === "base" && sku.width >= Math.min(baseCabinet.width, 60));
  if (!originalGeneric) return null;

  const candidates = findCookingRelocationCandidates(baseCabinet, cabinets, hoodDef, constraints, context)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) return null;

  const replacementOriginal: Cabinet = {
    ...originalGeneric,
    width: baseCabinet.width,
    wall: baseCabinet.wall,
    xPos: baseCabinet.xPos,
    zPos: baseCabinet.zPos,
    runSide: baseCabinet.runSide,
    price: originalGeneric.price ?? 0,
    label: originalGeneric.label,
    doorDirection: "S",
  };

  const relocated = cabinets
    .filter((cabinet) => {
      if (cabinet === baseCabinet) return false;
      if (cabinet.wall !== best.movedBase.wall) return true;
      if (getMountLayer(cabinet) !== "ground") return true;
      if (!canDisplaceForCookingRelocation(cabinet)) return true;
      return !horizontalOverlap(cabinet, best.movedBase);
    })
    .concat(replacementOriginal, best.movedBase);

  return { cabinets: relocated, baseCabinet: best.movedBase, hood: best.hood };
}

function findCookingRelocationCandidates(
  baseCabinet: Cabinet,
  cabinets: Cabinet[],
  hoodDef: Cabinet,
  constraints: RoomConstraints | undefined,
  context: ResolveContext
): { movedBase: Cabinet; hood: Cabinet; score: number }[] {
  const candidates: { movedBase: Cabinet; hood: Cabinet; score: number }[] = [];

  for (const wall of ["A", "B", "C"] as const) {
    if (wall === context.peninsulaWall) continue;
    const groundBounds = getLayerBounds(wall, "ground", context);
    const wallBounds = getLayerBounds(wall, "wall", context);
    if (groundBounds.end - groundBounds.start < baseCabinet.width) continue;
    if (wallBounds.end - wallBounds.start < hoodDef.width) continue;

    for (let hoodX = snapToIncrement(wallBounds.start); hoodX + hoodDef.width <= wallBounds.end; hoodX += RULES.SNAP_INCREMENT) {
      const baseX = snapToIncrement(Math.min(
        Math.max(groundBounds.start, hoodX + (hoodDef.width - baseCabinet.width) / 2),
        groundBounds.end - baseCabinet.width
      ));
      const movedBase: Cabinet = {
        ...baseCabinet,
        wall,
        xPos: baseX,
        zPos: undefined,
        runSide: undefined,
      };
      const hood: Cabinet = {
        ...hoodDef,
        wall,
        xPos: hoodX,
        price: hoodDef.price ?? 0,
        label: hoodDef.label,
        doorDirection: "S",
      };

      if (!isValidCookingBasePlacement(movedBase, cabinets, baseCabinet, constraints)) continue;
      if (!isValidHoodPlacement(hood, constraints, context)) continue;
      if (!canPackGenericWallAroundHood(hood, context)) continue;

      candidates.push({
        movedBase,
        hood,
        score: scoreCookingRelocation(baseCabinet, movedBase, hood, context, cabinets),
      });
    }
  }

  return candidates;
}

function isValidCookingBasePlacement(
  movedBase: Cabinet,
  cabinets: Cabinet[],
  originalBase: Cabinet,
  constraints: RoomConstraints | undefined
): boolean {
  if (constraints) {
    const forbidden = getForbiddenIntervals(movedBase, constraints);
    if (findOverlapInterval(movedBase.xPos, movedBase.width, forbidden)) return false;
    if (getCabinetConflicts(movedBase, constraints).length > 0) return false;
  }

  return cabinets.every((cabinet) => {
    if (cabinet === originalBase) return true;
    if (cabinet.wall !== movedBase.wall) return true;
    if (getMountLayer(cabinet) !== "ground") return true;
    if (!horizontalOverlap(cabinet, movedBase)) return true;
    return canDisplaceForCookingRelocation(cabinet);
  });
}

function canDisplaceForCookingRelocation(cabinet: Cabinet): boolean {
  return isRepackableGenericCabinet(cabinet) || cabinet.type === "base-dishwasher";
}

function scoreCookingRelocation(
  baseCabinet: Cabinet,
  candidate: Cabinet,
  hood: Cabinet,
  context: ResolveContext,
  cabinets: Cabinet[]
): number {
  let score = 1000;
  if (candidate.wall === baseCabinet.wall) score += 140;
  if (candidate.wall !== "A") score += 70;

  const bounds = getLayerBounds(candidate.wall as "A" | "B" | "C", "ground", context);
  const center = (bounds.start + bounds.end) / 2;
  score -= Math.abs((candidate.xPos + candidate.width / 2) - center) * 0.35;
  score -= Math.abs(candidate.xPos - baseCabinet.xPos) * 0.08;

  const removedGenericWidth = cabinets
    .filter((cabinet) => cabinet.wall === candidate.wall && getMountLayer(cabinet) === "ground")
    .filter((cabinet) => isRepackableGenericCabinet(cabinet) && horizontalOverlap(cabinet, candidate))
    .reduce((sum, cabinet) => sum + cabinet.width, 0);
  score -= Math.max(0, candidate.width - removedGenericWidth) * 2;

  const wallBounds = getLayerBounds(candidate.wall as "A" | "B" | "C", "wall", context);
  if (hood.xPos >= wallBounds.start && hood.xPos + hood.width <= wallBounds.end) {
    score += 80;
  }
  if (canPackGenericWallAroundHood(hood, context)) {
    score += 180;
  }

  return score;
}

function applyRoomConstraints(
  cabinets: Cabinet[],
  constraints: RoomConstraints | undefined,
  context: ResolveContext,
  warnings: string[]
): Cabinet[] {
  if (!constraints) return cabinets;

  const withConflicts = cabinets.map((cab) => ({ ...cab, conflicts: [] as CabinetConflict[] }));
  const removedCabinets = new Set<Cabinet>();

  for (const wall of ["A", "B", "C"] as const) {
    const wallLength = getWallLength(wall, context);
    if (wallLength <= 0) continue;

    for (const layer of ["ground", "wall"] as MountLayer[]) {
      const layerCabs = withConflicts
        .filter((cab) => cab.wall === wall && getMountLayer(cab) === layer)
        .sort((a, b) => a.xPos - b.xPos);

      const bounds = getLayerBounds(wall, layer, context);
      let cursor = bounds.start;
      for (const cab of layerCabs) {
        if (isProtectedLayoutAnchor(cab)) {
          cursor = Math.max(cursor, cab.xPos + cab.width);
          continue;
        }

        const intervals = getForbiddenIntervals(cab, constraints).sort((a, b) => a.start - b.start);
        let start = Math.max(cab.xPos, cursor);
        let loops = 0;

        while (loops < 30) {
          loops += 1;
          const overlap = findOverlapInterval(start, cab.width, intervals);
          if (!overlap) break;
          start = overlap.end;
        }

        if (start + cab.width <= bounds.end) {
          cab.xPos = start;
          cursor = start + cab.width;
          continue;
        }

        removedCabinets.add(cab);
        cursor = Math.max(cursor, start);
        warnings.push(`${cab.label ?? cab.sku} a fost eliminat deoarece nu mai incape dupa respectarea constrangerilor de pe peretele ${wall}.`);
      }
    }
  }

  const keptCabinets: Cabinet[] = [];
  for (const cab of withConflicts) {
    if (removedCabinets.has(cab)) continue;
    const openingConflicts = getOpeningConflicts(cab, constraints);
    if (openingConflicts.length > 0) {
      warnings.push(`${cab.label ?? cab.sku} a fost eliminat deoarece se suprapune cu o fereastra sau usa.`);
      continue;
    }
    keptCabinets.push(cab);
  }

  for (const cab of keptCabinets) {
    cab.conflicts = dedupeConflicts([...(cab.conflicts ?? []), ...getCabinetConflicts(cab, constraints)]);
  }

  return removeSameLayerOverlaps(keptCabinets, context, warnings);
}

function removeSameLayerOverlaps(
  cabinets: Cabinet[],
  context: ResolveContext,
  warnings: string[]
): Cabinet[] {
  const kept = new Set<Cabinet>();

  for (const wall of ["A", "B", "C"] as const) {
    const wallLength = getWallLength(wall, context);
    if (wallLength <= 0) continue;

    for (const layer of ["ground", "wall"] as MountLayer[]) {
      const layerCabs = cabinets
        .filter((cabinet) => cabinet.wall === wall && getMountLayer(cabinet) === layer)
        .sort((a, b) => a.xPos - b.xPos || layerPriority(a) - layerPriority(b));

      const bounds = getLayerBounds(wall, layer, context);
      let cursor = bounds.start;
      for (const cabinet of layerCabs) {
        if (isProtectedLayoutAnchor(cabinet)) {
          kept.add(cabinet);
          cursor = Math.max(cursor, cabinet.xPos + cabinet.width);
          continue;
        }

        if (cabinet.xPos < cursor || cabinet.xPos + cabinet.width > bounds.end) {
          warnings.push(`${cabinet.label ?? cabinet.sku} a fost eliminat deoarece se suprapunea cu alt cabinet pe peretele ${wall}.`);
          continue;
        }

        kept.add(cabinet);
        cursor = cabinet.xPos + cabinet.width;
      }
    }
  }

  cabinets.forEach((cabinet) => {
    if (cabinet.wall !== "A" && cabinet.wall !== "B" && cabinet.wall !== "C") {
      kept.add(cabinet);
    }
  });

  return cabinets.filter((cabinet) => kept.has(cabinet));
}

function isProtectedLayoutAnchor(cabinet: Cabinet): boolean {
  return (
    cabinet.type === "base-corner" ||
    cabinet.type === "wall-corner" ||
    cabinet.type === "wall-hood" ||
    TALL_CABINET_TYPES.includes(cabinet.type) ||
    (!isRepackableGenericCabinet(cabinet) && getMountLayer(cabinet) === "ground")
  );
}

function layerPriority(cabinet: Cabinet): number {
  if (isProtectedLayoutAnchor(cabinet)) return 0;
  return 1;
}

function fillAvailableCabinetGaps(
  cabinets: Cabinet[],
  constraints: RoomConstraints | undefined,
  context: ResolveContext
): Cabinet[] {
  if (!constraints) return cabinets;

  const rebuilt: Cabinet[] = cabinets.filter((cabinet) => cabinet.wall !== "A" && cabinet.wall !== "B" && cabinet.wall !== "C");

  for (const wall of ["A", "B", "C"] as const) {
    const wallLength = getWallLength(wall, context);
    if (wallLength <= 0) continue;

    for (const layer of ["ground", "wall"] as MountLayer[]) {
      const layerCabinets = cabinets
        .filter((cabinet) => cabinet.wall === wall && getMountLayer(cabinet) === layer)
        .sort((a, b) => a.xPos - b.xPos || layerPriority(a) - layerPriority(b));

      if (layerCabinets.length === 0) continue;

      const bounds = getLayerBounds(wall, layer, context);
      const rowStart = bounds.start;
      const rowEnd = bounds.end;
      const anchors = layerCabinets
        .filter((cabinet) => !isRepackableGenericCabinet(cabinet))
        .sort((a, b) => a.xPos - b.xPos || layerPriority(a) - layerPriority(b));

      let cursor = rowStart;
      for (const anchor of anchors) {
        if (anchor.xPos > cursor) {
          rebuilt.push(...packGenericCabinets(wall, layer, cursor, anchor.xPos, constraints));
        }

        rebuilt.push(anchor);
        cursor = Math.max(cursor, anchor.xPos + anchor.width);
      }

      if (cursor < rowEnd) {
        rebuilt.push(...packGenericCabinets(wall, layer, cursor, rowEnd, constraints));
      }
    }
  }

  return rebuilt;
}

function isRepackableGenericCabinet(cabinet: Cabinet): boolean {
  return cabinet.type === "base" || cabinet.type === "wall";
}

function getRowBlockingIntervals(
  wall: "A" | "B" | "C",
  layer: MountLayer,
  start: number,
  end: number,
  constraints: RoomConstraints
): ConstraintInterval[] {
  const rowY = layer === "wall"
    ? [RULES.WALL_CAB_FROM_FLOOR, RULES.WALL_CAB_FROM_FLOOR + 70] as [number, number]
    : [0, RULES.BASE_HEIGHT] as [number, number];
  const intervals: ConstraintInterval[] = [];

  (constraints.openings ?? []).forEach((opening) => {
    if (opening.wall !== wall) return;
    if (!verticalOverlap(rowY, openingYRange(opening))) return;
    intervals.push({ start: opening.xPos, end: opening.xPos + opening.width });
  });

  (constraints.obstructions ?? []).forEach((obstruction) => {
    if (obstruction.wall !== wall) return;
    if (!verticalOverlap(rowY, obstructionYRange(obstruction))) return;
    intervals.push({ start: obstruction.xPos, end: obstruction.xPos + obstruction.width });
  });

  if (constraints.boiler && constraints.boiler.wall === wall && verticalOverlap(rowY, boilerYRange(constraints.boiler))) {
    intervals.push({
      start: constraints.boiler.xPos - constraints.boiler.pipeClearance,
      end: constraints.boiler.xPos + constraints.boiler.width + constraints.boiler.pipeClearance,
    });
  }

  return intervals
    .map((interval) => ({ start: Math.max(start, interval.start), end: Math.min(end, interval.end) }))
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start - b.start);
}

function getLegalRowSegments(
  wall: "A" | "B" | "C",
  layer: MountLayer,
  start: number,
  end: number,
  constraints: RoomConstraints
): { start: number; end: number }[] {
  const blockers = getRowBlockingIntervals(wall, layer, start, end, constraints);
  const segments: { start: number; end: number }[] = [];
  let cursor = start;

  blockers.forEach((blocker) => {
    if (blocker.start > cursor) segments.push({ start: cursor, end: blocker.start });
    cursor = Math.max(cursor, blocker.end);
  });

  if (cursor < end) segments.push({ start: cursor, end });
  return segments.filter((segment) => segment.end - segment.start >= Math.min(...BASE_WIDTHS));
}

function packGenericCabinets(
  wall: "A" | "B" | "C",
  layer: MountLayer,
  start: number,
  end: number,
  constraints: RoomConstraints
): Cabinet[] {
  const packed: Cabinet[] = [];
  const segments = getLegalRowSegments(wall, layer, start, end, constraints);

  segments.forEach((segment) => {
    let cursor = snapToIncrement(segment.start);
    while (cursor + Math.min(...BASE_WIDTHS) <= segment.end) {
      const def = findLargestGenericCabinet(layer, segment.end - cursor, cursor, wall, constraints);
      if (!def) {
        cursor += RULES.SNAP_INCREMENT;
        continue;
      }

      packed.push({
        sku: def.sku,
        type: def.type,
        width: def.width,
        height: def.height,
        depth: def.depth,
        wall,
        xPos: cursor,
        price: def.price ?? 0,
        label: def.label,
        doorDirection: "S",
      });
      cursor += def.width;
    }
  });

  return packed;
}

function canFillWidth(width: number): boolean {
  if (width === 0) return true;
  if (width < Math.min(...BASE_WIDTHS)) return false;
  return decomposeWall(width).reduce((sum, item) => sum + item, 0) === width;
}

function findLargestGenericCabinet(
  layer: MountLayer,
  maxWidth: number,
  xPos: number,
  wall: "A" | "B" | "C",
  constraints: RoomConstraints
) {
  const source = layer === "wall" ? WALL_CABINETS : BASE_CABINETS;
  const type = layer === "wall" ? "wall" : "base";

  const legalCandidates = source
    .filter((cabinet) => cabinet.type === type && cabinet.width <= maxWidth)
    .filter((cabinet) => {
      const candidate: Cabinet = {
        sku: cabinet.sku,
        type: cabinet.type,
        width: cabinet.width,
        height: cabinet.height,
        depth: cabinet.depth,
        wall,
        xPos,
        price: cabinet.price ?? 0,
        label: cabinet.label,
      };

      const forbidden = getForbiddenIntervals(candidate, constraints);
      return !findOverlapInterval(candidate.xPos, candidate.width, forbidden)
        && getOpeningConflicts(candidate, constraints).length === 0
        && getCabinetConflicts(candidate, constraints).length === 0;
    })
    .sort((a, b) => b.width - a.width);

  const fillableCandidates = legalCandidates.filter((cabinet) => canFillWidth(maxWidth - cabinet.width));
  return fillableCandidates[0] ?? legalCandidates[0];
}

function snapToIncrement(value: number): number {
  return Math.ceil(value / RULES.SNAP_INCREMENT) * RULES.SNAP_INCREMENT;
}

function dedupeConflicts(conflicts: CabinetConflict[]): CabinetConflict[] {
  const map = new Map<string, CabinetConflict>();
  conflicts.forEach((conflict) => map.set(`${conflict.type}:${conflict.constraintId}`, conflict));
  return Array.from(map.values());
}

function getWallLength(wall: "A" | "B" | "C", context: ResolveContext): number {
  if (wall === "A") return context.wallA;
  if (wall === context.perpWall) return context.wallB;
  return 0;
}

function getMountLayer(cab: Cabinet): MountLayer {
  return WALL_CABINET_TYPES.includes(cab.type) ? "wall" : "ground";
}

function getCabinetYRange(cab: Cabinet): [number, number] {
  if (WALL_CABINET_TYPES.includes(cab.type)) {
    return [RULES.WALL_CAB_FROM_FLOOR, RULES.WALL_CAB_FROM_FLOOR + cab.height];
  }
  return [0, cab.height];
}

function verticalOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

function horizontalOverlap(a: Cabinet, b: Cabinet): boolean {
  return a.xPos < b.xPos + b.width && b.xPos < a.xPos + a.width;
}

function openingYRange(opening: Opening): [number, number] {
  const sill = opening.type === "window" ? opening.sillHeight ?? 90 : 0;
  return [sill, sill + opening.height];
}

function obstructionYRange(obstruction: Obstruction): [number, number] {
  const bottom = obstruction.startsFromFloor === false ? obstruction.yPos ?? 0 : 0;
  return [bottom, bottom + obstruction.height];
}

function boilerYRange(boiler: Boiler): [number, number] {
  const bottom = boiler.yPos ?? RULES.WALL_CAB_FROM_FLOOR;
  return [bottom, bottom + boiler.height];
}

function getForbiddenIntervals(cab: Cabinet, constraints: RoomConstraints): ConstraintInterval[] {
  const wall = cab.wall;
  if (wall !== "A" && wall !== "B" && wall !== "C") return [];

  const intervals: ConstraintInterval[] = [];
  const cabY = getCabinetYRange(cab);

  if (isCookingBase(cab)) {
    intervals.push(...getHoodOpeningProjectionIntervals(cab, constraints));
  }

  (constraints.obstructions ?? []).forEach((obstruction) => {
    if (obstruction.wall !== wall) return;
    if (!verticalOverlap(cabY, obstructionYRange(obstruction))) return;
    intervals.push({ start: obstruction.xPos, end: obstruction.xPos + obstruction.width });
  });

  if (constraints.boiler && constraints.boiler.wall === wall && verticalOverlap(cabY, boilerYRange(constraints.boiler))) {
    intervals.push({
      start: constraints.boiler.xPos - constraints.boiler.pipeClearance,
      end: constraints.boiler.xPos + constraints.boiler.width + constraints.boiler.pipeClearance,
    });
  }

  return intervals.map((interval) => ({
    start: Math.max(0, interval.start),
    end: Math.max(0, interval.end),
    mode: interval.mode,
  }));
}

function getHoodOpeningProjectionIntervals(cab: Cabinet, constraints: RoomConstraints): ConstraintInterval[] {
  const wall = cab.wall;
  if (wall !== "A" && wall !== "B" && wall !== "C") return [];

  const hoodDef = getHoodDef();
  if (!hoodDef) return [];

  const hoodY = getCabinetYRange(hoodDef);
  const hoodOffset = Math.max(0, (cab.width - hoodDef.width) / 2);

  return (constraints.openings ?? [])
    .filter((opening) => opening.wall === wall && verticalOverlap(hoodY, openingYRange(opening)))
    .map((opening) => ({
      start: opening.xPos - hoodDef.width - hoodOffset,
      end: opening.xPos + opening.width - hoodOffset,
      mode: "start" as const,
    }));
}

function findOverlapInterval(start: number, width: number, intervals: ConstraintInterval[]): ConstraintInterval | undefined {
  const end = start + width;
  return intervals.find((interval) => {
    if (interval.mode === "start") {
      return interval.start <= start && start < interval.end;
    }
    return interval.start < end && start < interval.end;
  });
}

function getCabinetConflicts(cab: Cabinet, constraints: RoomConstraints): CabinetConflict[] {
  const wall = cab.wall;
  if (wall !== "A" && wall !== "B" && wall !== "C") return [];

  const start = cab.xPos;
  const end = cab.xPos + cab.width;
  const cabY = getCabinetYRange(cab);
  const conflicts: CabinetConflict[] = [];

  (constraints.openings ?? []).forEach((opening) => {
    if (opening.wall !== wall) return;
    if (!verticalOverlap(cabY, openingYRange(opening))) return;
    if (opening.xPos < end && start < opening.xPos + opening.width) {
      conflicts.push({
        type: opening.type,
        constraintId: opening.id,
        message: `${opening.type === "window" ? "Fereastra" : "Usa"} se suprapune cu cabinetul.`,
      });
    }
  });

  (constraints.obstructions ?? []).forEach((obstruction) => {
    if (obstruction.wall !== wall) return;
    if (!verticalOverlap(cabY, obstructionYRange(obstruction))) return;
    if (obstruction.xPos < end && start < obstruction.xPos + obstruction.width) {
      conflicts.push({
        type: "obstruction",
        constraintId: obstruction.id,
        message: "Obstacolul se suprapune cu cabinetul.",
      });
    }
  });

  if (constraints.boiler && constraints.boiler.wall === wall && verticalOverlap(cabY, boilerYRange(constraints.boiler))) {
    const min = constraints.boiler.xPos - constraints.boiler.pipeClearance;
    const max = constraints.boiler.xPos + constraints.boiler.width + constraints.boiler.pipeClearance;
    if (min < end && start < max) {
      conflicts.push({
        type: "boiler",
        constraintId: constraints.boiler.id,
        message: "Centrala termica necesita zona libera suplimentara.",
      });
    }
  }

  return conflicts;
}

function getOpeningConflicts(cab: Cabinet, constraints: RoomConstraints): CabinetConflict[] {
  const wall = cab.wall;
  if (wall !== "A" && wall !== "B" && wall !== "C") return [];

  const start = cab.xPos;
  const end = cab.xPos + cab.width;
  const cabY = getCabinetYRange(cab);
  const conflicts: CabinetConflict[] = [];

  (constraints.openings ?? []).forEach((opening) => {
    if (opening.wall !== wall) return;
    if (!verticalOverlap(cabY, openingYRange(opening))) return;
    if (opening.xPos < end && start < opening.xPos + opening.width) {
      conflicts.push({
        type: opening.type,
        constraintId: opening.id,
        message: `${opening.type === "window" ? "Fereastra" : "Usa"} elimina cabinetul din zona ei.`,
      });
    }
  });

  return conflicts;
}

// ── REPLACE the DOOR_PRICE_BY_WIDTH constant and calcTotalPrice at the bottom of resolver.ts ──

const DOOR_PRICE_BY_WIDTH: Record<number, number> = {
  40: 80, 45: 90, 50: 100, 60: 110, 80: 140, 95: 180, 100: 190
};

export const CABINET_DISCOUNT = 0.20; // 20% off cabinets, worktop stays full price

export function calcTotalPrice(
  cabinets: Cabinet[],
  wallA: number,
  wallB?: number,
  layout?: LayoutType
): { original: number; discounted: number } {
  const cabPrice = cabinets.reduce((sum, c) => sum + (c.price ?? 0), 0);

  // Subtract tall cabinet widths from Wall A — no worktop above tall columns
  const tallWidthA = cabinets
    .filter(c => c.wall === "A" && c.type.startsWith("tall"))
    .reduce((sum, c) => sum + c.width, 0);

  // 1.80 RON/cm = 180 RON/linear meter (matches Shopify worktop price)
  const islandAndPeninsulaWidth = cabinets
    .filter(c => (c.wall === "I" || c.wall === "P") && !c.type.startsWith("wall") && !c.type.startsWith("tall"))
    .reduce((sum, c) => sum + c.width, 0);
  const worktopLength = (wallA - tallWidthA) + (layout === "l-shape" ? (wallB ?? 0) : 0) + islandAndPeninsulaWidth;
  const worktopPrice  = worktopLength * 1.80;

  const original   = Math.round(cabPrice + worktopPrice);
  const discounted = Math.round(cabPrice * (1 - CABINET_DISCOUNT) + worktopPrice);
  return { original, discounted };
}

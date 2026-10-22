import type { Cabinet, LayoutType, WallDimensions } from "@/types/kitchen";

export const WORKTOP_RON_PER_CM = 1.45;
const money = (value: number) => Math.round(value * 100) / 100;

/** Wall-run estimate, net of tall columns and the overlapping L corner. */
export function calculateExportPricing(cabinets: Cabinet[], layout: LayoutType, dimensions: WallDimensions) {
  const tallA = cabinets.filter(c => c.wall === "A" && c.placementMode !== "free" && c.type?.startsWith("tall"))
    .reduce((sum, c) => sum + c.width, 0);
  const tallReturn = cabinets.filter(c => (c.wall === "B" || c.wall === "C") && c.placementMode !== "free" && c.type?.startsWith("tall"))
    .reduce((sum, c) => sum + c.width, 0);
  const a = Math.max(0, dimensions.wallA - tallA);
  const b = layout === "l-shape" ? Math.max(0, (dimensions.wallB ?? 0) - tallReturn) : 0;
  const island = cabinets.filter(c => c.wall === "I" && c.type?.startsWith("base"))
    .reduce((sum, c) => sum + c.width, 0);
  const peninsula = cabinets.filter(c => c.wall === "P" && c.type?.startsWith("base"))
    .reduce((sum, c) => sum + c.width, 0);
  const islandLength = (layout === "island" || dimensions.hasIsland) ? (island || dimensions.islandWidth || 0) : island;
  const peninsulaLength = layout === "peninsula" ? (peninsula || dimensions.peninsulaWidth || 0) : peninsula;
  const overlap = a > 0 && b > 0 ? Math.min(60, a, b) : 0;
  const worktopLengthCm = money(a + b - overlap + islandLength + peninsulaLength);
  const worktopPrice = money(worktopLengthCm * WORKTOP_RON_PER_CM);
  const cabinetSubtotal = money(cabinets.reduce((sum, cabinet) => sum + (cabinet.price ?? 0), 0));
  const worktopDescription = `${(worktopLengthCm / 100).toFixed(2)} ml x 145 RON/ml`;
  return { cabinetSubtotal, worktopLengthCm, worktopPrice, worktopDescription, total: money(cabinetSubtotal + worktopPrice) };
}

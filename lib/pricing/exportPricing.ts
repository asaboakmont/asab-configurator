import type { Cabinet, LayoutType, WallDimensions } from "@/types/kitchen";

/** Shared document totals; cabinet prices are used without a promotional discount. */
export function calculateExportPricing(cabinets: Cabinet[], layout: LayoutType, dimensions: WallDimensions) {
  const worktopLengthCm =
    dimensions.wallA +
    (layout === "l-shape" ? (dimensions.wallB ?? 0) : 0) +
    ((layout === "island" || dimensions.hasIsland)
      ? (dimensions.islandWidth ?? 0)
      : 0);

  const FULL_WORKTOP_CM = 410;
  const HALF_WORKTOP_CM = 205;
  const FULL_WORKTOP_PRICE = 740;
  const HALF_WORKTOP_PRICE = 370;

  let fullWorktops = Math.floor(worktopLengthCm / FULL_WORKTOP_CM);
  const remaining = worktopLengthCm % FULL_WORKTOP_CM;

  let halfWorktops = 0;

  if (remaining > 0) {
    if (remaining <= HALF_WORKTOP_CM) {
      halfWorktops = 1;
    } else {
      fullWorktops++;
    }
  }

  const worktopPrice =
    fullWorktops * FULL_WORKTOP_PRICE +
    halfWorktops * HALF_WORKTOP_PRICE;

  const worktopDescription = [
    fullWorktops > 0 ? `${fullWorktops} × 410 cm` : "",
    halfWorktops > 0 ? `${halfWorktops} × 205 cm` : "",
  ]
    .filter(Boolean)
    .join(" + ");

  const cabinetSubtotal = cabinets.reduce((sum, cabinet) => sum + (cabinet.price ?? 0), 0);
  return { cabinetSubtotal, worktopLengthCm, worktopPrice, worktopDescription, total: Math.round((cabinetSubtotal + worktopPrice) * 100) / 100 };
}

import type { Cabinet } from "@/types/kitchen";
export type HingeSide = "left" | "right";
/** Opening symbols describe the configured handing, not manufacturing hinge-hole positions. */
export function doorHingeSides(cabinet: Cabinet): HingeSide[] {
  if (!["base", "base-sink", "wall", "wall-hood"].includes(cabinet.type)) return [];
  const model = (cabinet.displaySku ?? cabinet.catalogProduct?.sku ?? cabinet.baseSku ?? cabinet.sku).replace(/-(smt|jpn|grm|frc|soh)$/i, "");
  const name = (cabinet.catalogProduct?.name ?? cabinet.label ?? "").toLowerCase();
  if (/sertar|lift|piston|jolly/i.test(name)) return [];
  if (/-2U-(RAFT|W)/i.test(model) || ["1005", "1013", "2013"].includes(model)) return ["left", "right"];
  const knownSingle = /-1U-(RAFT|W)/i.test(model) || /^ASAB-CS-HOTA-W/i.test(model) || model === "2007" || ["1004", "1007", "1008", "1010", "1014", "2004", "2008", "2010", "2014"].includes(model);
  if (!knownSingle) return [];
  return [cabinet.doorDirection === "D" ? "right" : "left"];
}

import * as THREE from "three";
export type KitchenCorner = "left" | "right";
export function kitchenExportCorner(cabinets: Array<{ wall?: string; placementMode?: string }>, fallback?: KitchenCorner): KitchenCorner | undefined {
  const attached = cabinets.filter(c => c.placementMode !== "free");
  if (attached.some(c => c.wall === "C")) return "right";
  if (attached.some(c => c.wall === "B")) return "left";
  return fallback;
}
/** Both perspectives of an L stay diagonally opposite its inside junction. */
export function kitchenExportDirection(corner: KitchenCorner | undefined, view: "first" | "second" | "front" | "isometric") {
  const sign = corner === "right" ? -1 : 1;
  if (view === "isometric") return new THREE.Vector3(sign, 1, 1);
  if (!corner) return view === "front" ? new THREE.Vector3(0, .12, 1) : new THREE.Vector3(view === "first" ? 1 : -1, .55, 1.4);
  if (view === "front") return new THREE.Vector3(sign * .45, .3, 1.4);
  return view === "first" ? new THREE.Vector3(sign, .6, 1.4) : new THREE.Vector3(sign * 1.4, .6, 1);
}

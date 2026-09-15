import type { Cabinet } from "@/types/kitchen";

export const CUSTOM_SIZE_LABEL = "***dimensiune personalizata";
export function customCabinetLabel(label: string, custom: boolean): string {
  const base = label.replaceAll(CUSTOM_SIZE_LABEL, "").trim();
  return custom ? `${base} ${CUSTOM_SIZE_LABEL}` : base;
}

export function cabinetWidthScale(width: number, standardWidth: number): number {
  return Number.isFinite(width) && width > 0 && Number.isFinite(standardWidth) && standardWidth > 0 ? width / standardWidth : 1;
}

/** Preserve the native model origin when changing its local X extent. */
export function resizeCabinetAtOrigin(cabinet: Cabinet, width: number, standardWidth: number): Cabinet {
  const delta = width - cabinet.width;
  const resized = { ...cabinet, width, standardWidth, isCustom: width !== standardWidth };
  if (cabinet.placementMode === "free" && cabinet.freePosition) {
    const angle = (cabinet.rotationYDegrees ?? 0) * Math.PI / 180;
    resized.freePosition = { x: cabinet.freePosition.x + Math.cos(angle) * delta / 2, z: cabinet.freePosition.z - Math.sin(angle) * delta / 2 };
  } else if (cabinet.wall === "B" || (cabinet.wall === "P" && cabinet.runSide === "left")) {
    resized.xPos -= delta;
  }
  return resized;
}

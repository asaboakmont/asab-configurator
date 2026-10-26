import type { Cabinet } from '@/types/kitchen';

export const HANGING_TOP_CM = 220;
export const STANDARD_WALL_BOTTOM_CM = 150;
export function isStackedCabinet(cabinet: Pick<Cabinet, 'sku' | 'baseSku'>) {
  return /^ASAB-SP-/.test(cabinet.baseSku ?? cabinet.sku);
}
/** Nominal finished-floor elevations, shared by renderer, editor and collision checks. */
export function cabinetBottomCm(cabinet: Pick<Cabinet, 'sku' | 'baseSku' | 'type' | 'height' | 'mountHeightCm'>): number {
  if (isStackedCabinet(cabinet)) return HANGING_TOP_CM; // Also normalizes saved 216.9 cm SP entries.
  if (cabinet.mountHeightCm != null) return cabinet.mountHeightCm;
  return cabinet.type.startsWith('wall') ? HANGING_TOP_CM - cabinet.height : 0;
}
export function cabinetVerticalRange(cabinet: Pick<Cabinet, 'sku' | 'baseSku' | 'type' | 'height' | 'mountHeightCm'>): [number, number] {
  const bottom = cabinetBottomCm(cabinet); return [bottom, bottom + cabinet.height];
}
/** Keep the previous wall-corner assets until the new blind corners are retouched. */
export function legacyWallCornerSku(cabinet: Pick<Cabinet, 'type' | 'sku' | 'baseSku' | 'cornerSide'>): string | undefined {
  if (cabinet.type !== 'wall-corner') return undefined;
  const left = cabinet.cornerSide === 'STG' || /STG/.test(cabinet.baseSku ?? cabinet.sku);
  return left ? '2001-STG' : '2001-DR';
}

export function cabinetWallGapCm(cabinet: Pick<Cabinet, 'type'>): number {
  return cabinet.type === 'accessory' || cabinet.type.startsWith('tall') ? 0 : cabinet.type.startsWith('wall') ? 1.5 : 5;
}

/** All 335 native GLBs have a validated, losslessly merged counterpart.
 * Catalogue records retain original source URLs for provenance and comparison.
 * Imported private catalogue URLs use their separate loader and are unaffected.
 */
export function nativeAssetUrl(original: string, compareOriginal = false): string {
  return compareOriginal ? original : original.replace(/^\/models\/catalogue\//, '/models/catalogue-optimized/');
}

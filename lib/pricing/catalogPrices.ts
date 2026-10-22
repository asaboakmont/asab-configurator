import { REVISED_CATALOGUE } from "@/data/revisedCatalogue";
import type { Cabinet, DesignCollectionId } from "@/types/kitchen";

// Model identifiers stay stable: these keys still resolve the original GLB files.
export const MODEL_FAMILIES: Record<string, string> = {
  "1001-DR": "ASAB-CI-COLT-DR", "1001-STG": "ASAB-CI-COLT-STG",
  "1003": "ASAB-CI-3S", "1004": "ASAB-CI-1U-RAFT", "1008": "ASAB-CI-1U-RAFT",
  "1010": "ASAB-CI-1U-RAFT", "1014": "ASAB-CI-1U-RAFT", "1013": "ASAB-CI-2U-RAFT",
  "1005": "ASAB-CI-CHV-2U", "1007": "ASAB-CI-CHV-1U", "1006": "ASAB-CI-CPT-US",
  "1003-HOB-60": "ASAB-CI-PLT-2S-1SA", "1003-HOB-80": "ASAB-CI-PLT-2S-1SA",
  "2001-DR": "ASAB-CS-COLT-DR", "2001-STG": "ASAB-CS-COLT-STG",
  "2004": "ASAB-CS-1U-RAFT", "2008": "ASAB-CS-1U-RAFT", "2010": "ASAB-CS-1U-RAFT",
  "2014": "ASAB-CS-1U-RAFT", "2013": "ASAB-CS-2U-RAFT", "2007": "ASAB-CS-HOTA",
  "1011A": "ASAB-CA-2UV", "1011B": "ASAB-CA-CPT", "1011C": "ASAB-CA-CPT-MIC",
};
const suffixes: Record<DesignCollectionId, string> = { japandi: "JPN", germain: "GRM", franc: "FRC" };
export function revisedPrice(sku: string, widthCm: number, collection: DesignCollectionId) {
  const model = sku.replace(/-(jpn|grm|frc|soh)$/i, "");
  const family = MODEL_FAMILIES[model] ?? (model.startsWith("ASAB-") ? model.replace(/-W\d+$/, "") : undefined);
  if (!family) return undefined;
  const key = `${family}-W${String(Math.round(widthCm * 10)).padStart(4, "0")}`;
  // A fractional millimetre must not accidentally match a listed integer size.
  if (Math.abs(widthCm * 10 - Math.round(widthCm * 10)) > 0.000001) return undefined;
  const row = REVISED_CATALOGUE.find(r => r.sku === key);
  if (!row) return undefined;
  const price = row.prices[collection];
  if (price == null) return undefined;
  return { price, displaySku: `${key}-${suffixes[collection]}`, name: row.name,
    note: key === "ASAB-CS-2F-LIFT-W1000" && collection === "germain" ? "Pret Germain 415 RON din catalog: necesita confirmare." : undefined };
}
export function cabinetDocumentSku(cabinet: Cabinet) {
  return cabinet.displaySku ?? cabinet.sku;
}

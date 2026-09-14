import type {
  CustomCabinetPriceBreakdown,
  CustomCabinetPricing,
} from "@/types/kitchen";

export interface CustomCabinetPriceInput {
  standardPrice: number;
  standardWidth: number;
  customWidth: number;
  pricing: CustomCabinetPricing;
}

export function calculateCustomCabinetPrice({
  standardPrice,
  standardWidth,
  customWidth,
  pricing,
}: CustomCabinetPriceInput): CustomCabinetPriceBreakdown {
  const dimensionalAdjustment = roundRon(
    ((customWidth - standardWidth) / 100) * pricing.extraWidthPerMeter
  );
  const customSurcharge = roundRon(
    standardPrice * pricing.customSurchargePercent / 100
  );
  const minimumPrice = roundRon(
    standardPrice * pricing.minimumCustomPricePercent / 100
  );
  const finalPrice = Math.max(
    minimumPrice,
    roundRon(standardPrice + dimensionalAdjustment + customSurcharge)
  );

  return {
    standardPrice: roundRon(standardPrice),
    standardWidth,
    customWidth,
    dimensionalAdjustment,
    customSurcharge,
    minimumPrice,
    finalPrice,
  };
}

function roundRon(value: number): number {
  return Math.round(value);
}

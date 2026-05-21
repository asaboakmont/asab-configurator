"use client";

import { useConfigStore } from "@/store/configuratorStore";
import { BUDGET_OPTIONS, DESIGN_COLLECTIONS } from "@/data/designCollections";
import type { BudgetPreference } from "@/types/kitchen";

// Drop your Shopify CDN URLs here. Keys must match item.id from DESIGN_COLLECTIONS.
const COLLECTION_IMAGES: Record<string, string> = {
  japandi: "https://cdn.shopify.com/s/files/1/0897/6747/7627/files/11_374bf6a8-8163-489d-9fd3-28da3dae86b4_700x700_jpg.webp?v=1778948744",
  // FIXED: Removed the accidental concatenated second URL here
  germain: "https://cdn.shopify.com/s/files/1/0897/6747/7627/files/crafted-by-shan-matt-acrylic-grey-kitchen-project-05.jpg?v=1778933724",
  franc:   "https://cdn.shopify.com/s/files/1/0897/6747/7627/files/37-Entry-Pic-1.png?v=1778948748",
};

type BudgetRange = NonNullable<BudgetPreference["range"]>;

const BUDGET_AMOUNTS: Partial<Record<BudgetRange, number>> = {
  "under-4000": 4000,
  "4000-6000": 6000,
  "7000-10000": 10000,
};

export default function StepCollection() {
  const { collection, budget, setCollection, setBudget, setStep } = useConfigStore();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 1 din 11</p>
        <h1 className="text-2xl font-semibold text-gray-900">Alege directia de design</h1>
        <p className="text-sm text-gray-400 mt-1">
          Selecteaza colectia care descrie cel mai bine bucataria dorita.
        </p>
      </div>

      <div className="space-y-3">
        {DESIGN_COLLECTIONS.map((item) => {
          const isActive = collection === item.id;
          const imageSrc = COLLECTION_IMAGES[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCollection(item.id)}
              className={[
                "w-full overflow-hidden rounded-xl border text-left transition-all",
                isActive
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-400",
              ].join(" ")}
            >
              {imageSrc && (
                <div className="w-full h-36 bg-gray-100 overflow-hidden">
                  <img
                    src={imageSrc}
                    alt={item.name}
                    className={[
                      "w-full h-full object-cover",
                      // Aligns germain and franc images to show the bottom edge; uses center for everything else
                      item.id === "germain" || item.id === "franc" ? "object-bottom" : "object-center"
                    ].join(" ")}
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold">{item.name}</p>
                  <p
                    className={[
                      "text-xs mt-1 leading-relaxed",
                      isActive ? "text-gray-300" : "text-gray-400",
                    ].join(" ")}
                  >
                    {item.description}
                  </p>
                </div>
                <span
                  className={[
                    "text-[10px] uppercase tracking-wider rounded-full px-2 py-1 border whitespace-nowrap",
                    isActive ? "border-white/30" : "border-gray-200",
                  ].join(" ")}
                >
                  {item.priceTier}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-4 border border-gray-100 rounded-2xl p-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Buget orientativ</p>
          <p className="text-xs text-gray-400 mt-1">
            Ajuta specialistul ASAB sa calibreze solutia fara sa blocheze configurarea.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {BUDGET_OPTIONS.map((option) => {
            const isActive = budget.range === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  setBudget({
                    range: option.id,
                    amount: option.id === "not-sure" ? undefined : BUDGET_AMOUNTS[option.id],
                  })
                }
                className={[
                  "min-h-12 rounded-xl border px-3 py-2.5 text-xs font-semibold leading-snug transition-colors",
                  isActive
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-400",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Prioritate</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "price", label: "Pret" },
              { id: "balanced", label: "Echilibru" },
              { id: "premium", label: "Premium" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setBudget({ priority: option.id as BudgetPreference["priority"] })}
                className={[
                  "py-2 rounded-lg border text-xs font-semibold",
                  budget.priority === option.id
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 text-gray-600",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setStep("room")}
        className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold"
      >
        Continua →
      </button>
    </div>
  );
}

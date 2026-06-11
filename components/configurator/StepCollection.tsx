"use client";

import { useConfigStore } from "@/store/configuratorStore";
import { DESIGN_COLLECTIONS } from "@/data/designCollections";
import AssembledKitchenVideo from "./AssembledKitchenVideo";

// Drop your Shopify CDN URLs here. Keys must match item.id from DESIGN_COLLECTIONS.
const COLLECTION_IMAGES: Record<string, string> = {
  japandi: "https://cdn.shopify.com/s/files/1/0897/6747/7627/files/11_374bf6a8-8163-489d-9fd3-28da3dae86b4_700x700_jpg.webp?v=1778948744",
  // FIXED: Removed the accidental concatenated second URL here
  germain: "https://cdn.shopify.com/s/files/1/0897/6747/7627/files/crafted-by-shan-matt-acrylic-grey-kitchen-project-05.jpg?v=1778933724",
  franc:   "https://cdn.shopify.com/s/files/1/0897/6747/7627/files/37-Entry-Pic-1.png?v=1778948748",
};

export default function StepCollection() {
  const { collection, setCollection, setStep } = useConfigStore();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 1 din 11</p>
        <h1 className="text-2xl font-semibold text-gray-900">Alege directia de design</h1>
        <p className="text-sm text-gray-400 mt-1">
          Selecteaza colectia care descrie cel mai bine bucataria dorita.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <p className="text-base font-extrabold text-emerald-900">Bucatarie gata asamblata</p>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-emerald-900">
          Corpurile sunt livrate deja asamblate, asa ca trebuie doar puse pe pozitie acasa.
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

      <AssembledKitchenVideo />

      <button
        onClick={() => setStep("room")}
        className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold"
      >
        Continua →
      </button>
    </div>
  );
}

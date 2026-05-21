"use client";
import { useEffect } from "react";
import ConfiguratorFlow from "@/components/configurator/ConfiguratorFlow";
import { useConfigStore } from "@/store/configuratorStore";
import { COLORWAYS, HANDLE_OPTIONS, WORKTOP_OPTIONS } from "@/data/colorways";
import type { BacksplashTexture, BudgetPreference, BudgetRange, DesignCollectionId, FloorTexture, LayoutType, OvenPlacement, WallDimensions } from "@/types/kitchen";

export default function Home() {
  useEffect(() => {
    const store = useConfigStore.getState();
    const params = new URLSearchParams(window.location.search);
    const configId = params.get("config");
    if (!configId) {
      loadConfigFromParams(params, store);
      return;
    }

    fetch(`/api/config/load?id=${configId}`)
      .then(r => r.json())
      .then(({ config }) => {
        if (!config) return;
        const c = typeof config === "string" ? JSON.parse(config) : config;
        if (c.layout)     store.setLayout(c.layout);
        if (c.dimensions) store.setDimensions(c.dimensions);
        if (c.appliances) store.setAppliances(c.appliances);
        if (c.colorway)   store.setColorway(c.colorway);
        if (c.constraints) store.setConstraints(c.constraints);
        if (c.collection) store.setCollection(parseCollection(c.collection));
        if (c.budget) store.setBudget(normalizeBudget(c.budget));
        if (c.roomFinishes) store.setRoomFinishes(c.roomFinishes);
        store.generate();
      })
      .catch(console.error);
  }, []);

  return (
    <main className="min-h-screen bg-asab-cream">
      <ConfiguratorFlow />
    </main>
  );
}

function loadConfigFromParams(params: URLSearchParams, store: ReturnType<typeof useConfigStore.getState>) {
  if (!params.has("tip") && !params.has("p1")) return;

  const layout = parseLayout(params.get("tip"));
  const dimensions: Partial<WallDimensions> = {};
  const wallA = Number(params.get("p1"));
  const wallB = Number(params.get("p2"));
  if (Number.isFinite(wallA) && wallA > 0) dimensions.wallA = wallA;
  if (Number.isFinite(wallB) && wallB > 0) dimensions.wallB = wallB;

  if (layout === "island" || params.get("insula") === "da") {
    dimensions.hasIsland = true;
    dimensions.islandWidth = numberParam(params, "insula_latime", 180);
    dimensions.islandDepth = numberParam(params, "insula_adancime", 90);
    dimensions.islandDistance = numberParam(params, "insula_distanta", 100);
    dimensions.islandPosition = parsePosition(params.get("insula_pozitie"));
  }

  store.setLayout(layout === "peninsula" ? "linear" : layout);
  store.setDimensions(dimensions);

  const colorway = COLORWAYS.find((cw) => cw.id === params.get("culoare"));
  if (colorway) {
    const worktop = WORKTOP_OPTIONS.find((w) => w.id === (params.get("blat") === "gri-piatra" ? "gri-piatra" : "stejar"));
    const handle = HANDLE_OPTIONS.find((h) => h.id === (params.get("manere") === "negru-mat" ? "negru-mat" : "inox"));
    const plinth = HANDLE_OPTIONS.find((h) => h.id === (params.get("plinta") === "negru-mat" ? "negru-mat" : "inox"));
    store.setColorway({
      ...colorway,
      worktop: worktop?.id ?? "stejar",
      worktopHex: worktop?.hex ?? colorway.worktopHex,
      handle: handle?.id === "negru-mat" ? "negru-mat" : "inox",
      handleHex: handle?.hex ?? colorway.handleHex,
      plinth: plinth?.id === "negru-mat" ? "negru-mat" : "inox",
      plinthHex: plinth?.hex ?? handle?.hex ?? colorway.handleHex,
    });
  }

  store.setAppliances({
    hasOven: parseOven(params.get("cuptor")),
    hasIntegratedMicrowave: params.get("microunde") === "da",
    hasHob: params.get("plita") !== "fara",
    hobSize: params.get("plita") === "80" ? 80 : 60,
    hasDishwasher: params.get("masina") !== "nu" && params.get("masina") !== "fara",
    dishwasherSize: params.get("masina") === "45" ? 45 : 60,
  });

  store.setContact({
    name: params.get("nume") ?? "",
    email: params.get("email") ?? "",
    phone: params.get("telefon") ?? "",
    city: params.get("oras") ?? "",
  });

  const collection = parseCollection(params.get("colectie"));
  store.setCollection(collection);
  const budgetRange = parseBudgetRange(params.get("buget"));
  const priority = parseBudgetPriority(params.get("prioritate"));
  if (budgetRange || priority) {
    store.setBudget({
      ...(budgetRange ? { range: budgetRange } : {}),
      ...(priority ? { priority } : {}),
    });
  }

  const wallColor = params.get("pereti");
  const floorColor = params.get("pardoseala");
  const floorTexture = parseFloorTexture(params.get("pardoseala_textura"));
  const backsplashColor = params.get("backsplash");
  const backsplashTexture = parseBacksplashTexture(params.get("backsplash_textura"));
  if (wallColor || floorColor || floorTexture || backsplashColor || backsplashTexture) {
    store.setRoomFinishes({
      ...(wallColor ? { wallColor } : {}),
      ...(floorColor ? { floorColor } : {}),
      ...(floorTexture ? { floorTexture } : {}),
      ...(backsplashColor ? { backsplashColor } : {}),
      ...(backsplashTexture ? { backsplashTexture } : {}),
    });
  }

  store.generate();
}

function parseLayout(value: string | null): LayoutType {
  const map: Record<string, LayoutType> = {
    liniar: "linear",
    linear: "linear",
    colt: "l-shape",
    "l-shape": "l-shape",
    insula: "island",
    island: "island",
    "semi-insula": "linear",
    peninsula: "linear",
  };
  return value ? map[value] ?? "linear" : "linear";
}

function numberParam(params: URLSearchParams, key: string, fallback: number): number {
  const value = Number(params.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parsePosition(value: string | null): "left" | "center" | "right" {
  if (value === "stanga" || value === "left") return "left";
  if (value === "dreapta" || value === "right") return "right";
  return "center";
}

function parseOven(value: string | null): OvenPlacement {
  if (value === "coloana" || value === "tall-column") return "tall-column";
  if (value === "fara" || value === "none") return "none";
  return "under-hob";
}

function parseCollection(value: unknown): DesignCollectionId {
  if (value === "germain" || value === "franc") return value;
  return "japandi";
}

function normalizeBudget(value: Partial<BudgetPreference>): Partial<BudgetPreference> {
  return {
    ...(parseBudgetRange(value.range) ? { range: parseBudgetRange(value.range) } : {}),
    ...(parseBudgetPriority(value.priority) ? { priority: parseBudgetPriority(value.priority) } : {}),
  };
}

function parseBudgetRange(value: unknown): BudgetRange | undefined {
  if (value === "under-10000") return "under-4000";
  if (value === "10000-15000") return "4000-6000";
  if (value === "15000-25000" || value === "25000-plus") return "7000-10000";
  if (
    value === "under-4000" ||
    value === "4000-6000" ||
    value === "7000-10000" ||
    value === "not-sure"
  ) {
    return value;
  }
  return undefined;
}

function parseBudgetPriority(value: unknown): BudgetPreference["priority"] | undefined {
  if (value === "price" || value === "balanced" || value === "premium") return value;
  return undefined;
}

function parseFloorTexture(value: unknown): FloorTexture | undefined {
  if (value === "light-wood" || value === "warm-wood" || value === "gray-stone" || value === "terrazzo") return value;
  return undefined;
}

function parseBacksplashTexture(value: unknown): BacksplashTexture | undefined {
  if (value === "none" || value === "white-tile" || value === "stone-light" || value === "stone-dark" || value === "zellige") return value;
  return undefined;
}

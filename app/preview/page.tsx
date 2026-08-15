"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { COLORWAYS, HANDLE_OPTIONS, WORKTOP_OPTIONS } from "@/data/colorways";
import { useConfigStore } from "@/store/configuratorStore";
import type {
  BacksplashTexture,
  DesignCollectionId,
  FloorTexture,
  LayoutType,
  OvenPlacement,
  WallDimensions,
} from "@/types/kitchen";

const KitchenScene = dynamic(() => import("@/components/viewer/KitchenScene"), { ssr: false });

export default function PreviewPage() {
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const {
    cabinets,
    totalPrice,
    colorway,
    layout,
    dimensions,
    constraints,
    collection,
    roomFinishes,
  } = useConfigStore();

  useEffect(() => {
    const store = useConfigStore.getState();
    const params = new URLSearchParams(window.location.search);
    loadPreviewFromParams(params, store);
  }, []);

  const unlockPreview = () => {
    const customerName = name.trim() || "Client";
    const customerEmail = email.trim();
    const customerPhone = phone.trim();
    if (!customerEmail || !customerPhone) return;

    const store = useConfigStore.getState();
    store.setContact({ name: customerName, email: customerEmail, phone: customerPhone });
    store.generate();

    const { collection, budget, roomFinishes, layout, dimensions, appliances, colorway, cabinets, totalPrice, constraints } = useConfigStore.getState();
    fetch("/api/config/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: { collection, budget, roomFinishes, layout, dimensions, appliances, colorway, cabinets, totalPrice, constraints },
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      }),
    }).catch(() => {});

    setReady(true);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-gray-50">
      {ready && (
        <KitchenScene
          cabinets={cabinets}
          colorway={colorway}
          wallA={dimensions.wallA}
          wallB={layout === "l-shape" ? dimensions.wallB ?? 160 : undefined}
          cornerSide={dimensions.cornerSide ?? "right"}
          constraints={constraints}
          collection={collection}
          roomFinishes={roomFinishes}
          renderPreset="interactive"
        />
      )}

      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              unlockPreview();
            }}
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Vezi bucataria ta in 3D</h1>
              <p className="mt-1 text-xs text-gray-400">Lasa emailul si telefonul pentru a vedea previzualizarea si a-ti salva configuratia.</p>
            </div>
            <input
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="Numele tau (optional)"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none"
              type="email"
              placeholder="Email *"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none"
              type="tel"
              placeholder="Telefon *"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <button type="submit" className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white">
              Vezi in 3D →
            </button>
          </form>
        </div>
      )}

      {ready && <div className="absolute right-4 top-4 z-10 rounded-2xl border border-gray-100 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Total estimat
        </p>
        <p className="text-xl font-semibold text-gray-900">
          {totalPrice.toLocaleString("ro-RO")} RON
        </p>
      </div>}
    </main>
  );
}

function loadPreviewFromParams(
  params: URLSearchParams,
  store: ReturnType<typeof useConfigStore.getState>
) {
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
  store.setCollection(parseCollection(params.get("colectie")));

  const colorway = COLORWAYS.find((cw) => cw.id === params.get("culoare"));
  if (colorway) {
    const worktop = WORKTOP_OPTIONS.find((w) => w.id === params.get("blat")) ?? WORKTOP_OPTIONS[0];
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

function parseFloorTexture(value: unknown): FloorTexture | undefined {
  if (value === "light-wood" || value === "warm-wood" || value === "gray-stone" || value === "terrazzo") return value;
  return undefined;
}

function parseBacksplashTexture(value: unknown): BacksplashTexture | undefined {
  if (value === "none" || value === "white-tile" || value === "stone-light" || value === "stone-dark" || value === "zellige") return value;
  return undefined;
}

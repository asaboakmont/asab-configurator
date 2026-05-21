import { create } from "zustand";
import type {
  ConfigStep, ContactInfo, LayoutType,
  WallDimensions, Appliances, Colorway, Cabinet, RoomConstraints,
  Opening, Obstruction, Boiler, ServicePoint, DesignCollectionId,
  BudgetPreference, RoomFinishes
} from "@/types/kitchen";
import { COLORWAYS } from "@/data/colorways";
import { resolveLayout, calcTotalPrice, snapDimension } from "@/lib/rules/resolver";
import { applyCollectionToCabinets } from "@/data/skus";

interface ConfiguratorStore {
  step:       ConfigStep;
  setStep:    (s: ConfigStep) => void;
  collection: DesignCollectionId;
  budget: BudgetPreference;
  roomFinishes: RoomFinishes;
  layout:     LayoutType;
  dimensions: WallDimensions;
  appliances: Appliances;
  colorway:   Colorway;
  constraints: RoomConstraints;
  contact:    ContactInfo;
  shareUrl?:   string;
  devConstraintsUnlocked: boolean;
  cabinets:   Cabinet[];
  totalPrice:    number;
  originalPrice: number;
  layoutWarnings: string[];
  setCollection: (collection: DesignCollectionId) => void;
  setBudget: (budget: Partial<BudgetPreference>) => void;
  setRoomFinishes: (finishes: Partial<RoomFinishes>) => void;
  setLayout:     (l: LayoutType) => void;
  setDimensions: (d: Partial<WallDimensions>) => void;
  setAppliances: (a: Partial<Appliances>) => void;
  setColorway:   (c: Colorway) => void;
  setConstraints: (c: Partial<RoomConstraints>) => void;
  addOpening: (type: "window" | "door") => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  removeOpening: (id: string) => void;
  addObstruction: () => void;
  updateObstruction: (id: string, patch: Partial<Obstruction>) => void;
  removeObstruction: (id: string) => void;
  addServicePoint: () => void;
  updateServicePoint: (id: string, patch: Partial<ServicePoint>) => void;
  removeServicePoint: (id: string) => void;
  setBoiler: (boiler?: Boiler) => void;
  setContact:    (c: Partial<ContactInfo>) => void;
  setShareUrl:   (url?: string) => void;
  setDevConstraintsUnlocked: (unlocked: boolean) => void;
  generate:      () => void;
}

const defaultAppliances: Appliances = {
  hasHob: true, hobSize: 60,
  hasSink: true, sinkSize: 60,
  hasOven: "under-hob", hasIntegratedMicrowave: false, hasDishwasher: false, dishwasherSize: 60,
  hasHood: true,
  sinkWall: "A", hobWall: "A",
};

function nextId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useConfigStore = create<ConfiguratorStore>((set, get) => ({
  step:       "collection",
  setStep:    (step) => set({ step }),
  collection: "japandi",
  budget: { range: "not-sure", priority: "balanced" },
  roomFinishes: {
    wallColor: "#F4EFE7",
    floorColor: "#CDAF83",
    floorTexture: "light-wood",
    backsplashColor: "#F8F7F2",
    backsplashTexture: "white-tile",
  },
  layout:     "linear",
  dimensions: { wallA: 300, wallB: 160, height: 240, cornerSide: "right" },
  appliances: defaultAppliances,
  colorway:   COLORWAYS[0],
  constraints: {},
  contact:    { name: "", email: "", phone: "", city: "" },
  shareUrl:    undefined,
  devConstraintsUnlocked: false,
  cabinets:      [],
  totalPrice:    0,
  originalPrice: 0,
  layoutWarnings: [],
  setCollection: (collection) => set({ collection }),
  setBudget: (budget) => set((s) => ({ budget: { ...s.budget, ...budget } })),
  setRoomFinishes: (roomFinishes) => set((s) => ({ roomFinishes: { ...s.roomFinishes, ...roomFinishes } })),
  setLayout:     (layout)   => set({ layout }),
  setDimensions: (d)        => set((s) => ({ dimensions: { ...s.dimensions, ...d } })),
  setAppliances: (a)        => set((s) => ({ appliances: { ...s.appliances, ...a } })),
  setColorway:   (colorway) => set({ colorway }),
  setConstraints: (c)       => set((s) => ({ constraints: { ...s.constraints, ...c } })),
  addOpening: (type) => set((s) => ({
    constraints: {
      ...s.constraints,
      openings: [
        ...(s.constraints.openings ?? []),
        {
          id: nextId(type),
          type,
          wall: "A",
          xPos: 50,
          width: type === "door" ? 90 : 120,
          height: type === "door" ? 210 : 120,
          sillHeight: type === "window" ? 90 : undefined,
          openingDirection: type === "door" ? "inside" : undefined,
        },
      ],
    },
  })),
  updateOpening: (id, patch) => set((s) => ({
    constraints: {
      ...s.constraints,
      openings: (s.constraints.openings ?? []).map((opening) =>
        opening.id === id ? { ...opening, ...patch } : opening
      ),
    },
  })),
  removeOpening: (id) => set((s) => ({
    constraints: {
      ...s.constraints,
      openings: (s.constraints.openings ?? []).filter((opening) => opening.id !== id),
    },
  })),
  addObstruction: () => set((s) => ({
    constraints: {
      ...s.constraints,
      obstructions: [
        ...(s.constraints.obstructions ?? []),
        {
          id: nextId("obs"),
          type: "vertical-pipe-box",
          wall: "A",
          xPos: 50,
          width: 30,
          height: 240,
          depth: 20,
          startsFromFloor: true,
        },
      ],
    },
  })),
  updateObstruction: (id, patch) => set((s) => ({
    constraints: {
      ...s.constraints,
      obstructions: (s.constraints.obstructions ?? []).map((obstruction) =>
        obstruction.id === id ? { ...obstruction, ...patch } : obstruction
      ),
    },
  })),
  removeObstruction: (id) => set((s) => ({
    constraints: {
      ...s.constraints,
      obstructions: (s.constraints.obstructions ?? []).filter((obstruction) => obstruction.id !== id),
    },
  })),
  addServicePoint: () => set((s) => ({
    constraints: {
      ...s.constraints,
      servicePoints: [
        ...(s.constraints.servicePoints ?? []),
        {
          id: nextId("sp"),
          type: "electrical-outlet",
          wall: "A",
          xPos: 50,
          heightFromFloor: 50,
        },
      ],
    },
  })),
  updateServicePoint: (id, patch) => set((s) => ({
    constraints: {
      ...s.constraints,
      servicePoints: (s.constraints.servicePoints ?? []).map((point) =>
        point.id === id ? { ...point, ...patch } : point
      ),
    },
  })),
  removeServicePoint: (id) => set((s) => ({
    constraints: {
      ...s.constraints,
      servicePoints: (s.constraints.servicePoints ?? []).filter((point) => point.id !== id),
    },
  })),
  setBoiler: (boiler) => set((s) => ({ constraints: { ...s.constraints, boiler } })),
  setContact:    (c)        => set((s) => ({ contact: { ...s.contact, ...c } })),
  setShareUrl:   (shareUrl) => set({ shareUrl }),
  setDevConstraintsUnlocked: (devConstraintsUnlocked) => set({ devConstraintsUnlocked }),
  generate: () => {
    const { collection, layout, dimensions, appliances, constraints, devConstraintsUnlocked } = get();
    const resolvedLayout = layout === "peninsula" ? "linear" : layout;

    if (appliances.hasOven === "tall-column" && !appliances.hasHob) {
      alert("Daca cuptorul este in coloana separata, trebuie sa includeti si o plita.");
      return;
    }

    const normalizedDimensions: WallDimensions = {
      ...dimensions,
      wallA: snapDimension(dimensions.wallA),
      wallB: dimensions.wallB ? snapDimension(dimensions.wallB) : dimensions.wallB,
      ...(layout === "island" || dimensions.hasIsland === true ? { islandDistance: 130 } : {}),
    };
    const scoringAppliances: Appliances = {
      ...appliances,
      sinkWall: "A",
      hobWall: "A",
    };
    const activeConstraints = devConstraintsUnlocked ? constraints : undefined;
    const { cabinets, warnings } = resolveLayout(resolvedLayout, normalizedDimensions, scoringAppliances, activeConstraints);
    const collectionCabinets = applyCollectionToCabinets(cabinets, collection);
    const { original, discounted } = calcTotalPrice(collectionCabinets, normalizedDimensions.wallA, normalizedDimensions.wallB, resolvedLayout);
    const hasIsland = resolvedLayout === "island" || normalizedDimensions.hasIsland === true;
    const layoutWarnings = hasIsland
      ? [
          "Configuratiile cu insula necesita verificare tehnica pentru pozitionare exacta, distante de circulatie si instalatii.",
          ...warnings,
        ]
      : warnings;

    set({
      dimensions: normalizedDimensions,
      appliances: scoringAppliances,
      cabinets: collectionCabinets,
      totalPrice: discounted,
      originalPrice: original,
      step: "viewer",
      layoutWarnings,
    });
  },
}));

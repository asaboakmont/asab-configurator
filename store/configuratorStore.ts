import { create } from "zustand";
import type {
  ConfigStep, ContactInfo, LayoutType,
  WallDimensions, Appliances, Colorway, Cabinet
} from "@/types/kitchen";
import { COLORWAYS } from "@/data/colorways";
import { resolveLayout, calcTotalPrice, snapDimension } from "@/lib/rules/resolver";

interface ConfiguratorStore {
  step:       ConfigStep;
  setStep:    (s: ConfigStep) => void;
  layout:     LayoutType;
  dimensions: WallDimensions;
  appliances: Appliances;
  colorway:   Colorway;
  contact:    ContactInfo;
  cabinets:   Cabinet[];
  totalPrice:    number;
  originalPrice: number;
  layoutWarnings: string[];
  setLayout:     (l: LayoutType) => void;
  setDimensions: (d: Partial<WallDimensions>) => void;
  setAppliances: (a: Partial<Appliances>) => void;
  setColorway:   (c: Colorway) => void;
  setContact:    (c: Partial<ContactInfo>) => void;
  generate:      () => void;
}

const defaultAppliances: Appliances = {
  hasHob: true, hobSize: 60,
  hasSink: true, sinkSize: 60,
  hasOven: "under-hob", hasDishwasher: false, dishwasherSize: 60,
  hasHood: true,
  sinkWall: "A", hobWall: "A",
};

export const useConfigStore = create<ConfiguratorStore>((set, get) => ({
  step:       "dimensions",
  setStep:    (step) => set({ step }),
  layout:     "linear",
  dimensions: { wallA: 300, wallB: 160, height: 240 },
  appliances: defaultAppliances,
  colorway:   COLORWAYS[0],
  contact:    { name: "", email: "", phone: "", city: "" },
  cabinets:      [],
  totalPrice:    0,
  originalPrice: 0,
  layoutWarnings: [],
  setLayout:     (layout)   => set({ layout }),
  setDimensions: (d)        => set((s) => ({ dimensions: { ...s.dimensions, ...d } })),
  setAppliances: (a)        => set((s) => ({ appliances: { ...s.appliances, ...a } })),
  setColorway:   (colorway) => set({ colorway }),
  setContact:    (c)        => set((s) => ({ contact: { ...s.contact, ...c } })),
  generate: () => {
    const { layout, dimensions, appliances } = get();

    if (appliances.hasOven === "tall-column" && !appliances.hasHob) {
      alert("Daca cuptorul este in coloana separata, trebuie sa includeti si o plita.");
      return;
    }

    const { cabinets, warnings } = resolveLayout(layout, dimensions, appliances);
    const { original, discounted } = calcTotalPrice(cabinets, dimensions.wallA, dimensions.wallB, layout);
    set({ cabinets, totalPrice: discounted, originalPrice: original, step: "viewer", layoutWarnings: warnings });
  },
}));
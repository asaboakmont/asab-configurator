import type { BacksplashTexture, BudgetRange, DesignCollection, FloorTexture } from "@/types/kitchen";

export const DESIGN_COLLECTIONS: DesignCollection[] = [
  {
    id: "japandi",
    name: "Japandi",
    description: "Minimalist, cald, entry level, cu linii simple si finisaje naturale.",
    priceTier: "entry",
    handleMode: "handles",
    doorStyle: "minimal",
  },
  {
    id: "germain",
    name: "Germain",
    description: "Industrial, urban, cu fronturi fara manere si contrast mai puternic.",
    priceTier: "mid",
    handleMode: "handleless",
    doorStyle: "industrial",
  },
  {
    id: "franc",
    name: "Franc",
    description: "Inspiratie franceza, usi MDF profilate, cornisa si terminatii decorative.",
    priceTier: "premium",
    handleMode: "handles",
    doorStyle: "mdf-profile",
  },
];

export const BUDGET_OPTIONS: { id: BudgetRange; label: string; description: string }[] = [
  { id: "under-4000", label: "Sub 4000 RON", description: "Prioritate pe solutii compacte si eficiente." },
  { id: "4000-6000", label: "4000 - 6000 RON", description: "Echilibru bun pentru configuratii standard." },
  { id: "7000-10000", label: "7000 - 10000 RON", description: "Mai mult spatiu pentru finisaje si accesorii." },
  { id: "not-sure", label: "Nu stiu inca", description: "ASAB poate calibra oferta dupa verificarea tehnica." },
];

export const WALL_COLOR_OPTIONS = [
  { label: "Alb cald", value: "#F4EFE7" },
  { label: "Gri deschis", value: "#D8D5CE" },
  { label: "Greige", value: "#C9BDAE" },
  { label: "Verde salvie", value: "#A7B09A" },
  { label: "Albastru fumuriu", value: "#8A9BA8" },
] as const;

export const FLOOR_TEXTURE_OPTIONS: { id: FloorTexture; label: string; color: string }[] = [
  { id: "light-wood", label: "Lemn deschis", color: "#CDAF83" },
  { id: "warm-wood", label: "Lemn cald", color: "#9A6B43" },
  { id: "gray-stone", label: "Piatra gri", color: "#8C8880" },
  { id: "terrazzo", label: "Terrazzo", color: "#BDB7AA" },
];

export const BACKSPLASH_OPTIONS: { id: BacksplashTexture; label: string; color: string }[] = [
  { id: "none", label: "Fara faianta", color: "#F4EFE7" },
  { id: "white-tile", label: "Placi albe", color: "#F8F7F2" },
  { id: "stone-light", label: "Piatra deschisa", color: "#D5D0C7" },
  { id: "stone-dark", label: "Piatra inchisa", color: "#55514C" },
  { id: "zellige", label: "Zellige", color: "#DDE5DA" },
];

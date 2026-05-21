export type LayoutType = "linear" | "l-shape" | "island" | "peninsula";
export type WallSide   = "A" | "B" | "C" | "I" | "P";  // A=back, B=left, C=right, I=island, P=peninsula
export type DoorDirection = "S" | "D";

export type DesignCollectionId = "japandi" | "germain" | "franc";

export interface DesignCollection {
  id: DesignCollectionId;
  name: string;
  description: string;
  priceTier: "entry" | "mid" | "premium";
  handleMode: "handles" | "handleless";
  doorStyle: "minimal" | "industrial" | "mdf-profile";
}

export type BudgetRange =
  | "under-4000"
  | "4000-6000"
  | "7000-10000"
  | "not-sure";

export interface BudgetPreference {
  range?: BudgetRange;
  priority: "price" | "balanced" | "premium";
  amount?: number;
}

export type FloorTexture = "light-wood" | "warm-wood" | "gray-stone" | "terrazzo";
export type BacksplashTexture = "none" | "white-tile" | "stone-light" | "stone-dark" | "zellige";

export interface RoomFinishes {
  wallColor: string;
  floorColor: string;
  floorTexture: FloorTexture;
  backsplashColor: string;
  backsplashTexture: BacksplashTexture;
}

export interface WallDimensions {
  wallA:       number;
  wallB?:      number;
  height:      number;
  cornerSide?: "left" | "right";
  hasIsland?: boolean;
  islandWidth?: number;
  islandDepth?: number;
  islandDistance?: number;
  islandPosition?: "left" | "center" | "right";
  peninsulaWidth?: number;
  peninsulaDepth?: number;
  peninsulaSide?: "left" | "right";
  peninsulaClearance?: number;
}

export type HobSize    = 60 | 80;
export type SinkSize   = 60 | 80 | 90;
export type OvenPlacement = "under-hob" | "tall-column" | "none";

export interface Appliances {
  hasHob:        boolean;
  hobSize:       HobSize;
  hasSink:       boolean;
  sinkSize:      SinkSize;
  hasOven:       OvenPlacement;
  hasIntegratedMicrowave: boolean;
  hasDishwasher:  boolean;
  dishwasherSize: 60 | 45;
  sinkWall:       "A" | "B" | "I" | "P";
  hobWall:        "A" | "B" | "I" | "P";

  hasHood:       boolean;
}

export type CabinetType =
  | "base" | "base-corner" | "base-sink" | "base-hob"
  | "base-oven" | "base-drawer" | "base-dishwasher"
  | "wall" | "wall-corner" | "wall-hood"
  | "tall" | "tall-oven" | "tall-fridge";

export interface Cabinet {
  sku:    string;
  baseSku?: string;
  type:   CabinetType;
  width:  number;
  height: number;
  depth:  number;
  wall:   WallSide;
  xPos:   number;
  price:  number;
  doorDirection?: "S" | "D";
  label?:      string;
  cornerSide?: "STG" | "DR";
  zPos?: number;
  runSide?: "left" | "right";
  conflicts?: CabinetConflict[];
}

export type CabinetConflictType = "window" | "door" | "obstruction" | "boiler";

export interface CabinetConflict {
  type: CabinetConflictType;
  constraintId: string;
  message: string;
}

export interface Colorway {
  id:         string;
  name:       string;
  finish:     "mat" | "lucios" | "furnir";
  doorHex:    string;
  carcassHex: string;
  worktopHex: string;
  handleHex:  string;
  plinthHex?: string;
  worktop:    "stejar" | "gri-piatra";
  handle:     "inox" | "negru-mat";
  plinth?:    "inox" | "negru-mat";
}

export type HandleStyle = "inox" | "negru-mat";

export type RoomWall = Extract<WallSide, "A" | "B" | "C">;

export type OpeningType = "window" | "door";

export interface Opening {
  id: string;
  type: OpeningType;
  wall: RoomWall;
  xPos: number;
  width: number;
  height: number;
  sillHeight?: number;
  openingDirection?: "left" | "right" | "inside" | "outside";
  notes?: string;
}

export type ObstructionType =
  | "vertical-pipe-box"
  | "exposed-pipe"
  | "radiator"
  | "beam"
  | "column"
  | "other";

export interface Obstruction {
  id: string;
  type: ObstructionType;
  wall: RoomWall;
  xPos: number;
  width: number;
  height: number;
  depth: number;
  startsFromFloor?: boolean;
  yPos?: number;
  label?: string;
  notes?: string;
}

export type ServicePointType =
  | "water-pipe"
  | "drain"
  | "gas"
  | "electrical-outlet"
  | "hood-vent"
  | "dishwasher-water-drain"
  | "oven-electrical"
  | "fridge-electrical";

export interface ServicePoint {
  id: string;
  type: ServicePointType;
  wall: RoomWall;
  xPos: number;
  heightFromFloor: number;
  notes?: string;
}

export interface Boiler {
  id: string;
  wall: RoomWall;
  xPos: number;
  yPos?: number;
  width: number;
  height: number;
  depth: number;
  pipeClearance: number;
  notes?: string;
}

export interface RoomConstraints {
  openings?: Opening[];
  obstructions?: Obstruction[];
  servicePoints?: ServicePoint[];
  boiler?: Boiler;
}

export interface KitchenConfig {
  collection?: DesignCollectionId;
  budget?: BudgetPreference;
  roomFinishes?: RoomFinishes;
  layout:     LayoutType;
  dimensions: WallDimensions;
  appliances: Appliances;
  colorway:   Colorway;
  handle:     HandleStyle;
  cabinets:   Cabinet[];
  constraints?: RoomConstraints;
  totalPrice: number;
}

export interface ContactInfo {
  name:   string;
  email:  string;
  phone:  string;
  city:   string;
  notes?: string;
}

export type ConfigStep = "collection" | "room" | "dimensions" | "constraints" | "sink" | "hob" | "dishwasher" | "hood" | "style" | "viewer" | "cart";

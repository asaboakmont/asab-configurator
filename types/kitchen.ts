export type LayoutType = "linear" | "l-shape";
export type WallSide   = "A" | "B" | "C";  // A=back, B=left, C=right
export type DoorDirection = "S" | "D";

export interface WallDimensions {
  wallA:       number;
  wallB?:      number;
  height:      number;
  cornerSide?: "left" | "right";
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
  hasDishwasher:  boolean;
  dishwasherSize: 60 | 45;
  sinkWall:       "A" | "B";
  hobWall:        "A" | "B";

  hasHood:       boolean;
}

export type CabinetType =
  | "base" | "base-corner" | "base-sink" | "base-hob"
  | "base-oven" | "base-drawer" | "base-dishwasher"
  | "wall" | "wall-corner" | "wall-hood"
  | "tall" | "tall-oven" | "tall-fridge";

export interface Cabinet {
  sku:    string;
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
}

export interface Colorway {
  id:         string;
  name:       string;
  finish:     "mat" | "lucios" | "furnir";
  doorHex:    string;
  carcassHex: string;
  worktopHex: string;
  handleHex:  string;
  worktop:    "stejar" | "gri-piatra";
  handle:     "inox" | "negru-mat";
}

export type HandleStyle = "inox" | "negru-mat";

export interface KitchenConfig {
  layout:     LayoutType;
  dimensions: WallDimensions;
  appliances: Appliances;
  colorway:   Colorway;
  handle:     HandleStyle;
  cabinets:   Cabinet[];
  totalPrice: number;
}

export interface ContactInfo {
  name:   string;
  email:  string;
  phone:  string;
  city:   string;
  notes?: string;
}

export type ConfigStep = "dimensions" | "sink" | "hob" | "dishwasher" | "hood" | "style" | "viewer" | "cart";

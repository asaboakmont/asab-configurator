import type { Colorway } from "@/types/kitchen";

const CARCASS  = "#F5F4F0";
const STEJAR   = "#A67C52";
const PIATRA   = "#8C8880";
const INOX     = "#C0C0C0";
const NEGRU    = "#1C1C1A";

export const COLORWAYS: Colorway[] = [
  // ── Mat finishes ─────────────────────────────────────────────────────────
  { id: "alb-mat",          name: "Alb Mat",          finish: "mat",    doorHex: "#F2F0EC", carcassHex: CARCASS, worktopHex: STEJAR, handleHex: INOX,  worktop: "stejar",    handle: "inox"      },
  { id: "gri-deschis-mat",  name: "Gri Deschis Mat",  finish: "mat",    doorHex: "#C8C5BE", carcassHex: CARCASS, worktopHex: PIATRA, handleHex: INOX,  worktop: "gri-piatra", handle: "inox"     },
  { id: "gri-inchis-mat",   name: "Gri Inchis Mat",   finish: "mat",    doorHex: "#4A4845", carcassHex: CARCASS, worktopHex: PIATRA, handleHex: INOX,  worktop: "gri-piatra", handle: "inox"     },
  { id: "olive-mat",        name: "Verde Olive Mat",   finish: "mat",    doorHex: "#6B7B5E", carcassHex: CARCASS, worktopHex: STEJAR, handleHex: NEGRU, worktop: "stejar",    handle: "negru-mat" },
  { id: "negru-mat",        name: "Negru Mat",         finish: "mat",    doorHex: "#1C1C1A", carcassHex: CARCASS, worktopHex: PIATRA, handleHex: INOX,  worktop: "gri-piatra", handle: "inox"     },
  { id: "albastru-mat",     name: "Albastru Mat",      finish: "mat",    doorHex: "#2C3E52", carcassHex: CARCASS, worktopHex: PIATRA, handleHex: INOX,  worktop: "gri-piatra", handle: "inox"     },
  { id: "stejar",           name: "Stejar",            finish: "furnir", doorHex: "#B8935A", carcassHex: CARCASS, worktopHex: STEJAR, handleHex: INOX,  worktop: "stejar",    handle: "inox"      },
  // ── Gloss finishes ────────────────────────────────────────────────────────
  { id: "crem-lucios",      name: "Crem Lucios",       finish: "lucios", doorHex: "#EDE0C8", carcassHex: CARCASS, worktopHex: STEJAR, handleHex: INOX,  worktop: "stejar",    handle: "inox"      },
  { id: "alb-lucios",       name: "Alb Lucios",        finish: "lucios", doorHex: "#F8F7F5", carcassHex: CARCASS, worktopHex: STEJAR, handleHex: INOX,  worktop: "stejar",    handle: "inox"      },
  { id: "gri-deschis-lucios", name: "Gri Deschis Lucios", finish: "lucios", doorHex: "#C8C5BE", carcassHex: CARCASS, worktopHex: PIATRA, handleHex: INOX, worktop: "gri-piatra", handle: "inox"  },
  { id: "gri-inchis-lucios", name: "Gri Inchis Lucios",  finish: "lucios", doorHex: "#4A4845", carcassHex: CARCASS, worktopHex: PIATRA, handleHex: INOX, worktop: "gri-piatra", handle: "inox"  },
  { id: "olive-lucios",     name: "Verde Olive Lucios", finish: "lucios", doorHex: "#6B7B5E", carcassHex: CARCASS, worktopHex: STEJAR, handleHex: NEGRU, worktop: "stejar",   handle: "negru-mat" },
  { id: "negru-lucios",     name: "Negru Lucios",       finish: "lucios", doorHex: "#1C1C1A", carcassHex: CARCASS, worktopHex: PIATRA, handleHex: INOX,  worktop: "gri-piatra", handle: "inox"   },
];

export const HANDLE_OPTIONS = [
  { id: "inox",      label: "Inox",      hex: INOX  },
  { id: "negru-mat", label: "Negru Mat", hex: NEGRU },
] as const;

export const WORKTOP_OPTIONS = [
  { id: "stejar",    label: "Stejar",    hex: STEJAR },
  { id: "gri-piatra", label: "Gri Piatra", hex: PIATRA },
] as const;

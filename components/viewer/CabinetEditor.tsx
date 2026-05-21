"use client";
import { useState } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import { BASE_CABINETS, WALL_CABINETS, TALL_CABINETS, applyCollectionToCabinet, applyCollectionToCabinets } from "@/data/skus";
import type { Cabinet, RoomConstraints, WallSide } from "@/types/kitchen";
import { calcTotalPrice } from "@/lib/rules/resolver";

interface CabinetEditorProps {
  activeWall?: WallSide;
  selectedCabinetKey?: string | null;
  onSelectCabinet?: (key: string | null) => void;
}

export default function CabinetEditor({ activeWall, selectedCabinetKey, onSelectCabinet }: CabinetEditorProps) {
  const { cabinets, dimensions, collection, layout, constraints } = useConfigStore();
  const editorWall = activeWall ?? "A";
  const wallCabs = cabinets.filter(c => c.wall === editorWall);

  function commit(newCabs: Cabinet[], nextSelectedCabinet?: Cabinet | null) {
    const collectionResult = applyCollectionToCabinets(newCabs, collection);
    const { discounted, original } = calcTotalPrice(collectionResult, dimensions.wallA, dimensions.wallB, layout);
    useConfigStore.setState({ cabinets: collectionResult, totalPrice: discounted, originalPrice: original });
    if (nextSelectedCabinet === null) {
      onSelectCabinet?.(null);
    } else if (nextSelectedCabinet) {
      const updatedCabinet = collectionResult.find((cabinet) => cabinetKey(cabinet) === cabinetKey(nextSelectedCabinet));
      onSelectCabinet?.(cabinetKey(updatedCabinet ?? nextSelectedCabinet));
    }
  }

  function add(wall: WallSide, layer: "base" | "wall", sku: typeof BASE_CABINETS[0]) {
    const draft: Cabinet = applyCollectionToCabinet({
      sku: sku.sku, type: sku.type, width: sku.width,
      height: sku.height, depth: sku.depth,
      wall,
      xPos: 0,
      zPos: wall === "I" ? (dimensions.islandDistance ?? 100) + (dimensions.islandDepth ?? 90) / 2 : undefined,
      runSide: wall === "P" ? dimensions.peninsulaSide ?? "right" : undefined,
      price: sku.price,
      label: sku.label,
    }, collection);
    const xPos = findNearestValidSlot(draft, cabinets, 1, dimensions, layout, constraints, wallStart(wall, dimensions, layout), true);
    if (xPos === undefined) {
      useConfigStore.setState({ layoutWarnings: ["Nu exista spatiu liber pe acest perete pentru dulapul ales.", ...useConfigStore.getState().layoutWarnings] });
      return;
    }
    commit([...cabinets, { ...draft, xPos }], { ...draft, xPos });
  }

  function toggleDoorDirection(cab: Cabinet) {
    const newCabs = cabinets.map((item) =>
      item === cab ? { ...item, doorDirection: (item.doorDirection === "S" ? "D" : "S") as "S" | "D" } : item
    );
    const selected = newCabs.find((item) => item.sku === cab.sku && item.wall === cab.wall && item.xPos === cab.xPos && item.type === cab.type);
    commit(newCabs, selected);
  }

  function selectCabinet(cab: Cabinet) {
    onSelectCabinet?.(cabinetKey(cab));
  }

  return (
    <div className="space-y-4">
      <WallSection title={`Modifica ${wallLabel(editorWall)}`} cabinets={wallCabs}
        selectedCabinetKey={selectedCabinetKey}
        onSelectCabinet={selectCabinet}
        onAdd={(l, s) => add(editorWall, l, s)}
        onToggleDirection={toggleDoorDirection} />
    </div>
  );
}

function cabinetKey(cabinet: Cabinet): string {
  return `${cabinet.sku}-${cabinet.wall}-${cabinet.type}-${cabinet.xPos}`;
}

const WALL_CAB_TYPES: Cabinet["type"][] = ["wall", "wall-corner", "wall-hood"];
const TALL_TYPES: Cabinet["type"][] = ["tall", "tall-oven", "tall-fridge"];

function cabinetLayer(cab: Cabinet): "wall" | "ground" {
  return WALL_CAB_TYPES.includes(cab.type) ? "wall" : "ground";
}

function wallStart(wall: WallSide, dimensions: { cornerSide?: "left" | "right" }, layout: string): number {
  if (wall === "A" && layout === "l-shape" && (dimensions.cornerSide ?? "right") === "right") return 60;
  if ((wall === "B" || wall === "C") && layout === "l-shape") return 100;
  if (wall === "P") return 100;
  return 0;
}

function wallEnd(wall: WallSide, dimensions: { wallA: number; wallB?: number; peninsulaWidth?: number }, layout: string): number {
  if (wall === "A") return dimensions.wallA;
  if ((wall === "B" || wall === "C") && layout === "l-shape") return dimensions.wallB ?? 0;
  if (wall === "I") return dimensions.wallA;
  if (wall === "P") return 100 + (dimensions.peninsulaWidth ?? 0);
  return dimensions.wallA;
}

function cabinetYRange(cab: Cabinet): [number, number] {
  if (WALL_CAB_TYPES.includes(cab.type)) return [146.9, 146.9 + cab.height];
  return [0, cab.height];
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function verticalOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

function openingYRange(opening: NonNullable<RoomConstraints["openings"]>[number]): [number, number] {
  const sill = opening.type === "window" ? opening.sillHeight ?? 90 : 0;
  return [sill, sill + opening.height];
}

function obstructionYRange(obstruction: NonNullable<RoomConstraints["obstructions"]>[number]): [number, number] {
  const bottom = obstruction.startsFromFloor === false ? obstruction.yPos ?? 0 : 0;
  return [bottom, bottom + obstruction.height];
}

function isValidSlot(cab: Cabinet, xPos: number, allCabs: Cabinet[], dimensions: any, layout: string, constraints: RoomConstraints): boolean {
  const min = wallStart(cab.wall, dimensions, layout);
  const max = wallEnd(cab.wall, dimensions, layout);
  if (xPos < min || xPos + cab.width > max) return false;

  const yRange = cabinetYRange(cab);
  const layer = cabinetLayer(cab);
  const start = xPos;
  const end = xPos + cab.width;

  for (const other of allCabs) {
    if (other === cab || other.wall !== cab.wall) continue;
    if (cabinetLayer(other) !== layer) continue;
    if (rangesOverlap(start, end, other.xPos, other.xPos + other.width)) return false;
  }

  if (cab.wall === "A" || cab.wall === "B" || cab.wall === "C") {
    for (const opening of constraints.openings ?? []) {
      if (opening.wall !== cab.wall) continue;
      if (!verticalOverlap(yRange, openingYRange(opening))) continue;
      if (rangesOverlap(start, end, opening.xPos, opening.xPos + opening.width)) return false;
    }

    for (const obstruction of constraints.obstructions ?? []) {
      if (obstruction.wall !== cab.wall) continue;
      if (!verticalOverlap(yRange, obstructionYRange(obstruction))) continue;
      if (rangesOverlap(start, end, obstruction.xPos, obstruction.xPos + obstruction.width)) return false;
    }

    const boiler = constraints.boiler;
    if (boiler?.wall === cab.wall) {
      const boilerY: [number, number] = [146.9, 146.9 + boiler.height];
      if (verticalOverlap(yRange, boilerY)) {
        if (rangesOverlap(start, end, boiler.xPos - boiler.pipeClearance, boiler.xPos + boiler.width + boiler.pipeClearance)) return false;
      }
    }
  }

  if (layer === "wall") {
    for (const other of allCabs) {
      if (other === cab || other.wall !== cab.wall || !TALL_TYPES.includes(other.type)) continue;
      if (rangesOverlap(start, end, other.xPos, other.xPos + other.width)) return false;
    }
  }

  if (TALL_TYPES.includes(cab.type)) {
    for (const other of allCabs) {
      if (other === cab || other.wall !== cab.wall || !WALL_CAB_TYPES.includes(other.type)) continue;
      if (rangesOverlap(start, end, other.xPos, other.xPos + other.width)) return false;
    }
  }

  return true;
}

function findNearestValidSlot(
  cab: Cabinet,
  allCabs: Cabinet[],
  dir: -1 | 1,
  dimensions: any,
  layout: string,
  constraints: RoomConstraints,
  from = cab.xPos,
  includeCurrent = false
): number | undefined {
  const min = wallStart(cab.wall, dimensions, layout);
  const max = wallEnd(cab.wall, dimensions, layout) - cab.width;
  const step = 5 * dir;
  let x = includeCurrent ? from : from + step;

  while (dir > 0 ? x <= max : x >= min) {
    const snapped = Math.round(x / 5) * 5;
    if (isValidSlot(cab, snapped, allCabs, dimensions, layout, constraints)) return snapped;
    x += step;
  }

  return undefined;
}

function wallLabel(wall: WallSide): string {
  if (wall === "I") return "insula";
  if (wall === "P") return "semi-insula";
  return `perete ${wall}`;
}

function WallSection({ title, cabinets, selectedCabinetKey, onSelectCabinet, onAdd, onToggleDirection }: {
  title:    string;
  cabinets: Cabinet[];
  selectedCabinetKey?: string | null;
  onSelectCabinet: (c: Cabinet) => void;
  onAdd:    (layer: "base" | "wall", sku: typeof BASE_CABINETS[0]) => void;
  onToggleDirection: (c: Cabinet) => void;
}) {
  const [addingBase, setAddingBase] = useState(false);
  const [addingWall, setAddingWall] = useState(false);

  const baseCabs = cabinets.filter(c => !["wall","wall-corner","wall-hood"].includes(c.type));
  const wallCabs = cabinets.filter(c =>  ["wall","wall-corner","wall-hood"].includes(c.type));

  return (
    <div className="card space-y-4">
      <p className="text-sm font-medium text-asab-black">{title}</p>

      <div>
        <p className="field-label mb-2">Dulapuri baza</p>
        {baseCabs.map((cab, i) => (
          <CabRow key={`${cab.sku}-${cab.wall}-${cab.xPos}-${i}`} cab={cab}
            selected={selectedCabinetKey === cabinetKey(cab)}
            onSelect={() => onSelectCabinet(cab)}
            onToggleDirection={() => onToggleDirection(cab)} />
        ))}
        {addingBase ? (
          <Picker
            skus={[...BASE_CABINETS.filter(s => ["base","base-sink","base-oven","base-drawer","base-dishwasher","base-hob"].includes(s.type)), ...TALL_CABINETS]}
            onPick={(s) => { onAdd("base", s); setAddingBase(false); }}
            onClose={() => setAddingBase(false)} />
        ) : (
          <AddBtn onClick={() => setAddingBase(true)} label="+ Adauga dulap baza" />
        )}
      </div>

      <div>
        <p className="field-label mb-2">Dulapuri suspendate</p>
        {wallCabs.map((cab, i) => (
          <CabRow key={`${cab.sku}-${cab.wall}-${cab.xPos}-${i}`} cab={cab}
            selected={selectedCabinetKey === cabinetKey(cab)}
            onSelect={() => onSelectCabinet(cab)}
            onToggleDirection={() => onToggleDirection(cab)} />
        ))}
        {addingWall ? (
          <Picker
            skus={WALL_CABINETS.filter(s => ["wall","wall-hood"].includes(s.type))}
            onPick={(s) => { onAdd("wall", s); setAddingWall(false); }}
            onClose={() => setAddingWall(false)} />
        ) : (
          <AddBtn onClick={() => setAddingWall(true)} label="+ Adauga dulap suspendat" />
        )}
      </div>
    </div>
  );
}

function CabRow({ cab, selected, onSelect, onToggleDirection }: {
  cab: Cabinet;
  selected: boolean;
  onSelect: () => void;
  onToggleDirection: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={[
        "flex items-center gap-2 py-1.5 px-2 rounded-lg border transition-colors cursor-pointer",
        selected ? "bg-asab-light border-asab-accent/40" : "border-transparent hover:bg-asab-light",
      ].join(" ")}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-asab-black truncate">{cab.label ?? cab.sku}</p>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-asab-stone">{cab.width}cm · {(cab.price ?? 0).toLocaleString("ro-RO")} RON</p>
          {!["base-corner","wall-corner"].includes(cab.type) && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggleDirection();
              }}
              className="text-[10px] px-1.5 py-0.5 rounded border border-asab-warm/40 text-asab-stone hover:border-asab-accent hover:text-asab-accent transition-colors"
              title="Schimba directia deschidere usa"
            >
              {(cab.doorDirection ?? "S") === "S" ? "← S" : "D →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="mt-1 w-full py-2 border border-dashed border-asab-warm/50 rounded-lg text-xs text-asab-stone hover:border-asab-accent hover:text-asab-accent transition-colors">
      {label}
    </button>
  );
}

function Picker({ skus, onPick, onClose }: {
  skus:    typeof BASE_CABINETS;
  onPick:  (sku: typeof BASE_CABINETS[0]) => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-1 border border-asab-warm/30 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-asab-light">
        <p className="text-xs font-medium text-asab-black">Alege dulap</p>
        <button onClick={onClose} className="text-asab-stone text-lg leading-none">×</button>
      </div>
      <div className="divide-y divide-asab-warm/20 max-h-48 overflow-y-auto">
        {skus.map((sku) => (
          <button key={sku.sku} onClick={() => onPick(sku)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-asab-light text-left transition-colors">
            <span className="text-xs text-asab-black">{sku.label}</span>
            <span className="text-xs text-asab-stone shrink-0 ml-2">{sku.width}cm · {sku.price.toLocaleString("ro-RO")} RON</span>
          </button>
        ))}
      </div>
    </div>
  );
}

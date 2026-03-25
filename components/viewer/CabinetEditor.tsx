"use client";
import { useState } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import { BASE_CABINETS, WALL_CABINETS } from "@/data/skus";
import type { Cabinet, WallSide } from "@/types/kitchen";
import { calcTotalPrice } from "@/lib/rules/resolver";

export default function CabinetEditor() {
  const { cabinets, dimensions } = useConfigStore();
  const wallACabs = cabinets.filter(c => c.wall === "A");
  const wallBCabs = cabinets.filter(c => c.wall === "B" || c.wall === "C");

  function save(newCabs: Cabinet[]) {
    const result: Cabinet[] = [];
    for (const wall of ["A", "B", "C"] as WallSide[]) {
      const tallTypes = ["tall","tall-oven","tall-fridge"];
      const wallCabTypes = ["wall","wall-corner","wall-hood"];

      // All non-wall cabs (base + tall) — recalc sequentially preserving order
      const groundCabs = newCabs.filter(c => c.wall === wall && !wallCabTypes.includes(c.type));
      // For Wall A with L-shape corner, start after the corner gap (60cm)
      const cs = dimensions.cornerSide ?? "right";
      const cornerAtLeft = cs === "right";
      const isLShape = !!(dimensions.wallB && dimensions.wallB > 0);
      const tallWidth = groundCabs
        .filter(c => tallTypes.includes(c.type))
        .reduce((s, c) => s + c.width, 0);

      let cursor = 0;
      if (wall === "A") {
        cursor = isLShape ? (cornerAtLeft ? 60 : tallWidth) : tallWidth;
      } else if ((wall === "B" || wall === "C") && isLShape) {
        cursor = 100;
      }

      const groundResult = groundCabs.map(c => {
        if (c.type === "base-corner") return c; // don't repack corner cabs
        const r = { ...c, xPos: cursor };
        cursor += c.width;
        return r;
      });

      // Build occupied zones from ground cabs (tall cabs block wall cabs above them)
      const tallZones = groundResult
        .filter(c => tallTypes.includes(c.type))
        .map(c => ({ start: c.xPos, end: c.xPos + c.width }));

      // Wall cabs — skip zones occupied by tall cabs
      const wallCabs = newCabs.filter(c => c.wall === wall && wallCabTypes.includes(c.type));
      // Wall A with L-shape: wall cabs also start after corner gap
      let wallCursor = 0;
      if (wall === "A") {
        wallCursor = isLShape ? (cornerAtLeft ? 60 : tallWidth) : tallWidth;
      } else if ((wall === "B" || wall === "C") && isLShape) {
        wallCursor = 100;
      }
      const wallResult = wallCabs.map(c => {
        // Don't repack corner cabs
        if (c.type === "wall-corner") return c;
        // Advance past any tall zone
        let safe = wallCursor;
        for (const zone of tallZones) {
          if (safe >= zone.start && safe < zone.end) safe = zone.end;
        }
        wallCursor = safe;
        const r = { ...c, xPos: wallCursor };
        wallCursor += c.width;
        return r;
      });

      result.push(...groundResult, ...wallResult);
    }
    const totalPrice = calcTotalPrice(result, dimensions.wallA, dimensions.wallB);
    useConfigStore.setState({ cabinets: result, totalPrice });
  }

  function remove(cab: Cabinet) {
    save(cabinets.filter(c => c !== cab));
  }

  function add(wall: WallSide, layer: "base" | "wall", sku: typeof BASE_CABINETS[0]) {
    const newCab: Cabinet = {
      sku: sku.sku, type: sku.type, width: sku.width,
      height: sku.height, depth: sku.depth,
      wall, xPos: 0, price: sku.price, label: sku.label,
    };
    save([...cabinets, newCab]);
  }

  function move(cab: Cabinet, dir: -1 | 1) {
    const isWall = ["wall","wall-corner","wall-hood"].includes(cab.type);
    const layer = cabinets.filter(c => c.wall === cab.wall &&
      (isWall ? ["wall","wall-corner","wall-hood"].includes(c.type) : !["wall","wall-corner","wall-hood"].includes(c.type))
    );
    const idx = layer.indexOf(cab);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= layer.length) return;
    const newLayer = [...layer];
    [newLayer[idx], newLayer[newIdx]] = [newLayer[newIdx], newLayer[idx]];
    const rest = cabinets.filter(c => !layer.includes(c));
    save([...rest, ...newLayer]);
  }

  return (
    <div className="space-y-4">
      <WallSection title="Perete A" cabinets={wallACabs}
        onRemove={remove} onAdd={(l, s) => add("A", l, s)} onMove={move} />
      {wallBCabs.length > 0 && (
        <WallSection title="Perete B" cabinets={wallBCabs}
          onRemove={remove} onAdd={(l, s) => add(wallBCabs[0]?.wall ?? "B", l, s)} onMove={move} />
      )}
    </div>
  );
}

function WallSection({ title, cabinets, onRemove, onAdd, onMove }: {
  title:    string;
  cabinets: Cabinet[];
  onRemove: (c: Cabinet) => void;
  onAdd:    (layer: "base" | "wall", sku: typeof BASE_CABINETS[0]) => void;
  onMove:   (c: Cabinet, dir: -1 | 1) => void;
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
          <CabRow key={i} cab={cab} index={i} total={baseCabs.length}
            onRemove={() => onRemove(cab)}
            onUp={() => onMove(cab, -1)}
            onDown={() => onMove(cab, 1)}
            onToggleDirection={() => {
              const { cabinets: allCabs, dimensions: dims } = useConfigStore.getState();
              const newCabs = allCabs.map(c => c === cab ? { ...c, doorDirection: (c.doorDirection === "S" ? "D" : "S") as "S" | "D" } : c);
              const totalPrice = calcTotalPrice(newCabs, dims.wallA, dims.wallB);
              useConfigStore.setState({ cabinets: newCabs, totalPrice });
            }} />
        ))}
        {addingBase ? (
          <Picker
            skus={BASE_CABINETS.filter(s => ["base","base-sink","base-oven","base-drawer","base-dishwasher"].includes(s.type))}
            onPick={(s) => { onAdd("base", s); setAddingBase(false); }}
            onClose={() => setAddingBase(false)} />
        ) : (
          <AddBtn onClick={() => setAddingBase(true)} label="+ Adauga dulap baza" />
        )}
      </div>

      <div>
        <p className="field-label mb-2">Dulapuri suspendate</p>
        {wallCabs.map((cab, i) => (
          <CabRow key={i} cab={cab} index={i} total={wallCabs.length}
            onRemove={() => onRemove(cab)}
            onUp={() => onMove(cab, -1)}
            onDown={() => onMove(cab, 1)}
            onToggleDirection={() => {
              const { cabinets: allCabs, dimensions: dims } = useConfigStore.getState();
              const newCabs = allCabs.map(c => c === cab ? { ...c, doorDirection: (c.doorDirection === "S" ? "D" : "S") as "S" | "D" } : c);
              const totalPrice = calcTotalPrice(newCabs, dims.wallA, dims.wallB);
              useConfigStore.setState({ cabinets: newCabs, totalPrice });
            }} />
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

function CabRow({ cab, index, total, onRemove, onUp, onDown, onToggleDirection }: {
  cab: Cabinet; index: number; total: number;
  onRemove: () => void; onUp: () => void; onDown: () => void; onToggleDirection: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-asab-light transition-colors">
      {/* Order buttons */}
      <div className="flex flex-col gap-0.5">
        <button onClick={onUp} disabled={index === 0}
          className="w-5 h-5 flex items-center justify-center rounded text-asab-stone hover:text-asab-black disabled:opacity-20 text-xs">
          ▲
        </button>
        <button onClick={onDown} disabled={index === total - 1}
          className="w-5 h-5 flex items-center justify-center rounded text-asab-stone hover:text-asab-black disabled:opacity-20 text-xs">
          ▼
        </button>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-asab-black truncate">{cab.label ?? cab.sku}</p>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-asab-stone">{cab.width}cm · {(cab.price ?? 0).toLocaleString("ro-RO")} RON</p>
          {!["base-corner","wall-corner"].includes(cab.type) && (
            <button
              onClick={onToggleDirection}
              className="text-[10px] px-1.5 py-0.5 rounded border border-asab-warm/40 text-asab-stone hover:border-asab-accent hover:text-asab-accent transition-colors"
              title="Schimba directia deschidere usa"
            >
              {(cab.doorDirection ?? "S") === "S" ? "← S" : "D →"}
            </button>
          )}
        </div>
      </div>
      {/* Remove */}
      <button onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-asab-stone hover:bg-red-50 hover:text-red-500 transition-colors text-lg leading-none shrink-0">
        ×
      </button>
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







"use client";
import { useConfigStore } from "@/store/configuratorStore";
import { snapDimension } from "@/lib/rules/resolver";

const LAYOUTS = [
  { id: "linear", label: "Liniara", desc: "Un singur perete" },
  { id: "l-shape", label: "In colt", desc: "Doi pereti" },
] as const;

// Inline SVG infographics for each layout card. currentColor follows the card text color.
function LinearIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 50" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* floor outline */}
      <rect x="4" y="4" width="72" height="42" rx="2" />
      {/* single run of cabinets along top wall */}
      <rect x="8" y="8" width="64" height="10" rx="1" fill="currentColor" />
      <line x1="24" y1="8" x2="24" y2="18" stroke="#fff" />
      <line x1="40" y1="8" x2="40" y2="18" stroke="#fff" />
      <line x1="56" y1="8" x2="56" y2="18" stroke="#fff" />
    </svg>
  );
}

function LShapeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 50" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="72" height="42" rx="2" />
      {/* top wall run */}
      <rect x="8" y="8" width="64" height="10" rx="1" fill="currentColor" />
      <line x1="24" y1="8" x2="24" y2="18" stroke="#fff" />
      <line x1="40" y1="8" x2="40" y2="18" stroke="#fff" />
      <line x1="56" y1="8" x2="56" y2="18" stroke="#fff" />
      {/* left wall run */}
      <rect x="8" y="18" width="10" height="24" rx="1" fill="currentColor" />
      <line x1="8" y1="30" x2="18" y2="30" stroke="#fff" />
    </svg>
  );
}

function IslandIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 50" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="72" height="42" rx="2" />
      {/* wall run */}
      <rect x="8" y="8" width="64" height="9" rx="1" fill="currentColor" />
      <line x1="28" y1="8" x2="28" y2="17" stroke="#fff" />
      <line x1="52" y1="8" x2="52" y2="17" stroke="#fff" />
      {/* island */}
      <rect x="22" y="30" width="36" height="12" rx="1" fill="currentColor" />
      <line x1="40" y1="30" x2="40" y2="42" stroke="#fff" />
    </svg>
  );
}

export default function StepDimensions() {
  const { layout, dimensions, devConstraintsUnlocked, setLayout, setDimensions, setStep } = useConfigStore();
  const baseLayout = layout === "island" || layout === "peninsula" ? "linear" : layout;
  const hasIsland = layout === "island" || dimensions.hasIsland === true;

  const handleNext = () => {
    setDimensions({
      wallA: snapDimension(dimensions.wallA),
      wallB: dimensions.wallB ? snapDimension(dimensions.wallB) : undefined,
      hasIsland,
      ...(hasIsland
        ? {
            islandWidth: dimensions.islandWidth ?? 180,
            islandDepth: dimensions.islandDepth ?? 90,
            islandDistance: dimensions.islandDistance ?? 130,
            islandPosition: dimensions.islandPosition ?? "center",
          }
        : {}),
    });
    setStep(devConstraintsUnlocked ? "constraints" : "sink");
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 3 din 11</p>
        <h1 className="text-2xl font-semibold text-gray-900">Dimensiuni</h1>
        <p className="text-sm text-gray-400 mt-1">Introduceti dimensiunile spatiului dumneavoastra.</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Configuratie</p>
        <div className="grid grid-cols-2 gap-3">
          {LAYOUTS.map((l) => {
            const isActive = baseLayout === l.id;
            const Icon = l.id === "linear" ? LinearIcon : LShapeIcon;
            return (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={[
                  "py-3 px-4 rounded-xl border text-left transition-all",
                  isActive
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-400",
                ].join(" ")}
              >
                <Icon className="w-full h-16 mb-2" />
                <p className="text-sm font-semibold">{l.label}</p>
                <p className={["text-xs mt-0.5", isActive ? "text-gray-300" : "text-gray-400"].join(" ")}>{l.desc}</p>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            if (layout === "island") setLayout("linear");
            setDimensions({ hasIsland: !hasIsland });
          }}
          className={[
            "w-full mt-3 py-3 px-4 rounded-xl border text-left transition-all flex items-center gap-4",
            hasIsland ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-400",
          ].join(" ")}
        >
          <IslandIcon className="w-20 h-14 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Adauga insula</p>
            <p className={["text-xs mt-0.5", hasIsland ? "text-gray-300" : "text-gray-400"].join(" ")}>Optional pentru bucatarie liniara sau in colt</p>
          </div>
        </button>
        {hasIsland && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3 leading-relaxed">
            Configuratiile cu insula necesita verificare tehnica pentru pozitionare exacta, distante de circulatie si instalatii.
          </p>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
            {baseLayout === "l-shape" ? "Perete A (principal)" : "Lungime perete principal"} — cm
          </label>
          <input
            type="number"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
            min={120} max={600} step={5}
            value={dimensions.wallA || ""}
            onChange={(e) => setDimensions({ wallA: e.target.value === "" ? 0 : +e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">Ajustat la modul: {snapDimension(dimensions.wallA)} cm</p>
        </div>

        {baseLayout === "l-shape" && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Perete B — cm</label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
                min={120} max={400} step={5}
                value={dimensions.wallB ?? ""}
                onChange={(e) => setDimensions({ wallB: e.target.value === "" ? undefined : +e.target.value })}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Directie colt</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDimensions({ cornerSide: "right" })}
                  className={["flex flex-col items-center gap-2 py-4 px-3 rounded-xl border transition-all",
                    (dimensions.cornerSide ?? "right") === "right" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600 hover:border-gray-400"].join(" ")}
                >
                  <svg width="44" height="30" viewBox="0 0 44 30">
                    <rect x="2" y="2" width="24" height="7" rx="1" fill="currentColor" opacity="0.4"/>
                    <rect x="2" y="2" width="7" height="24" rx="1" fill="currentColor" opacity="0.4"/>
                    <rect x="2" y="2" width="24" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="2" y="2" width="7" height="24" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span className="text-xs font-semibold">Colt stanga</span>
                </button>
                <button
                  onClick={() => setDimensions({ cornerSide: "left" })}
                  className={["flex flex-col items-center gap-2 py-4 px-3 rounded-xl border transition-all",
                    dimensions.cornerSide === "left" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600 hover:border-gray-400"].join(" ")}
                >
                  <svg width="44" height="30" viewBox="0 0 44 30">
                    <rect x="18" y="2" width="24" height="7" rx="1" fill="currentColor" opacity="0.4"/>
                    <rect x="35" y="2" width="7" height="24" rx="1" fill="currentColor" opacity="0.4"/>
                    <rect x="18" y="2" width="24" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="35" y="2" width="7" height="24" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span className="text-xs font-semibold">Colt dreapta</span>
                </button>
              </div>
            </div>
          </>
        )}

        {hasIsland && (
          <div className="border border-gray-100 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dimensiuni insula</p>
            <DimensionInput label="Latime insula" value={dimensions.islandWidth ?? 180} min={90} max={300} onChange={(islandWidth) => setDimensions({ islandWidth })} />
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pozitie insula</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "left", label: "Stanga" },
                  { id: "center", label: "Centru" },
                  { id: "right", label: "Dreapta" },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setDimensions({ islandPosition: pos.id as "left" | "center" | "right" })}
                    className={[
                      "py-2 rounded-lg border text-xs font-semibold",
                      (dimensions.islandPosition ?? "center") === pos.id
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600",
                    ].join(" ")}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <button onClick={handleNext} className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all">
        Continua →
      </button>
    </div>
  );
}

function DimensionInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
        {label} — cm
      </span>
      <input
        type="number"
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
        min={min}
        max={max}
        step={5}
        value={value || ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : +e.target.value)}
      />
    </label>
  );
}
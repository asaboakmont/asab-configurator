"use client";
import { useConfigStore } from "@/store/configuratorStore";
import { snapDimension } from "@/lib/rules/resolver";

const LAYOUTS = [
  { id: "linear",  label: "Liniară",  desc: "Un singur perete" },
  { id: "l-shape", label: "În L",     desc: "Doua pereti" },
] as const;

export default function StepDimensions() {
  const { layout, dimensions, setLayout, setDimensions, setStep } = useConfigStore();

  const handleNext = () => {
    setDimensions({
      wallA: snapDimension(dimensions.wallA),
      wallB: dimensions.wallB ? snapDimension(dimensions.wallB) : undefined,
    });
    setStep("sink");
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 1 din 8</p>
        <h1 className="text-2xl font-semibold text-gray-900">Dimensiuni</h1>
        <p className="text-sm text-gray-400 mt-1">Introduceti dimensiunile spatiului dumneavoastra.</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Configuratie</p>
        <div className="grid grid-cols-2 gap-3">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLayout(l.id)}
              className={[
                "py-3 px-4 rounded-xl border text-left transition-all",
                layout === l.id
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-400",
              ].join(" ")}
            >
              <p className="text-sm font-semibold">{l.label}</p>
              <p className={["text-xs mt-0.5", layout === l.id ? "text-gray-300" : "text-gray-400"].join(" ")}>{l.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
            {layout === "l-shape" ? "Perete A (principal)" : "Lungime perete"} — cm
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

        {layout === "l-shape" && (
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
      </div>

      <button onClick={handleNext} className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all">
        Continua →
      </button>
    </div>
  );
}
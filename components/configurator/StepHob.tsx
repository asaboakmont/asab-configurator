"use client";
import { useConfigStore } from "@/store/configuratorStore";
import type { HobSize, OvenPlacement } from "@/types/kitchen";

export default function StepHob() {
  const { appliances, setAppliances, setStep, layout, dimensions } = useConfigStore();
  const hasWallB = layout === "l-shape" && (dimensions.wallB ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 3 din 8</p>
        <h1 className="text-2xl font-semibold text-gray-900">Plita & Cuptor</h1>
        <p className="text-sm text-gray-400 mt-1">Configurati plita si cuptorul.</p>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Plita</p>
          <div className="grid grid-cols-2 gap-3">
            <OptionCard active={appliances.hasHob} onClick={() => setAppliances({ hasHob: true })} label="Da" />
            <OptionCard active={!appliances.hasHob} onClick={() => setAppliances({ hasHob: false })} label="Nu" />
          </div>
        </div>

        {appliances.hasHob && (
          <>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Latime plita</p>
              <div className="grid grid-cols-2 gap-3">
                {([60, 80] as HobSize[]).map((w) => (
                  <OptionCard key={w} active={appliances.hobSize === w} onClick={() => setAppliances({ hobSize: w })} label={`${w} cm`} />
                ))}
              </div>
            </div>

            {hasWallB && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Perete plita</p>
                <div className="grid grid-cols-2 gap-3">
                  <OptionCard active={(appliances.hobWall ?? "A") === "A"} onClick={() => setAppliances({ hobWall: "A" })} label="Perete A" />
                  <OptionCard active={(appliances.hobWall ?? "A") === "B"} onClick={() => setAppliances({ hobWall: "B" })} label="Perete B" />
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cuptor</p>
              <div className="grid grid-cols-3 gap-3">
                {(["none", "under-hob", "tall-column"] as OvenPlacement[]).map((opt) => {
                  const labels: Record<OvenPlacement, string> = {
                    "none": "Fara", "under-hob": "Sub plita", "tall-column": "Coloana",
                  };
                  return (
                    <OptionCard key={opt} active={appliances.hasOven === opt} onClick={() => setAppliances({ hasOven: opt })} label={labels[opt]} />
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!appliances.hasHob && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cuptor</p>
            <div className="grid grid-cols-2 gap-3">
              <OptionCard active={appliances.hasOven === "none"} onClick={() => setAppliances({ hasOven: "none" })} label="Fara" />
              <OptionCard active={appliances.hasOven === "tall-column"} onClick={() => setAppliances({ hasOven: "tall-column" })} label="Coloana" />
            </div>
          </div>
        )}
      </div>

      <NavButtons onBack={() => setStep("sink")} onNext={() => setStep("dishwasher")} />
    </div>
  );
}

function OptionCard({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={[
        "py-3 px-4 rounded-xl border text-sm font-semibold transition-all",
        active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-400",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function NavButtons({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-400 transition-all">
        ← Inapoi
      </button>
      <button onClick={onNext} className="flex-[2] py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all">
        Continua →
      </button>
    </div>
  );
}
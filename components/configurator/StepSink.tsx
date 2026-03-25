"use client";
import { useConfigStore } from "@/store/configuratorStore";
import type { SinkSize } from "@/types/kitchen";

export default function StepSink() {
  const { appliances, setAppliances, setStep, layout, dimensions } = useConfigStore();
  const hasWallB = layout === "l-shape" && (dimensions.wallB ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 2 din 8</p>
        <h1 className="text-2xl font-semibold text-gray-900">Chiuveta</h1>
        <p className="text-sm text-gray-400 mt-1">Veti integra o chiuveta in bucatarie?</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <OptionCard active={appliances.hasSink} onClick={() => setAppliances({ hasSink: true })} label="Da" />
          <OptionCard active={!appliances.hasSink} onClick={() => setAppliances({ hasSink: false })} label="Nu" />
        </div>

        {appliances.hasSink && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Latime</p>
              <div className="grid grid-cols-2 gap-3">
                {([60, 80] as SinkSize[]).map((w) => (
                  <OptionCard key={w} active={appliances.sinkSize === w} onClick={() => setAppliances({ sinkSize: w })} label={`${w} cm`} />
                ))}
              </div>
            </div>
            {hasWallB && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Perete</p>
                <div className="grid grid-cols-2 gap-3">
                  <OptionCard active={(appliances.sinkWall ?? "A") === "A"} onClick={() => setAppliances({ sinkWall: "A" })} label="Perete A" />
                  <OptionCard active={(appliances.sinkWall ?? "A") === "B"} onClick={() => setAppliances({ sinkWall: "B" })} label="Perete B" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <NavButtons onBack={() => setStep("dimensions")} onNext={() => setStep("hob")} />
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
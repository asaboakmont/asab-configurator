"use client";
import { useConfigStore } from "@/store/configuratorStore";
import type { HobSize, SinkSize, OvenPlacement } from "@/types/kitchen";

export default function StepAppliances() {
  const { appliances, setAppliances, setStep, layout, dimensions } = useConfigStore();
  const hasWallB = layout === "l-shape" && (dimensions.wallB ?? 0) > 0;

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      <div>
        <h1 className="font-display text-3xl font-light text-asab-black mb-1">
          Electrocasnice
        </h1>
        <p className="text-sm text-asab-stone">Ce aparate veti integra in bucatarie?</p>
      </div>

      {/* SINK */}
      <div className="card space-y-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-asab-black">Chiuveta</span>
          <Toggle value={appliances.hasSink} onChange={(v) => setAppliances({ hasSink: v })} />
        </div>
        {appliances.hasSink && (
          <div className="pt-2 border-t border-asab-warm/20 space-y-3">
            <div>
              <label className="field-label">Latime chiuveta</label>
              <div className="grid grid-cols-2 gap-2">
                {([60, 80] as SinkSize[]).map((w) => (
                  <ChipButton key={w} active={appliances.sinkSize === w}
                    onClick={() => setAppliances({ sinkSize: w })} label={`${w} cm`} />
                ))}
              </div>
            </div>
            {hasWallB && (
              <div>
                <label className="field-label">Perete chiuveta</label>
                <div className="grid grid-cols-2 gap-2">
                  <ChipButton active={(appliances.sinkWall ?? "A") === "A"} onClick={() => setAppliances({ sinkWall: "A" })} label="Perete A" />
                  <ChipButton active={(appliances.sinkWall ?? "A") === "B"} onClick={() => setAppliances({ sinkWall: "B" })} label="Perete B" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HOB */}
      <div className="card space-y-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-asab-black">Plita</span>
          <Toggle value={appliances.hasHob} onChange={(v) => setAppliances({ hasHob: v })} />
        </div>
        {appliances.hasHob && (
          <div className="pt-2 border-t border-asab-warm/20 space-y-3">
            <div>
              <label className="field-label">Latime plita</label>
              <div className="grid grid-cols-2 gap-2">
                {([60, 80] as HobSize[]).map((w) => (
                  <ChipButton key={w} active={appliances.hobSize === w}
                    onClick={() => setAppliances({ hobSize: w })} label={`${w} cm`} />
                ))}
              </div>
            </div>
            {hasWallB && (
              <div>
                <label className="field-label">Perete plita</label>
                <div className="grid grid-cols-2 gap-2">
                  <ChipButton active={(appliances.hobWall ?? "A") === "A"} onClick={() => setAppliances({ hobWall: "A" })} label="Perete A" />
                  <ChipButton active={(appliances.hobWall ?? "A") === "B"} onClick={() => setAppliances({ hobWall: "B" })} label="Perete B" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* OVEN */}
      <div className="card space-y-3 overflow-hidden">
        <span className="text-sm font-medium text-asab-black">Cuptor</span>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {(["none", "under-hob", "tall-column"] as OvenPlacement[]).map((opt) => {
            const labels: Record<OvenPlacement, string> = {
              "none": "Fara", "under-hob": "Sub plita", "tall-column": "Coloana",
            };
            return (
              <ChipButton key={opt} active={appliances.hasOven === opt}
                onClick={() => setAppliances({ hasOven: opt })} label={labels[opt]} />
            );
          })}
        </div>
      </div>

      {/* DISHWASHER */}
      <div className="card space-y-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-asab-black">Masina de spalat vase</span>
          <Toggle value={appliances.hasDishwasher} onChange={(v) => setAppliances({ hasDishwasher: v })} />
        </div>
        {appliances.hasDishwasher && (
          <div className="pt-2 border-t border-asab-warm/20">
            <label className="field-label">Latime front masina vase</label>
            <div className="grid grid-cols-2 gap-2">
              {([60, 45] as number[]).map((w) => (
                <ChipButton key={w} active={(appliances.dishwasherSize ?? 60) === w}
                  onClick={() => setAppliances({ dishwasherSize: w as 60 | 45 })} label={`${w} cm`} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FRIDGE & HOOD */}
      <div className="card space-y-3 overflow-hidden">
        <span className="text-sm font-medium text-asab-black">Alte aparate</span>
        <div className="space-y-2 pt-1">
          {[
            { key: "hasFridge", label: "Frigider integrat" },
            { key: "hasHood",   label: "Hota" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-sm text-asab-stone">{label}</span>
              <Toggle
                value={appliances[key as keyof typeof appliances] as boolean}
                onChange={(v) => setAppliances({ [key]: v })} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => setStep("dimensions")} className="btn-secondary">← Inapoi</button>
        <button onClick={() => setStep("style")} className="btn-primary">Urmatorul pas →</button>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={["relative w-11 h-6 rounded-full transition-colors overflow-hidden shrink-0",
        value ? "bg-asab-accent" : "bg-asab-warm/40"].join(" ")}>
      <span className={["absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200",
        value ? "left-[22px]" : "left-[2px]"].join(" ")} />
    </button>
  );
}

function ChipButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={["py-2.5 text-sm rounded-lg border transition-all",
        active
          ? "border-asab-accent bg-asab-accent/5 text-asab-accent font-medium"
          : "border-asab-warm/30 bg-white text-asab-stone hover:border-asab-accent/40",
      ].join(" ")}>{label}</button>
  );
}

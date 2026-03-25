"use client";
import { useConfigStore } from "@/store/configuratorStore";

export default function StepDishwasher() {
  const { appliances, setAppliances, setStep } = useConfigStore();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 4 din 8</p>
        <h1 className="text-2xl font-semibold text-gray-900">Masina de spalat vase</h1>
        <p className="text-sm text-gray-400 mt-1">Veti integra o masina de spalat vase?</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <OptionCard active={appliances.hasDishwasher} onClick={() => setAppliances({ hasDishwasher: true })} label="Da" />
          <OptionCard active={!appliances.hasDishwasher} onClick={() => setAppliances({ hasDishwasher: false })} label="Nu" />
        </div>

        {appliances.hasDishwasher && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Latime front</p>
            <div className="grid grid-cols-2 gap-3">
              {([60, 45] as (60 | 45)[]).map((w) => (
                <OptionCard
                  key={w}
                  active={(appliances.dishwasherSize ?? 60) === w}
                  onClick={() => setAppliances({ dishwasherSize: w })}
                  label={`${w} cm`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <NavButtons onBack={() => setStep("hob")} onNext={() => setStep("hood")} />
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
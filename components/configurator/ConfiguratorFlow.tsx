"use client";
import React from "react";
import { useConfigStore } from "@/store/configuratorStore";
import StepDimensions from "./StepDimensions";
import StepSink       from "./StepSink";
import StepHob        from "./StepHob";
import StepDishwasher from "./StepDishwasher";
import StepHood       from "./StepHood";
import StepStyle      from "./StepStyle";
import StepCart       from "@/components/cart/StepCart";
import dynamic        from "next/dynamic";
const StepViewer = dynamic(() => import("@/components/viewer/StepViewer"), { ssr: false });

const STEPS = [
  { id: "dimensions",  label: "Dimensiuni" },
  { id: "sink",        label: "Chiuveta" },
  { id: "hob",         label: "Plita" },
  { id: "dishwasher",  label: "Masina vase" },
  { id: "hood",        label: "Hota" },
  { id: "style",       label: "Stil" },
  { id: "viewer",      label: "Previzualizare" },
  { id: "cart",        label: "Comanda" },
] as const;

export default function ConfiguratorFlow() {
  const { step, setStep } = useConfigStore();
    React.useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-semibold tracking-wide text-gray-900">
              ASAB Design
            </span>
            <span className="text-xs text-gray-400 uppercase tracking-widest">
              Configurator
            </span>
          </div>
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => i < stepIndex && setStep(s.id as import("@/types/kitchen").ConfigStep)}
                disabled={i > stepIndex}
                className={[
                  "h-1 rounded-full transition-all duration-300 flex-1",
                  i === stepIndex ? "bg-gray-900" : "",
                  i  < stepIndex  ? "bg-gray-300 cursor-pointer hover:bg-gray-400" : "",
                  i  > stepIndex  ? "bg-gray-100 cursor-not-allowed" : "",
                ].join(" ")}
                title={s.label}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {stepIndex + 1} din {STEPS.length} — {STEPS[stepIndex].label}
          </p>
        </div>
      </header>

      <div className="flex-1 max-w-lg w-full mx-auto px-4 py-8">
        {step === "dimensions"  && <StepDimensions />}
        {step === "sink"        && <StepSink />}
        {step === "hob"         && <StepHob />}
        {step === "dishwasher"  && <StepDishwasher />}
        {step === "hood"        && <StepHood />}
        {step === "style"       && <StepStyle />}
        {step === "viewer"      && <StepViewer />}
        {step === "cart"        && <StepCart />}
      </div>
    </div>
  );
}
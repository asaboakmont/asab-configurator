"use client";
import React from "react";
import { useConfigStore } from "@/store/configuratorStore";
import StepCollection from "./StepCollection";
import StepRoomFinishes from "./StepRoomFinishes";
import StepDimensions from "./StepDimensions";
import StepConstraints from "./StepConstraints";
import StepSink       from "./StepSink";
import StepHob        from "./StepHob";
import StepDishwasher from "./StepDishwasher";
import StepHood       from "./StepHood";
import StepStyle      from "./StepStyle";
import StepCart       from "@/components/cart/StepCart";
import dynamic        from "next/dynamic";
const StepViewer = dynamic(() => import("@/components/viewer/StepViewer"), { ssr: false });

const ALL_STEPS = [
  { id: "collection",  label: "Colectie" },
  { id: "room",        label: "Camera" },
  { id: "dimensions",  label: "Dimensiuni" },
  { id: "constraints", label: "Constrangeri", devOnly: true },
  { id: "sink",        label: "Chiuveta" },
  { id: "hob",         label: "Plita" },
  { id: "dishwasher",  label: "Masina vase" },
  { id: "hood",        label: "Hota" },
  { id: "style",       label: "Stil" },
  { id: "viewer",      label: "Previzualizare" },
  { id: "cart",        label: "Ce urmeaza?" },
] as const;

export default function ConfiguratorFlow() {
  const { step, devConstraintsUnlocked, setDevConstraintsUnlocked, setStep } = useConfigStore();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [devLoginOpen, setDevLoginOpen] = React.useState(false);
  const STEPS = React.useMemo(
    () => ALL_STEPS.filter((step) => !("devOnly" in step && step.devOnly) || devConstraintsUnlocked),
    [devConstraintsUnlocked]
  );
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.id === step));

  React.useEffect(() => {
    if (step === "constraints" && !devConstraintsUnlocked) setStep("sink");
  }, [devConstraintsUnlocked, setStep, step]);

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <header className={["shrink-0 bg-white border-b border-gray-100 px-4 py-3 z-50", (step === "viewer" || step === "cart") ? "hidden" : ""].join(" ")}>
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
                  "h-5 rounded-full transition-all duration-300 flex-1 flex items-center justify-center",
                  i === stepIndex ? "bg-gray-900" : "",
                  i  < stepIndex  ? "bg-gray-300 cursor-pointer hover:bg-gray-400" : "",
                  i  > stepIndex  ? "bg-gray-100 cursor-not-allowed" : "",
                ].join(" ")}
                title={s.label}
              >
                <span className={["text-[13px] font-bold", i === stepIndex ? "text-white" : i < stepIndex ? "text-gray-500" : "text-gray-300"].join(" ")}>{i + 1}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {stepIndex + 1} din {STEPS.length} — {STEPS[stepIndex].label}
          </p>
        </div>
      </header>

      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-lg w-full mx-auto px-4 py-8">
          {step === "collection"  && (
            <>
              <StepCollection />
              {!devConstraintsUnlocked && (
                <button
                  type="button"
                  onClick={() => setDevLoginOpen(true)}
                  className="mt-8 block w-full text-center text-xs text-gray-300 underline underline-offset-4 hover:text-gray-500"
                >
                  Acces dezvoltator
                </button>
              )}
            </>
          )}
          {step === "room"        && <StepRoomFinishes />}
          {step === "dimensions"  && <StepDimensions />}
          {step === "constraints" && devConstraintsUnlocked && <StepConstraints />}
          {step === "sink"        && <StepSink />}
          {step === "hob"         && <StepHob />}
          {step === "dishwasher"  && <StepDishwasher />}
          {step === "hood"        && <StepHood />}
          {step === "style"       && <StepStyle />}
          {step === "viewer"      && <StepViewer />}
          {step === "cart"        && <StepCart />}
        </div>
      </div>
      {devLoginOpen && (
        <DevLoginModal
          onClose={() => setDevLoginOpen(false)}
          onUnlock={() => {
            setDevConstraintsUnlocked(true);
            setDevLoginOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DevLoginModal({ onClose, onUnlock }: { onClose: () => void; onUnlock: () => void }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username === "admin" && password === "admin") {
      setError(false);
      onUnlock();
      return;
    }
    setError(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Acces dezvoltator</p>
          <h2 className="text-lg font-semibold text-gray-900">Activeaza constrangerile</h2>
        </div>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Utilizator</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Parola</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900"
          />
        </label>
        {error && <p className="text-xs font-semibold text-red-600">Utilizator sau parola incorecta.</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
            Inchide
          </button>
          <button type="submit" className="flex-[2] py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">
            Activeaza
          </button>
        </div>
      </form>
    </div>
  );
}

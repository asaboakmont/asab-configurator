"use client";
import { useState } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import { COLORWAYS, WORKTOP_OPTIONS, HANDLE_OPTIONS } from "@/data/colorways";

export default function StepStyle() {
  const { colorway, setColorway, setStep, setContact, setShareUrl, generate } = useConfigStore();
  const [finishFilter, setFinishFilter] = useState<"mat" | "lucios" | "furnir">("mat");
  const [showCapture, setShowCapture] = useState(false);
  const [captureName, setCaptureName] = useState("");
  const [captureEmail, setCaptureEmail] = useState("");
  const [capturePhone, setCapturePhone] = useState("");

  const updateWorktop = (worktopId: string) => {
    const opt = WORKTOP_OPTIONS.find(w => w.id === worktopId);
    if (opt) setColorway({ ...colorway, worktop: opt.id as "stejar" | "gri-piatra", worktopHex: opt.hex });
  };

  const updateHandle = (handleId: string) => {
    const opt = HANDLE_OPTIONS.find(h => h.id === handleId);
    if (opt) setColorway({ ...colorway, handle: opt.id as "inox" | "negru-mat", handleHex: opt.hex });
  };

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 9 din 11</p>
        <h1 className="text-2xl font-semibold text-gray-900">Stil & Culoare</h1>
        <p className="text-sm text-gray-400 mt-1">Alegeti finisajul, blatul si manerele.</p>
      </div>

      {/* Door finish */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Finisaj fronturi</p>
        <div className="flex gap-2 mb-4">
          {(["mat", "lucios", "furnir"] as const).map((f) => (
            <button key={f} onClick={() => setFinishFilter(f)}
              className={["px-4 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize",
                finishFilter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"].join(" ")}>
              {f}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {COLORWAYS.filter(cw => cw.finish === finishFilter).map((cw) => (
            <button key={cw.id}
              onClick={() => setColorway({
                ...cw,
                worktop: colorway.worktop,
                worktopHex: colorway.worktopHex,
                handle: colorway.handle,
                handleHex: colorway.handleHex,
                plinth: colorway.plinth,
                plinthHex: colorway.plinthHex,
              })}
              className={["w-full flex items-center gap-4 p-3 rounded-xl border transition-all text-left",
                colorway.id === cw.id ? "border-gray-900" : "border-gray-200 hover:border-gray-400"].join(" ")}>
              <div className="w-8 h-10 rounded-lg shrink-0 border border-black/5" style={{ background: cw.doorHex }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{cw.name}</p>
                <p className="text-xs text-gray-400 capitalize">{cw.finish}</p>
              </div>
              {colorway.id === cw.id && (
                <div className="w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Worktop */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Blat de lucru</p>
        <div className="grid grid-cols-2 gap-3">
          {WORKTOP_OPTIONS.map((w) => (
            <button key={w.id} onClick={() => updateWorktop(w.id)}
              className={["flex items-center gap-3 p-3 rounded-xl border transition-all",
                colorway.worktop === w.id ? "border-gray-900" : "border-gray-200 hover:border-gray-400"].join(" ")}>
              <div className="w-8 h-10 rounded-lg shrink-0 border border-black/5" style={{ background: w.hex }} />
              <p className="text-sm font-semibold text-gray-900">{w.label}</p>
              {colorway.worktop === w.id && (
                <div className="w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center ml-auto shrink-0">
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Handle */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Manere 128mm</p>
        <div className="grid grid-cols-2 gap-3">
          {HANDLE_OPTIONS.map((h) => (
            <button key={h.id} onClick={() => updateHandle(h.id)}
              className={["flex items-center gap-3 p-3 rounded-xl border transition-all",
                colorway.handle === h.id ? "border-gray-900" : "border-gray-200 hover:border-gray-400"].join(" ")}>
              <div className="w-8 h-3 rounded-full shrink-0 border border-black/10" style={{ background: h.hex }} />
              <p className="text-sm font-semibold text-gray-900">{h.label}</p>
              {colorway.handle === h.id && (
                <div className="w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center ml-auto shrink-0">
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Preview strip */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Previzualizare</p>
        <div className="flex h-16 rounded-xl overflow-hidden border border-gray-100">
          <div className="w-3" style={{ background: colorway.carcassHex }} />
          <div className="flex-1" style={{ background: colorway.doorHex }} />
          <div className="w-10" style={{ background: colorway.worktopHex }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {colorway.name} · {colorway.finish} · {WORKTOP_OPTIONS.find(w => w.id === colorway.worktop)?.label}
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={() => setStep("hood")}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-400 transition-all">
          ← Inapoi
        </button>
        <button onClick={() => setShowCapture(true)}
          className="flex-[2] py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all">
          Genereaza bucataria →
        </button>
      </div>

      {/* Capture Modal */}
      {showCapture && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Aproape gata!</h2>
            <p className="text-xs text-gray-400">Introduceti datele pentru a salva si vizualiza configuratia.</p>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-900"
              placeholder="Numele tau"
              value={captureName}
              onChange={e => setCaptureName(e.target.value)}
            />
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-900"
              type="email"
              placeholder="Email"
              value={captureEmail}
              onChange={e => setCaptureEmail(e.target.value)}
            />
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-900"
              type="tel"
              placeholder="Telefon"
              value={capturePhone}
              onChange={e => setCapturePhone(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCapture(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
                Inapoi
              </button>
              <button
                disabled={!captureName || !captureEmail || !capturePhone}
                onClick={async () => {
                  setContact({ name: captureName, email: captureEmail, phone: capturePhone });
                  generate();
                  const { collection, budget, roomFinishes, layout, dimensions, appliances, colorway: cw, cabinets, totalPrice, constraints } = useConfigStore.getState();
                  fetch("/api/config/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      config: { collection, budget, roomFinishes, layout, dimensions, appliances, colorway: cw, cabinets, totalPrice, constraints },
                      name: captureName,
                      email: captureEmail,
                      phone: capturePhone,
                    }),
                  })
                    .then((res) => (res.ok ? res.json() : undefined))
                    .then((data) => {
                      if (data?.url) setShareUrl(data.url);
                    })
                    .catch(() => {});
                  setShowCapture(false);
                }}
                className="flex-[2] py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40">
                Vizualizeaza →
              </button>
            </div>
            <button onClick={() => { generate(); setShowCapture(false); }}
              className="w-full text-xs text-gray-400 underline underline-offset-2 pt-1">
              Continua fara a salva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

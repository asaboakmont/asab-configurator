"use client";
import { useEffect, useState } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import { COLORWAYS, WORKTOP_OPTIONS, HANDLE_OPTIONS } from "@/data/colorways";
import type { WorktopStyle } from "@/types/kitchen";

export default function StepStyle() {
  const { collection, colorway, setColorway, setStep, setContact, setShareUrl, generate } = useConfigStore();
  const [finishFilter, setFinishFilter] = useState<"mat" | "lucios">("mat");
  const [showCapture, setShowCapture] = useState(false);
  const [captureName, setCaptureName] = useState("");
  const [captureEmail, setCaptureEmail] = useState("");
  const [capturePhone, setCapturePhone] = useState("");
  const availableFinishes = collection === "franc" ? (["mat"] as const) : (["mat", "lucios"] as const);

  useEffect(() => {
    if (collection === "franc" && finishFilter !== "mat") {
      setFinishFilter("mat");
    }
  }, [collection, finishFilter]);

  const updateWorktop = (worktopId: string) => {
    const opt = WORKTOP_OPTIONS.find(w => w.id === worktopId);
    if (opt) setColorway({ ...colorway, worktop: opt.id as WorktopStyle, worktopHex: opt.hex });
  };

  const updateHandle = (handleId: string) => {
    const opt = HANDLE_OPTIONS.find(h => h.id === handleId);
    if (opt) setColorway({ ...colorway, handle: opt.id as "inox" | "negru-mat", handleHex: opt.hex });
  };

  const worktopPreviewStyle = (worktop: { hex: string; texture?: string }) =>
    worktop.texture
      ? {
          backgroundColor: worktop.hex,
          backgroundImage: `url('${worktop.texture}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { background: worktop.hex };

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
          {availableFinishes.map((f) => (
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
              <div className="w-8 h-10 rounded-lg shrink-0 border border-black/5" style={worktopPreviewStyle(w)} />
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

      {showCapture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();

              const name = captureName.trim() || "Client";
              const email = captureEmail.trim();
              const phone = capturePhone.trim();
              if (!email || !phone) return;

              setContact({ name, email, phone });
              generate();

              const { collection, budget, roomFinishes, layout, dimensions, appliances, colorway: selectedColorway, cabinets, totalPrice, constraints } = useConfigStore.getState();
              fetch("/api/config/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  config: { collection, budget, roomFinishes, layout, dimensions, appliances, colorway: selectedColorway, cabinets, totalPrice, constraints },
                  name,
                  email,
                  phone,
                }),
              })
                .then((response) => (response.ok ? response.json() : undefined))
                .then((data) => {
                  if (data?.url) setShareUrl(data.url);
                })
                .catch(() => {});

              setShowCapture(false);
            }}
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6"
          >
            <div>
              <h2 className="text-base font-semibold text-gray-900">Aproape gata!</h2>
              <p className="mt-1 text-xs text-gray-400">Lasa emailul si telefonul pentru a vedea previzualizarea 3D si a-ti salva configuratia.</p>
            </div>
            <input
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="Numele tau (optional)"
              value={captureName}
              onChange={(event) => setCaptureName(event.target.value)}
            />
            <input
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none"
              type="email"
              placeholder="Email *"
              value={captureEmail}
              onChange={(event) => setCaptureEmail(event.target.value)}
            />
            <input
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none"
              type="tel"
              placeholder="Telefon *"
              value={capturePhone}
              onChange={(event) => setCapturePhone(event.target.value)}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCapture(false)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600"
              >
                Inapoi
              </button>
              <button
                type="submit"
                className="flex-[2] rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Vizualizeaza →
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

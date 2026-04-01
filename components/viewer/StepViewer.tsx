"use client";
import { Suspense, useState } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import { COLORWAYS } from "@/data/colorways";
import type { HandleStyle } from "@/types/kitchen";
import dynamic from "next/dynamic";
import { exportKitchenPDF } from "@/lib/pdf/exportPDF";
import CabinetEditor from "./CabinetEditor";

const KitchenScene = dynamic(() => import("./KitchenScene"), { ssr: false });

const HANDLES: { id: HandleStyle; label: string }[] = [
  { id: "inox",      label: "Inox"      },
  { id: "negru-mat", label: "Negru Mat" },
];

export default function StepViewer() {
  const { cabinets, totalPrice, colorway, layout, dimensions, setColorway, setStep, layoutWarnings } = useConfigStore();
  const [showHints,    setShowHints]    = useState(true);
  const [exporting,    setExporting]    = useState(false);
  const [wallBCabs,    setWallBCabs]    = useState(true);
  const [showSheet,    setShowSheet]    = useState(false);
  const [sheetTab,     setSheetTab]     = useState<"colors" | "cabinets" | "list">("colors");
  const [show2D,       setShow2D]       = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfName,      setPdfName]      = useState("");
  const [pdfEmail,     setPdfEmail]     = useState("");
  const [pdfPhone,     setPdfPhone]     = useState("");

  const visibleCabinets = wallBCabs
    ? cabinets
    : cabinets.filter((c) => (c.wall !== "B" && c.wall !== "C") || c.type === "base-corner");

  const handleExportPDF = async (name = "", email = "", phone = "") => {
    setExporting(true);
    try {
      let screenshot: string | undefined;
      await new Promise(r => setTimeout(r, 600));
      const viewer = document.getElementById("kitchen-viewer");
      if (viewer) {
        const canvas = viewer.querySelector("canvas") as HTMLCanvasElement;
        if (canvas && canvas.width > 0) {
          try {
            const targetW = 900;
            const aspectRatio = canvas.height / canvas.width;
            const targetH = Math.round(targetW * aspectRatio);
            const offscreen = document.createElement("canvas");
            offscreen.width  = targetW;
            offscreen.height = targetH;
            const ctx = offscreen.getContext("2d");
            if (ctx) { ctx.drawImage(canvas, 0, 0, targetW, targetH); screenshot = offscreen.toDataURL("image/png"); }
            else { screenshot = canvas.toDataURL("image/png"); }
            (window as any).__screenshotAspect = aspectRatio;
          } catch(e) { console.warn("Screenshot failed:", e); }
        }
      }
      let cartUrl: string | undefined;
      try {
        const res = await fetch("/api/shopify/draft-order", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cabinets: visibleCabinets, colorway, handle: colorway.handle, totalPrice, dimensions, layout, contact: { name, phone, email } }),
        });
        if (res.ok) { const data = await res.json(); cartUrl = data.checkoutUrl; }
      } catch(e) { console.warn("Cart URL failed:", e); }
      await exportKitchenPDF({ cabinets: visibleCabinets, colorway, handle: colorway.handle, totalPrice, layout, dimensions, screenshot, cartUrl, contact: { name, phone, email } });
    } finally { setExporting(false); }
  };

  return (
    <div className="relative" style={{ height: "100svh", marginLeft: "-1rem", marginRight: "-1rem", marginTop: "-1rem" }}>
      <div
        key={visibleCabinets.length + "-" + visibleCabinets.reduce((s,c) => s + c.width, 0)}
        id="kitchen-viewer"
        className="absolute inset-0 bg-gray-50"
      >
        <Suspense fallback={<ViewerSkeleton />}>
          <KitchenScene
            cabinets={visibleCabinets}
            colorway={colorway}
            wallA={dimensions.wallA}
            wallB={layout === "l-shape" ? (dimensions.wallB ?? 160) : undefined}
            cornerSide={dimensions.cornerSide ?? "right"}
          />
        </Suspense>
        {showHints && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ animation: "fadeOut 0.5s ease 6s forwards" }}
            onAnimationEnd={() => setShowHints(false)}>
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-16 h-16">
                  <div className="absolute w-6 h-6 bg-white/80 rounded-full border-2 border-gray-900"
                    style={{ animation: "orbitFinger 1.5s ease-in-out infinite", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
                </div>
                <span className="text-white text-xs font-semibold bg-black/50 px-2 py-0.5 rounded-full">Trageti pentru rotire</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {layoutWarnings && layoutWarnings.length > 0 && (
        <div className="absolute bottom-32 left-4 right-4 z-10">
          {layoutWarnings.map((w, i) => (
            <div key={i} className="bg-white border border-gray-200 text-gray-700 text-xs rounded-xl px-3 py-2 mb-1 shadow-sm flex items-center justify-between gap-2">
              <span>⚠️ {w}</span>
              <button onClick={() => useConfigStore.setState({ layoutWarnings: layoutWarnings.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-gray-700 shrink-0 text-base leading-none">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pointer-events-none">
        <button onClick={() => setStep("style")}
          className="pointer-events-auto bg-white/90 backdrop-blur-sm text-gray-600 text-xs font-semibold rounded-full px-3 py-1.5 shadow-sm border border-gray-100">
          ← Inapoi
        </button>
        <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow-sm border border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">Total estimat</p>
          <p className="text-lg font-semibold text-gray-900">
            {(totalPrice ?? 0).toLocaleString("ro-RO")} <span className="text-xs font-normal text-gray-400">RON</span>
          </p>
        </div>
      </div>

      <div className="absolute right-4 bottom-48 flex flex-col gap-2">
        <button onClick={() => setShow2D(true)}
          className="bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 text-xs font-semibold px-3 h-11">
          Modifica
        </button>
        {layout === "l-shape" && (
          <button onClick={() => setWallBCabs(v => !v)}
            className={["w-11 h-11 backdrop-blur-sm rounded-full shadow-sm border flex items-center justify-center text-xs font-semibold transition-colors",
              wallBCabs ? "bg-gray-900 text-white border-gray-900" : "bg-white/90 text-gray-600 border-gray-100"].join(" ")}>
            B
          </button>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <button onClick={() => setShowSheet(v => !v)}
          className="w-full flex flex-col items-center gap-1 pt-2 pb-1">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </button>
        <div className={["bg-white transition-all duration-300 overflow-hidden border-t border-gray-100",
          showSheet ? "max-h-[55vh]" : "max-h-[120px]"].join(" ")}>
          <div className="flex border-b border-gray-100 px-4">
            {([
              { id: "colors",   label: "Culori" },
              { id: "cabinets", label: "Dulapuri" },
              { id: "list",     label: "Lista" },
            ] as const).map(tab => (
              <button key={tab.id}
                onClick={() => { setSheetTab(tab.id); setShowSheet(true); }}
                className={["flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors",
                  sheetTab === tab.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400"].join(" ")}>
                {tab.label}
              </button>
            ))}
          </div>

          {sheetTab === "colors" && (
            <div className="px-4 py-3 space-y-4 overflow-y-auto max-h-[40vh]">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Finisaj</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {COLORWAYS.map((cw) => (
                    <button key={cw.id} onClick={() => setColorway(cw)} title={cw.name}
                      className={["shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all",
                        colorway.id === cw.id ? "border-gray-900" : "border-transparent hover:border-gray-200"].join(" ")}>
                      <div className="flex gap-0.5">
                        <div className="w-5 h-8 rounded-l" style={{ background: cw.doorHex }} />
                        <div className="w-2.5 h-8 rounded-r" style={{ background: cw.worktopHex }} />
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{cw.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Manere</p>
                <div className="grid grid-cols-2 gap-2">
                  {HANDLES.map((h) => (
                    <button key={h.id}
                      onClick={() => setColorway({ ...colorway, handle: h.id as "inox" | "negru-mat", handleHex: h.id === "inox" ? "#C0C0C0" : "#1C1C1A" })}
                      className={["py-2.5 text-sm rounded-xl border font-semibold transition-all",
                        colorway.handle === h.id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"].join(" ")}>
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pb-2">
                <button onClick={() => setStep("cart")} className="py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">
                  Adauga in cos →
                </button>
                <button onClick={() => setPdfModalOpen(true)} disabled={exporting}
                  className="py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
                  {exporting ? "PDF…" : "Salveaza PDF"}
                </button>
              </div>
            </div>
          )}

          {sheetTab === "cabinets" && (
            <div className="overflow-y-auto max-h-[40vh] px-4 py-4 flex flex-col items-center justify-center gap-3">
              <p className="text-xs text-gray-400 text-center">Adaugati sau eliminati dulapuri din configurare.</p>
              <button onClick={() => { setShow2D(true); setShowSheet(false); }}
                className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">
                Modifica configurarea →
              </button>
            </div>
          )}

          {sheetTab === "list" && (
            <div className="overflow-y-auto max-h-[40vh] px-4 py-3">
              <div className="space-y-2">
                {visibleCabinets.map((cab, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{cab.label ?? cab.sku}</p>
                      <p className="text-[10px] text-gray-400">{cab.width}×{cab.height}×{cab.depth} cm · Perete {cab.wall}</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-600">{cab.price.toLocaleString("ro-RO")} RON</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2 flex justify-between">
                  <span className="text-sm font-semibold text-gray-900">Total</span>
                  <span className="text-sm font-semibold text-gray-900">{(totalPrice ?? 0).toLocaleString("ro-RO")} RON</span>
                </div>
              </div>
            </div>
          )}

          {!showSheet && (
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="flex gap-1 overflow-x-auto">
                {COLORWAYS.slice(0,6).map((cw) => (
                  <button key={cw.id} onClick={() => setColorway(cw)}
                    className={["shrink-0 w-8 h-8 rounded-lg border-2 transition-all",
                      colorway.id === cw.id ? "border-gray-900" : "border-transparent"].join(" ")}
                    style={{ background: cw.doorHex }} />
                ))}
              </div>
              <div className="ml-auto">
                <button onClick={() => setStep("cart")}
                  className="bg-gray-900 text-white text-xs font-semibold rounded-xl px-4 py-2">
                  In cos →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {show2D && (
        <div className="absolute inset-0 bg-white z-50 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Modifica configurarea</h2>
            <button onClick={() => setShow2D(false)} className="text-gray-400 text-2xl leading-none">×</button>
          </div>
          <div className="px-4 py-4">
            <CabinetEditor />
          </div>
        </div>
      )}

      {pdfModalOpen && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Salveaza PDF</h2>
            <p className="text-xs text-gray-400">Completati datele pentru a genera oferta.</p>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-900"
              placeholder="Numele tau"
              value={pdfName}
              onChange={e => setPdfName(e.target.value)}
            />
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-900"
              type="email"
              placeholder="Email"
              value={pdfEmail}
              onChange={e => setPdfEmail(e.target.value)}
            />
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-900"
              type="tel"
              placeholder="Telefon"
              value={pdfPhone}
              onChange={e => setPdfPhone(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setPdfModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
                Anuleaza
              </button>
              <button
                disabled={!pdfName || !pdfEmail || !pdfPhone || exporting}
                onClick={async () => {
                  setPdfModalOpen(false);
                  fetch("/api/pdf/notify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: pdfName, email: pdfEmail, phone: pdfPhone, totalPrice }),
                  }).catch(() => {});
                  await handleExportPDF(pdfName, pdfEmail, pdfPhone);
                }}
                className="flex-[2] py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40">
                {exporting ? "PDF…" : "Genereaza PDF →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewerSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-400">Se genereaza bucataria…</p>
      </div>
    </div>
  );
}

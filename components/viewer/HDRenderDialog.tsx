"use client";
import React, { useEffect, useRef, useState } from "react";
import type { KitchenCorner } from "@/lib/render/exportCameras";
import type { Scene } from "three";
import { HD_PRESETS, renderKitchenHD, hdRenderKey, type HDAngle, type HDSettings, type HDImage } from "@/lib/render/hdRender";

interface Props {
  scene: Scene; corner?: KitchenCorner; rightCorner: boolean; expectedCabinets: number; onClose: () => void;
  target: "png" | "pptx"; settings: HDSettings; onSettings: (settings: HDSettings) => void;
  images: Record<string, HDImage>; onImage: (key: string, image: HDImage) => void;
  onPPTX: (images: HDImage[]) => Promise<boolean | undefined>;
}
export default function HDRenderDialog({ scene, corner, rightCorner, expectedCabinets, onClose, target, settings, onSettings, images, onImage, onPPTX }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [preset, setPreset] = useState<keyof typeof HD_PRESETS>("hd");
  const [angle, setAngle] = useState<HDAngle>(rightCorner ? "right" : "left");
  const [busy, setBusy] = useState(false);
  const [samples, setSamples] = useState(0);
  const [viewIndex, setViewIndex] = useState(0);
  const [error, setError] = useState("");
  const [download, setDownload] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const pptx = target === "pptx";
  const viewAngles: HDAngle[] = pptx ? [rightCorner ? "right" : "left", rightCorner ? "left" : "right", "front"] : [angle];
  const totalSamples = settings.samples;
  const cachedViews = viewAngles.filter(a => images[hdRenderKey(a, preset, settings)]).length;
  useEffect(() => () => controller.current?.abort(), []);
  const close = () => { controller.current?.abort(); onClose(); };
  const start = async () => {
    if (!canvas.current || controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(""); setDownload(null); setSamples(0); setViewIndex(0); setCancelled(false);
    try {
      const results: HDImage[] = [];
      for (let i = 0; i < viewAngles.length; i++) {
        if (abort.signal.aborted) throw new DOMException("Anulat", "AbortError");
        setViewIndex(i); setSamples(0);
        const view = viewAngles[i];
        const key = hdRenderKey(view, preset, settings);
        let image = images[key];
        if (!image) {
          const blob = await renderKitchenHD({ source: scene, corner, expectedCabinets, preview: canvas.current, angle: view, preset, settings, signal: abort.signal, onProgress: value => setSamples(value) });
          if (abort.signal.aborted) throw new DOMException("Anulat", "AbortError");
          image = { label: view === "front" ? (corner ? "Randare HD - perspectiva centrala" : "Randare HD - frontal") : `Randare HD - perspectiva ${view === "left" ? 1 : 2}`, dataUrl: await blobDataUrl(blob), aspect: HD_PRESETS[preset].height / HD_PRESETS[preset].width };
          if (abort.signal.aborted) throw new DOMException("Anulat", "AbortError");
          onImage(key, image);
        }
        results.push(image);
        setSamples(totalSamples);
        if (!pptx) setDownload(image.dataUrl);
      }
      if (pptx && !abort.signal.aborted) {
        const success = await onPPTX(results);
        if (success) onClose();
        else setError("PowerPoint nu a putut fi creat. Randarile finalizate sunt pastrate; puteti incerca din nou.");
      }
    } catch (e) {
      if (abort.signal.aborted) setCancelled(true);
      else setError(e instanceof Error ? e.message : "Randarea HD a esuat.");
    } finally { controller.current = null; setBusy(false); }
  };
  const change = () => { setSamples(0); setDownload(null); setCancelled(false); setError(""); };
  const adjust = (next: Partial<HDSettings>) => { onSettings({ ...settings, ...next }); change(); };
  const progress = (viewIndex * totalSamples + samples) / (viewAngles.length * totalSamples) * 100;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="hd-title">
    <div className="max-h-[95svh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between gap-4"><h2 id="hd-title" className="text-lg font-semibold">{pptx ? "PowerPoint cu randari HD" : "Export randare HD"}</h2><button onClick={close} aria-label="Inchide randarea HD" className="rounded-lg border px-3 py-2">Inchide</button></div>
      <p className="mt-2 text-sm text-gray-600">{pptx ? "Trei vederi HD vor fi incluse in prezentare. Randarile deja generate pentru aceeasi configuratie si aceleasi setari sunt reutilizate." : "Imagine PNG a configuratiei actuale, cu reflexii si lumina calculata progresiv."} Pastrati fila activa in timpul randarii.</p>
      <div className="my-4 flex flex-wrap gap-4">
        <label className="text-sm">Rezolutie<select aria-label="Rezolutie HD" disabled={busy} value={preset} onChange={e => { setPreset(e.target.value as keyof typeof HD_PRESETS); change(); }} className="ml-2 rounded-lg border p-2">{Object.entries(HD_PRESETS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}</select></label>
        {!pptx && <label className="text-sm">Unghi<select aria-label="Unghi randare" disabled={busy} value={angle} onChange={e => { setAngle(e.target.value as HDAngle); change(); }} className="ml-2 rounded-lg border p-2"><option value="left">Perspectiva 1</option><option value="right">Perspectiva 2</option><option value="front">{corner ? "Perspectiva centrala" : "Frontal"}</option></select></label>}
        <label className="text-sm">Calitate<select aria-label="Calitate randare" disabled={busy} value={settings.samples} onChange={e => adjust({ samples: Number(e.target.value) })} className="ml-2 rounded-lg border p-2"><option value={32}>Rapida · 32 mostre</option><option value={128}>Echilibrata · 128 mostre</option><option value={256}>Fina · 256 mostre</option></select></label>
      </div>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Expunere: {settings.exposure.toFixed(1)}<input aria-label="Expunere randare" type="range" min="0.6" max="1.8" step="0.1" disabled={busy} value={settings.exposure} onChange={e => adjust({ exposure: Number(e.target.value) })} className="mt-2 block w-full" /><span className="text-xs text-gray-500">Luminozitatea imaginii finale</span></label>
        <label className="text-sm">Intensitate lumina: {settings.lighting.toFixed(1)}<input aria-label="Intensitate lumina randare" type="range" min="0.5" max="1.5" step="0.1" disabled={busy} value={settings.lighting} onChange={e => adjust({ lighting: Number(e.target.value) })} className="mt-2 block w-full" /><span className="text-xs text-gray-500">Puterea luminii care ilumineaza corpurile</span></label>
      </div>
      <p className="mb-3 text-xs text-gray-500">Pentru probe: Full HD + Rapida. Pentru imaginea finala: Echilibrata sau Fina. Modificarea setarilor necesita o noua randare.{cachedViews > 0 && ` ${cachedViews}/${viewAngles.length} vederi sunt deja pregatite.`}</p>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-100"><canvas ref={canvas} className={`h-full w-full object-contain ${download ? "hidden" : samples >= 4 ? "" : "invisible"}`} />{download && <img src={download} alt="Randare HD finalizata" className="h-full w-full object-contain" />}{!download && samples < 4 && <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm text-gray-500">{busy ? "Pregatim scena si primele mostre…" : "Apasati Genereaza HD pentru previzualizare."}</div>}</div>
      <div role="status" className="mt-3 text-sm text-gray-600">{busy ? `${pptx ? `Vedere ${viewIndex + 1}/${viewAngles.length} · ` : ""}Randare: ${Math.min(100, Math.floor(progress))}% · ${samples}/${totalSamples} mostre` : download ? "Randare finalizata. Imaginea este pregatita pentru descarcare." : cancelled ? "Randare anulata. Vederile finalizate sunt pastrate." : ""}</div>
      {busy && <progress aria-label="Progres randare HD" value={progress} max={100} className="mt-2 w-full" />}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-3">{busy ? <button onClick={() => controller.current?.abort()} className="rounded-xl border px-4 py-3 text-sm font-semibold">Anuleaza randarea</button> : <button onClick={start} className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white">{pptx ? "Genereaza HD + PowerPoint" : download ? "Genereaza din nou" : "Genereaza HD"}</button>}
      {download && <a href={download} download={`ASAB-Randare-${preset}-${angle}.png`} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">Descarca PNG</a>}</div>
    </div>
  </div>;
}
function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Imaginea HD nu a putut fi citita.")); reader.readAsDataURL(blob); });
}

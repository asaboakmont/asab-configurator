"use client";
import React from "react"
import { Suspense, useState } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import { COLORWAYS, HANDLE_OPTIONS, WORKTOP_OPTIONS } from "@/data/colorways";
import type { Cabinet, RoomConstraints, WallSide } from "@/types/kitchen";
import dynamic from "next/dynamic";
import { exportKitchenPDF } from "@/lib/pdf/exportPDF";
import { BASE_CABINETS, TALL_CABINETS, WALL_CABINETS, applyCollectionToCabinet, applyCollectionToCabinets } from "@/data/skus";
import type { SkuDefinition } from "@/data/skus";
import { calcTotalPrice } from "@/lib/rules/resolver";
import { getSkuByCode } from "@/data/skus";

const KitchenScene = dynamic(() => import("./KitchenScene"), { ssr: false });
type RenderCameraPreset = "interactive" | "NW" | "NE" | "TOP";
type CabinetLayer = "wall" | "ground";

interface GapAddTarget {
  id: string;
  wall: WallSide;
  layer: CabinetLayer;
  start: number;
  end: number;
  cabinets: Cabinet[];
}

export default function StepViewer() {
  const { cabinets, totalPrice, colorway, layout, dimensions, constraints, collection, roomFinishes, devConstraintsUnlocked, setColorway, setStep, layoutWarnings } = useConfigStore();
  const [showHints,    setShowHints]    = useState(true);
  const [exporting,    setExporting]    = useState(false);
  const [finishPicker, setFinishPicker] = useState<"doors" | "worktop" | "handles" | null>(null);
  const [show2D,       setShow2D]       = useState(false);
  const [editWall,     setEditWall]     = useState<WallSide>("A");
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfName,      setPdfName]      = useState("");
  const [pdfEmail,     setPdfEmail]     = useState("");
  const [pdfPhone,     setPdfPhone]     = useState("");
  const [renderPreset, setRenderPreset] = useState<RenderCameraPreset>("interactive");
  const [selectedCabinetKey, setSelectedCabinetKey] = useState<string | null>(null);
  const [addPickerTargetId, setAddPickerTargetId] = useState<string | null>(null);

  const editableWalls = getEditableWalls(cabinets);
  const activeConstraints = devConstraintsUnlocked ? constraints : undefined;
  const visibleCabinets = show2D
    ? cabinets.filter((cabinet) => cabinet.wall === editWall)
    : cabinets;
  const visibleConstraints = show2D
    ? filterConstraintsForWall(activeConstraints, editWall)
    : activeConstraints;

  React.useEffect(() => {
    if (!show2D) {
      setSelectedCabinetKey(null);
      setAddPickerTargetId(null);
    }
  }, [show2D]);

  React.useEffect(() => {
    if (selectedCabinetKey && !visibleCabinets.some((cabinet) => cabinetKey(cabinet) === selectedCabinetKey)) {
      setSelectedCabinetKey(null);
    }
  }, [selectedCabinetKey, visibleCabinets]);

  React.useEffect(() => {
    setAddPickerTargetId(null);
  }, [selectedCabinetKey, editWall]);

  function commitCabinets(newCabinets: Cabinet[], nextSelectedCabinet?: Cabinet | null) {
    const collectionResult = applyCollectionToCabinets(newCabinets, collection);
    const { discounted, original } = calcTotalPrice(collectionResult, dimensions.wallA, dimensions.wallB, layout);
    useConfigStore.setState({ cabinets: collectionResult, totalPrice: discounted, originalPrice: original });

    if (nextSelectedCabinet === null) {
      setSelectedCabinetKey(null);
    } else if (nextSelectedCabinet) {
      const updatedCabinet = collectionResult.find((cabinet) => cabinetKey(cabinet) === cabinetKey(nextSelectedCabinet));
      setSelectedCabinetKey(cabinetKey(updatedCabinet ?? nextSelectedCabinet));
    }
  }

  function selectedCabinet(): Cabinet | undefined {
    if (!selectedCabinetKey) return undefined;
    return cabinets.find((cabinet) => cabinetKey(cabinet) === selectedCabinetKey);
  }
  const activeSelectedCabinet = selectedCabinet();

  function removeSelectedCabinet() {
    const cabinet = selectedCabinet();
    if (!cabinet) return;
    commitCabinets(cabinets.filter((item) => cabinetKey(item) !== cabinetKey(cabinet)), null);
  }

  function moveSelectedCabinet(dir: -1 | 1) {
    const cabinet = activeSelectedCabinet;
    if (!cabinet || cabinet.type === "base-corner" || cabinet.type === "wall-corner") return;

    const nudgedCabinet = { ...cabinet, xPos: cabinet.xPos + 5 * dir };
    const nudgedCabinets = cabinets.map((item) => cabinetKey(item) === cabinetKey(cabinet) ? nudgedCabinet : item);
    if (isValidEditorSlot(nudgedCabinet, nudgedCabinet.xPos, nudgedCabinets, dimensions, layout, activeConstraints ?? {})) {
      commitCabinets(nudgedCabinets, nudgedCabinet);
      return;
    }

    const swapped = swapCabinetWithNeighbor(cabinets, cabinet, dir, dimensions, layout, activeConstraints ?? {});
    if (swapped) commitCabinets(swapped.cabinets, swapped.movedCabinet);
  }

  function setSelectedCabinetDoorDirection(doorDirection: "S" | "D") {
    const cabinet = activeSelectedCabinet;
    if (!cabinet || cabinet.type === "base-corner" || cabinet.type === "wall-corner") return;
    const updatedCabinet = { ...cabinet, doorDirection };
    const updatedCabinets = cabinets.map((item) =>
      cabinetKey(item) === cabinetKey(cabinet) ? updatedCabinet : item
    );
    commitCabinets(updatedCabinets, updatedCabinet);
  }

  function cabinetDraftForGap(
    wall: WallSide,
    layer: CabinetLayer,
    start: number,
    sku: SkuDefinition
  ): Cabinet | undefined {
    const draft = applyCollectionToCabinet({
      sku: sku.sku,
      type: sku.type,
      width: sku.width,
      height: sku.height,
      depth: sku.depth,
      wall,
      xPos: start,
      zPos: wall === "I" ? (dimensions.islandDistance ?? 100) + (dimensions.islandDepth ?? 90) / 2 : undefined,
      runSide: wall === "P" ? dimensions.peninsulaSide ?? "right" : undefined,
      price: sku.price,
      label: sku.label,
    }, collection);

    return isValidEditorSlot(draft, draft.xPos, cabinets, dimensions, layout, activeConstraints ?? {})
      ? draft
      : undefined;
  }

  function fittingCabinetsForGap(wall: WallSide, layer: CabinetLayer, start: number, end: number): Cabinet[] {
    const gap = end - start;
    const candidates = layer === "wall"
      ? WALL_CABINETS.filter((sku) => ["wall", "wall-hood"].includes(sku.type))
      : [
          ...BASE_CABINETS.filter((sku) => ["base", "base-sink", "base-oven", "base-drawer", "base-dishwasher", "base-hob"].includes(sku.type)),
          ...TALL_CABINETS,
        ];

    return candidates
      .filter((sku) => sku.width <= gap)
      .map((sku) => cabinetDraftForGap(wall, layer, start, sku))
      .filter((cabinet): cabinet is Cabinet => !!cabinet)
      .sort((a, b) => b.width - a.width || a.price - b.price);
  }

  const gapAddTargets = show2D
    ? findGapAddTargets(cabinets, editWall, dimensions, layout, fittingCabinetsForGap)
    : [];
  const addPickerTarget = gapAddTargets.find((target) => target.id === addPickerTargetId);
  const fittingCabinetsForPicker = addPickerTarget?.cabinets ?? [];
  const selectedCabinetSupportsDoorDirection = !!activeSelectedCabinet && cabinetSupportsDoorDirection(activeSelectedCabinet);

  function openGapCabinetPicker(id: string) {
    setAddPickerTargetId(id);
  }

  function addAdjacentCabinet(draft: Cabinet) {
    commitCabinets([...cabinets, draft], draft);
    setAddPickerTargetId(null);
  }

  const handleExportPDF = async (name = "", email = "", phone = "") => {
    setExporting(true);
    try {
      const screenshots = await capturePdfRenderViews(setRenderPreset);
      let cartUrl: string | undefined;
      try {
        const res = await fetch("/api/shopify/draft-order", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cabinets: visibleCabinets, colorway, handle: colorway.handle, totalPrice, dimensions, layout, constraints: visibleConstraints, collection, roomFinishes, contact: { name, phone, email } }),
        });
        if (res.ok) { const data = await res.json(); cartUrl = data.checkoutUrl; }
      } catch(e) { console.warn("Cart URL failed:", e); }
      await exportKitchenPDF({ cabinets: visibleCabinets, colorway, handle: colorway.handle, totalPrice, layout, dimensions, screenshots, cartUrl, contact: { name, phone, email }, constraints: visibleConstraints, collection, roomFinishes });
    } finally {
      setRenderPreset("interactive");
      setExporting(false);
    }
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
            constraints={visibleConstraints}
            collection={collection}
            roomFinishes={roomFinishes}
            focusWall={show2D ? editWall : null}
            renderPreset={renderPreset}
            editMode={show2D}
            selectedCabinetKey={selectedCabinetKey}
            onCabinetSelect={setSelectedCabinetKey}
            onCabinetDeselect={() => setSelectedCabinetKey(null)}
            onSelectedCabinetMove={moveSelectedCabinet}
            onSelectedCabinetRemove={removeSelectedCabinet}
            gapAddTargets={gapAddTargets}
            onGapAdd={openGapCabinetPicker}
            editableWalls={editableWalls}
            onWallEdit={(wall) => {
              setEditWall(wall);
              setShow2D(true);
              setFinishPicker(null);
            }}
            onExitWallEdit={() => {
              setShow2D(false);
              setSelectedCabinetKey(null);
              setAddPickerTargetId(null);
            }}
          />
        </Suspense>
        {showHints && (
          <GestureHints onDone={() => setShowHints(false)} />
        )}
      </div>

      {!show2D && layoutWarnings && layoutWarnings.length > 0 && (
        <div className="absolute bottom-32 left-4 right-4 z-10">
          {layoutWarnings.map((w, i) => (
            <div key={i} className="bg-white border border-gray-200 text-gray-700 text-xs rounded-xl px-3 py-2 mb-1 shadow-sm flex items-center justify-between gap-2">
              <span>⚠️ {w}</span>
              <button onClick={() => useConfigStore.setState({ layoutWarnings: layoutWarnings.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-gray-700 shrink-0 text-base leading-none">×</button>
            </div>
          ))}
        </div>
      )}

      {!show2D && (
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
      )}

      {!show2D && finishPicker === "handles" && (
        <button
          type="button"
          className="fixed inset-0 z-20 cursor-default bg-transparent"
          aria-label="Inchide selectorul de culori"
          onClick={() => setFinishPicker(null)}
        />
      )}

      {!show2D && (
        <div className="absolute bottom-0 left-0 right-0 z-30">
          {finishPicker && (
            <div className="mx-4 mb-2 rounded-2xl bg-white/95 backdrop-blur-sm border border-gray-100 shadow-xl p-3">
              {finishPicker === "doors" && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {COLORWAYS.map((cw) => (
                    <button
                      key={cw.id}
                      onClick={() => { setColorway({ ...colorway, id: cw.id, name: cw.name, finish: cw.finish, doorHex: cw.doorHex }); setFinishPicker(null); }}
                      className={["shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all",
                        colorway.doorHex === cw.doorHex && colorway.finish === cw.finish ? "border-gray-900" : "border-gray-200"].join(" ")}
                    >
                      <span className="w-8 h-8 rounded-lg border border-black/5" style={{ background: cw.doorHex }} />
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">{cw.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {finishPicker === "worktop" && (
                <div className="grid grid-cols-2 gap-2">
                  {WORKTOP_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => { setColorway({ ...colorway, worktop: option.id, worktopHex: option.hex }); setFinishPicker(null); }}
                      className={["flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
                        colorway.worktop === option.id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"].join(" ")}
                    >
                      <span className="w-5 h-5 rounded border border-black/5" style={{ background: option.hex }} />
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              {finishPicker === "handles" && (
                <div className="space-y-3">
                  <ColorOptionRow
                    label="Culoare manere"
                    options={HANDLE_OPTIONS}
                    selected={colorway.handle}
                    onSelect={(option) =>
                      setColorway({ ...colorway, handle: option.id, handleHex: option.hex })
                    }
                  />
                  <ColorOptionRow
                    label="Culoare plinta"
                    options={HANDLE_OPTIONS}
                    selected={colorway.plinth ?? colorway.handle}
                    onSelect={(option) =>
                      setColorway({ ...colorway, plinth: option.id, plinthHex: option.hex })
                    }
                  />
                </div>
              )}
            </div>
          )}
          <div className="bg-white border-t border-gray-100 px-4 pt-3 pb-4 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <FinishControl label="Culoare usi" swatch={colorway.doorHex} onClick={() => setFinishPicker((value) => value === "doors" ? null : "doors")} />
              <FinishControl label="Culoare blat" swatch={colorway.worktopHex} onClick={() => setFinishPicker((value) => value === "worktop" ? null : "worktop")} />
              <FinishControl label="Culoare maner" swatch={colorway.handleHex} onClick={() => setFinishPicker((value) => value === "handles" ? null : "handles")} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPdfModalOpen(true)} disabled={exporting}
                className="py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
                {exporting ? "PDF..." : "Salveaza PDF"}
              </button>
              <button onClick={() => setStep("cart")} className="py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">
                Verifica proiect
              </button>
            </div>
          </div>
        </div>
      )}

      {show2D && !activeSelectedCabinet && (
        <div className="absolute inset-x-4 bottom-[136px] z-40 flex justify-center">
          <div className="bg-white/95 backdrop-blur-sm border border-gray-100 shadow-xl rounded-full px-4 py-2 text-xs font-semibold text-gray-700">
            Apasati pe un dulap pentru a modifica configuratia
          </div>
        </div>
      )}

      {show2D && activeSelectedCabinet && (
        <div className="absolute inset-x-4 bottom-[118px] z-40 flex justify-center">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-sm border border-gray-100 shadow-xl rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Dulap selectat</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {activeSelectedCabinet.label ?? activeSelectedCabinet.sku}
              </p>
            </div>
            {selectedCabinetSupportsDoorDirection && (
              <div className="shrink-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 text-right">Deschidere</p>
                <div className="flex rounded-xl bg-gray-100 p-1">
                  {([
                    { id: "S", label: "Stanga" },
                    { id: "D", label: "Dreapta" },
                  ] as const).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedCabinetDoorDirection(option.id)}
                      className={[
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                        (activeSelectedCabinet.doorDirection ?? "S") === option.id
                          ? "bg-gray-900 text-white"
                          : "text-gray-500 hover:text-gray-900",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {show2D && (
        <div className="absolute inset-x-0 bottom-0 z-40 bg-white border-t border-gray-100 shadow-2xl">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Modificare perete</p>
                <h2 className="text-base font-semibold text-gray-900">{wallEditTitle(editWall)}</h2>
              </div>
              <button onClick={() => setShow2D(false)}
                className="bg-gray-900 text-white text-xs font-semibold rounded-xl px-4 py-2">
                Inchide
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {editableWalls.map((wall) => (
                <button
                  key={wall.id}
                  onClick={() => { setEditWall(wall.id); setSelectedCabinetKey(null); }}
                  className={["shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold transition-all",
                    editWall === wall.id ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-600"].join(" ")}
                >
                  {wall.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {show2D && addPickerTarget && (
        <div
          className="absolute inset-0 z-50 bg-black/35 flex items-end justify-center p-4"
          onClick={() => setAddPickerTargetId(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Adauga dulap</p>
                <p className="text-sm font-semibold text-gray-900">
                  Spatiu liber {addPickerTarget.start}-{addPickerTarget.end} cm
                </p>
              </div>
              <button
                onClick={() => setAddPickerTargetId(null)}
                className="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="max-h-[42vh] overflow-y-auto divide-y divide-gray-100">
              {fittingCabinetsForPicker.map((cabinet) => (
                <button
                  key={`${cabinet.sku}-${cabinet.width}-${cabinet.type}`}
                  onClick={() => addAdjacentCabinet(cabinet)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cabinet.label ?? cabinet.sku}</p>
                    <p className="text-xs text-gray-400">{cabinet.width} cm latime</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 shrink-0">
                    {(getSkuByCode(cabinet.sku)?.price ?? cabinet.price ?? 0).toLocaleString("ro-RO")} RON
                  </span>
                </button>
              ))}
            </div>
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

function cabinetKey(cabinet: { sku: string; wall: WallSide; xPos: number; type: string }): string {
  return `${cabinet.sku}-${cabinet.wall}-${cabinet.type}-${cabinet.xPos}`;
}

const WALL_CAB_TYPES: Cabinet["type"][] = ["wall", "wall-corner", "wall-hood"];
const TALL_TYPES: Cabinet["type"][] = ["tall", "tall-oven", "tall-fridge"];

function cabinetLayer(cabinet: Cabinet): "wall" | "ground" {
  return WALL_CAB_TYPES.includes(cabinet.type) ? "wall" : "ground";
}

function cabinetSupportsDoorDirection(cabinet: Cabinet): boolean {
  return ![
    "base-corner",
    "wall-corner",
    "base-drawer",
    "base-oven",
    "base-dishwasher",
  ].includes(cabinet.type);
}

function layerCabinets(allCabinets: Cabinet[], cabinet: Cabinet): Cabinet[] {
  return allCabinets
    .filter((item) => item.wall === cabinet.wall && cabinetLayer(item) === cabinetLayer(cabinet))
    .sort((a, b) => a.xPos - b.xPos);
}

function findGapAddTargets(
  allCabinets: Cabinet[],
  wall: WallSide,
  dimensions: any,
  layout: string,
  fittingCabinetsForGap: (wall: WallSide, layer: CabinetLayer, start: number, end: number) => Cabinet[]
): GapAddTarget[] {
  const targets: GapAddTarget[] = [];
  const layers: CabinetLayer[] = wall === "I" ? ["ground"] : ["ground", "wall"];
  for (const layer of layers) {
    const layerItems = allCabinets
      .filter((cabinet) => cabinet.wall === wall && cabinetLayer(cabinet) === layer)
      .sort((a, b) => a.xPos - b.xPos);
    const wallStart = editorWallStart(wall, dimensions, layout);
    const wallEnd = editorWallEnd(wall, dimensions, layout);
    let cursor = wallStart;

    for (const cabinet of layerItems) {
      if (cabinet.xPos > cursor) {
        const candidates = fittingCabinetsForGap(wall, layer, cursor, cabinet.xPos);
        if (candidates.length > 0) {
          targets.push({
            id: `${wall}-${layer}-${cursor}-${cabinet.xPos}`,
            wall,
            layer,
            start: cursor,
            end: cabinet.xPos,
            cabinets: candidates,
          });
        }
      }
      cursor = Math.max(cursor, cabinet.xPos + cabinet.width);
    }

    if (cursor < wallEnd) {
      const candidates = fittingCabinetsForGap(wall, layer, cursor, wallEnd);
      if (candidates.length > 0) {
        targets.push({
          id: `${wall}-${layer}-${cursor}-${wallEnd}`,
          wall,
          layer,
          start: cursor,
          end: wallEnd,
          cabinets: candidates,
        });
      }
    }
  }
  return targets;
}

function editorWallStart(wall: WallSide, dimensions: { cornerSide?: "left" | "right" }, layout: string): number {
  if (wall === "A" && layout === "l-shape" && (dimensions.cornerSide ?? "right") === "right") return 60;
  if ((wall === "B" || wall === "C") && layout === "l-shape") return 100;
  if (wall === "P") return 100;
  return 0;
}

function editorWallEnd(
  wall: WallSide,
  dimensions: { wallA: number; wallB?: number; peninsulaWidth?: number },
  layout: string
): number {
  if (wall === "A") return dimensions.wallA;
  if ((wall === "B" || wall === "C") && layout === "l-shape") return dimensions.wallB ?? 0;
  if (wall === "I") return dimensions.wallA;
  if (wall === "P") return 100 + (dimensions.peninsulaWidth ?? 0);
  return dimensions.wallA;
}

function cabinetYRange(cabinet: Cabinet): [number, number] {
  if (WALL_CAB_TYPES.includes(cabinet.type)) return [146.9, 146.9 + cabinet.height];
  return [0, cabinet.height];
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function verticalOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

function openingYRange(opening: NonNullable<RoomConstraints["openings"]>[number]): [number, number] {
  const sill = opening.type === "window" ? opening.sillHeight ?? 90 : 0;
  return [sill, sill + opening.height];
}

function obstructionYRange(obstruction: NonNullable<RoomConstraints["obstructions"]>[number]): [number, number] {
  const bottom = obstruction.startsFromFloor === false ? obstruction.yPos ?? 0 : 0;
  return [bottom, bottom + obstruction.height];
}

function isValidEditorSlot(
  cabinet: Cabinet,
  xPos: number,
  allCabinets: Cabinet[],
  dimensions: any,
  layout: string,
  constraints: RoomConstraints
): boolean {
  const min = editorWallStart(cabinet.wall, dimensions, layout);
  const max = editorWallEnd(cabinet.wall, dimensions, layout);
  if (xPos < min || xPos + cabinet.width > max) return false;

  const yRange = cabinetYRange(cabinet);
  const layer = cabinetLayer(cabinet);
  const start = xPos;
  const end = xPos + cabinet.width;

  for (const other of allCabinets) {
    if (cabinetKey(other) === cabinetKey(cabinet) || other.wall !== cabinet.wall) continue;
    if (cabinetLayer(other) !== layer) continue;
    if (rangesOverlap(start, end, other.xPos, other.xPos + other.width)) return false;
  }

  if (cabinet.wall === "A" || cabinet.wall === "B" || cabinet.wall === "C") {
    for (const opening of constraints.openings ?? []) {
      if (opening.wall !== cabinet.wall) continue;
      if (!verticalOverlap(yRange, openingYRange(opening))) continue;
      if (rangesOverlap(start, end, opening.xPos, opening.xPos + opening.width)) return false;
    }

    for (const obstruction of constraints.obstructions ?? []) {
      if (obstruction.wall !== cabinet.wall) continue;
      if (!verticalOverlap(yRange, obstructionYRange(obstruction))) continue;
      if (rangesOverlap(start, end, obstruction.xPos, obstruction.xPos + obstruction.width)) return false;
    }

    const boiler = constraints.boiler;
    if (boiler?.wall === cabinet.wall) {
      const boilerY: [number, number] = [146.9, 146.9 + boiler.height];
      if (verticalOverlap(yRange, boilerY)) {
        if (rangesOverlap(start, end, boiler.xPos - boiler.pipeClearance, boiler.xPos + boiler.width + boiler.pipeClearance)) return false;
      }
    }
  }

  if (layer === "wall") {
    for (const other of allCabinets) {
      if (cabinetKey(other) === cabinetKey(cabinet) || other.wall !== cabinet.wall || !TALL_TYPES.includes(other.type)) continue;
      if (rangesOverlap(start, end, other.xPos, other.xPos + other.width)) return false;
    }
  }

  if (TALL_TYPES.includes(cabinet.type)) {
    for (const other of allCabinets) {
      if (cabinetKey(other) === cabinetKey(cabinet) || other.wall !== cabinet.wall || !WALL_CAB_TYPES.includes(other.type)) continue;
      if (rangesOverlap(start, end, other.xPos, other.xPos + other.width)) return false;
    }
  }

  return true;
}

function swapCabinetWithNeighbor(
  cabinets: Cabinet[],
  cabinet: Cabinet,
  dir: -1 | 1,
  dimensions: any,
  layout: string,
  constraints: RoomConstraints
): { cabinets: Cabinet[]; movedCabinet: Cabinet } | undefined {
  if (cabinet.type === "base-corner" || cabinet.type === "wall-corner") return undefined;
  const layer = layerCabinets(cabinets, cabinet);
  const index = layer.findIndex((item) => cabinetKey(item) === cabinetKey(cabinet));
  const neighbor = layer[index + dir];
  if (!neighbor || neighbor.type === "base-corner" || neighbor.type === "wall-corner") return undefined;

  const left = cabinet.xPos <= neighbor.xPos ? cabinet : neighbor;
  const start = left.xPos;
  const swappedCabinet = left === cabinet
    ? { ...cabinet, xPos: start + neighbor.width }
    : { ...cabinet, xPos: start };
  const swappedNeighbor = left === cabinet
    ? { ...neighbor, xPos: start }
    : { ...neighbor, xPos: start + cabinet.width };
  const swappedCabinets = cabinets.map((item) => {
    if (cabinetKey(item) === cabinetKey(cabinet)) return swappedCabinet;
    if (cabinetKey(item) === cabinetKey(neighbor)) return swappedNeighbor;
    return item;
  });

  if (
    isValidEditorSlot(swappedCabinet, swappedCabinet.xPos, swappedCabinets, dimensions, layout, constraints) &&
    isValidEditorSlot(swappedNeighbor, swappedNeighbor.xPos, swappedCabinets, dimensions, layout, constraints)
  ) {
    return { cabinets: swappedCabinets, movedCabinet: swappedCabinet };
  }
  return undefined;
}

function filterConstraintsForWall(
  constraints: RoomConstraints | undefined,
  wall: WallSide
): RoomConstraints | undefined {
  if (!constraints || (wall !== "A" && wall !== "B" && wall !== "C")) return undefined;
  return {
    openings: (constraints.openings ?? []).filter((opening) => opening.wall === wall),
    obstructions: (constraints.obstructions ?? []).filter((obstruction) => obstruction.wall === wall),
    servicePoints: (constraints.servicePoints ?? []).filter((point) => point.wall === wall),
    boiler: constraints.boiler?.wall === wall ? constraints.boiler : undefined,
  };
}

function getEditableWalls(cabinets: { wall: WallSide }[]): { id: WallSide; label: string }[] {
  const order: WallSide[] = ["A", "B", "C", "I", "P"];
  const labels: Record<WallSide, string> = {
    A: "Perete A",
    B: "Perete B",
    C: "Perete C",
    I: "Insula",
    P: "Semi-insula",
  };
  const present = new Set(cabinets.map((cab) => cab.wall));
  const walls = order.filter((wall) => wall === "A" || present.has(wall));
  return walls.map((wall) => ({ id: wall, label: labels[wall] }));
}

function wallEditTitle(wall: WallSide): string {
  const labels: Record<WallSide, string> = {
    A: "Modifica perete A",
    B: "Modifica perete B",
    C: "Modifica perete C",
    I: "Modifica insula",
    P: "Modifica semi-insula",
  };
  return labels[wall];
}

function ColorOptionRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: typeof HANDLE_OPTIONS;
  selected: "inox" | "negru-mat";
  onSelect: (option: (typeof HANDLE_OPTIONS)[number]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option)}
            className={[
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
              selected === option.id
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 text-gray-600",
            ].join(" ")}
          >
            <span
              className="w-5 h-5 rounded border border-black/5"
              style={{ background: option.hex }}
            />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FinishControl({
  label,
  swatch,
  onClick,
}: {
  label: string;
  swatch: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="min-h-[54px] rounded-xl border border-gray-200 px-2 py-2 flex flex-col items-center justify-center gap-1 text-center"
    >
      <span className="w-5 h-5 rounded-full border border-black/10" style={{ background: swatch }} />
      <span className="text-[10px] font-semibold text-gray-600 leading-tight">{label}</span>
    </button>
  );
}

async function capturePdfRenderViews(
  setRenderPreset: React.Dispatch<React.SetStateAction<RenderCameraPreset>>
): Promise<{ label: string; dataUrl: string; aspect: number }[]> {
  const views: { preset: Exclude<RenderCameraPreset, "interactive">; label: string }[] = [
    { preset: "NW", label: "Randare N/V" },
    { preset: "NE", label: "Randare N/E" },
    { preset: "TOP", label: "Plan de sus" },
  ];
  const captures: { label: string; dataUrl: string; aspect: number }[] = [];

  for (const view of views) {
    setRenderPreset(view.preset);
    await waitForRenderFrame(900);
    const captured = captureViewerCanvas();
    if (captured) captures.push({ label: view.label, ...captured });
  }

  setRenderPreset("interactive");
  await waitForRenderFrame(100);
  return captures;
}

function captureViewerCanvas(): { dataUrl: string; aspect: number } | undefined {
  const viewer = document.getElementById("kitchen-viewer");
  const canvas = viewer?.querySelector("canvas") as HTMLCanvasElement | null;
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return undefined;

  try {
    const targetW = 1200;
    const aspect = canvas.height / canvas.width;
    const targetH = Math.round(targetW * aspect);
    const offscreen = document.createElement("canvas");
    offscreen.width = targetW;
    offscreen.height = targetH;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return { dataUrl: canvas.toDataURL("image/png"), aspect };
    ctx.drawImage(canvas, 0, 0, targetW, targetH);
    return { dataUrl: offscreen.toDataURL("image/png"), aspect };
  } catch (error) {
    console.warn("PDF render capture failed:", error);
    return undefined;
  }
}

function waitForRenderFrame(ms: number): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, ms);
      });
    });
  });
}

function GestureHints({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = React.useState<"pinch" | "pan" | "orbit" | "done">("pinch");

  React.useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("pan"),   2500),
      setTimeout(() => setPhase("orbit"), 5000),
      setTimeout(() => setPhase("done"),  7500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  React.useEffect(() => {
    if (phase === "done") onDone();
  }, [phase, onDone]);

  const hints = {
    pinch:  { label: "Apropie 2 degete — zoom" },
    pan:    { label: "2 degete — panoramare" },
    orbit:  { label: "1 deget — rotire" },
  };

  if (phase === "done") return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-black/50 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-8"
        style={{ width: "60vw", height: "60vw", maxWidth: 320, maxHeight: 320 }}>
        
        <div className="relative w-24 h-24 flex items-center justify-center">
          {phase === "pinch" && (
            <>
              <div className="absolute w-5 h-5 bg-white rounded-full shadow-lg" style={{ animation: "pinchDot1 1.2s ease-in-out infinite" }} />
              <div className="absolute w-5 h-5 bg-white rounded-full shadow-lg" style={{ animation: "pinchDot2 1.2s ease-in-out infinite" }} />
            </>
          )}
          {phase === "pan" && (
            <>
              <div className="absolute w-5 h-5 bg-white rounded-full shadow-lg" style={{ top: "25%", left: "50%", transform: "translate(-50%,-50%)", animation: "panDot 1.2s ease-in-out infinite" }} />
              <div className="absolute w-5 h-5 bg-white rounded-full shadow-lg" style={{ top: "75%", left: "50%", transform: "translate(-50%,-50%)", animation: "panDot 1.2s ease-in-out infinite" }} />
            </>
          )}
          {phase === "orbit" && (
            <div className="absolute w-5 h-5 bg-white rounded-full shadow-lg" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)", animation: "orbitDot 1.2s ease-in-out infinite" }} />
          )}
        </div>

        <span className="text-white text-sm font-medium text-center px-4">
          {hints[phase].label}
        </span>

        <div className="flex gap-2">
          {(["pinch","pan","orbit"] as const).map(p => (
            <div key={p} className={["w-2 h-2 rounded-full transition-all",
              phase === p ? "bg-white scale-125" : "bg-white/30"].join(" ")} />
          ))}
        </div>

      </div>
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

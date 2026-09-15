"use client";
import React from "react";
import type { Scene } from "three";
import { downloadKitchenGLB } from "@/lib/asab/exportGLB";
import { Suspense, useState } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import { COLORWAYS, HANDLE_OPTIONS, WORKTOP_OPTIONS } from "@/data/colorways";
import type { Cabinet, RoomConstraints, WallSide } from "@/types/kitchen";
import dynamic from "next/dynamic";
import { exportKitchenPDF } from "@/lib/pdf/exportPDF";
import { ALL_SKUS, toCollectionSku, BASE_CABINETS, TALL_CABINETS, WALL_CABINETS, applyCollectionToCabinet, applyCollectionToCabinets } from "@/data/skus";
import type { SkuDefinition } from "@/data/skus";
import { calcTotalPrice, RULES } from "@/lib/rules/resolver";
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
  const [liveScene, setLiveScene] = useState<Scene | null>(null);
  const [exportingGLB, setExportingGLB] = useState(false);
  const [glbError, setGlbError] = useState("");
  const glbBusy = React.useRef(false);
  const internalRole = useConfigStore((state) => state.internalRole);
  const [desktop, setDesktop] = useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const isInternal = internalRole === "admin" || internalRole === "designer";
  const adminDesktop = isInternal && desktop;
  const glbExportEnabled = internalRole === "admin" || internalRole === "designer";
  const handleExportGLB = async () => {
    if (!glbExportEnabled) return;
    if (!liveScene || glbBusy.current) return;
    glbBusy.current = true;
    setExportingGLB(true);
    setGlbError("");
    try {
      const accessResponse = await fetch("/api/internal/session", { cache: "no-store" });
      const access = await accessResponse.json().catch(() => ({}));
      if (!accessResponse.ok || (access.role !== "admin" && access.role !== "designer")) {
        useConfigStore.getState().setInternalRole(null);
        throw new Error("Sesiunea interna a expirat. Autentificati-va din nou.");
      }
      await downloadKitchenGLB(liveScene);
    }
    catch (error) { setGlbError(error instanceof Error ? error.message : "GLB export failed. Please try again."); }
    finally { glbBusy.current = false; setExportingGLB(false); }
  };
  const { cabinets, totalPrice, colorway, layout, dimensions, constraints, collection, roomFinishes, devConstraintsUnlocked, setColorway, setStep, layoutWarnings } = useConfigStore();
  const [showHints,    setShowHints]    = useState(true);
  const [exporting,    setExporting]    = useState(false);
  const [finishPicker, setFinishPicker] = useState<"doors" | "worktop" | "handles" | null>(null);
  const [show2D,       setShow2D]       = useState(false);
  const [editWall,     setEditWall]     = useState<WallSide>("A");
  const [exportError, setExportError] = useState("");
  const [exportFormat, setExportFormat] = useState<"pdf" | "pptx">("pdf");
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfName,      setPdfName]      = useState("");
  const [pdfEmail,     setPdfEmail]     = useState("");
  const [pdfPhone,     setPdfPhone]     = useState("");
  const [renderPreset, setRenderPreset] = useState<RenderCameraPreset>("interactive");
  const [selectedCabinetKey, setSelectedCabinetKey] = useState<string | null>(null);
  const [customWidthMm, setCustomWidthMm] = useState("");
  const [skuSearch, setSkuSearch] = useState("");
  const [skuCategory, setSkuCategory] = useState("all");
  const [skuNotice, setSkuNotice] = useState("");
  const [addPickerTargetId, setAddPickerTargetId] = useState<string | null>(null);

  const editableWalls = getEditableWalls(cabinets, isInternal);
  const activeConstraints = devConstraintsUnlocked ? constraints : undefined;
  const visibleCabinets = React.useMemo(() => show2D
    ? cabinets.filter((cabinet) => cabinet.wall === editWall)
    : cabinets, [show2D, cabinets, editWall]);
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

  function validEditorSlot(cabinet: Cabinet, xPos: number, allCabinets: Cabinet[], dims: typeof dimensions, activeLayout: string, roomConstraints: RoomConstraints) {
    return isValidEditorSlot(cabinet, xPos, allCabinets, dims, activeLayout, roomConstraints, isInternal);
  }

  function moveSelectedCabinetToWall(wall: WallSide) {
    const cabinet = activeSelectedCabinet;
    if (!isInternal || !cabinet || cabinet.type.includes("corner") || !editableWalls.some(item => item.id === wall)) return;
    if (wall === "I" && cabinet.type.startsWith("wall")) {
      setSkuNotice("Insula nu accepta corpuri suspendate.");
      return;
    }
    const remaining = cabinets.filter(item => cabinetKey(item) !== cabinetKey(cabinet));
    for (let x = editorWallStart(wall, dimensions, layout); x <= editorWallEnd(wall, dimensions, layout) - cabinet.width; x++) {
      const moved: Cabinet = {
        ...cabinet, wall, xPos: x, placementMode: "wall", freePosition: undefined, rotationYDegrees: undefined,
        zPos: wall === "I" ? (dimensions.islandDistance ?? 100) + (dimensions.islandDepth ?? 90) / 2 : undefined,
        runSide: wall === "P" ? dimensions.peninsulaSide ?? "right" : undefined,
      };
      if (!validEditorSlot(moved, x, remaining, dimensions, layout, activeConstraints ?? {})) continue;
      commitCabinets([...remaining, moved], moved);
      setEditWall(wall);
      setSkuNotice(`${moved.sku} mutat pe ${wall}.`);
      return;
    }
    setSkuNotice("Nu exista spatiu liber pe peretele ales. Mutati sau eliminati un corp.");
  }

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

  React.useEffect(() => {
    setCustomWidthMm(activeSelectedCabinet ? String(Math.round(activeSelectedCabinet.width * 10)) : "");
  }, [activeSelectedCabinet]);

  function removeSelectedCabinet() {
    const cabinet = selectedCabinet();
    if (!cabinet) return;
    commitCabinets(cabinets.filter((item) => cabinetKey(item) !== cabinetKey(cabinet)), null);
  }

  function moveSelectedCabinet(dir: -1 | 1) {
    const cabinet = activeSelectedCabinet;
    if (!cabinet || cabinet.type === "base-corner" || cabinet.type === "wall-corner") return;

    if (cabinet.placementMode === "free" && cabinet.freePosition) {
      const moved = {
        ...cabinet,
        freePosition: { ...cabinet.freePosition, x: cabinet.freePosition.x + 5 * dir },
      };
      commitCabinets(cabinets.map((item) => cabinetKey(item) === cabinetKey(cabinet) ? moved : item), moved);
      return;
    }

    const nudgedCabinet = { ...cabinet, xPos: cabinet.xPos + 5 * dir };
    const nudgedCabinets = cabinets.map((item) => cabinetKey(item) === cabinetKey(cabinet) ? nudgedCabinet : item);
    if (validEditorSlot(nudgedCabinet, nudgedCabinet.xPos, nudgedCabinets, dimensions, layout, activeConstraints ?? {})) {
      commitCabinets(nudgedCabinets, nudgedCabinet);
      return;
    }

    const swapped = swapCabinetWithNeighbor(cabinets, cabinet, dir, dimensions, layout, activeConstraints ?? {}, isInternal);
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

  function setSelectedCabinetWidth(widthMm: number) {
    const cabinet = activeSelectedCabinet;
    if (!cabinet || !internalRole || !Number.isFinite(widthMm)) return;
    if (cabinet.type === "base-corner" || cabinet.type === "wall-corner") return;

    const nextWidth = Math.round(widthMm) / 10;
    if (nextWidth < 20 || nextWidth > 120) return;
    const delta = nextWidth - cabinet.width;
    if (Math.abs(delta) < 0.0001) return;

    const standardWidth = cabinet.standardWidth ?? getSkuByCode(cabinet.sku)?.width ?? cabinet.width;
    const resized = { ...cabinet, width: nextWidth, standardWidth, isCustom: nextWidth !== standardWidth };
    const shifted = cabinets.map((item) => {
      if (cabinetKey(item) === cabinetKey(cabinet)) return resized;
      if (
        item.placementMode !== "free" &&
        item.wall === cabinet.wall &&
        cabinetLayer(item) === cabinetLayer(cabinet) &&
        item.xPos > cabinet.xPos
      ) {
        return { ...item, xPos: item.xPos + delta };
      }
      return item;
    });

    const wallEnd = editorWallEnd(cabinet.wall, dimensions, layout);
    const runFits = shifted
      .filter((item) => item.placementMode !== "free" && item.wall === cabinet.wall && cabinetLayer(item) === cabinetLayer(cabinet))
      .every((item) => item.xPos >= editorWallStart(item.wall, dimensions, layout) && item.xPos + item.width <= wallEnd);

    if (!runFits) {
      useConfigStore.setState({
        layoutWarnings: ["Latimea personalizata depaseste spatiul disponibil pe acest perete.", ...layoutWarnings],
      });
      return;
    }

    commitCabinets(shifted, resized);
  }

  function resetSelectedCabinetWidth() {
    const cabinet = activeSelectedCabinet;
    if (!cabinet) return;
    const standardWidth = cabinet.standardWidth ?? getSkuByCode(cabinet.sku)?.width ?? cabinet.width;
    setCustomWidthMm(String(Math.round(standardWidth * 10)));
    setSelectedCabinetWidth(standardWidth * 10);
  }

  function setSelectedCabinetPlacementMode(mode: "wall" | "free") {
    const cabinet = activeSelectedCabinet;
    if (!cabinet || !internalRole || cabinet.placementMode === mode) return;

    if (mode === "free") {
      const transform = wallCabinetCenter(cabinet, dimensions.wallA);
      const updated = {
        ...cabinet,
        placementMode: "free" as const,
        freePosition: { x: transform.x, z: transform.z },
        rotationYDegrees: transform.rotationYDegrees,
      };
      commitCabinets(cabinets.map((item) => cabinetKey(item) === cabinetKey(cabinet) ? updated : item), updated);
      return;
    }

    const updated = { ...cabinet, placementMode: "wall" as const };
    const candidates = cabinets.map((item) => cabinetKey(item) === cabinetKey(cabinet) ? updated : item);
    if (!validEditorSlot(updated, updated.xPos, candidates, dimensions, layout, activeConstraints ?? {})) {
      useConfigStore.setState({
        layoutWarnings: ["Pozitia initiala de perete este ocupata. Mutati celelalte corpuri inainte de revenirea la Wall.", ...layoutWarnings],
      });
      return;
    }
    commitCabinets(candidates, updated);
  }

  function updateSelectedFreePlacement(patch: { x?: number; z?: number; rotationYDegrees?: 0 | 90 | 180 | 270 }) {
    const cabinet = activeSelectedCabinet;
    if (!cabinet || !internalRole || cabinet.placementMode !== "free" || !cabinet.freePosition) return;
    const updated = {
      ...cabinet,
      freePosition: {
        x: patch.x ?? cabinet.freePosition.x,
        z: patch.z ?? cabinet.freePosition.z,
      },
      rotationYDegrees: patch.rotationYDegrees ?? cabinet.rotationYDegrees ?? 0,
    };
    commitCabinets(cabinets.map((item) => cabinetKey(item) === cabinetKey(cabinet) ? updated : item), updated);
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

    return validEditorSlot(draft, draft.xPos, cabinets, dimensions, layout, activeConstraints ?? {})
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

  function insertCatalogueSku(sku: SkuDefinition, replace = false) {
    if (!isInternal) return;
    const old = replace ? activeSelectedCabinet : undefined;
    const wall = old?.wall ?? editWall;
    const remaining = old ? cabinets.filter(c => cabinetKey(c) !== cabinetKey(old)) : cabinets;
    const draft = applyCollectionToCabinet({
      id: old?.id ?? crypto.randomUUID(), sku: sku.sku, type: sku.type,
      width: sku.width, height: sku.height, depth: sku.depth, label: sku.label, price: sku.price,
      wall, xPos: old?.xPos ?? editorWallStart(wall, dimensions, layout), cornerSide: sku.cornerSide,
      zPos: wall === "I" ? (dimensions.islandDistance ?? 100) + (dimensions.islandDepth ?? 90) / 2 : undefined,
      runSide: wall === "P" ? dimensions.peninsulaSide ?? "right" : undefined,
      ...(old?.placementMode === "free" ? { placementMode: old.placementMode, freePosition: old.freePosition, rotationYDegrees: old.rotationYDegrees } : {}),
    }, collection);
    if (sku.type.includes("corner") && (!old || old.type !== sku.type)) {
      setSkuNotice("Corpurile de colt se inlocuiesc selectand un colt existent."); return;
    }
    if (wall === "I" && sku.type.startsWith("wall")) { setSkuNotice("Insula nu accepta corpuri suspendate."); return; }
    let placed: Cabinet | undefined;
    const start = old ? old.xPos : editorWallStart(wall, dimensions, layout);
    const end = old ? start : editorWallEnd(wall, dimensions, layout) - sku.width;
    for (let x = start; x <= end; x += 1) {
      const candidate = { ...draft, xPos: x };
      if (candidate.placementMode === "free" || validEditorSlot(candidate, x, [...remaining, candidate], dimensions, layout, activeConstraints ?? {})) { placed = candidate; break; }
    }
    if (!placed) { setSkuNotice("Nu exista spatiu suficient. Alegeti alt perete, un corp mai ingust sau inlocuiti un corp selectat."); return; }
    commitCabinets([...remaining, placed], placed);
    setEditWall(wall); setShow2D(true); setFinishPicker(null);
    setSkuNotice(`${placed.sku} ${replace ? "inlocuit" : "adaugat"}.`);
  }
  const catalogueMatches = ALL_SKUS.filter(sku => {
    const category = sku.type.startsWith("wall") ? "wall" : sku.type.startsWith("tall") ? "tall" : "base";
    const term = skuSearch.trim().toLocaleLowerCase();
    return (skuCategory === "all" || skuCategory === category) &&
      `${toCollectionSku(sku.sku, collection)} ${sku.label} ${sku.width * 10}`.toLocaleLowerCase().includes(term);
  });

  const worktopPreviewStyle = (worktop: { hex: string; texture?: string }) =>
    worktop.texture
      ? {
          backgroundColor: worktop.hex,
          backgroundImage: `url('${worktop.texture}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { background: worktop.hex };

  const handleExportPDF = async (name = "", email = "", phone = "", format = exportFormat) => {
    setExporting(true);
    setExportError("");
    try {
      const screenshots = await capturePdfRenderViews(setRenderPreset);
      if (format === "pptx") {
        if (!isInternal) throw new Error("Autentificare interna necesara pentru export PowerPoint.");
        const { exportKitchenPPTX } = await import("@/lib/pptx/exportPPTX");
        await exportKitchenPPTX({ cabinets, colorway, handle: colorway.handle, totalPrice, layout, dimensions, screenshots, contact: { name, email, phone }, collection, roomFinishes });
        return;
      }
      let cartUrl: string | undefined;
      try {
        const res = await fetch("/api/shopify/draft-order", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cabinets: visibleCabinets,
            colorway,
            handle: colorway.handle,
            totalPrice,
            dimensions,
            layout,
            constraints: visibleConstraints,
            collection,
            roomFinishes,
            contact: { name, phone, email },
            previewImage: screenshots[0]?.dataUrl,
          }),
        });
        if (res.ok) { const data = await res.json(); cartUrl = data.checkoutUrl; }
      } catch(e) { console.warn("Cart URL failed:", e); }
      await exportKitchenPDF({ includeCabinetTotal: isInternal, cabinets: visibleCabinets, colorway, handle: colorway.handle, totalPrice, layout, dimensions, screenshots, cartUrl, contact: { name, phone, email }, constraints: visibleConstraints, collection, roomFinishes });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Exportul nu a reusit. Incercati din nou.");
    } finally {
      setRenderPreset("interactive");
      setExporting(false);
    }
  };

  return (
    <div className={adminDesktop ? "relative admin-desktop-viewer" : "relative"} style={{ height: "100svh", marginLeft: "-1rem", marginRight: "-1rem", marginTop: "-1rem" }}>
      <div
        key={adminDesktop ? "admin-scene" : visibleCabinets.length + "-" + visibleCabinets.reduce((s,c) => s + c.width, 0)}
        id="kitchen-viewer"
        className="absolute inset-0 bg-gray-50"
      >
        <Suspense fallback={<ViewerSkeleton />}>
          <KitchenScene
            adminDesktop={adminDesktop}
            onSceneReady={setLiveScene}
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
            onSelectedCabinetMove={adminDesktop ? undefined : moveSelectedCabinet}
            onSelectedCabinetRemove={adminDesktop ? undefined : removeSelectedCabinet}
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
        {showHints && !adminDesktop && (
          <GestureHints onDone={() => setShowHints(false)} />
        )}
      </div>

      <div className={adminDesktop ? "admin-inspector" : "contents"}>
      {isInternal && !show2D && (
        <div className={adminDesktop ? "space-y-2" : "absolute top-16 right-4 z-40"}>
          <button disabled={exporting} onClick={() => { setExportFormat("pptx"); void handleExportPDF("", "", "", "pptx"); }} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50">{exporting ? "Se exporta…" : "Salveaza PowerPoint"}</button>
        </div>
      )}
      {exportError && <div role="alert" className="absolute top-28 inset-x-4 z-50 rounded-xl bg-red-50 p-3 text-sm text-red-700">{exportError}</div>}
      {isInternal && (
        <details className={adminDesktop ? "admin-sku-picker" : "absolute top-28 right-4 z-40 w-80 max-h-[60vh] overflow-auto rounded-xl bg-white p-3 shadow-lg"} open={adminDesktop}>
          <summary className="cursor-pointer text-sm font-semibold">Catalog {collection} · Adauga corp</summary>
          <div className="space-y-3 pt-3">
            <label className="block text-xs">Perete
              <select value={editWall} onChange={e => { setEditWall(e.target.value as WallSide); setSelectedCabinetKey(null); }} className="mt-1 w-full rounded-lg border p-2">
                {editableWalls.map(wall => <option key={wall.id} value={wall.id}>{wall.label}</option>)}
              </select>
            </label>
            <input aria-label="Cauta SKU sau denumire" placeholder="SKU, denumire sau latime (mm)" value={skuSearch} onChange={e => setSkuSearch(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
            <select aria-label="Tip corp" value={skuCategory} onChange={e => setSkuCategory(e.target.value)} className="w-full rounded-lg border p-2 text-sm">
              <option value="all">Toate corpurile</option><option value="base">Corpuri inferioare</option><option value="wall">Suspendate</option><option value="tall">Coloane</option>
            </select>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {catalogueMatches.map(sku => <div key={sku.sku} className="rounded-lg border p-2 text-xs space-y-1">
                <p className="font-semibold">{toCollectionSku(sku.sku, collection)}</p><p>{sku.label}</p>
                <p className="text-gray-500">{sku.width * 10} × {sku.height * 10} × {sku.depth * 10} mm · {getSkuByCode(toCollectionSku(sku.sku, collection))?.price.toLocaleString("ro-RO")} RON</p>
                <div className="flex gap-2 pt-1"><button onClick={() => insertCatalogueSku(sku)} className="rounded border px-2 py-1">Adauga</button>
                  {activeSelectedCabinet && <button onClick={() => insertCatalogueSku(sku, true)} className="rounded border px-2 py-1">Inlocuieste selectia</button>}
                </div>
              </div>)}
              {!catalogueMatches.length && <p className="text-xs text-gray-500">Niciun SKU gasit.</p>}
            </div>
            {skuNotice && <p role="status" className="text-xs text-gray-600">{skuNotice}</p>}
          </div>
        </details>
      )}
      {adminDesktop && (
        <div className="space-y-3">
          <h1 className="text-lg font-semibold">Editor bucatarie</h1>
          <p className="text-xs text-gray-500">Selectati un perete, apoi un corp pentru modificare.</p>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border px-3 py-2 text-xs" onClick={() => setShow2D(false)}>Vedere 3D</button>
            {editableWalls.map(wall => <button key={wall.id} className="rounded-lg border px-3 py-2 text-xs" onClick={() => { setEditWall(wall.id); setShow2D(true); setSelectedCabinetKey(null); }}>{wall.label}</button>)}
          </div>
          {activeSelectedCabinet && <div className="flex gap-2">
            <button className="rounded-lg border px-3 py-2 text-xs" onClick={() => moveSelectedCabinet(-1)}>← Muta</button>
            <button className="rounded-lg border px-3 py-2 text-xs" onClick={() => moveSelectedCabinet(1)}>Muta →</button>
            <button className="rounded-lg border px-3 py-2 text-xs text-red-700" onClick={removeSelectedCabinet}>Sterge</button>
          </div>}
        </div>
      )}
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
                      <span className="w-5 h-5 rounded border border-black/5" style={worktopPreviewStyle(option)} />
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
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Bucatarie gata asamblata</p>
              <p className="mt-0.5 text-xs leading-relaxed text-emerald-900">
                Corpurile vin deja asamblate, doar trebuie puse pe pozitie.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <FinishControl label="Culoare usi" swatch={colorway.doorHex} onClick={() => setFinishPicker((value) => value === "doors" ? null : "doors")} />
              <FinishControl label="Culoare blat" swatch={colorway.worktopHex} onClick={() => setFinishPicker((value) => value === "worktop" ? null : "worktop")} />
              <FinishControl label="Culoare maner" swatch={colorway.handleHex} onClick={() => setFinishPicker((value) => value === "handles" ? null : "handles")} />
            </div>
            {glbExportEnabled && (
              <>
                <button type="button" onClick={handleExportGLB} disabled={!liveScene || exportingGLB || exporting}
                  className="w-full py-3 rounded-xl border border-gray-900 text-sm font-semibold text-gray-900 disabled:opacity-50">
                  {exportingGLB ? "Exporting GLB…" : "Export GLB"}
                </button>
                {glbError && <p role="alert" className="text-sm text-red-600">{glbError}</p>}
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setExportFormat("pdf"); if (glbExportEnabled) void handleExportPDF("", "", "", "pdf"); else setPdfModalOpen(true); }} disabled={exporting}
                className="py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
                {exporting ? "PDF..." : "Salveaza PDF"}
              </button>
              <button onClick={() => setStep("cart")} className="py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">
                Afla pretul
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
          <div className="w-full max-w-md max-h-[55vh] overflow-y-auto bg-white/95 backdrop-blur-sm border border-gray-100 shadow-xl rounded-2xl px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
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
            {internalRole && !["base-corner", "wall-corner"].includes(activeSelectedCabinet.type) && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <label className="block text-xs font-semibold text-gray-600">
                  Muta pe perete
                  <select aria-label="Muta corpul pe perete" value={activeSelectedCabinet.wall}
                    onChange={event => moveSelectedCabinetToWall(event.target.value as WallSide)}
                    className="mt-1 w-full rounded-lg border border-gray-200 p-2">
                    {editableWalls.map(wall => <option key={wall.id} value={wall.id}>{wall.label}</option>)}
                  </select>
                </label>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Placement</p>
                  <div className="flex rounded-xl bg-gray-100 p-1">
                    {(["wall", "free"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSelectedCabinetPlacementMode(mode)}
                        className={[
                          "rounded-lg px-3 py-1.5 text-xs font-semibold",
                          (activeSelectedCabinet.placementMode ?? "wall") === mode ? "bg-gray-900 text-white" : "text-gray-500",
                        ].join(" ")}
                      >
                        {mode === "wall" ? "Wall" : "Free"}
                      </button>
                    ))}
                  </div>
                </div>
                {activeSelectedCabinet.placementMode === "free" && activeSelectedCabinet.freePosition && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <FreePositionInput
                        label="Position X"
                        valueCm={activeSelectedCabinet.freePosition.x}
                        onChange={(x) => updateSelectedFreePlacement({ x })}
                      />
                      <FreePositionInput
                        label="Position Z"
                        valueCm={activeSelectedCabinet.freePosition.z}
                        onChange={(z) => updateSelectedFreePlacement({ z })}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {([0, 90, 180, 270] as const).map((rotationYDegrees) => (
                        <button
                          key={rotationYDegrees}
                          type="button"
                          onClick={() => updateSelectedFreePlacement({ rotationYDegrees })}
                          className={[
                            "rounded-lg border px-2 py-1.5 text-xs font-semibold",
                            (activeSelectedCabinet.rotationYDegrees ?? 0) === rotationYDegrees
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 text-gray-500",
                          ].join(" ")}
                        >
                          {rotationYDegrees}°
                        </button>
                      ))}
                    </div>
                    {freePlacementWarnings(activeSelectedCabinet, cabinets, dimensions, activeConstraints ?? {}).map((warning) => (
                      <p key={warning} className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-800">{warning}</p>
                    ))}
                  </>
                )}
              </div>
            )}
            {internalRole && !["base-corner", "wall-corner"].includes(activeSelectedCabinet.type) && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Custom dimensions</p>
                    <p className="text-xs text-gray-500">Standard: {Math.round((activeSelectedCabinet.standardWidth ?? activeSelectedCabinet.width) * 10)} mm</p>
                  </div>
                  <button type="button" onClick={resetSelectedCabinetWidth} className="text-xs font-semibold text-gray-500 underline underline-offset-2">
                    Reset la standard
                  </button>
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">Latime</span>
                  <input
                    type="number"
                    min={200}
                    max={1200}
                    step={1}
                    value={customWidthMm}
                    onChange={(event) => {
                      setCustomWidthMm(event.target.value);
                      const value = Number(event.target.value);
                      if (value >= 200 && value <= 1200) setSelectedCabinetWidth(value);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-gray-900"
                  />
                  <span className="text-xs text-gray-500">mm</span>
                </label>
                {activeSelectedCabinet.customPriceBreakdown && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-gray-50 p-3 text-[11px]">
                    <span className="text-gray-500">Pret standard</span><span className="text-right font-semibold">{activeSelectedCabinet.customPriceBreakdown.standardPrice.toLocaleString("ro-RO")} RON</span>
                    <span className="text-gray-500">Ajustare dimensiune</span><span className="text-right font-semibold">{formatSignedRon(activeSelectedCabinet.customPriceBreakdown.dimensionalAdjustment)}</span>
                    <span className="text-gray-500">Suprataxa productie</span><span className="text-right font-semibold">{formatSignedRon(activeSelectedCabinet.customPriceBreakdown.customSurcharge)}</span>
                    <span className="font-bold text-gray-900">Pret custom</span><span className="text-right font-bold text-gray-900">{activeSelectedCabinet.customPriceBreakdown.finalPrice.toLocaleString("ro-RO")} RON</span>
                  </div>
                )}
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

      </div>

      {pdfModalOpen && !glbExportEnabled && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-900">{exportFormat === "pptx" ? "Salveaza PowerPoint" : "Salveaza PDF"}</h2>
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
                  if (exportFormat === "pdf") fetch("/api/pdf/notify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: pdfName, email: pdfEmail, phone: pdfPhone, totalPrice }),
                  }).catch(() => {});
                  await handleExportPDF(pdfName, pdfEmail, pdfPhone);
                }}
                className="flex-[2] py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40">
                {exporting ? "Se exporta…" : exportFormat === "pptx" ? "Genereaza PPTX →" : "Genereaza PDF →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cabinetKey(cabinet: { id?: string; sku: string; wall: WallSide; xPos: number; type: string }): string {
  return cabinet.id ?? `${cabinet.sku}-${cabinet.wall}-${cabinet.type}-${cabinet.xPos}`;
}

function formatSignedRon(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("ro-RO")} RON`;
}

function wallCabinetCenter(cabinet: Cabinet, wallA: number): { x: number; z: number; rotationYDegrees: 0 | 90 | 180 | 270 } {
  const isWall = WALL_CAB_TYPES.includes(cabinet.type);
  const isTall = TALL_TYPES.includes(cabinet.type);
  const wallDepth = isWall ? RULES.WALL_DEPTH / 2 + 1.5 : isTall ? RULES.BASE_DEPTH / 2 + 2.5 : RULES.BASE_DEPTH / 2 + 5;

  if (cabinet.wall === "B") return { x: wallDepth, z: cabinet.xPos + cabinet.width / 2, rotationYDegrees: 90 };
  if (cabinet.wall === "C") return { x: wallA - wallDepth, z: cabinet.xPos + cabinet.width / 2, rotationYDegrees: 270 };
  if (cabinet.wall === "I") return { x: cabinet.xPos + cabinet.width / 2, z: cabinet.zPos ?? 140, rotationYDegrees: 0 };
  if (cabinet.wall === "P") {
    const left = (cabinet.runSide ?? "right") === "left";
    return { x: left ? wallDepth : wallA - wallDepth, z: cabinet.xPos + cabinet.width / 2, rotationYDegrees: left ? 90 : 270 };
  }
  return { x: cabinet.xPos + cabinet.width / 2, z: wallDepth, rotationYDegrees: 0 };
}

function freePlacementWarnings(
  cabinet: Cabinet,
  cabinets: Cabinet[],
  dimensions: { wallA: number; wallB?: number },
  constraints: RoomConstraints
): string[] {
  if (cabinet.placementMode !== "free" || !cabinet.freePosition) return [];
  const warnings: string[] = [];
  const footprint = cabinetFootprint(cabinet, dimensions.wallA);
  const roomDepth = dimensions.wallB ?? 220;
  if (
    footprint.minX < 0 || footprint.maxX > dimensions.wallA ||
    footprint.minZ < 0 || footprint.maxZ > roomDepth
  ) {
    warnings.push("Corpul depaseste limitele camerei.");
  }

  const overlapsCabinet = cabinets.some((other) =>
    cabinetKey(other) !== cabinetKey(cabinet) &&
    cabinetLayer(other) === cabinetLayer(cabinet) &&
    footprintsOverlap(footprint, cabinetFootprint(other, dimensions.wallA))
  );
  if (overlapsCabinet) warnings.push("Corpul se suprapune cu un alt corp.");

  const obstructionOverlap = (constraints.obstructions ?? []).some((obstruction) => {
    const depth = Math.max(4, obstruction.depth);
    const obstructionFootprint = obstruction.wall === "A"
      ? { minX: obstruction.xPos, maxX: obstruction.xPos + obstruction.width, minZ: 0, maxZ: depth }
      : obstruction.wall === "B"
        ? { minX: 0, maxX: depth, minZ: obstruction.xPos, maxZ: obstruction.xPos + obstruction.width }
        : { minX: dimensions.wallA - depth, maxX: dimensions.wallA, minZ: obstruction.xPos, maxZ: obstruction.xPos + obstruction.width };
    return footprintsOverlap(footprint, obstructionFootprint);
  });
  if (obstructionOverlap) warnings.push("Corpul intersecteaza o obstructie structurala.");
  return warnings;
}

function cabinetFootprint(cabinet: Cabinet, wallA: number) {
  const center = cabinet.placementMode === "free" && cabinet.freePosition
    ? { ...cabinet.freePosition, rotationYDegrees: cabinet.rotationYDegrees ?? 0 }
    : wallCabinetCenter(cabinet, wallA);
  const quarterTurn = center.rotationYDegrees === 90 || center.rotationYDegrees === 270;
  const sizeX = quarterTurn ? cabinet.depth : cabinet.width;
  const sizeZ = quarterTurn ? cabinet.width : cabinet.depth;
  return {
    minX: center.x - sizeX / 2,
    maxX: center.x + sizeX / 2,
    minZ: center.z - sizeZ / 2,
    maxZ: center.z + sizeZ / 2,
  };
}

function footprintsOverlap(
  a: { minX: number; maxX: number; minZ: number; maxZ: number },
  b: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
}

function FreePositionInput({ label, valueCm, onChange }: { label: string; valueCm: number; onChange: (valueCm: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step={10}
          value={Math.round(valueCm * 10)}
          onChange={(event) => {
            const millimetres = Number(event.target.value);
            if (Number.isFinite(millimetres)) onChange(Math.round(millimetres / 10));
          }}
          className="min-w-0 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold outline-none focus:border-gray-900"
        />
        <span className="text-[10px] text-gray-400">mm</span>
      </div>
    </label>
  );
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
    .filter((item) => item.placementMode !== "free" && item.wall === cabinet.wall && cabinetLayer(item) === cabinetLayer(cabinet))
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
      .filter((cabinet) => cabinet.placementMode !== "free" && cabinet.wall === wall && cabinetLayer(cabinet) === layer)
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
  if (wall === "B" || wall === "C") return layout === "l-shape" ? dimensions.wallB ?? 160 : 220;
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
  constraints: RoomConstraints,
  checkAcrossWalls = false
): boolean {
  const min = editorWallStart(cabinet.wall, dimensions, layout);
  const max = editorWallEnd(cabinet.wall, dimensions, layout);
  if (xPos < min || xPos + cabinet.width > max) return false;

  const yRange = cabinetYRange(cabinet);
  if (checkAcrossWalls) {
    const footprint = cabinetFootprint({ ...cabinet, xPos }, dimensions.wallA);
    for (const other of allCabinets) {
      if (cabinetKey(other) === cabinetKey(cabinet)) continue;
      if (other.wall === cabinet.wall && other.placementMode !== "free") continue;
      if (verticalOverlap(yRange, cabinetYRange(other)) && footprintsOverlap(footprint, cabinetFootprint(other, dimensions.wallA))) return false;
    }
  }
  const layer = cabinetLayer(cabinet);
  const start = xPos;
  const end = xPos + cabinet.width;

  for (const other of allCabinets) {
    if (other.placementMode === "free") continue;
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
      if (other.placementMode === "free") continue;
      if (cabinetKey(other) === cabinetKey(cabinet) || other.wall !== cabinet.wall || !TALL_TYPES.includes(other.type)) continue;
      if (rangesOverlap(start, end, other.xPos, other.xPos + other.width)) return false;
    }
  }

  if (TALL_TYPES.includes(cabinet.type)) {
    for (const other of allCabinets) {
      if (other.placementMode === "free") continue;
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
  constraints: RoomConstraints,
  checkAcrossWalls = false
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
    isValidEditorSlot(swappedCabinet, swappedCabinet.xPos, swappedCabinets, dimensions, layout, constraints, checkAcrossWalls) &&
    isValidEditorSlot(swappedNeighbor, swappedNeighbor.xPos, swappedCabinets, dimensions, layout, constraints, checkAcrossWalls)
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

function getEditableWalls(cabinets: { wall: WallSide }[], internal = false): { id: WallSide; label: string }[] {
  const order: WallSide[] = ["A", "B", "C", "I", "P"];
  const labels: Record<WallSide, string> = {
    A: "Perete A",
    B: "Perete B",
    C: "Perete C",
    I: "Insula",
    P: "Semi-insula",
  };
  const present = new Set(cabinets.map((cab) => cab.wall));
  const walls = order.filter((wall) => wall === "A" || (internal && (wall === "B" || wall === "C")) || present.has(wall));
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

"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import type {
  Boiler,
  Obstruction,
  ObstructionType,
  Opening,
  ServicePoint,
  ServicePointType,
} from "@/types/kitchen";

const WALLS = ["A", "B", "C"] as const;

const OBSTRUCTION_TYPES: { value: ObstructionType; label: string }[] = [
  { value: "vertical-pipe-box", label: "Ghena / masca tevi" },
  { value: "exposed-pipe", label: "Teava aparenta" },
  { value: "radiator", label: "Calorifer" },
  { value: "beam", label: "Grinda" },
  { value: "column", label: "Stalp" },
  { value: "other", label: "Alt obstacol" },
];

const SERVICE_POINT_TYPES: { value: ServicePointType; label: string }[] = [
  { value: "water-pipe", label: "Apa" },
  { value: "drain", label: "Scurgere" },
  { value: "gas", label: "Gaz" },
  { value: "electrical-outlet", label: "Priza" },
  { value: "hood-vent", label: "Evacuare hota" },
  { value: "dishwasher-water-drain", label: "Apa/scurgere masina vase" },
  { value: "oven-electrical", label: "Priza cuptor" },
  { value: "fridge-electrical", label: "Priza frigider" },
];

export default function StepConstraints() {
  const {
    constraints,
    dimensions,
    addOpening,
    updateOpening,
    removeOpening,
    addObstruction,
    updateObstruction,
    removeObstruction,
    addServicePoint,
    updateServicePoint,
    removeServicePoint,
    setBoiler,
    setStep,
  } = useConfigStore();

  const windows = useMemo(
    () => (constraints.openings ?? []).filter((opening) => opening.type === "window"),
    [constraints.openings]
  );
  const doors = useMemo(
    () => (constraints.openings ?? []).filter((opening) => opening.type === "door"),
    [constraints.openings]
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 4 din 11</p>
        <h1 className="text-2xl font-semibold text-gray-900">Camera & instalatii</h1>
        <p className="text-sm text-gray-400 mt-1">
          Adauga ferestre, usi, gheuri, puncte tehnice si centrala pentru verificarea proiectului.
        </p>
      </div>

      <ConstraintGroup title="Ferestre" actionLabel="+ Adauga fereastra" onAdd={() => addOpening("window")}>
        {windows.map((opening) => (
          <OpeningEditor
            key={opening.id}
            opening={opening}
            wallLength={wallLength(opening.wall, dimensions)}
            roomHeight={dimensions.height}
            onChange={(patch) => updateOpening(opening.id, patch)}
            onDelete={() => removeOpening(opening.id)}
          />
        ))}
      </ConstraintGroup>

      <ConstraintGroup title="Usi" actionLabel="+ Adauga usa" onAdd={() => addOpening("door")}>
        {doors.map((opening) => (
          <OpeningEditor
            key={opening.id}
            opening={opening}
            wallLength={wallLength(opening.wall, dimensions)}
            roomHeight={dimensions.height}
            onChange={(patch) => updateOpening(opening.id, patch)}
            onDelete={() => removeOpening(opening.id)}
          />
        ))}
      </ConstraintGroup>

      <ConstraintGroup title="Gheuri & obstacole" actionLabel="+ Adauga obstacol" onAdd={addObstruction}>
        {(constraints.obstructions ?? []).map((obstruction) => (
          <ObstructionEditor
            key={obstruction.id}
            obstruction={obstruction}
            wallLength={wallLength(obstruction.wall, dimensions)}
            roomHeight={dimensions.height}
            onChange={(patch) => updateObstruction(obstruction.id, patch)}
            onDelete={() => removeObstruction(obstruction.id)}
          />
        ))}
      </ConstraintGroup>

      <ConstraintGroup title="Puncte tehnice" actionLabel="+ Adauga punct tehnic" onAdd={addServicePoint}>
        {(constraints.servicePoints ?? []).map((point) => (
          <ServicePointEditor
            key={point.id}
            point={point}
            wallLength={wallLength(point.wall, dimensions)}
            roomHeight={dimensions.height}
            onChange={(patch) => updateServicePoint(point.id, patch)}
            onDelete={() => removeServicePoint(point.id)}
          />
        ))}
      </ConstraintGroup>

      <details open className="border border-gray-200 rounded-xl p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">Centrala termica</summary>
        <div className="mt-3">
          {constraints.boiler ? (
            <BoilerEditor
              boiler={constraints.boiler}
              wallLength={wallLength(constraints.boiler.wall, dimensions)}
              roomHeight={dimensions.height}
              onChange={(patch) => setBoiler({ ...constraints.boiler!, ...patch })}
              onDelete={() => setBoiler(undefined)}
            />
          ) : (
            <button
              onClick={() =>
                setBoiler({
                  id: `boiler-${Date.now()}`,
                  wall: "A",
                  xPos: 50,
                  yPos: 146.9,
                  width: 60,
                  height: 90,
                  depth: 35,
                  pipeClearance: 15,
                })
              }
              className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-500"
            >
              + Adauga centrala
            </button>
          )}
        </div>
      </details>

      <div className="border border-amber-100 bg-amber-50 text-amber-800 rounded-xl px-4 py-3 text-xs leading-relaxed">
        Aceste date nu modifica automat toate corpurile in aceasta etapa. Ele apar in rezumat/PDF si ajuta specialistul ASAB sa valideze proiectul tehnic.
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={() => setStep("dimensions")} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
          ← Inapoi
        </button>
        <button onClick={() => setStep("sink")} className="flex-[2] py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">
          Continua →
        </button>
      </div>
    </div>
  );
}

function ConstraintGroup({
  title,
  actionLabel,
  onAdd,
  children,
}: {
  title: string;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <details open className="border border-gray-200 rounded-xl p-4">
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">{title}</summary>
      <div className="space-y-3 mt-3">
        {children}
        <button onClick={onAdd} className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-500">
          {actionLabel}
        </button>
      </div>
    </details>
  );
}

function OpeningEditor({
  opening,
  wallLength,
  roomHeight,
  onChange,
  onDelete,
}: {
  opening: Opening;
  wallLength: number;
  roomHeight: number;
  onChange: (patch: Partial<Opening>) => void;
  onDelete: () => void;
}) {
  const yPos = opening.type === "window" ? opening.sillHeight ?? 90 : 0;
  const maxX = Math.max(0, wallLength - opening.width);
  const maxY = Math.max(0, roomHeight - opening.height);

  return (
    <div className="grid grid-cols-2 gap-2 border border-gray-100 rounded-xl p-3">
      <div className="col-span-2">
        <WallPlacementPreview
          wallLength={wallLength}
          roomHeight={roomHeight}
          xPos={opening.xPos}
          yPos={yPos}
          width={opening.width}
          height={opening.height}
          kind={opening.type}
          label={opening.type === "window" ? "Fereastra" : "Usa"}
        />
      </div>
      <SelectField label="Perete" value={opening.wall} options={WALLS} onChange={(wall) => onChange({ wall: wall as Opening["wall"] })} />
      <NumberField label="X (cm)" value={opening.xPos} onChange={(xPos) => onChange({ xPos })} />
      <RangeField label="Pozitie pe perete" value={opening.xPos} min={0} max={maxX} onChange={(xPos) => onChange({ xPos })} />
      <NumberField label="Latime" value={opening.width} onChange={(width) => onChange({ width })} />
      <NumberField label="Inaltime" value={opening.height} onChange={(height) => onChange({ height })} />
      {opening.type === "window" ? (
        <>
          <NumberField label="Parapet" value={opening.sillHeight ?? 90} onChange={(sillHeight) => onChange({ sillHeight })} />
          <RangeField label="Inaltime parapet" value={opening.sillHeight ?? 90} min={0} max={maxY} onChange={(sillHeight) => onChange({ sillHeight })} />
        </>
      ) : (
        <SelectField
          label="Deschidere"
          value={opening.openingDirection ?? "inside"}
          options={["left", "right", "inside", "outside"]}
          onChange={(openingDirection) => onChange({ openingDirection: openingDirection as Opening["openingDirection"] })}
        />
      )}
      <TextField label="Note" value={opening.notes ?? ""} onChange={(notes) => onChange({ notes })} />
      <DeleteButton onClick={onDelete} />
    </div>
  );
}

function ObstructionEditor({
  obstruction,
  wallLength,
  roomHeight,
  onChange,
  onDelete,
}: {
  obstruction: Obstruction;
  wallLength: number;
  roomHeight: number;
  onChange: (patch: Partial<Obstruction>) => void;
  onDelete: () => void;
}) {
  const yPos = obstruction.startsFromFloor === false ? obstruction.yPos ?? 0 : 0;
  const maxX = Math.max(0, wallLength - obstruction.width);
  const maxY = Math.max(0, roomHeight - obstruction.height);

  return (
    <div className="grid grid-cols-2 gap-2 border border-gray-100 rounded-xl p-3">
      <div className="col-span-2">
        <WallPlacementPreview
          wallLength={wallLength}
          roomHeight={roomHeight}
          xPos={obstruction.xPos}
          yPos={yPos}
          width={obstruction.width}
          height={obstruction.height}
          kind={obstruction.type}
          label={obstructionLabel(obstruction.type)}
        />
      </div>
      <SelectField label="Perete" value={obstruction.wall} options={WALLS} onChange={(wall) => onChange({ wall: wall as Obstruction["wall"] })} />
      <label className="text-[11px] text-gray-500 flex flex-col gap-1">
        Tip
        <select
          value={obstruction.type}
          onChange={(e) => onChange({ type: e.target.value as ObstructionType })}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-800"
        >
          {OBSTRUCTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>
      <NumberField label="X (cm)" value={obstruction.xPos} onChange={(xPos) => onChange({ xPos })} />
      <RangeField label="Pozitie pe perete" value={obstruction.xPos} min={0} max={maxX} onChange={(xPos) => onChange({ xPos })} />
      <NumberField label="Latime" value={obstruction.width} onChange={(width) => onChange({ width })} />
      <NumberField label="Inaltime" value={obstruction.height} onChange={(height) => onChange({ height })} />
      <NumberField label="Adancime" value={obstruction.depth} onChange={(depth) => onChange({ depth })} />
      <NumberField label="Y de la podea" value={obstruction.yPos ?? 0} onChange={(yPos) => onChange({ yPos, startsFromFloor: yPos === 0 })} />
      <RangeField label="Inaltime de la podea" value={yPos} min={0} max={maxY} onChange={(yPos) => onChange({ yPos, startsFromFloor: yPos === 0 })} />
      <TextField label="Eticheta" value={obstruction.label ?? ""} onChange={(label) => onChange({ label })} />
      <TextField label="Note" value={obstruction.notes ?? ""} onChange={(notes) => onChange({ notes })} />
      <DeleteButton onClick={onDelete} />
    </div>
  );
}

function ServicePointEditor({
  point,
  wallLength,
  roomHeight,
  onChange,
  onDelete,
}: {
  point: ServicePoint;
  wallLength: number;
  roomHeight: number;
  onChange: (patch: Partial<ServicePoint>) => void;
  onDelete: () => void;
}) {
  const maxX = Math.max(0, wallLength);
  const maxY = Math.max(0, roomHeight);

  return (
    <div className="grid grid-cols-2 gap-2 border border-gray-100 rounded-xl p-3">
      <div className="col-span-2">
        <WallPlacementPreview
          wallLength={wallLength}
          roomHeight={roomHeight}
          xPos={point.xPos}
          yPos={point.heightFromFloor}
          width={6}
          height={6}
          kind={point.type}
          label={servicePointLabel(point.type)}
          marker
        />
      </div>
      <label className="text-[11px] text-gray-500 flex flex-col gap-1 col-span-2">
        Tip
        <select
          value={point.type}
          onChange={(e) => onChange({ type: e.target.value as ServicePointType })}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-800"
        >
          {SERVICE_POINT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>
      <SelectField label="Perete" value={point.wall} options={WALLS} onChange={(wall) => onChange({ wall: wall as ServicePoint["wall"] })} />
      <NumberField label="X (cm)" value={point.xPos} onChange={(xPos) => onChange({ xPos })} />
      <RangeField label="Pozitie pe perete" value={point.xPos} min={0} max={maxX} onChange={(xPos) => onChange({ xPos })} />
      <NumberField label="Inaltime" value={point.heightFromFloor} onChange={(heightFromFloor) => onChange({ heightFromFloor })} />
      <RangeField label="Inaltime de la podea" value={point.heightFromFloor} min={0} max={maxY} onChange={(heightFromFloor) => onChange({ heightFromFloor })} />
      <TextField label="Note" value={point.notes ?? ""} onChange={(notes) => onChange({ notes })} />
      <DeleteButton onClick={onDelete} />
    </div>
  );
}

function BoilerEditor({
  boiler,
  wallLength,
  roomHeight,
  onChange,
  onDelete,
}: {
  boiler: Boiler;
  wallLength: number;
  roomHeight: number;
  onChange: (patch: Partial<Boiler>) => void;
  onDelete: () => void;
}) {
  const yPos = boiler.yPos ?? 146.9;
  const maxX = Math.max(0, wallLength - boiler.width);
  const maxY = Math.max(0, roomHeight - boiler.height);

  return (
    <div className="grid grid-cols-2 gap-2 border border-gray-100 rounded-xl p-3">
      <div className="col-span-2">
        <WallPlacementPreview
          wallLength={wallLength}
          roomHeight={roomHeight}
          xPos={boiler.xPos}
          yPos={yPos}
          width={boiler.width}
          height={boiler.height}
          kind="boiler"
          label="Centrala"
        />
      </div>
      <SelectField label="Perete" value={boiler.wall} options={WALLS} onChange={(wall) => onChange({ wall: wall as Boiler["wall"] })} />
      <NumberField label="X (cm)" value={boiler.xPos} onChange={(xPos) => onChange({ xPos })} />
      <RangeField label="Pozitie pe perete" value={boiler.xPos} min={0} max={maxX} onChange={(xPos) => onChange({ xPos })} />
      <NumberField label="Y de la podea" value={yPos} onChange={(nextY) => onChange({ yPos: nextY })} />
      <RangeField label="Inaltime de la podea" value={yPos} min={0} max={maxY} onChange={(nextY) => onChange({ yPos: nextY })} />
      <NumberField label="Latime" value={boiler.width} onChange={(width) => onChange({ width })} />
      <NumberField label="Inaltime" value={boiler.height} onChange={(height) => onChange({ height })} />
      <NumberField label="Adancime" value={boiler.depth} onChange={(depth) => onChange({ depth })} />
      <NumberField label="Spatiu tevi" value={boiler.pipeClearance} onChange={(pipeClearance) => onChange({ pipeClearance })} />
      <TextField label="Note" value={boiler.notes ?? ""} onChange={(notes) => onChange({ notes })} />
      <DeleteButton onClick={onDelete} label="Sterge centrala" />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-[11px] text-gray-500 flex flex-col gap-1">
      {label}
      <input
        type="number"
        min={0}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-800"
      />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const safeMax = Math.max(min, Math.round(max));
  const safeValue = Math.min(safeMax, Math.max(min, Math.round(value)));
  return (
    <label className="col-span-2 text-[11px] text-gray-500 flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <strong className="text-gray-800">{safeValue} cm</strong>
      </span>
      <input
        type="range"
        min={min}
        max={safeMax}
        step={5}
        value={safeValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gray-900"
      />
    </label>
  );
}

function WallPlacementPreview({
  wallLength,
  roomHeight,
  xPos,
  yPos,
  width,
  height,
  kind,
  label,
  marker = false,
}: {
  wallLength: number;
  roomHeight: number;
  xPos: number;
  yPos: number;
  width: number;
  height: number;
  kind: string;
  label: string;
  marker?: boolean;
}) {
  const left = percent(xPos, wallLength);
  const bottom = percent(yPos, roomHeight);
  const boxWidth = marker ? 3.5 : Math.max(3, percent(width, wallLength));
  const boxHeight = marker ? 10 : Math.max(7, percent(height, roomHeight));
  const color = previewColor(kind);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pozitie pe perete</span>
        <span className="text-[11px] text-gray-400">{Math.round(wallLength)} x {Math.round(roomHeight)} cm</span>
      </div>
      <div className="relative h-32 rounded-lg bg-white border border-gray-200 overflow-hidden">
        <div className="absolute left-0 right-0 bottom-[33%] border-t border-dashed border-gray-100" />
        <div className="absolute left-0 right-0 bottom-[61%] border-t border-dashed border-gray-100" />
        <div className="absolute left-2 bottom-2 text-[10px] text-gray-300">podea</div>
        <div
          className="absolute rounded-md border shadow-sm flex items-center justify-center text-[9px] font-semibold text-white text-center px-1 leading-tight"
          style={{
            left: `${Math.min(96, left)}%`,
            bottom: `${Math.min(92, bottom)}%`,
            width: `${boxWidth}%`,
            height: `${boxHeight}%`,
            minWidth: marker ? 18 : 28,
            minHeight: marker ? 18 : 22,
            background: color.background,
            borderColor: color.border,
            transform: marker ? "translate(-50%, 50%)" : undefined,
            borderRadius: marker ? 999 : 8,
          }}
        >
          {marker ? "" : label}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-gray-400">
        <span>X: {Math.round(xPos)} cm</span>
        <span>Y: {Math.round(yPos)} cm</span>
      </div>
    </div>
  );
}

function percent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function previewColor(kind: string): { background: string; border: string } {
  if (kind === "window") return { background: "#93c5fd", border: "#60a5fa" };
  if (kind === "door") return { background: "#c49a6c", border: "#a8794e" };
  if (kind === "radiator") return { background: "#94a3b8", border: "#64748b" };
  if (kind === "boiler") return { background: "#6b7280", border: "#4b5563" };
  if (kind.includes("water") || kind === "drain") return { background: "#2563eb", border: "#1d4ed8" };
  if (kind === "gas") return { background: "#f59e0b", border: "#d97706" };
  if (kind.includes("electrical")) return { background: "#16a34a", border: "#15803d" };
  return { background: "#d95f43", border: "#b94932" };
}

function wallLength(wall: "A" | "B" | "C", dimensions: { wallA: number; wallB?: number }): number {
  if (wall === "A") return dimensions.wallA;
  return dimensions.wallB ?? dimensions.wallA;
}

function obstructionLabel(value: ObstructionType): string {
  return OBSTRUCTION_TYPES.find((type) => type.value === value)?.label ?? "Obstacol";
}

function servicePointLabel(value: ServicePointType): string {
  return SERVICE_POINT_TYPES.find((type) => type.value === value)?.label ?? "Punct tehnic";
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-[11px] text-gray-500 flex flex-col gap-1">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-800"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[11px] text-gray-500 flex flex-col gap-1">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-800">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function DeleteButton({ onClick, label = "Sterge" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="text-xs text-red-500 font-semibold text-left pt-5">
      {label}
    </button>
  );
}

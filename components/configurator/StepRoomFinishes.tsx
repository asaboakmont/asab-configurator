"use client";

import { useConfigStore } from "@/store/configuratorStore";
import { BACKSPLASH_OPTIONS, FLOOR_TEXTURE_OPTIONS, WALL_COLOR_OPTIONS } from "@/data/designCollections";
import type { BacksplashTexture, FloorTexture } from "@/types/kitchen";

export default function StepRoomFinishes() {
  const { roomFinishes, setRoomFinishes, setStep } = useConfigStore();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 2 din 11</p>
        <h1 className="text-2xl font-semibold text-gray-900">Culorile camerei</h1>
        <p className="text-sm text-gray-400 mt-1">
          Alege finisaje orientative pentru pereti, pardoseala si zona dintre blat si corpurile suspendate.
        </p>
      </div>

      <section className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pereti</p>
        <div className="grid grid-cols-2 gap-3">
          {WALL_COLOR_OPTIONS.map((option) => (
            <SwatchButton
              key={option.value}
              label={option.label}
              color={option.value}
              active={roomFinishes.wallColor === option.value}
              onClick={() => setRoomFinishes({ wallColor: option.value })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pardoseala</p>
        <div className="grid grid-cols-2 gap-3">
          {FLOOR_TEXTURE_OPTIONS.map((option) => (
            <SwatchButton
              key={option.id}
              label={option.label}
              color={option.color}
              active={roomFinishes.floorTexture === option.id}
              onClick={() =>
                setRoomFinishes({
                  floorTexture: option.id as FloorTexture,
                  floorColor: option.color,
                })
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Faianta / backsplash</p>
        <div className="grid grid-cols-2 gap-3">
          {BACKSPLASH_OPTIONS.map((option) => (
            <SwatchButton
              key={option.id}
              label={option.label}
              color={option.color}
              active={roomFinishes.backsplashTexture === option.id}
              onClick={() =>
                setRoomFinishes({
                  backsplashTexture: option.id as BacksplashTexture,
                  backsplashColor: option.color,
                })
              }
            />
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="h-20" style={{ background: roomFinishes.wallColor }} />
        <div className="h-10" style={{ background: roomFinishes.backsplashColor }} />
        <div className="h-14" style={{ background: roomFinishes.floorColor }} />
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={() => setStep("collection")} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
          ← Inapoi
        </button>
        <button onClick={() => setStep("dimensions")} className="flex-[2] py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">
          Continua →
        </button>
      </div>
    </div>
  );
}

function SwatchButton({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
        active ? "border-gray-900" : "border-gray-200 hover:border-gray-400",
      ].join(" ")}
    >
      <span className="w-8 h-8 rounded-lg border border-black/10 shrink-0" style={{ background: color }} />
      <span className="text-sm font-semibold text-gray-900">{label}</span>
    </button>
  );
}

"use client";

const ASSEMBLED_KITCHEN_VIDEO_SRC = "/media/gata-asamblata.mp4";

export default function AssembledKitchenVideo() {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
      aria-label="Bucatarie gata asamblata"
    >
      <div className="aspect-[4/3] bg-gray-50">
        <video
          src={ASSEMBLED_KITCHEN_VIDEO_SRC}
          className="h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-label="Animatie cu un corp de bucatarie care iese din cutie si este pus pe pozitie"
        />
      </div>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-sm font-extrabold text-gray-900">Din cutie, direct pe pozitie</p>
      </div>
    </section>
  );
}

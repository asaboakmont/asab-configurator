"use client";
import { useEffect, useState } from 'react';
import type { Cabinet, InternalRole } from '@/types/kitchen';
import { minimumRoomHeightCm } from '@/lib/asab/cabinetPlacement';

export default function InternalRoomHeightControl({ height, cabinets, role, disabled, onApply }: {
  height: number; cabinets: Cabinet[]; role: InternalRole; disabled: boolean; onApply: (height: number) => void;
}) {
  const [draft, setDraft] = useState(String(height));
  const [error, setError] = useState('');
  useEffect(() => { setDraft(String(height)); setError(''); }, [height]);
  return <form className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3" onSubmit={e => {
    e.preventDefault(); const next = Number(draft), minimum = minimumRoomHeightCm(cabinets);
    if (!draft.trim() || !Number.isFinite(next) || next < 200 || next > 400) { setError('Introduceti o inaltime intre 200 si 400 cm.'); return; }
    if (next < minimum) { setError(`Corpurile existente necesita o camera de minimum ${minimum} cm. Mutati sau eliminati corpurile prea inalte.`); return; }
    setError(''); onApply(next);
  }}>
    <p className="text-[10px] font-semibold uppercase text-gray-500">Acces intern: {role === 'admin' ? 'Administrator' : 'Designer'}</p>
    <label className="block text-xs font-semibold">Inaltime camera (cm)
      <input aria-label="Inaltime camera (cm)" type="number" min={200} max={400} step={1} required disabled={disabled} value={draft} onChange={e => setDraft(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
    </label>
    <p className="text-[11px] text-gray-600">SP incepe la 220 cm; un corp de 40 cm necesita minimum 260 cm inaltime libera.</p>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <button type="submit" disabled={disabled || draft === String(height)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">Aplica inaltimea</button>
  </form>;
}

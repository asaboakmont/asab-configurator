"use client";
import { useState } from "react";
import { useConfigStore } from "@/store/configuratorStore";

export default function StepCart() {
  const { cabinets, colorway, totalPrice, dimensions, layout, contact, setContact, setStep } = useConfigStore();
  const [submitting,  setSubmitting]  = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const isValid = contact.name && contact.email && contact.phone;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/shopify/draft-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cabinets, colorway, handle: colorway.handle, totalPrice, dimensions, layout, contact }),
      });
      if (!res.ok) throw new Error("Eroare la creare comanda");
      const data = await res.json();
      setCheckoutUrl(data.checkoutUrl);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "A aparut o eroare. Va rugam incercati din nou.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (checkoutUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
          <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
            <path d="M2 10l7 7L22 2" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Bucataria ta e gata!</h1>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">
            Am creat cosul de cumparaturi. Continuati catre checkout pentru a finaliza comanda.
          </p>
        </div>
        <div className="w-full border border-gray-100 rounded-xl p-4 space-y-2 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Produse</span>
            <span className="font-semibold text-gray-900">{cabinets.length} buc</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Culoare</span>
            <span className="font-semibold text-gray-900">{colorway.name}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
            <span className="text-gray-400">Total estimat</span>
            <span className="font-semibold text-gray-900">{totalPrice.toLocaleString("ro-RO")} RON</span>
          </div>
        </div>
        <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
          className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold text-center block">
          Finalizeaza comanda →
        </a>
        <button onClick={() => setCheckoutUrl(null)} className="text-xs text-gray-400 underline underline-offset-2">
          Inapoi la configurator
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 8 din 8</p>
        <h1 className="text-2xl font-semibold text-gray-900">Date de contact</h1>
        <p className="text-sm text-gray-400 mt-1">Completati datele pentru a crea cosul de cumparaturi.</p>
      </div>

      {/* Order summary */}
      <div className="border border-gray-100 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rezumat comanda</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-semibold text-gray-900">{totalPrice.toLocaleString("ro-RO")} RON</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {cabinets.length} dulapuri · {colorway.name} · {layout === "l-shape" ? "In L" : "Liniara"}
            </p>
          </div>
          <div className="flex gap-1">
            <div className="w-8 h-14 rounded-l-lg border border-gray-100" style={{ background: colorway.doorHex }} />
            <div className="w-4 h-14 rounded-r-lg border border-gray-100" style={{ background: colorway.worktopHex }} />
          </div>
        </div>
      </div>

      {/* Contact form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Nume *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
              placeholder="Popescu Ion"
              value={contact.name}
              onChange={(e) => setContact({ name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Telefon *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
              type="tel" placeholder="07xx xxx xxx"
              value={contact.phone}
              onChange={(e) => setContact({ phone: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Email *</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
            type="email" placeholder="email@exemplu.ro"
            value={contact.email}
            onChange={(e) => setContact({ email: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Oras</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
            placeholder="Bucuresti"
            value={contact.city}
            onChange={(e) => setContact({ city: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Mentiuni</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all resize-none"
            rows={3} placeholder="Ex: prefer livrare saptamana viitoare..."
            value={contact.notes ?? ""}
            onChange={(e) => setContact({ notes: e.target.value })} />
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      <div className="space-y-3 pb-8">
        <button onClick={handleSubmit} disabled={!isValid || submitting}
          className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40 transition-all">
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Se creeaza comanda…
            </span>
          ) : "Creeaza cos de cumparaturi →"}
        </button>
        <button onClick={() => setStep("viewer")}
          className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
          ← Inapoi la previzualizare
        </button>
      </div>
    </div>
  );
}
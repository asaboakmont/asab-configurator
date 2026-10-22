"use client";
import React, { useState } from "react";
export interface ExportCustomer { name: string; phone: string; city: string; }
export default function CustomerDetailsDialog({ initial, format, onConfirm, onClose }: {
  initial: ExportCustomer; format: "pdf" | "pptx";
  onConfirm: (customer: ExportCustomer) => void; onClose: () => void;
}) {
  const [customer, setCustomer] = useState(initial);
  const [error, setError] = useState("");
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="export-customer-title">
    <form className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" onSubmit={event => {
      event.preventDefault();
      const clean = Object.fromEntries(Object.entries(customer).map(([key,value]) => [key,value.replace(/\s+/g," ").trim()])) as unknown as ExportCustomer;
      if (!clean.name || !clean.city || clean.phone.replace(/\D/g,"").length < 6) { setError("Completati numele, localitatea si un numar de telefon valid."); return; }
      onConfirm(clean);
    }}>
      <h2 id="export-customer-title" className="text-lg font-semibold">Date client pentru {format === "pptx" ? "PowerPoint" : "PDF"}</h2>
      <p className="text-sm text-gray-600">Datele vor aparea in documentul exportat.</p>
      <label className="block text-sm">Nume client<input autoFocus required maxLength={80} autoComplete="name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-3" /></label>
      <label className="block text-sm">Telefon<input required type="tel" maxLength={40} autoComplete="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-3" /></label>
      <label className="block text-sm">Localitate / oras<input required maxLength={80} autoComplete="address-level2" value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-3" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 rounded-xl border px-3 py-3 text-sm font-semibold">Anuleaza</button><button type="submit" className="flex-1 rounded-xl bg-gray-900 px-3 py-3 text-sm font-semibold text-white">{format === "pptx" ? "Continua la randari HD" : "Genereaza PDF"}</button></div>
    </form>
  </div>;
}

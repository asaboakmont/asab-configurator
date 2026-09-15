"use client";
import { useEffect, useState } from "react";
import { CATEGORIES, type Catalog, type CatalogProduct } from "@/lib/catalog/schema";
export default function InternalCatalog({ onAdd, admin }: { onAdd: (product: CatalogProduct) => void; admin: boolean }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null), [error, setError] = useState("");
  const [category, setCategory] = useState("all"), [collection, setCollection] = useState("all"), [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/internal/catalog", { cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); if (active) { setCatalog(data); setError(""); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [version]);
  const matches = catalog?.products.filter(p => (category === "all" || p.category === category) && (collection === "all" || p.collectionId === collection) && `${p.sku} ${p.name}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <details className="rounded-xl border bg-white p-3 text-xs"><summary className="cursor-pointer font-semibold">Produse importate</summary><div className="space-y-3 pt-3">
    {admin && <a href="/admin/catalog" target="_blank" rel="noreferrer" className="block underline">Administreaza produse si colectii ↗</a>}
    <button className="underline" onClick={() => setVersion(v => v + 1)}>Reincarca produsele</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <input aria-label="Cauta produse importate" className="w-full rounded border p-2" placeholder="SKU sau denumire" value={search} onChange={e => setSearch(e.target.value)} />
    <select aria-label="Colectie importata" className="w-full rounded border p-2" value={collection} onChange={e => setCollection(e.target.value)}><option value="all">Toate colectiile</option>{catalog?.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <select aria-label="Categorie importata" className="w-full rounded border p-2" value={category} onChange={e => setCategory(e.target.value)}><option value="all">Toate categoriile</option>{Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    <div className="max-h-72 space-y-2 overflow-auto">{matches.map(p => <div key={`${p.collectionId}/${p.sku}`} className="rounded border p-2"><b>{p.sku} · {p.name}</b><p>{p.collectionId} · {p.widthMm} × {p.heightMm} × {p.depthMm} mm</p><p>{p.price.toLocaleString('ro-RO')} RON</p><button className="mt-2 rounded border px-3 py-1 font-semibold" onClick={() => onAdd(p)}>Adauga</button></div>)}{!matches.length && <p className="text-gray-500">Niciun produs activ pentru filtrele alese.</p>}</div>
  </div></details>;
}

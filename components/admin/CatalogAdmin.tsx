"use client";
import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import { CATEGORIES, EMPTY_CATALOG, catalogModelPath, productKey, type Catalog, type CatalogCollection, type CatalogProduct, type ProductCategory } from "@/lib/catalog/schema";
import { productsCSV } from "@/lib/catalog/csv";
import { MAX_GLB_BYTES, validateGLB } from "@/lib/catalog/glb";
const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";
const button = "rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";
const blankProduct = (): CatalogProduct => ({ sku: "", name: "", description: "", collectionId: "japandi", category: "base", widthMm: 600, heightMm: 720, depthMm: 530, price: 0, modelUrl: "", active: false });
async function api(path: string, body?: unknown) {
  const response = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Operatia nu a reusit.");
  return data;
}
function downloadCSV(name: string, products: CatalogProduct[]) {
  const url = URL.createObjectURL(new Blob([productsCSV(products)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function uploadModel(file: File) {
  if (!file.name.toLowerCase().endsWith(".glb") || file.size > MAX_GLB_BYTES) throw new Error("Alegeti un fisier GLB de maxim 50 MB.");
  validateGLB(await file.arrayBuffer());
  const blob = await upload(`catalog/${crypto.randomUUID()}.glb`, file, { access: "private", contentType: "model/gltf-binary", handleUploadUrl: "/api/admin/catalog/upload", multipart: true });
  await api("/api/admin/catalog/assets", { url: blob.url });
  return blob.url;
}
export default function CatalogAdmin({ authorized }: { authorized: boolean }) {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [product, setProduct] = useState<CatalogProduct>(blankProduct);
  const [editing, setEditing] = useState(false);
  const [collection, setCollection] = useState<CatalogCollection>({ id: "", name: "", description: "", active: true });
  const [editingCollection, setEditingCollection] = useState(false);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [csv, setCSV] = useState("");
  const [preview, setPreview] = useState<CatalogProduct[]>([]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    api("/api/admin/catalog").then(data => { if (active) { setCatalog(data); setLoaded(true); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [authorized]);
  async function save(body: object) {
    const next = await api("/api/admin/catalog", { ...body, revision: catalog.revision });
    setCatalog(next); setPreview([]); setMessage("Salvat. Modificarile sunt disponibile in editorul intern.");
  }
  if (!authorized) return <main className="min-h-screen bg-stone-100 px-4 py-16"><form className="mx-auto max-w-sm space-y-5 rounded-2xl bg-white p-6 shadow-sm" onSubmit={event => { event.preventDefault(); void run(async () => { const data = await api("/api/internal/session", { username: "admin", password }); if (data.role !== "admin") throw new Error("Cont admin necesar."); window.location.reload(); }); }}>
    <p className="text-xs uppercase tracking-widest text-stone-500">ASAB • Administrare</p><h1 className="text-2xl font-semibold">Catalog produse</h1><p className="text-sm text-gray-500">Autentificare cu contul admin.</p><label className="block text-sm">Parola admin<input type="password" autoComplete="current-password" required className={input} value={password} onChange={e => setPassword(e.target.value)} /></label><button className={button} disabled={busy}>Autentificare</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<a href="/" className="block text-sm underline">Inapoi la configurator</a>
  </form></main>;
  const matches = catalog.products.filter(p => `${p.sku} ${p.name}`.toLowerCase().includes(filter.toLowerCase()) && (category === "all" || p.category === category) && (collectionFilter === "all" || p.collectionId === collectionFilter));
  return <main className="min-h-screen bg-stone-100 px-4 py-8 text-gray-900"><div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-stone-500">ASAB • Administrare</p><h1 className="mt-1 text-3xl font-semibold">Catalog produse</h1><p className="mt-2 text-sm text-stone-600">Colectii, modele 3D si preturi pentru editorul admin/designer.</p></div><a className="text-sm underline" href="/">Deschide configuratorul</a></header>
    <div aria-live="polite">{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}{message && <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">{message}</p>}{busy && <p className="mt-2 text-sm">Se proceseaza…</p>}</div>
    <div className="flex flex-wrap items-center gap-4 text-sm"><span>{catalog.collections.length} colectii · {catalog.products.length} produse</span><button disabled={busy} className="underline" onClick={() => void run(async () => { setCatalog(await api("/api/admin/catalog")); setLoaded(true); setPreview([]); })}>Reincarca catalogul</button><button disabled={!loaded || busy} className="underline" onClick={() => downloadCSV("asab-catalog.csv", catalog.products)}>Export CSV</button></div>
    {!loaded && <p className="text-sm">Catalogul nu este inca incarcat. Verificati conexiunea de stocare daca apare o eroare.</p>}
    <fieldset disabled={busy || !loaded} className="grid gap-6 lg:grid-cols-3 disabled:opacity-60">
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Colectii</h2>
        <div className="flex flex-wrap gap-2">{catalog.collections.map(c => <button type="button" key={c.id} onClick={() => { setCollection(c); setEditingCollection(true); }} className="rounded-lg border px-3 py-2 text-xs">{c.name}{!c.active && " · inactiva"}</button>)}</div>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => { await save({ action: "collection", collection }); setCollection({ id: "", name: "", description: "", active: true }); setEditingCollection(false); }); }}>
          <label className="block text-sm">ID unic<input required readOnly={editingCollection} pattern="[a-z][a-z0-9-]*" className={input} value={collection.id} onChange={e => setCollection({ ...collection, id: e.target.value })} placeholder="ex. nordic" /></label>
          <label className="block text-sm">Nume<input required className={input} value={collection.name} onChange={e => setCollection({ ...collection, name: e.target.value })} /></label>
          <label className="block text-sm">Descriere<textarea className={input} value={collection.description} onChange={e => setCollection({ ...collection, description: e.target.value })} /></label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={collection.active} onChange={e => setCollection({ ...collection, active: e.target.checked })} />Activa in editorul intern</label>
          <div className="flex gap-3"><button className={button}>Salveaza colectia</button><button type="button" className="text-sm underline" onClick={() => { setCollection({ id: "", name: "", description: "", active: true }); setEditingCollection(false); }}>Colectie noua</button></div>
        </form>
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2"><h2 className="mb-4 text-xl font-semibold">{editing ? "Editeaza produsul" : "Produs nou"}</h2>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void run(async () => { if (!editing && catalog.products.some(p => productKey(p) === productKey(product))) throw new Error("SKU existent. Folositi Editeaza pentru actualizare."); await save({ action: "products", products: [product] }); setEditing(true); }); }}>
          <label className="text-sm">SKU<input required readOnly={editing} className={input} value={product.sku} onChange={e => setProduct({ ...product, sku: e.target.value })} /></label>
          <label className="text-sm">Denumire<input required className={input} value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} /></label>
          <label className="text-sm">Colectie<select disabled={editing} className={input} value={product.collectionId} onChange={e => setProduct({ ...product, collectionId: e.target.value })}>{catalog.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-sm">Categorie<select className={input} value={product.category} onChange={e => setProduct({ ...product, category: e.target.value as ProductCategory })}>{Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {([['widthMm', 'Latime (mm)'], ['heightMm', 'Inaltime (mm)'], ['depthMm', 'Adancime (mm)'], ['price', 'Pret integral (RON)']] as const).map(([key, label]) => <label className="text-sm" key={key}>{label}<input className={input} type="number" required min={key === 'price' ? 0 : 1} max={key === 'price' ? 1000000 : 10000} step={key === 'price' ? .01 : 1} value={product[key]} onChange={e => setProduct({ ...product, [key]: e.target.valueAsNumber })} /></label>)}
          <label className="text-sm sm:col-span-2">Descriere<textarea className={input} value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })} /></label>
          <label className="text-sm sm:col-span-2">Model GLB (maxim 50 MB)<input className={input} type="file" accept=".glb" onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { const url = await uploadModel(file); setProduct(p => ({ ...p, modelUrl: url })); setMessage("GLB verificat. Salvati produsul pentru a pastra asocierea."); }); e.target.value = ""; }} /></label>
          {product.modelUrl && <div className="sm:col-span-2 rounded-lg bg-stone-50 p-3 text-sm"><p>GLB incarcat si verificat.</p><a className="underline" href={catalogModelPath(product.modelUrl)} target="_blank" rel="noreferrer">Descarca modelul</a></div>}
          <p className="text-xs text-gray-500 sm:col-span-2">GLB: Y in sus, fata catre +Z, texturi incluse. Dimensiunile introduse stabilesc dimensiunea in configurator. Modelele sunt private.</p>
          <label className="flex gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={product.active} onChange={e => setProduct({ ...product, active: e.target.checked })} />Activ in editorul intern (necesita GLB)</label>
          <div className="flex gap-3 sm:col-span-2"><button className={button}>Salveaza produsul</button><button className="text-sm underline" type="button" onClick={() => { setProduct(blankProduct()); setEditing(false); }}>Produs nou</button></div>
        </form>
      </section>
    </fieldset>
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Import CSV + modele GLB</h2><p className="text-sm text-gray-600">1. Creati colectiile. 2. Importati CSV cu active=false si modelUrl gol. 3. Incarcati GLB cu numele SKU.glb. 4. Activati produsele. SKU existent in aceeasi colectie va fi actualizat.</p>
      <button className="text-sm underline" onClick={() => downloadCSV("asab-model-import.csv", [{ ...blankProduct(), sku: "DEMO-600", name: "Corp inferior exemplu", price: 800 }])}>Descarca model CSV</button>
      <div className="flex flex-wrap gap-3"><input aria-label="Fisier CSV" type="file" accept=".csv,text/csv" disabled={busy || !loaded} onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { if (file.size > 2_000_000) throw new Error("CSV maxim 2 MB."); const raw = await file.text(); setCSV(raw); setPreview([]); const result = await api("/api/admin/catalog", { action: "csv", csv: raw, preview: true, revision: catalog.revision }); setPreview(result.products); }); e.target.value = ""; }} />
      {preview.length > 0 && <button disabled={busy} className={button} onClick={() => void run(async () => { await save({ action: "csv", csv }); setCSV(""); })}>Importa {preview.length} produse</button>}</div>
      {preview.length > 0 && <div className="max-h-64 overflow-auto rounded-lg border"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">SKU</th><th>Colectie</th><th>Denumire</th><th>Pret</th><th>Operatie</th></tr></thead><tbody>{preview.map(p => <tr key={productKey(p)} className="border-t"><td className="p-2">{p.sku}</td><td>{p.collectionId}</td><td>{p.name}</td><td>{p.price} RON</td><td>{catalog.products.some(old => productKey(old) === productKey(p)) ? 'Actualizare' : 'Produs nou'}</td></tr>)}</tbody></table></div>}
      <div className="border-t pt-4"><label className="block text-sm">Colectie pentru incarcare GLB in lot<select className={input} value={collectionFilter} onChange={e => setCollectionFilter(e.target.value)}><option value="all">Alegeti colectia</option>{catalog.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><input className="mt-3 text-sm" aria-label="Modele GLB in lot" type="file" accept=".glb" multiple disabled={busy || !loaded || collectionFilter === "all"} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (!files.length) return; void run(async () => {
        if (files.length > 50) throw new Error("Maxim 50 fisiere GLB pe lot.");
        const keys = files.map(f => f.name.replace(/\.glb$/i, '').toLowerCase());
        if (new Set(keys).size !== keys.length) throw new Error("Fisiere cu acelasi SKU in lot.");
        for (const key of keys) if (!catalog.products.some(p => p.collectionId === collectionFilter && p.sku.toLowerCase() === key)) throw new Error(`SKU ${key} nu exista in colectia selectata.`);
        let current = catalog;
        for (const file of files) {
          const existing = current.products.find(p => p.collectionId === collectionFilter && p.sku.toLowerCase() === file.name.replace(/\.glb$/i, '').toLowerCase())!;
          setMessage(`Se incarca ${file.name}…`);
          const url = await uploadModel(file);
          current = await api("/api/admin/catalog", { action: "products", products: [{ ...existing, modelUrl: url }], revision: current.revision });
          setCatalog(current);
        }
        setPreview([]); setMessage(`${files.length} modele asociate. Activati produsele cand sunt gata.`);
      }); }} /><p className="mt-2 text-xs text-gray-500">Fiecare fisier reusit este salvat separat; daca un lot se opreste, produsele deja actualizate raman salvate.</p></div>
    </section>
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Produse ({matches.length})</h2><div className="my-4 grid gap-3 sm:grid-cols-3"><input aria-label="Cauta produse" className={input} placeholder="Cauta SKU sau denumire" value={filter} onChange={e => setFilter(e.target.value)} /><select aria-label="Filtreaza categoria" className={input} value={category} onChange={e => setCategory(e.target.value)}><option value="all">Toate categoriile</option>{Object.entries(CATEGORIES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select aria-label="Filtreaza colectia" className={input} value={collectionFilter} onChange={e => setCollectionFilter(e.target.value)}><option value="all">Toate colectiile</option>{catalog.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Produs</th><th>Colectie / categorie</th><th>Dimensiuni (mm)</th><th>Pret RON</th><th>Stare</th><th>Actiuni</th></tr></thead><tbody>{matches.map(p => <tr key={productKey(p)} className="border-b"><td className="p-2"><b>{p.sku}</b><p>{p.name}</p></td><td>{p.collectionId}<p className="text-xs text-gray-500">{CATEGORIES[p.category]}</p></td><td>{p.widthMm} × {p.heightMm} × {p.depthMm}</td><td>{p.price.toLocaleString('ro-RO')}</td><td>{p.active ? 'Activ' : 'Inactiv'}{!p.modelUrl && ' · lipseste GLB'}</td><td className="space-x-3 whitespace-nowrap"><button disabled={busy} className="underline" onClick={() => { setProduct(p); setEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editeaza</button><button disabled={busy} className="underline" onClick={() => void run(() => save({ action: 'products', products: [{ ...p, active: !p.active }] }))}>{p.active ? 'Dezactiveaza' : 'Activeaza'}</button></td></tr>)}</tbody></table>{!matches.length && <p className="py-6 text-sm text-gray-500">Niciun produs. Adaugati un produs sau importati un CSV.</p>}</div>
    </section>
  </div></main>;
}

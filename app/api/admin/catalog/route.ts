import { NextRequest, NextResponse } from "next/server";
import { getInternalRole } from "@/lib/auth/internalSession";
import { mergeProducts, parseCollection } from "@/lib/catalog/schema";
import { parseProductCSV } from "@/lib/catalog/csv";
import { checkAssets, readCatalog, writeCatalog } from "@/lib/catalog/storage";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (getInternalRole(req) !== "admin") return NextResponse.json({ error: "Acces permis doar administratorilor." }, { status: 403 });
  try { return NextResponse.json(await readCatalog(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  if (getInternalRole(req) !== "admin") return NextResponse.json({ error: "Acces permis doar administratorilor." }, { status: 403 });
  try {
    const raw = await req.text();
    if (raw.length > 2_100_000) throw new Error("Cerere prea mare.");
    const body = JSON.parse(raw);
    const catalog = await readCatalog();
    if (!Number.isInteger(body.revision) || body.revision !== catalog.revision) return NextResponse.json({ error: "Catalog modificat. Reincarcati pagina inainte de salvare." }, { status: 409 });
    if (body.action === "collection") {
      const collection = parseCollection(body.collection);
      if (!catalog.collections.some(c => c.id === collection.id) && catalog.collections.length >= 100) throw new Error("Limita: 100 colectii.");
      catalog.collections = [...catalog.collections.filter(c => c.id !== collection.id), collection];
    } else if (body.action === "products" || body.action === "csv") {
      const rows = body.action === "csv" ? parseProductCSV(String(body.csv ?? "")) : body.products;
      if (!Array.isArray(rows)) throw new Error("Lista de produse invalida.");
      const products = mergeProducts(catalog, rows);
      await checkAssets(rows.map((p: { modelUrl?: string }) => p.modelUrl ?? ""));
      catalog.products = products;
      if (body.preview === true) return NextResponse.json({ products: rows, count: rows.length, revision: catalog.revision });
    } else throw new Error("Actiune invalida.");
    return NextResponse.json(await writeCatalog(catalog, body.revision));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

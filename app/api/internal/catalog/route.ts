import { NextRequest, NextResponse } from "next/server";
import { getInternalRole } from "@/lib/auth/internalSession";
import { readCatalog } from "@/lib/catalog/storage";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!getInternalRole(req)) return NextResponse.json({ error: "Autentificare interna necesara." }, { status: 403 });
  try {
    const catalog = await readCatalog();
    const collections = catalog.collections.filter(c => c.active);
    return NextResponse.json({ revision: catalog.revision, collections, products: catalog.products.filter(p => p.active && collections.some(c => c.id === p.collectionId)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 503 }); }
}

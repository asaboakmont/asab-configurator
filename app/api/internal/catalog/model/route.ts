import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getInternalRole } from "@/lib/auth/internalSession";
import { isCatalogModelUrl } from "@/lib/catalog/schema";
import { checkAssets } from "@/lib/catalog/storage";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!getInternalRole(req)) return NextResponse.json({ error: "Autentificare interna necesara." }, { status: 403 });
  try {
    const url = req.nextUrl.searchParams.get("url") ?? "";
    if (!isCatalogModelUrl(url)) throw new Error("Model invalid.");
    await checkAssets([url]);
    const result = await get(new URL(url).pathname.slice(1), { access: "private" });
    if (!result || result.statusCode !== 200 || result.blob.url !== url) return new NextResponse(null, { status: 404 });
    return new NextResponse(result.stream, { headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return NextResponse.json({ error: "Model indisponibil." }, { status: 404 }); }
}

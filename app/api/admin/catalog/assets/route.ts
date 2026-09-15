import { NextRequest, NextResponse } from "next/server";
import { get, head } from "@vercel/blob";
import { getInternalRole } from "@/lib/auth/internalSession";
import { isCatalogModelUrl } from "@/lib/catalog/schema";
import { MAX_GLB_BYTES, validateGLB } from "@/lib/catalog/glb";
import { registerAsset } from "@/lib/catalog/storage";
export async function POST(req: NextRequest) {
  if (getInternalRole(req) !== "admin") return NextResponse.json({ error: "Autorizare admin necesara." }, { status: 403 });
  try {
    const { url } = await req.json();
    if (typeof url !== "string" || !isCatalogModelUrl(url)) throw new Error("URL GLB invalid.");
    // Resolve the pathname in OUR Blob store, rather than trusting a supplied host.
    const blob = await head(new URL(url).pathname.slice(1));
    if (blob.url !== url || blob.size > MAX_GLB_BYTES) throw new Error("GLB nu apartine acestui catalog sau depaseste 50 MB.");
    const response = await get(blob.url, { access: "private", useCache: false });
    if (!response || response.statusCode !== 200) throw new Error("GLB nu poate fi citit pentru verificare.");
    const buffer = await new Response(response.stream).arrayBuffer();
    validateGLB(buffer);
    await registerAsset(blob.url);
    return NextResponse.json({ url: blob.url });
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
}

import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getInternalRole } from "@/lib/auth/internalSession";
import { MAX_GLB_BYTES } from "@/lib/catalog/glb";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as HandleUploadBody;
    // Completion callbacks are authenticated by the Blob SDK, not a browser cookie.
    if (body.type === "blob.generate-client-token" && getInternalRole(req) !== "admin") return NextResponse.json({ error: "Acces permis doar administratorilor." }, { status: 403 });
    const result = await handleUpload({ request: req, body,
      onBeforeGenerateToken: async pathname => {
        if (getInternalRole(req) !== "admin") throw new Error("Autorizare admin necesara.");
        if (!/^catalog\/[a-zA-Z0-9_-]+\.glb$/.test(pathname)) throw new Error("Nume GLB invalid.");
        return { allowedContentTypes: ["model/gltf-binary", "application/octet-stream"], maximumSizeInBytes: MAX_GLB_BYTES, addRandomSuffix: true, allowOverwrite: false };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
}

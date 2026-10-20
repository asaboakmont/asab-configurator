import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ship the blank template with the function as well as the public assets. */
export async function GET() {
  try {
    const template = await readFile(path.join(process.cwd(), "public/templates/asab-designer-quote.pptx"));
    // Stream the 8 MB template instead of exceeding a buffered function response limit.
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= template.byteLength) { controller.close(); return; }
        const end = Math.min(offset + 64 * 1024, template.byteLength);
        controller.enqueue(new Uint8Array(template.subarray(offset, end)));
        offset = end;
      },
    });
    return new NextResponse(body, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": 'inline; filename="asab-designer-quote.pptx"',
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    console.error("PowerPoint template unavailable", error);
    return NextResponse.json({ error: "Sablonul PowerPoint lipseste din versiunea publicata. Redeploy necesar." }, { status: 503 });
  }
}

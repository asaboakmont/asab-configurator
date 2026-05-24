import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 });

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const raw = await redis.get<string>(`preview:${id}`);
  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const base64 = parsed?.base64;
  const mime = parsed?.mime ?? "image/png";
  if (!base64) return NextResponse.json({ error: "Invalid preview" }, { status: 404 });

  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}

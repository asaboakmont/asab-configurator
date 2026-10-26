import { getInternalRole, usesInternalCabinetFeatures } from "@/lib/auth/internalSession";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 });

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const config = await redis.get(`config:${id}`);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let parsed = config;
  try { if (typeof config === 'string') parsed = JSON.parse(config); } catch {}
  if (usesInternalCabinetFeatures(parsed) && !getInternalRole(req)) return NextResponse.json({ error: 'Configuratie disponibila numai pentru admin/designer.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  return NextResponse.json({ config }, { headers: { 'Cache-Control': 'private, no-store' } });
}

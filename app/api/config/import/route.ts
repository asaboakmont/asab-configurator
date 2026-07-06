import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

interface ImportPayload {
  config?: unknown;
  rawConfig?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImportPayload;
    const config = parseConfig(body);

    if (!isRecord(config)) {
      return NextResponse.json({ error: "Configuratia trebuie sa fie un obiect JSON valid." }, { status: 400 });
    }

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!redisUrl || !redisToken) {
      return NextResponse.json({ error: "Serviciul de salvare configuratii nu este configurat." }, { status: 500 });
    }

    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const id = nanoid(10);

    await redis.set(
      `config:${id}`,
      JSON.stringify({
        ...config,
        _lead: {
          name: clean(body.name),
          email: clean(body.email),
          phone: clean(body.phone),
        },
        _source: "manual-old-lead-import",
        _createdAt: new Date().toISOString(),
      }),
      { ex: 2592000 }
    );

    const url = `${getSiteUrl(req)}/?config=${encodeURIComponent(id)}`;
    return NextResponse.json({ id, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nu am putut importa configuratia.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function parseConfig(body: ImportPayload): unknown {
  if (body.config !== undefined) return body.config;

  const rawConfig = clean(body.rawConfig);
  if (!rawConfig) throw new Error("Lipeste JSON-ul configuratiei vechi.");

  try {
    return JSON.parse(rawConfig);
  } catch {
    throw new Error("JSON invalid. Verifica daca ai copiat configuratia completa din email.");
  }
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSiteUrl(req: NextRequest): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  return "https://configurator.asab-design.ro";
}

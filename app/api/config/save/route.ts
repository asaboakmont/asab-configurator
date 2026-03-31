import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const { config, name, email } = await req.json();

  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const id = nanoid(10);
  await redis.set(`config:${id}`, JSON.stringify(config), { ex: 60 * 60 * 24 * 30 });

  const url = `https://configurator.asab-design.ro/?config=${id}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "ASAB Design <configurator@asab-design.ro>",
    to: email,
    subject: "Configuratia ta de bucatarie ASAB Design",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #111;">Buna ziua, ${name}!</h2>
        <p>Configuratia ta de bucatarie a fost salvata. O poti accesa oricand folosind linkul de mai jos:</p>
        <a href="${url}" style="display:inline-block; background:#111; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; margin:16px 0;">
          Vezi configuratia →
        </a>
        <p style="color:#666; font-size:12px;">Linkul este valabil 30 de zile.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:11px;">ASAB Design · asab-design.ro</p>
      </div>
    `,
  });

  return NextResponse.json({ id, url });
}
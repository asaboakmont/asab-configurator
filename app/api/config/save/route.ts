import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const { config, name, email } = await req.json();

    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const id = nanoid(10);

    try {
      await redis.set(`config:${id}`, JSON.stringify({ ...config, _lead: { name, email } }), { ex: 2592000 });
    } catch (redisErr) {
      return NextResponse.json({ error: "Redis failed", detail: String(redisErr) }, { status: 500 });
    }

    const url = `https://configurator.asab-design.ro/?config=${id}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: "ASAB Design <noreply@configurator.asab-design.ro>",
      to: email,
      subject: "Configuratia ta de bucatarie ASAB Design",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111;">Buna ziua, ${name}!</h2>
          <p>Configuratia ta de bucatarie a fost salvata.</p>
          <a href="${url}" style="display:inline-block; background:#111; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; margin:16px 0;">
            Vezi configuratia →
          </a>
          <p style="color:#666; font-size:12px;">Linkul este valabil 30 de zile.</p>
        </div>
      `,
    });

    // Notify owner
    const notifyResend = new Resend(process.env.RESEND_API_KEY);
    await notifyResend.emails.send({
      from: "ASAB Configurator <noreply@configurator.asab-design.ro>",
      to: "asaboakmont@gmail.com",
      subject: `Config salvat: ${name} — ${email}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Config nou salvat</h2>
          <p><strong>Nume:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <a href="${url}" style="display:inline-block; background:#111; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; margin:16px 0;">
            Vezi configuratia →
          </a>
        </div>
      `,
    }).catch(() => {});

    return NextResponse.json({ id, url, emailData: data, emailError: error });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
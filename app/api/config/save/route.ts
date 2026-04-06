import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const { config, name, email, phone } = await req.json();

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
          <p style="color:#333;">Configuratia ta de bucatarie a fost salvata. O poti accesa oricand folosind linkul de mai jos:</p>
          <a href="${url}" style="display:inline-block; background:#111; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; margin:16px 0;">
            Vezi configuratia →
          </a>
          <p style="color:#555; font-size:13px;">💡 Dupa accesarea linkului, puteti salva configuratia ca PDF direct din aplicatie.</p>
          <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />
          <p style="color:#333; font-size:13px;"><strong>Nu esti sigur de material?</strong><br/>Comanda o cutie de mostre cu fronturile si blaturile noastre si vezi cum arata in casa ta.</p>
          <a href="https://asab-design.ro/products/cutie-mostre-fronturi-blaturi-de-bucatarie" style="display:inline-block; background:#fff; color:#111; padding:12px 24px; border-radius:8px; text-decoration:none; margin:8px 0; border:1px solid #111;">
            Comanda cutie mostre →
          </a>
          <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />
          <div style="color:#999; font-size:11px; line-height:1.8;">
            <strong style="color:#555;">ASAB Design</strong><br/>
            <a href="https://www.asab-design.ro" style="color:#999; text-decoration:none;">www.asab-design.ro</a> &nbsp;|&nbsp;
            <a href="mailto:office@asab-design.ro" style="color:#999; text-decoration:none;">office@asab-design.ro</a><br/>
            +40 755 837 264<br/>
            Strada Sfantul Ioan nr. 1, Iasi (Romania)
          </div>
        </div>
      `,
    });

    // Notify owner
    const notifyResend = new Resend(process.env.RESEND_API_KEY);
    await notifyResend.emails.send({
      from: "ASAB Configurator <noreply@configurator.asab-design.ro>",
      to: "asaboakmont@gmail.com",
      subject: `Config salvat: ${name} — ${phone}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Config nou salvat</h2>
          <p><strong>Nume:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Telefon:</strong> ${phone}</p>
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
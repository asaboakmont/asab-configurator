import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { nanoid } from "nanoid";
import {
  getInternalRole,
  usesInternalCabinetFeatures,
} from "@/lib/auth/internalSession";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const internalRole = getInternalRole(req);

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "Client";

    const email =
      typeof body.email === "string"
        ? body.email.trim()
        : "";

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    if (!internalRole && (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !phone
    )) {
      return NextResponse.json(
        { error: "Emailul si telefonul sunt obligatorii." },
        { status: 400 }
      );
    }

    const { config } = body;

    // Configurations using internal/custom cabinet features
    // can only be saved by an authenticated internal user.
    if (
      usesInternalCabinetFeatures(config) &&
      !internalRole
    ) {
      return NextResponse.json(
        {
          error:
            "Autorizare interna necesara pentru configuratii custom.",
        },
        { status: 403 }
      );
    }

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      return NextResponse.json(
        {
          error:
            "Serviciul de salvare configuratii nu este configurat.",
        },
        { status: 500 }
      );
    }

    const { Redis } = await import("@upstash/redis");

    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    const id = nanoid(10);

    try {
      await redis.set(
        `config:${id}`,
        JSON.stringify({
          ...config,
          _lead: {
            name,
            email,
            phone,
          },
        }),
        { ex: 2592000 }
      );
    } catch (redisErr) {
      console.error("Config save failed:", redisErr);

      return NextResponse.json(
        {
          error: "Redis failed",
          detail: String(redisErr),
        },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "https://configurator.asab-design.ro";

    const url = `${siteUrl}/?config=${encodeURIComponent(id)}`;

    // Internal saves need a share link, without creating a customer lead email.
    if (internalRole) return NextResponse.json({ id, url });

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Serviciul de email nu este configurat.",
        },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: "ASAB Design <noreply@configurator.asab-design.ro>",
      to: email,
      subject: "Configuratia ta de bucatarie ASAB Design",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111;">Buna ziua, ${escapeHtml(name)}!</h2>

          <p style="color:#333;">
            Configuratia ta de bucatarie a fost salvata.
            O poti accesa oricand folosind linkul de mai jos:
          </p>

          <a
            href="${escapeHtml(url)}"
            style="display:inline-block; background:#111; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; margin:16px 0;"
          >
            Vezi configuratia →
          </a>

          <p style="color:#555; font-size:13px;">
            💡 Dupa accesarea linkului, puteti salva configuratia ca PDF direct din aplicatie.
          </p>

          <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />

          <p style="color:#333; font-size:13px;">
            <strong>Nu esti sigur de material?</strong><br/>
            Comanda o cutie de mostre cu fronturile si blaturile noastre
            si vezi cum arata in casa ta.
          </p>

          <a
            href="https://asab-design.ro/products/cutie-mostre-fronturi-blaturi-de-bucatarie"
            style="display:inline-block; background:#fff; color:#111; padding:12px 24px; border-radius:8px; text-decoration:none; margin:8px 0; border:1px solid #111;"
          >
            Comanda cutie mostre →
          </a>

          <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />

          <div style="color:#999; font-size:11px; line-height:1.8;">
            <strong style="color:#555;">ASAB Design</strong><br/>

            <a
              href="https://www.asab-design.ro"
              style="color:#999; text-decoration:none;"
            >
              www.asab-design.ro
            </a>
            &nbsp;|&nbsp;

            <a
              href="mailto:office@asab-design.ro"
              style="color:#999; text-decoration:none;"
            >
              office@asab-design.ro
            </a>
            <br/>

            +40 755 837 264<br/>
            Strada Sfantul Ioan nr. 1, Iasi (Romania)
          </div>
        </div>
      `,
    });

    // Notify owner
    await resend.emails
      .send({
        from: "ASAB Configurator <noreply@configurator.asab-design.ro>",
        to: "asaboakmont@gmail.com",
        subject: `Config salvat: ${name} — ${phone}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Config nou salvat</h2>

            <p>
              <strong>Nume:</strong>
              ${escapeHtml(name)}
            </p>

            <p>
              <strong>Email:</strong>
              ${escapeHtml(email)}
            </p>

            <p>
              <strong>Telefon:</strong>
              ${escapeHtml(phone)}
            </p>

            <a
              href="${escapeHtml(url)}"
              style="display:inline-block; background:#111; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; margin:16px 0;"
            >
              Vezi configuratia →
            </a>
          </div>
        `,
      })
      .catch((notifyError) => {
        console.warn(
          "Owner notification failed:",
          notifyError
        );
      });

    return NextResponse.json({
      id,
      url,
      emailData: data,
      emailError: error,
    });
  } catch (err) {
    console.error("Config save failed:", err);

    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
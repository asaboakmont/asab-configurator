import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { nanoid } from "nanoid";

interface TechnicianBookingPayload {
  config?: unknown;
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TechnicianBookingPayload;
    const name = clean(body.name);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const city = clean(body.city);
    const notes = clean(body.notes);

    if (!name || !email || !phone) {
      return NextResponse.json({ error: "Completeaza numele, emailul si telefonul." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Serviciul de email nu este configurat." }, { status: 500 });
    }

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!redisUrl || !redisToken) {
      return NextResponse.json({ error: "Serviciul de salvare configuratii nu este configurat." }, { status: 500 });
    }

    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const configId = nanoid(10);
    const configUrl = `${getSiteUrl(req)}/?config=${encodeURIComponent(configId)}`;

    try {
      await redis.set(
        `config:${configId}`,
        JSON.stringify({
          ...(isRecord(body.config) ? body.config : { value: body.config ?? null }),
          _lead: { name, email, phone, city, notes },
          _source: "designer-price-request",
          _createdAt: new Date().toISOString(),
        }),
        { ex: 2592000 }
      );
    } catch (redisErr) {
      console.error("Technician booking config save failed:", redisErr);
      return NextResponse.json({ error: "Nu am putut salva configuratia pentru designer." }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const configSummary = formatConfig(body.config);
    const ownerEmail = process.env.TECHNICIAN_BOOKING_EMAIL ?? "asaboakmont@gmail.com";
    const showroomMapsUrl = "https://www.google.com/maps/search/?api=1&query=ASAB%20DESIGN%20SHOWROOM";
    const sampleBoxUrl = "https://asab-design.ro/products/cutie-mostre-fronturi-blaturi-de-bucatarie";
    const websiteUrl = "https://asab-design.ro";
    const socialLinks = [
      { label: "Instagram", href: "https://www.instagram.com/" },
      { label: "Facebook", href: "https://www.facebook.com/search/top/?q=ASAB%20Design" },
      { label: "TikTok", href: "https://www.tiktok.com/search?q=ASAB%20Design" },
      { label: "YouTube", href: "https://www.youtube.com/results?search_query=ASAB%20Design" },
    ];
    const socialHtml = socialLinks.map((item) =>
      `<a href="${hrefAttr(item.href)}" style="display:inline-block;margin:0 8px 8px 0;color:#111;text-decoration:none;border:1px solid #ddd;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:700">${escapeHtml(item.label)}</a>`
    ).join("");

    const { error: ownerError } = await resend.emails.send({
      from: "ASAB Configurator <noreply@configurator.asab-design.ro>",
      to: ownerEmail,
      replyTo: email,
      subject: `Cerere pret bucatarie: ${name}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#111;line-height:1.5">
        <div style="background:#fbf6ee;border:1px solid #e7dac8;border-radius:18px;padding:24px;margin-bottom:18px">
          <p style="margin:0 0 8px;color:#80613c;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Lead configurator</p>
          <h2 style="margin:0;font-size:26px;line-height:1.15">Cerere noua pentru pret bucatarie</h2>
          <p style="margin:10px 0 0;color:#555">Clientul a cerut pretul final si consultanta cu un Designer ASAB.</p>
        </div>

        <div style="border:1px solid #eee;border-radius:16px;padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 12px">Date client</h3>
          <p style="margin:6px 0"><strong>Nume:</strong> ${escapeHtml(name)}</p>
          <p style="margin:6px 0"><strong>Email:</strong> <a href="${hrefAttr(`mailto:${email}`)}" style="color:#111">${escapeHtml(email)}</a></p>
          <p style="margin:6px 0"><strong>Telefon:</strong> <a href="${hrefAttr(`tel:${phone}`)}" style="color:#111">${escapeHtml(phone)}</a></p>
          <p style="margin:6px 0"><strong>Oras:</strong> ${escapeHtml(city || "-")}</p>
          <p style="margin:12px 0 0"><strong>Mentiuni:</strong><br>${escapeHtml(notes || "-").replace(/\n/g, "<br>")}</p>
        </div>

        <div style="border:1px solid #e7dac8;background:#fbf6ee;border-radius:16px;padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 8px">Configuratie client</h3>
          <p style="margin:0 0 14px;color:#555">Deschide configuratia exacta trimisa de client in configuratorul 3D.</p>
          <a href="${hrefAttr(configUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:800">
            Vezi configuratia in 3D
          </a>
          <p style="margin:12px 0 0;color:#777;font-size:12px;word-break:break-all">${escapeHtml(configUrl)}</p>
        </div>

        <div style="border:1px solid #eee;border-radius:16px;padding:18px;margin-bottom:16px;background:#fafafa">
          <h3 style="margin:0 0 10px">Actiune recomandata</h3>
          <ul style="margin:0;padding-left:20px;color:#444">
            <li>Contacteaza clientul in urmatoarele 24h.</li>
            <li>Confirma dimensiunile, instalatiile si eventualele modificari fata de previzualizarea 3D.</li>
            <li>Comunica pretul final si pasii urmatori pentru showroom / comanda.</li>
          </ul>
        </div>

        <h3>Rezumat configuratie</h3>
        <pre style="white-space:pre-wrap;background:#f7f7f7;padding:16px;border-radius:8px;font-size:12px;line-height:1.45">${escapeHtml(configSummary)}</pre>
      </div>`,
    });

    if (ownerError) {
      console.error("Technician booking owner email failed:", ownerError);
      return NextResponse.json({ error: "Nu am putut trimite cererea catre echipa ASAB." }, { status: 502 });
    }

    const { error: customerError } = await resend.emails.send({
      from: "ASAB Design <noreply@configurator.asab-design.ro>",
      to: email,
      subject: "Am primit cererea ta pentru pretul bucatariei",
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111;line-height:1.55">
        <div style="background:#fbf6ee;border:1px solid #e7dac8;border-radius:20px;padding:26px;margin-bottom:20px">
          <p style="margin:0 0 8px;color:#80613c;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">ASAB Design</p>
          <h2 style="margin:0;font-size:28px;line-height:1.15">Buna ziua, ${escapeHtml(name)}!</h2>
          <p style="margin:12px 0 0;color:#444;font-size:15px">
            Am primit cererea ta pentru pretul bucatariei configurate. Proiectul tau ajunge acum la echipa ASAB, iar un Designer ASAB il va analiza si te va contacta in urmatoarele 24h.
          </p>
        </div>

        <div style="border:1px solid #eee;border-radius:16px;padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 10px;font-size:18px">Ce se intampla mai departe?</h3>
          <ol style="margin:0;padding-left:20px;color:#444">
            <li style="margin-bottom:8px">Verificam dimensiunile, forma bucatariei si configuratia generata.</li>
            <li style="margin-bottom:8px">Discutam impreuna modificarile dorite, inclusiv daca previzualizarea 3D nu este exact ce iti doreai.</li>
            <li style="margin-bottom:8px">Confirmam finisajele, corpurile, punctele tehnice si eventualele constrangeri din camera.</li>
            <li>Iti comunicam pretul final si pasii urmatori pentru comanda.</li>
          </ol>
        </div>

        <div style="border:1px solid #e7dac8;background:#fbf6ee;border-radius:16px;padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 8px;font-size:18px">Bucataria vine gata asamblata</h3>
          <p style="margin:0;color:#555;font-size:14px">
            Corpurile sunt livrate ca module solide, deja asamblate. La montaj, ele trebuie puse pe pozitie, fixate pe perete si ajustate la detaliile finale.
          </p>
        </div>

        <div style="border:1px solid #eee;border-radius:16px;padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 10px;font-size:18px">Showroom ASAB Design Iasi</h3>
          <p style="margin:6px 0;color:#444"><strong>Telefon:</strong> <a href="${hrefAttr("tel:0753494810")}" style="color:#111">0753 494 810</a></p>
          <p style="margin:6px 0;color:#444"><strong>Email:</strong> <a href="${hrefAttr("mailto:office@asab-design.ro")}" style="color:#111">office@asab-design.ro</a></p>
          <p style="margin:14px 0 0">
            <a href="${hrefAttr(showroomMapsUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;border-radius:10px;padding:12px 16px;font-weight:700">Deschide showroom-ul in Google Maps</a>
          </p>
        </div>

        <div style="border:1px solid #eee;border-radius:16px;padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 8px;font-size:18px">Nu esti sigur de materiale?</h3>
          <p style="margin:0 0 12px;color:#555;font-size:14px">
            Poti comanda cutia de mostre pentru fronturi si blaturi, ca sa vezi nuantele si textura in lumina casei tale.
          </p>
          <a href="${hrefAttr(sampleBoxUrl)}" style="display:inline-block;border:1px solid #111;color:#111;text-decoration:none;border-radius:10px;padding:11px 15px;font-weight:700">Vezi cutia de mostre</a>
        </div>

        <div style="border:1px solid #eee;border-radius:16px;padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 10px;font-size:18px">Urmareste ASAB Design</h3>
          <p style="margin:0 0 12px;color:#555;font-size:14px">Vezi proiecte, idei de finisaje si noutati din showroom.</p>
          ${socialHtml}
        </div>

        <p style="margin:20px 0 0;color:#666;font-size:13px;line-height:1.6">
          ASAB Design<br>
          <a href="${hrefAttr(websiteUrl)}" style="color:#666">asab-design.ro</a> ·
          <a href="${hrefAttr("mailto:office@asab-design.ro")}" style="color:#666">office@asab-design.ro</a> ·
          <a href="${hrefAttr("tel:0753494810")}" style="color:#666">0753 494 810</a>
        </p>
      </div>`,
    });

    if (customerError) console.warn("Technician booking confirmation email failed:", customerError);
    return NextResponse.json({ success: true, configId, configUrl });
  } catch (error) {
    console.error("Technician booking failed:", error);
    return NextResponse.json({ error: "Nu am putut procesa cererea pentru pret." }, { status: 500 });
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

function formatConfig(config: unknown): string {
  try { return JSON.stringify(config ?? {}, null, 2); }
  catch { return "Configuratia nu a putut fi serializata."; }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function hrefAttr(value: string): string {
  return escapeHtml(value.trim());
}

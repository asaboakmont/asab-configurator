import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

interface TechnicianBookingPayload {
  config?: unknown;
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  notes?: string;
  selectedDayLabel?: string;
  selectedSlot?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TechnicianBookingPayload;
    const name = clean(body.name);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const city = clean(body.city);
    const notes = clean(body.notes);
    const selectedDayLabel = clean(body.selectedDayLabel);
    const selectedSlot = clean(body.selectedSlot);

    if (!name || !email || !phone || !selectedDayLabel || !selectedSlot) {
      return NextResponse.json({ error: "Completeaza numele, emailul, telefonul, ziua si ora." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Serviciul de email nu este configurat." }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const configSummary = formatConfig(body.config);
    const ownerEmail = process.env.TECHNICIAN_BOOKING_EMAIL ?? "asaboakmont@gmail.com";

    const { error: ownerError } = await resend.emails.send({
      from: "ASAB Configurator <noreply@configurator.asab-design.ro>",
      to: ownerEmail,
      replyTo: email,
      subject: `Verificare proiect: ${name} - ${selectedDayLabel}, ${selectedSlot}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#111">
        <h2>Cerere noua de verificare cu designer</h2>
        <p><strong>Client:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Oras:</strong> ${escapeHtml(city || "-")}</p>
        <p><strong>Programare dorita:</strong> ${escapeHtml(selectedDayLabel)}, ${escapeHtml(selectedSlot)}</p>
        <p><strong>Mentiuni:</strong><br>${escapeHtml(notes || "-").replace(/\n/g, "<br>")}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
        <h3>Rezumat configuratie</h3>
        <pre style="white-space:pre-wrap;background:#f7f7f7;padding:16px;border-radius:8px">${escapeHtml(configSummary)}</pre>
      </div>`,
    });

    if (ownerError) {
      console.error("Technician booking owner email failed:", ownerError);
      return NextResponse.json({ error: "Nu am putut trimite cererea catre echipa ASAB." }, { status: 502 });
    }

    const { error: customerError } = await resend.emails.send({
      from: "ASAB Design <noreply@configurator.asab-design.ro>",
      to: email,
      subject: "Am primit cererea ta de verificare a proiectului",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
        <h2>Buna ziua, ${escapeHtml(name)}!</h2>
        <p>Am primit cererea ta pentru verificarea proiectului de bucatarie.</p>
        <p><strong>Interval ales:</strong> ${escapeHtml(selectedDayLabel)}, ${escapeHtml(selectedSlot)}</p>
        <p>Un designer ASAB DESIGN va analiza proiectul si va reveni la ora selectata pentru consultanta dvs.</p>
        <p style="margin-top:24px;color:#666;font-size:13px">ASAB Design · +40 755 837 264 · office@asab-design.ro</p>
      </div>`,
    });

    if (customerError) console.warn("Technician booking confirmation email failed:", customerError);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Technician booking failed:", error);
    return NextResponse.json({ error: "Nu am putut procesa cererea de verificare." }, { status: 500 });
  }
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatConfig(config: unknown): string {
  try { return JSON.stringify(config ?? {}, null, 2); }
  catch { return "Configuratia nu a putut fi serializata."; }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

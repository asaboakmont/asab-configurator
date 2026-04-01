import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, totalPrice } = await req.json();
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "ASAB Configurator <noreply@configurator.asab-design.ro>",
      to: "alex@asab-design.ro",
      subject: `Lead nou: ${name} — ${totalPrice} RON`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Lead nou configurator</h2>
          <p><strong>Nume:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Telefon:</strong> ${phone}</p>
          <p><strong>Total estimat:</strong> ${totalPrice} RON</p>
        </div>
      `,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

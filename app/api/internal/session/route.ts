import { NextRequest, NextResponse } from "next/server";
import {
  authenticateInternalUser,
  createInternalSession,
  getInternalRole,
  INTERNAL_SESSION_COOKIE,
  internalSessionCookieOptions,
} from "@/lib/auth/internalSession";

export async function GET(request: NextRequest) {
  return NextResponse.json({ role: getInternalRole(request) });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const role = authenticateInternalUser(String(body.username ?? ""), String(body.password ?? ""));
    if (!role) {
      return NextResponse.json({ error: "Utilizator sau parola incorecta." }, { status: 401 });
    }

    const response = NextResponse.json({ role });
    response.cookies.set(
      INTERNAL_SESSION_COOKIE,
      createInternalSession(role),
      internalSessionCookieOptions()
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accesul intern nu este configurat.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ role: null });
  response.cookies.set(INTERNAL_SESSION_COOKIE, "", {
    ...internalSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

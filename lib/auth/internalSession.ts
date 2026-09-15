import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import type { InternalRole } from "@/types/kitchen";

export const INTERNAL_SESSION_COOKIE = "asab_internal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

interface SessionPayload {
  role: InternalRole;
  expiresAt: number;
}

export function authenticateInternalUser(username: string, password: string): InternalRole | null {
  const role = normalizeRole(username);
  if (!role) return null;
  const expected = role === "admin"
    ? process.env.ASAB_ADMIN_PASSWORD
    : process.env.ASAB_DESIGNER_PASSWORD;
  if (!expected || !safeEqual(password, expected)) return null;
  return role;
}

export function createInternalSession(role: InternalRole): string {
  const payload: SessionPayload = {
    role,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function getInternalRole(request: NextRequest): InternalRole | null {
  const token = request.cookies.get(INTERNAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra !== undefined) return null;

  try {
    if (!safeEqual(signature, sign(encoded))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!normalizeRole(payload.role) || typeof payload.expiresAt !== "number" || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    return payload.role;
  } catch {
    return null;
  }
}

export function usesInternalCabinetFeatures(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const nested = record.config && typeof record.config === "object"
    ? record.config as Record<string, unknown>
    : undefined;
  const cabinets = Array.isArray(record.cabinets)
    ? record.cabinets
    : Array.isArray(nested?.cabinets)
      ? nested.cabinets
      : [];

  return cabinets.some((cabinet) => {
    if (!cabinet || typeof cabinet !== "object") return false;
    const item = cabinet as Record<string, unknown>;
    return !!item.catalogProduct || item.isCustom === true ||
      item.placementMode === "free" ||
      (typeof item.standardWidth === "number" && typeof item.width === "number" && item.standardWidth !== item.width);
  });
}

export function internalSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

function normalizeRole(value: unknown): InternalRole | null {
  return value === "admin" || value === "designer" ? value : null;
}

function sign(value: string): string {
  const secret = process.env.ASAB_INTERNAL_SESSION_SECRET;
  if (!secret) throw new Error("ASAB_INTERNAL_SESSION_SECRET is not configured.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

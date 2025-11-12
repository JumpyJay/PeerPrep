import type { NextRequest } from "next/server";
import { HttpError } from "./http-error";

type JwtPayload = { email?: string; id?: string | number; sub?: string | number; [k: string]: unknown };

function getAtob(): ((data: string) => string) | null {
    const g: unknown = globalThis;
    if (typeof g === "object" && g !== null && "atob" in g) {
        const maybe = (g as Record<string, unknown>).atob;
        return typeof maybe === "function" ? (maybe as (data: string) => string) : null;
    }
    return null;
}

function b64urlToUtf8(base64Url: string): string {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  // prefer Buffer when available (Node runtime), else fall back to atob (browser/edge).
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return Buffer.from(base64, "base64").toString("utf8");
  }
    // fallback to atob in edge/browser
    const atobFn = getAtob();
    if (!atobFn) throw new Error("Base64 decode not available in this runtime ");

    const bin = atobFn(base64);
    // binary string -> UTF-8
    return decodeURIComponent(
      Array.from(bin, (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = b64urlToUtf8(part);
    return JSON.parse(json) as JwtPayload;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return null;
  }
}

// Extract email from Authorization: Bearer or cookie("token").
export function getUserFromRequest(req: NextRequest): { email: string; source: "authorization" | "cookie" } {
  // Authorization: Bearer <jwt>
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const p = decodeJwtPayload(token);
    const raw = (p?.email ?? p?.id ?? p?.sub ?? "").toString();
    if (raw) return { email: raw.toLowerCase(), source: "authorization" };
  }

  // Fallback: cookie "token" (middleware already sets this)
  const cookie = req.cookies.get("token")?.value;
  if (cookie) {
    const p = decodeJwtPayload(cookie);
    const raw = (p?.email ?? p?.id ?? p?.sub ?? "").toString();
    if (raw) return { email: raw.toLowerCase(), source: "cookie" };
  }

  throw new HttpError(401, "Unauthenticated");
}
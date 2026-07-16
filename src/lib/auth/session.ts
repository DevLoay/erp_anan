import type { AppRole } from "@/lib/permissions";

export const SESSION_COOKIE = "erp_session";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: AppRole;
  driverId?: string;
  phone?: string;
  cityId?: string;
  cityScope?: string;
  projectScope?: string;
  supervisorId?: string;
  exp: number;
  iat: number;
};

const encoder = new TextEncoder();

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return "local-development-only-change-me";
}

function base64UrlEncode(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function signSession(input: Omit<SessionPayload, "exp" | "iat">, maxAgeSeconds = 60 * 60 * 10) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { ...input, iat: now, exp: now + maxAgeSeconds };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${await hmac(encoded)}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if ((await hmac(encoded)) !== signature) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (!payload.userId || !payload.email || !payload.role || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

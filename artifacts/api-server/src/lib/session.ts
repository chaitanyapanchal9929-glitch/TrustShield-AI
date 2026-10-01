import { createHmac, timingSafeEqual } from "node:crypto";
import type { Response } from "express";

const cookieName = "trustshield_session";
const maxAgeSeconds = 60 * 60 * 24 * 7;
const signingSecret: string = process.env.SESSION_SECRET ?? "";

if (!signingSecret) {
  throw new Error("SESSION_SECRET must be configured before the API server can start.");
}

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
};

type SessionPayload = {
  sub: string;
  exp: number;
  name: string;
  email: string;
};

function sign(value: string): string {
  return createHmac("sha256", signingSecret).update(value).digest("base64url");
}

export function createSessionToken(user: AuthenticatedUser): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      name: user.name,
      email: user.email,
      iat: now,
      exp: now + maxAgeSeconds,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifySessionToken(token: unknown): AuthenticatedUser | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = Buffer.from(sign(unsigned));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as {
      alg?: unknown;
      typ?: unknown;
    };
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;

    if (
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { id: payload.sub, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: Response, user: AuthenticatedUser): void {
  response.cookie(cookieName, createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
  });
}
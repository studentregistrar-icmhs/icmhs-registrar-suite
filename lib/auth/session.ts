import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "registrar_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 12; // 12 hours — re-login once a day is a reasonable tradeoff for a shared-computer registrar office

export type Role = "admin" | "editor" | "viewer";
export type CampusScope = "ALL" | "MAIN" | "NAKURU";

export type SessionPayload = {
  userId: number;
  username: string;
  displayName: string;
  role: Role;
  campusScope: CampusScope;
  // null/empty = unrestricted. Always effectively unrestricted for admins
  // regardless of what's stored, same convention as campusScope's "ALL".
  departmentScope: string[] | null;
  // Course CODES, one level finer than departmentScope — see lib/courses.ts.
  courseScope: string[] | null;
  termScope: string[] | null;
  canViewDeferments: boolean;
  mustResetPassword: boolean;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set — required to sign/verify login sessions.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_LIFETIME_SECONDS}s`)
    .sign(getSecretKey());
}

/** Returns null for a missing, malformed, or expired token — never throws,
 * so callers (middleware, page/route helpers) can treat it as "not logged in." */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_LIFETIME_SECONDS,
};

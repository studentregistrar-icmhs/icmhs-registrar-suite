import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { USER_HEADERS, encodeScopeHeader } from "@/lib/auth/currentUser";

/**
 * Session-based auth, enforced at the edge before any page or API route
 * runs. Replaces the old shared HTTP Basic Auth (DASHBOARD_USER/
 * DASHBOARD_PASSWORD) — those are retired; every registrar now has their
 * own account in the `registrar_users` table (see lib/auth/schema.sql).
 *
 * Configure in Vercel: Project → Settings → Environment Variables
 *   SESSION_SECRET   (required — signs/verifies the session cookie)
 *   DATABASE_URL     (already set for deferments; also backs registrar_users)
 *
 * Fails CLOSED: a missing/invalid/expired session always means "log in
 * again," never "let the request through."
 *
 * EXCEPTION — the Deferments module has a student-facing intake form that
 * must stay public (students have no registrar account). Those routes are
 * let through without auth; everything else, including the Deferments
 * admin review panel, stays behind the gate above.
 */

// Paths that must remain fully public (student-facing apply flow, and the
// PDF/lib assets it may load), plus the login page/API themselves — you
// can't log in if the login page requires being logged in.
const PUBLIC_PATHS = [
  "/deferments/apply",
  "/api/deferments/lookup-student",
  "/api/deferments/submit",
  "/login",
  "/api/auth/login",
];

// This one path is public for GET only (the apply form's deadline banner
// reads it) but registrar-only for POST (setting a deadline).
const PUBLIC_GET_ONLY_PATH = "/api/deferments/deadlines";

// Reachable by a logged-in user who still has to change their temp
// password, without that redirecting back to itself.
const CHANGE_PASSWORD_PATHS = ["/change-password", "/api/auth/change-password", "/api/auth/logout"];

function isPublicRequest(pathname: string, method: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  if (pathname === PUBLIC_GET_ONLY_PATH && method === "GET") {
    return true;
  }
  return false;
}

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicRequest(pathname, req.method)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ ok: false, reason: "Not logged in." }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const onChangePasswordPath = CHANGE_PASSWORD_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (session.mustResetPassword && !onChangePasswordPath) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ ok: false, reason: "Password reset required." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  // Deferments admin review area — a separate permission from role, since
  // an editor/viewer may or may not need it (e.g. most HOD accounts won't).
  // Always allowed for admins regardless of the account's own setting.
  const isDefermentsAdminPath =
    pathname.startsWith("/deferments/admin") || pathname.startsWith("/api/deferments/requests");
  const isDefermentsDeadlinesWrite = pathname === "/api/deferments/deadlines" && req.method !== "GET";
  if ((isDefermentsAdminPath || isDefermentsDeadlinesWrite) && session.role !== "admin" && !session.canViewDeferments) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ ok: false, reason: "You don't have access to the Deferments module." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Attach the verified identity as request headers so pages and route
  // handlers can read it (via lib/auth/currentUser.ts) without
  // re-verifying the session cookie themselves on every read.
  const forwardedHeaders = new Headers(req.headers);
  forwardedHeaders.set(USER_HEADERS.id, String(session.userId));
  forwardedHeaders.set(USER_HEADERS.username, session.username);
  forwardedHeaders.set(USER_HEADERS.displayName, session.displayName);
  forwardedHeaders.set(USER_HEADERS.role, session.role);
  forwardedHeaders.set(USER_HEADERS.campusScope, session.campusScope);
  forwardedHeaders.set(USER_HEADERS.departmentScope, encodeScopeHeader(session.departmentScope));
  forwardedHeaders.set(USER_HEADERS.termScope, encodeScopeHeader(session.termScope));
  forwardedHeaders.set(USER_HEADERS.canViewDeferments, String(session.canViewDeferments));

  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

// Runs for every route (pages + API) except Next's own static asset files,
// which carry no student data and don't need to be gated. The function body
// above then decides per-request whether that route is actually public.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

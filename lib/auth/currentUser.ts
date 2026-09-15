import { headers } from "next/headers";
import type { Role, CampusScope } from "./session";

export type CurrentUser = {
  userId: number;
  username: string;
  displayName: string;
  role: Role;
  campusScope: CampusScope;
};

// Keep these header names in sync with middleware.ts, which is the only
// place that sets them — every request reaching a page or API route has
// already been through middleware and had its session verified there, so
// route handlers and server components trust these headers rather than
// re-verifying the session cookie themselves on every read.
export const USER_HEADERS = {
  id: "x-registrar-user-id",
  username: "x-registrar-username",
  displayName: "x-registrar-display-name",
  role: "x-registrar-role",
  campusScope: "x-registrar-campus-scope",
} as const;

/** Server Components: reads the current user from request headers. Null if
 * somehow reached without going through middleware's auth check (shouldn't
 * happen given the matcher, but callers should still treat null as "not
 * authenticated" rather than assuming it's always present). */
export function getCurrentUser(): CurrentUser | null {
  const h = headers();
  const id = h.get(USER_HEADERS.id);
  const role = h.get(USER_HEADERS.role);
  if (!id || !role) return null;
  return {
    userId: Number(id),
    username: h.get(USER_HEADERS.username) ?? "",
    displayName: h.get(USER_HEADERS.displayName) ?? "",
    role: role as Role,
    campusScope: (h.get(USER_HEADERS.campusScope) ?? "ALL") as CampusScope,
  };
}

/** Route Handlers: same as getCurrentUser but reads from the NextRequest
 * passed in, for the (rare) route that needs it before/without calling
 * next/headers. Most routes can just use getCurrentUser(). */
export function getCurrentUserFromRequest(req: Request): CurrentUser | null {
  const id = req.headers.get(USER_HEADERS.id);
  const role = req.headers.get(USER_HEADERS.role);
  if (!id || !role) return null;
  return {
    userId: Number(id),
    username: req.headers.get(USER_HEADERS.username) ?? "",
    displayName: req.headers.get(USER_HEADERS.displayName) ?? "",
    role: role as Role,
    campusScope: (req.headers.get(USER_HEADERS.campusScope) ?? "ALL") as CampusScope,
  };
}

/** Whether `user` is allowed to view/edit a student in `studentCampus`.
 * Admins and ALL-scoped users pass regardless; a campus-scoped user only
 * passes for their own campus. Use for both read filtering and write
 * gating so the two can never drift apart. */
export function canAccessCampus(user: CurrentUser, studentCampus: "MAIN" | "NAKURU"): boolean {
  return user.campusScope === "ALL" || user.campusScope === studentCampus;
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin";
}

export function canEdit(user: CurrentUser): boolean {
  return user.role === "admin" || user.role === "editor";
}

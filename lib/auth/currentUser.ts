import { headers } from "next/headers";
import type { Role, CampusScope } from "./session";
import { getDepartment } from "../departments";

export type CurrentUser = {
  userId: number;
  username: string;
  displayName: string;
  role: Role;
  campusScope: CampusScope;
  /** null = every department. Always null (unrestricted) for admins. */
  departmentScope: string[] | null;
  /** null = every course (by code). One level finer than departmentScope —
   * see lib/courses.ts. Always null (unrestricted) for admins. */
  courseScope: string[] | null;
  /** null = every term. Always null (unrestricted) for admins. */
  termScope: string[] | null;
  canViewDeferments: boolean;
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
  // JSON-encoded string arrays (or the literal "null") — see
  // encodeScopeHeader/decodeScopeHeader below.
  departmentScope: "x-registrar-department-scope",
  courseScope: "x-registrar-course-scope",
  termScope: "x-registrar-term-scope",
  canViewDeferments: "x-registrar-can-view-deferments",
} as const;

/** Header value for a nullable string-array scope — used by middleware when
 * forwarding the session, and by the two read helpers below. Exported so
 * middleware.ts (the only other writer of these headers) stays in sync with
 * exactly how this module expects to decode them. */
export function encodeScopeHeader(scope: string[] | null): string {
  return JSON.stringify(scope);
}

function decodeScopeHeader(value: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function buildCurrentUser(get: (name: string) => string | null): CurrentUser | null {
  const id = get(USER_HEADERS.id);
  const role = get(USER_HEADERS.role);
  if (!id || !role) return null;
  return {
    userId: Number(id),
    username: get(USER_HEADERS.username) ?? "",
    displayName: get(USER_HEADERS.displayName) ?? "",
    role: role as Role,
    campusScope: (get(USER_HEADERS.campusScope) ?? "ALL") as CampusScope,
    departmentScope: decodeScopeHeader(get(USER_HEADERS.departmentScope)),
    courseScope: decodeScopeHeader(get(USER_HEADERS.courseScope)),
    termScope: decodeScopeHeader(get(USER_HEADERS.termScope)),
    canViewDeferments: get(USER_HEADERS.canViewDeferments) !== "false",
  };
}

/** Server Components: reads the current user from request headers. Null if
 * somehow reached without going through middleware's auth check (shouldn't
 * happen given the matcher, but callers should still treat null as "not
 * authenticated" rather than assuming it's always present). */
export function getCurrentUser(): CurrentUser | null {
  const h = headers();
  return buildCurrentUser((name) => h.get(name));
}

/** Route Handlers: same as getCurrentUser but reads from the NextRequest
 * passed in, for the (rare) route that needs it before/without calling
 * next/headers. Most routes can just use getCurrentUser(). */
export function getCurrentUserFromRequest(req: Request): CurrentUser | null {
  return buildCurrentUser((name) => req.headers.get(name));
}

/** Whether `user` is allowed to view/edit a student in `studentCampus`.
 * Admins and ALL-scoped users pass regardless; a campus-scoped user only
 * passes for their own campus. Use for both read filtering and write
 * gating so the two can never drift apart. */
export function canAccessCampus(user: CurrentUser, studentCampus: "MAIN" | "NAKURU"): boolean {
  return user.campusScope === "ALL" || user.campusScope === studentCampus;
}

/** Whether `user` is allowed to view/edit a student taking `courseCode`.
 * Unrestricted (null departmentScope) passes everyone — the normal case
 * and always true for admins. Otherwise the student's department (looked
 * up the same way the dashboard's own department breakdown does) must be
 * in the account's allowed list. */
export function canAccessDepartment(user: CurrentUser, courseCode: string): boolean {
  if (!user.departmentScope) return true;
  return user.departmentScope.includes(getDepartment(courseCode));
}

/** Whether `user` is allowed to view/edit a student taking `courseCode`,
 * checked by exact course code — one level finer than canAccessDepartment.
 * Unrestricted (null courseScope) passes everyone. Composes with
 * canAccessDepartment via AND wherever both are checked, same as every
 * other scoping dimension. */
export function canAccessCourse(user: CurrentUser, courseCode: string): boolean {
  if (!user.courseScope) return true;
  return user.courseScope.includes(courseCode);
}

/** Whether `user` is allowed to view/edit data for `termSlug` at all.
 * Unrestricted (null termScope) passes everyone. */
export function canAccessTerm(user: CurrentUser, termSlug: string): boolean {
  if (!user.termScope) return true;
  return user.termScope.includes(termSlug);
}

export function canViewDeferments(user: CurrentUser): boolean {
  return user.canViewDeferments;
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin";
}

export function canEdit(user: CurrentUser): boolean {
  return user.role === "admin" || user.role === "editor";
}

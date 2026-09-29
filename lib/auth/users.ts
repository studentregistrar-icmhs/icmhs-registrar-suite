import { sql } from "./db";
import { hashPassword, generateTempPassword } from "./passwords";
import type { Role, CampusScope } from "./session";

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: Role;
  campus_scope: CampusScope;
  department_scope: string[] | null;
  course_scope: string[] | null;
  term_scope: string[] | null;
  can_view_deferments: boolean;
  /** Added by db/migration_v4_disciplinary.sql. Optional in the type so
   * code keeps working (as "no access") on a database that predates it. */
  can_view_disciplinary?: boolean;
  active: boolean;
  must_reset_password: boolean;
  created_at: string;
  last_login_at: string | null;
};

export async function findActiveUserByUsername(username: string): Promise<UserRow | null> {
  const rows = (await sql`
    SELECT * FROM registrar_users WHERE lower(username) = lower(${username}) AND active = true LIMIT 1
  `) as UserRow[];
  return rows[0] ?? null;
}

export async function findUserById(userId: number): Promise<UserRow | null> {
  const rows = (await sql`SELECT * FROM registrar_users WHERE id = ${userId} AND active = true LIMIT 1`) as UserRow[];
  return rows[0] ?? null;
}

export async function listUsers(): Promise<Omit<UserRow, "password_hash">[]> {
  const rows = (await sql`
    SELECT * FROM registrar_users ORDER BY active DESC, display_name ASC
  `) as UserRow[];
  // SELECT * (rather than an explicit column list) so this keeps working
  // before and after migration_v4 adds can_view_disciplinary; the hash is
  // stripped here instead.
  return rows.map(({ password_hash, ...rest }) => ({
    ...rest,
    can_view_disciplinary: !!rest.can_view_disciplinary,
  }));
}

export async function touchLastLogin(userId: number): Promise<void> {
  await sql`UPDATE registrar_users SET last_login_at = now() WHERE id = ${userId}`;
}

export async function clearMustResetPassword(userId: number): Promise<void> {
  await sql`UPDATE registrar_users SET must_reset_password = false, updated_at = now() WHERE id = ${userId}`;
}

export async function setOwnPassword(userId: number, newPasswordHash: string): Promise<void> {
  await sql`
    UPDATE registrar_users
    SET password_hash = ${newPasswordHash}, must_reset_password = false, updated_at = now()
    WHERE id = ${userId}
  `;
}

function normalizeScope(scope: string[] | null): string[] | null {
  return scope && scope.length > 0 ? scope : null;
}

/** Creates a new account with a random temp password (returned, shown once) — the
 * person must change it on first login (must_reset_password starts true).
 * departmentScope/courseScope/termScope: pass null (or an empty array) for
 * "unrestricted" — either way it's stored as NULL, so canAccess*() only
 * ever has one "no restriction" shape to check for. */
export async function createUser(opts: {
  username: string;
  displayName: string;
  role: Role;
  campusScope: CampusScope;
  departmentScope: string[] | null;
  courseScope: string[] | null;
  termScope: string[] | null;
  canViewDeferments: boolean;
  canViewDisciplinary?: boolean;
}): Promise<{ user: Omit<UserRow, "password_hash">; tempPassword: string }> {
  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);
  const deptScope = normalizeScope(opts.departmentScope);
  const courseScope = normalizeScope(opts.courseScope);
  const termScope = normalizeScope(opts.termScope);
  const rows = (await sql`
    INSERT INTO registrar_users (
      username, password_hash, display_name, role, campus_scope,
      department_scope, course_scope, term_scope, can_view_deferments, must_reset_password
    )
    VALUES (
      ${opts.username}, ${hash}, ${opts.displayName}, ${opts.role}, ${opts.campusScope},
      ${deptScope}, ${courseScope}, ${termScope}, ${opts.canViewDeferments}, true
    )
    RETURNING id, username, display_name, role, campus_scope, department_scope, course_scope, term_scope,
              can_view_deferments, active, must_reset_password, created_at, last_login_at
  `) as Omit<UserRow, "password_hash">[];
  // Set separately so account creation still works on a database that hasn't
  // had migration_v4_disciplinary.sql run yet (the column just doesn't exist).
  let canViewDisciplinary = false;
  if (opts.canViewDisciplinary) {
    try {
      await sql`UPDATE registrar_users SET can_view_disciplinary = true WHERE id = ${rows[0].id}`;
      canViewDisciplinary = true;
    } catch (err) {
      console.error("Couldn't set can_view_disciplinary (migration_v4 not run?):", err);
    }
  }
  return { user: { ...rows[0], can_view_disciplinary: canViewDisciplinary }, tempPassword };
}

/** Admin-triggered reset — generates a fresh temp password (returned, shown once)
 * and forces the person to set their own on next login. */
export async function resetUserPassword(userId: number): Promise<string> {
  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);
  await sql`
    UPDATE registrar_users SET password_hash = ${hash}, must_reset_password = true, updated_at = now()
    WHERE id = ${userId}
  `;
  return tempPassword;
}

export async function setUserActive(userId: number, active: boolean): Promise<void> {
  await sql`UPDATE registrar_users SET active = ${active}, updated_at = now() WHERE id = ${userId}`;
}

export async function updateUserAccess(
  userId: number,
  opts: {
    role: Role;
    campusScope: CampusScope;
    departmentScope: string[] | null;
    courseScope: string[] | null;
    termScope: string[] | null;
    canViewDeferments: boolean;
    /** undefined = leave as is */
    canViewDisciplinary?: boolean;
  }
): Promise<void> {
  const deptScope = normalizeScope(opts.departmentScope);
  const courseScope = normalizeScope(opts.courseScope);
  const termScope = normalizeScope(opts.termScope);
  await sql`
    UPDATE registrar_users
    SET role = ${opts.role}, campus_scope = ${opts.campusScope},
        department_scope = ${deptScope}, course_scope = ${courseScope}, term_scope = ${termScope},
        can_view_deferments = ${opts.canViewDeferments}, updated_at = now()
    WHERE id = ${userId}
  `;
  if (opts.canViewDisciplinary !== undefined) {
    await sql`UPDATE registrar_users SET can_view_disciplinary = ${opts.canViewDisciplinary} WHERE id = ${userId}`;
  }
}

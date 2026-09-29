import { findUserById } from "@/lib/auth/users";
import type { CurrentUser } from "@/lib/auth/currentUser";

/**
 * Whether this account may see disciplinary records at all.
 *
 * Checked against the database on every call rather than read from the
 * login session: descriptions of misconduct are sensitive enough that
 * revoking access should take effect immediately, not when the person's
 * 12-hour session expires. Admins always pass. Fails closed — if the
 * column doesn't exist yet (migration_v4 not run) or the lookup errors,
 * a non-admin gets no access.
 */
export async function canViewDisciplinary(me: CurrentUser): Promise<boolean> {
  if (me.role === "admin") return true;
  try {
    const row = await findUserById(me.userId);
    return !!(row as any)?.can_view_disciplinary;
  } catch {
    return false;
  }
}

/** Recording/deciding cases additionally needs a non-viewer role, same as editing statuses. */
export async function canManageDisciplinary(me: CurrentUser): Promise<boolean> {
  if (me.role === "viewer") return false;
  return canViewDisciplinary(me);
}

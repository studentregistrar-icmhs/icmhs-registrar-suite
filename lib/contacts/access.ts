import { findUserById } from "@/lib/auth/users";
import type { CurrentUser } from "@/lib/auth/currentUser";

/**
 * Whether this account may see student contact details (phone / email).
 *
 * Same model as lib/discipline/access.ts: checked against the database on
 * every call rather than read from the login session, so revoking the
 * right takes effect immediately instead of when the person's session
 * expires. Admins always pass. Fails closed — if the column doesn't exist
 * yet (migration_v5 not run) or the lookup errors, a non-admin gets no
 * access.
 */
export async function canViewContacts(me: CurrentUser | null): Promise<boolean> {
  if (!me) return false;
  if (me.role === "admin") return true;
  try {
    const row = await findUserById(me.userId);
    return !!(row as any)?.can_view_contacts;
  } catch {
    return false;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/currentUser";
import { findUserById, setOwnPassword } from "@/lib/auth/users";
import { verifyPassword, hashPassword } from "@/lib/auth/passwords";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";

const MIN_LENGTH = 8;

export async function POST(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ ok: false, reason: "Not logged in." }, { status: 401 });

  const { currentPassword, newPassword } = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword || newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { ok: false, reason: `New password must be at least ${MIN_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const user = await findUserById(me.userId);
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    return NextResponse.json({ ok: false, reason: "Current password is incorrect." }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await setOwnPassword(user.id, newHash);

  // Reissue the session token — the old one still carries
  // mustResetPassword: true baked into its payload, which would otherwise
  // keep redirecting to /change-password for the rest of this session.
  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    campusScope: user.campus_scope,
    departmentScope: user.department_scope,
    termScope: user.term_scope,
    canViewDeferments: user.can_view_deferments,
    mustResetPassword: false,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return res;
}

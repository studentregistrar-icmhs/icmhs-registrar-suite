import { NextRequest, NextResponse } from "next/server";
import { findActiveUserByUsername, touchLastLogin } from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/passwords";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";

// Deliberately vague on failure ("Incorrect username or password") rather
// than distinguishing "no such user" from "wrong password" — telling an
// attacker which username exists is a real (if small) information leak,
// and registrars don't need that distinction to know what to do next
// (double-check what they typed, or ask an admin to reset it).
export async function POST(req: NextRequest) {
  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  if (!username?.trim() || !password) {
    return NextResponse.json({ ok: false, reason: "Incorrect username or password." }, { status: 401 });
  }

  const user = await findActiveUserByUsername(username.trim());
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ ok: false, reason: "Incorrect username or password." }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    campusScope: user.campus_scope,
    departmentScope: user.department_scope,
    termScope: user.term_scope,
    canViewDeferments: user.can_view_deferments,
    mustResetPassword: user.must_reset_password,
  });

  await touchLastLogin(user.id);

  const res = NextResponse.json({ ok: true, mustResetPassword: user.must_reset_password });
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return res;
}

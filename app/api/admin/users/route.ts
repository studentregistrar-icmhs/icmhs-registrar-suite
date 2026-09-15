import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";
import { listUsers, createUser, findActiveUserByUsername } from "@/lib/auth/users";
import type { Role, CampusScope } from "@/lib/auth/session";

const VALID_ROLES: Role[] = ["admin", "editor", "viewer"];
const VALID_SCOPES: CampusScope[] = ["ALL", "MAIN", "NAKURU"];
// Letters, numbers, dots, underscores, hyphens — no spaces, keeps it simple
// to type and to use as a login.
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,40}$/;

export async function GET(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  const users = await listUsers();
  return NextResponse.json({ ok: true, users });
}

export async function POST(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    displayName?: string;
    role?: string;
    campusScope?: string;
  };
  const username = (body.username ?? "").trim();
  const displayName = (body.displayName ?? "").trim();
  const role = body.role as Role;
  const campusScope = (body.campusScope ?? "ALL") as CampusScope;

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { ok: false, reason: "Username must be 3-40 characters: letters, numbers, dots, underscores, or hyphens." },
      { status: 400 }
    );
  }
  if (!displayName) {
    return NextResponse.json({ ok: false, reason: "Display name is required." }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, reason: "Invalid role." }, { status: 400 });
  }
  if (!VALID_SCOPES.includes(campusScope)) {
    return NextResponse.json({ ok: false, reason: "Invalid campus scope." }, { status: 400 });
  }
  if (await findActiveUserByUsername(username)) {
    return NextResponse.json({ ok: false, reason: "That username is already taken." }, { status: 400 });
  }

  // Admins always effectively have ALL scope — storing it as ALL rather
  // than whatever was passed keeps that true everywhere this column is
  // read, not just in the permission-check helpers.
  const effectiveScope = role === "admin" ? "ALL" : campusScope;

  const { user, tempPassword } = await createUser({ username, displayName, role, campusScope: effectiveScope });
  return NextResponse.json({ ok: true, user, tempPassword });
}

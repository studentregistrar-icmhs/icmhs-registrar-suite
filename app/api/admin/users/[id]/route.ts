import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";
import { setUserActive, updateUserAccess } from "@/lib/auth/users";
import { parseDepartmentScope, parseTermScope } from "@/lib/auth/validateScopes";
import type { Role, CampusScope } from "@/lib/auth/session";

const VALID_ROLES: Role[] = ["admin", "editor", "viewer"];
const VALID_SCOPES: CampusScope[] = ["ALL", "MAIN", "NAKURU"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  const targetId = Number(params.id);
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ ok: false, reason: "Invalid user id." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    active?: boolean;
    role?: string;
    campusScope?: string;
    departmentScope?: string[] | null;
    termScope?: string[] | null;
    canViewDeferments?: boolean;
  };

  // Whenever any access field changes, all of them are expected together —
  // the Manage Accounts UI always sends the full access object as one PATCH
  // rather than partial field updates, so this one flag covers the whole set.
  const isAccessChange =
    body.role !== undefined ||
    body.campusScope !== undefined ||
    body.departmentScope !== undefined ||
    body.termScope !== undefined ||
    body.canViewDeferments !== undefined;

  // An admin can't deactivate or change the access of their OWN account
  // through this route — prevents accidentally locking yourself out with
  // no other admin around to undo it. Another admin can still do either of
  // these to this account.
  if (targetId === me.userId && (body.active === false || isAccessChange)) {
    return NextResponse.json(
      { ok: false, reason: "You can't change your own role, scope, or active status here — ask another admin." },
      { status: 400 }
    );
  }

  if (body.active !== undefined) {
    await setUserActive(targetId, !!body.active);
  }

  if (isAccessChange) {
    const role = body.role as Role;
    const campusScope = (body.campusScope ?? "ALL") as CampusScope;
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ ok: false, reason: "Invalid role." }, { status: 400 });
    }
    if (!VALID_SCOPES.includes(campusScope)) {
      return NextResponse.json({ ok: false, reason: "Invalid campus scope." }, { status: 400 });
    }

    let departmentScope: string[] | null;
    let termScope: string[] | null;
    try {
      departmentScope = parseDepartmentScope(body.departmentScope);
      termScope = parseTermScope(body.termScope);
    } catch (err: any) {
      return NextResponse.json({ ok: false, reason: err.message }, { status: 400 });
    }

    const isAdminRole = role === "admin";
    await updateUserAccess(targetId, {
      role,
      campusScope: isAdminRole ? "ALL" : campusScope,
      departmentScope: isAdminRole ? null : departmentScope,
      termScope: isAdminRole ? null : termScope,
      canViewDeferments: isAdminRole ? true : !!body.canViewDeferments,
    });
  }

  return NextResponse.json({ ok: true });
}

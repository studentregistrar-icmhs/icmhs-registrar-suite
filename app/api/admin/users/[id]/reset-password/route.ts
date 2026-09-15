import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";
import { resetUserPassword } from "@/lib/auth/users";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  const targetId = Number(params.id);
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ ok: false, reason: "Invalid user id." }, { status: 400 });
  }

  const tempPassword = await resetUserPassword(targetId);
  return NextResponse.json({ ok: true, tempPassword });
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/currentUser";
import { canViewDisciplinary, canManageDisciplinary } from "@/lib/discipline/access";

// Tells the nav bar whether to show the "Disciplinary" link. Only a yes/no.
export async function GET(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const [canView, canManage] = await Promise.all([canViewDisciplinary(me), canManageDisciplinary(me)]);
  return NextResponse.json({ ok: true, canView, canManage }, { headers: { "Cache-Control": "no-store" } });
}

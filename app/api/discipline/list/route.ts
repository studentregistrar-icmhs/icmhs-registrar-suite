import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/currentUser";
import { canViewDisciplinary } from "@/lib/discipline/access";
import { listAllCasesForOverview } from "@/lib/discipline/cases";
import { scopeCases } from "@/lib/discipline/guard";

// The case list. No descriptions or notes — those come only from the
// per-student endpoint, one student at a time.
export async function GET(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ ok: false, reason: "Not logged in." }, { status: 401 });
  if (!(await canViewDisciplinary(me))) {
    return NextResponse.json({ ok: false, reason: "You don't have access to disciplinary records." }, { status: 403 });
  }
  try {
    const cases = scopeCases(me, await listAllCasesForOverview());
    return NextResponse.json({ ok: true, cases }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Disciplinary list failed:", err);
    return NextResponse.json(
      { ok: false, reason: "Couldn't reach the disciplinary records table — has db/migration_v4_disciplinary.sql been run against this database?" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/currentUser";
import { guardStudent } from "@/lib/discipline/guard";

// Finds a student by admission number so a case can be recorded from the
// Disciplinary area. Out-of-scope and nonexistent students look identical.
export async function GET(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  const admissionNo = req.nextUrl.searchParams.get("admissionNo")?.trim();
  if (!admissionNo) return NextResponse.json({ ok: false, reason: "Enter an admission number." }, { status: 400 });
  const g = await guardStudent(me, admissionNo, "write");
  if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, student: g.student });
}

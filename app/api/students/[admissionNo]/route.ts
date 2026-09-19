import { NextRequest, NextResponse } from "next/server";
import { getStudentTimeline } from "@/lib/studentTimeline";
import { getCurrentUserFromRequest, canAccessCampus, canAccessDepartment, canAccessTerm } from "@/lib/auth/currentUser";

export async function GET(
  req: NextRequest,
  { params }: { params: { admissionNo: string } }
) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const requestedTerm = req.nextUrl.searchParams.get("term") ?? undefined;
  const term = requestedTerm && canAccessTerm(me, requestedTerm) ? requestedTerm : undefined;
  const profile = await getStudentTimeline(params.admissionNo, term, me.termScope);
  // Same 404 either way (never found vs. out of scope) — a scoped user
  // shouldn't be able to tell "doesn't exist" from "exists but not yours."
  if (!profile || !canAccessCampus(me, profile.campus) || !canAccessDepartment(me, profile.courseCode)) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  return NextResponse.json(profile);
}

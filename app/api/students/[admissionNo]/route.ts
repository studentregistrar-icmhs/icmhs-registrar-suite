import { NextRequest, NextResponse } from "next/server";
import { getStudentTimeline } from "@/lib/studentTimeline";
import { getCurrentUserFromRequest, canAccessCampus } from "@/lib/auth/currentUser";

export async function GET(
  req: NextRequest,
  { params }: { params: { admissionNo: string } }
) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const term = req.nextUrl.searchParams.get("term") ?? undefined;
  const profile = await getStudentTimeline(params.admissionNo, term);
  // Same 404 either way (never found vs. found-but-wrong-campus) — a
  // campus-scoped user shouldn't be able to tell the two apart.
  if (!profile || !canAccessCampus(me, profile.campus)) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  return NextResponse.json(profile);
}

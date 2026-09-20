import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";
import { listKnownCourses } from "@/lib/courses";

export async function GET(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  try {
    const courses = await listKnownCourses();
    return NextResponse.json({ ok: true, courses });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, reason: "Couldn't load the course list from the roster." },
      { status: 500 }
    );
  }
}

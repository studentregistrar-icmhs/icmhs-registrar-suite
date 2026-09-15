import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { markUnmarkedStudent } from "@/lib/writeStatus";
import { findStudentRow } from "@/lib/rosterLookup";
import { getCurrentUserFromRequest, canEdit, canAccessCampus } from "@/lib/auth/currentUser";

export async function POST(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !canEdit(me)) {
    return NextResponse.json({ ok: false, reason: "You don't have permission to edit student statuses." }, { status: 403 });
  }

  const { admissionNo, termSlug, status, validityDate, graduationCohort } = (await req.json()) as {
    admissionNo: string;
    termSlug: string;
    status?: string;
    validityDate?: string;
    graduationCohort?: string;
  };

  if (!admissionNo || !termSlug || !status) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  const loc = await findStudentRow(admissionNo);
  if (!loc) return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  if (!canAccessCampus(me, loc.campus)) {
    return NextResponse.json({ ok: false, reason: "That student is outside your assigned campus." }, { status: 403 });
  }

  const result = await markUnmarkedStudent(
    admissionNo,
    termSlug,
    status,
    me.displayName,
    validityDate?.trim() || undefined,
    graduationCohort?.trim() || undefined
  );

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    revalidatePath(`/students/${admissionNo}`);
    return NextResponse.json(result);
  }

  const statusCode = result.reason === "terminal-lock" ? 409 : result.reason === "not-found" ? 404 : 400;
  return NextResponse.json(result, { status: statusCode });
}

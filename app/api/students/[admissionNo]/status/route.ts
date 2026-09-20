import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateStudentStatus } from "@/lib/writeStatus";
import { findStudentRow } from "@/lib/rosterLookup";
import { LAYOUT_FOR_WRITE } from "@/lib/parse";
import { getCurrentUserFromRequest, canEdit, canAccessCampus, canAccessDepartment, canAccessCourse, canAccessTerm } from "@/lib/auth/currentUser";
import { logAudit } from "@/lib/auth/auditLog";

export async function POST(
  req: NextRequest,
  { params }: { params: { admissionNo: string } }
) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !canEdit(me)) {
    return NextResponse.json({ ok: false, reason: "You don't have permission to edit student statuses." }, { status: 403 });
  }

  const body = await req.json();
  const { termSlug, status, override, validityDate, graduationCohort } = body as {
    termSlug: string;
    status: string;
    override?: boolean;
    validityDate?: string;
    graduationCohort?: string;
  };

  if (!termSlug || !status) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }
  if (!canAccessTerm(me, termSlug)) {
    return NextResponse.json({ ok: false, reason: "That term is outside your assigned access." }, { status: 403 });
  }

  // Campus- and department-scoped editors can only touch students in their
  // own campus/department — enforced here (the real boundary), not just by
  // hiding the Edit button.
  const loc = await findStudentRow(params.admissionNo);
  if (!loc) return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  if (!canAccessCampus(me, loc.campus)) {
    return NextResponse.json({ ok: false, reason: "That student is outside your assigned campus." }, { status: 403 });
  }
  const courseCode = String(loc.rawRow[LAYOUT_FOR_WRITE[loc.campus].courseCode] ?? "").trim();
  if (!canAccessDepartment(me, courseCode) || !canAccessCourse(me, courseCode)) {
    return NextResponse.json({ ok: false, reason: "That student is outside your assigned department/course." }, { status: 403 });
  }

  const result = await updateStudentStatus({
    admissionNo: params.admissionNo,
    termSlug,
    newStatusLabel: status,
    override,
    validityDate: validityDate?.trim() || undefined,
    graduationCohort: graduationCohort?.trim() || undefined,
  });

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    revalidatePath(`/students/${params.admissionNo}`);
    await logAudit({
      actorId: me.userId,
      actorName: me.displayName,
      action: "status_edit",
      admissionNo: params.admissionNo,
      termSlug,
      detail: `Set status to ${status}${override ? " (override)" : ""}`,
    });
    return NextResponse.json(result);
  }

  const statusCode = result.reason === "terminal-lock" ? 409 : result.reason === "not-found" ? 404 : 400;
  return NextResponse.json(result, { status: statusCode });
}

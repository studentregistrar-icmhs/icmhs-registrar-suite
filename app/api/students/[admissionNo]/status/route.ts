import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateStudentStatus } from "@/lib/writeStatus";
import { findStudentRow } from "@/lib/rosterLookup";
import { getCurrentUserFromRequest, canEdit, canAccessCampus } from "@/lib/auth/currentUser";

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

  // Campus-scoped editors can only touch students in their own campus —
  // enforced here (the real boundary), not just by hiding the Edit button.
  const loc = await findStudentRow(params.admissionNo);
  if (!loc) return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  if (!canAccessCampus(me, loc.campus)) {
    return NextResponse.json({ ok: false, reason: "That student is outside your assigned campus." }, { status: 403 });
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
    return NextResponse.json(result);
  }

  const statusCode = result.reason === "terminal-lock" ? 409 : result.reason === "not-found" ? 404 : 400;
  return NextResponse.json(result, { status: statusCode });
}

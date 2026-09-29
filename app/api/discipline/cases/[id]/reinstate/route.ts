import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserFromRequest } from "@/lib/auth/currentUser";
import { logAudit } from "@/lib/auth/auditLog";
import { guardStudent } from "@/lib/discipline/guard";
import { getCase, markReinstated, isIsoDate, todayIso } from "@/lib/discipline/cases";
import { liftSuspension } from "@/lib/discipline/workflow";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUserFromRequest(req);
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, reason: "Invalid case id." }, { status: 400 });

  const existing = await getCase(id).catch(() => null);
  if (!existing) return NextResponse.json({ ok: false, reason: "Case not found." }, { status: 404 });

  const g = await guardStudent(me, existing.admission_no, "write");
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as { date?: string; notes?: string };
  const on = body.date ? String(body.date) : todayIso();
  if (!isIsoDate(on)) return NextResponse.json({ ok: false, reason: "Reinstatement date is not a valid date." }, { status: 400 });
  if (existing.suspension_start && on < existing.suspension_start) {
    return NextResponse.json({ ok: false, reason: "Reinstatement can't be before the suspension started." }, { status: 400 });
  }
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 4000) : null;

  const updated = await markReinstated(id, on, me!.displayName, notes);
  if (!updated) {
    return NextResponse.json(
      { ok: false, reason: "This case has no active suspension to reinstate (already reinstated, or the outcome isn't a suspension)." },
      { status: 409 }
    );
  }

  const warning = await liftSuspension(updated);
  await logAudit({
    actorId: me!.userId, actorName: me!.displayName, action: "discipline_reinstate",
    admissionNo: updated.admission_no, termSlug: updated.term_slug,
    detail: `Reinstated student after suspension (case ${updated.case_ref}) effective ${on}`,
  });
  revalidatePath(`/students/${updated.admission_no}`);
  revalidatePath(`/terms/${updated.term_slug}`);
  return NextResponse.json({ ok: true, case: updated, warning });
}

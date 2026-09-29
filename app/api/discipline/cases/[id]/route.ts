import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserFromRequest, canAccessTerm } from "@/lib/auth/currentUser";
import { logAudit } from "@/lib/auth/auditLog";
import { guardStudent } from "@/lib/discipline/guard";
import { getCase, updateCase, mergeAndValidate } from "@/lib/discipline/cases";
import { applySuspension, liftSuspension, applyExpulsion, EXPULSION_REVERSED_WARNING } from "@/lib/discipline/workflow";
import { isSuspensionActive, OUTCOMES, labelFor } from "@/lib/discipline/constants";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUserFromRequest(req);
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, reason: "Invalid case id." }, { status: 400 });

  let before;
  try {
    before = await getCase(id);
  } catch {
    return NextResponse.json({ ok: false, reason: "Couldn't reach the disciplinary records table." }, { status: 500 });
  }
  // Same 404 whether it doesn't exist or the caller has no access to it.
  if (!before) return NextResponse.json({ ok: false, reason: "Case not found." }, { status: 404 });

  const g = await guardStudent(me, before.admission_no, "write");
  if (!g.ok) return g.res;
  if (!canAccessTerm(me!, before.term_slug)) {
    return NextResponse.json({ ok: false, reason: "That term is outside your assigned access." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const v = mergeAndValidate(body, before, me!.displayName);
  if (!v.ok) return NextResponse.json({ ok: false, reason: v.reason }, { status: 400 });

  // Once reinstated, the decision itself is part of the record — the wording
  // and notes can still be corrected, the outcome and period can't.
  if (before.reinstated_on) {
    const f = v.fields;
    const changed =
      f.outcome !== before.outcome ||
      f.suspension_start !== before.suspension_start ||
      f.suspension_end !== before.suspension_end ||
      f.suspension_indefinite !== before.suspension_indefinite;
    if (changed) {
      return NextResponse.json(
        { ok: false, reason: "This suspension has already been reinstated, so its outcome and dates can't be changed." },
        { status: 409 }
      );
    }
  }

  const after = await updateCase(id, v.fields);
  if (!after) return NextResponse.json({ ok: false, reason: "Case not found." }, { status: 404 });

  const wasActive = isSuspensionActive(before);
  const nowActive = isSuspensionActive(after);
  let warning: string | null = null;
  if (!wasActive && nowActive) {
    warning = await applySuspension(after);
  } else if (wasActive && !nowActive && after.outcome !== "expulsion") {
    warning = await liftSuspension(after); // e.g. an appeal overturned the suspension
  }
  if (before.outcome !== "expulsion" && after.outcome === "expulsion") {
    warning = (await applyExpulsion(after)) ?? warning;
  } else if (before.outcome === "expulsion" && after.outcome !== "expulsion") {
    warning = EXPULSION_REVERSED_WARNING;
  }

  const outcomeChanged = before.outcome !== after.outcome;
  await logAudit({
    actorId: me!.userId, actorName: me!.displayName, action: "discipline_case_update",
    admissionNo: after.admission_no, termSlug: after.term_slug,
    detail: `Updated case ${after.case_ref}` +
      (outcomeChanged ? ` — outcome: ${after.outcome ? labelFor(OUTCOMES, after.outcome) : "none"} (was ${before.outcome ? labelFor(OUTCOMES, before.outcome) : "none"})` : ""),
  });
  revalidatePath(`/students/${after.admission_no}`);
  revalidatePath(`/terms/${after.term_slug}`);
  return NextResponse.json({ ok: true, case: after, warning });
}

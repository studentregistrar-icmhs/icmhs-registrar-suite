import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserFromRequest, canAccessTerm } from "@/lib/auth/currentUser";
import { logAudit } from "@/lib/auth/auditLog";
import { getTerm, getCurrentTermSlug } from "@/lib/terms";
import { guardStudent } from "@/lib/discipline/guard";
import { listCasesForStudent, createCase, mergeAndValidate } from "@/lib/discipline/cases";
import { applySuspension, applyExpulsion } from "@/lib/discipline/workflow";
import { CATEGORIES, OUTCOMES, labelFor } from "@/lib/discipline/constants";

const NOT_MIGRATED =
  "Couldn't reach the disciplinary records table — has db/migration_v4_disciplinary.sql been run against this database?";

// Cases for one student. Descriptions are returned here and nowhere else in
// the app (no list/search/export endpoint includes them).
export async function GET(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  const admissionNo = req.nextUrl.searchParams.get("admissionNo")?.trim();
  if (!admissionNo) return NextResponse.json({ ok: false, reason: "admissionNo is required." }, { status: 400 });

  const g = await guardStudent(me, admissionNo, "read");
  if (!g.ok) return g.res;

  try {
    const cases = await listCasesForStudent(admissionNo);
    if (cases.length > 0) {
      await logAudit({
        actorId: me!.userId, actorName: me!.displayName, action: "discipline_view",
        admissionNo, detail: `Viewed disciplinary record (${cases.length} case${cases.length === 1 ? "" : "s"})`,
      });
    }
    return NextResponse.json({ ok: true, cases });
  } catch (err) {
    console.error("Disciplinary list failed:", err);
    return NextResponse.json({ ok: false, reason: NOT_MIGRATED }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const admissionNo = typeof body.admissionNo === "string" ? body.admissionNo.trim() : "";
  if (!admissionNo) return NextResponse.json({ ok: false, reason: "admissionNo is required." }, { status: 400 });

  const g = await guardStudent(me, admissionNo, "write");
  if (!g.ok) return g.res;

  // The term whose status column gets Suspended/Dropped. Defaults to the
  // term the profile is being viewed in (falls back to the current term).
  const termSlug = typeof body.termSlug === "string" && getTerm(body.termSlug) ? body.termSlug : getCurrentTermSlug();
  if (!canAccessTerm(me!, termSlug)) {
    return NextResponse.json({ ok: false, reason: "That term is outside your assigned access." }, { status: 403 });
  }

  const v = mergeAndValidate(body, null, me!.displayName);
  if (!v.ok) return NextResponse.json({ ok: false, reason: v.reason }, { status: 400 });

  try {
    const created = await createCase({
      fields: v.fields,
      student: g.student,
      termSlug,
      actor: { id: me!.userId, name: me!.displayName },
    });

    let warning: string | null = null;
    if (created.outcome === "suspension") warning = await applySuspension(created);
    else if (created.outcome === "expulsion") warning = await applyExpulsion(created);

    await logAudit({
      actorId: me!.userId, actorName: me!.displayName, action: "discipline_case_open",
      admissionNo, termSlug,
      detail: `Opened case ${created.case_ref} (${labelFor(CATEGORIES, created.category)})` +
        (created.outcome ? ` — outcome: ${labelFor(OUTCOMES, created.outcome)}` : ""),
    });
    revalidatePath(`/students/${admissionNo}`);
    revalidatePath(`/terms/${termSlug}`);
    return NextResponse.json({ ok: true, case: created, warning });
  } catch (err) {
    console.error("Disciplinary create failed:", err);
    return NextResponse.json({ ok: false, reason: NOT_MIGRATED }, { status: 500 });
  }
}

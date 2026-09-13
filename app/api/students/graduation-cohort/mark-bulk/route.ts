import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bulkTagGraduationCohort } from "@/lib/writeStatus";
import { checkResolvePassword } from "@/lib/resolveAuth";

const MAX_ROWS = 2000; // comfortably more than one cohort's worth of graduates

// Purely additive metadata (see bulkTagGraduationCohort) — still gated
// behind the same resolve password as bulk-upload, since it writes
// directly to the live sheet for a batch of students. Each row carries its
// own cohort year rather than one shared year, so a single upload (e.g. an
// Excel export with an admission-number column and a year column) can mix
// cohorts if it needs to.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    rows?: { admissionNo?: string; cohortYear?: string }[];
    password?: string;
  };
  const { rows, password } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, reason: `Too many rows (max ${MAX_ROWS})` }, { status: 400 });
  }
  if (!checkResolvePassword(password)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const cleanRows = rows
    .map((r) => ({ admissionNo: String(r.admissionNo ?? "").trim(), cohortYear: String(r.cohortYear ?? "").trim() }))
    .filter((r) => r.admissionNo !== "");

  const result = await bulkTagGraduationCohort(cleanRows);

  if (result.ok) {
    // Cohort-tagged students could be spread across any term's Graduated
    // list — cheaper to just revalidate the home page (where every term
    // card lives) than to guess which term slugs are affected.
    revalidatePath("/");
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

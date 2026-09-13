import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bulkTagGraduationCohort } from "@/lib/writeStatus";
import { checkResolvePassword } from "@/lib/resolveAuth";

const MAX_ROWS = 2000; // one cohort's worth of graduates at a time

// Purely additive metadata (see bulkTagGraduationCohort) — still gated
// behind the same resolve password as bulk-upload, since it writes
// directly to the live sheet for a batch of students.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    admissionNos?: string[];
    cohortYear?: string;
    password?: string;
  };
  const { admissionNos, cohortYear, password } = body;

  if (!Array.isArray(admissionNos) || admissionNos.length === 0 || !cohortYear?.trim()) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }
  if (admissionNos.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, reason: `Too many students (max ${MAX_ROWS})` }, { status: 400 });
  }
  if (!checkResolvePassword(password)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const clean = admissionNos.map((a) => String(a).trim()).filter(Boolean);
  const result = await bulkTagGraduationCohort(clean, cohortYear.trim());

  if (result.ok) {
    // Cohort-tagged students could be spread across any term's Graduated
    // list — cheaper to just revalidate the home page (where every term
    // card lives) than to guess which term slugs are affected.
    revalidatePath("/");
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

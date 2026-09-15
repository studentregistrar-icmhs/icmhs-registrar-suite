import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bulkMarkUnmarked } from "@/lib/writeStatus";
import { campusForAdmissionNumbers } from "@/lib/rosterLookup";
import { getCurrentUserFromRequest, canEdit, canAccessCampus } from "@/lib/auth/currentUser";

const MAX_ROWS = 500; // this is the Unmarked list, not a CSV upload — a generous but sane ceiling

export async function POST(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !canEdit(me)) {
    return NextResponse.json({ ok: false, reason: "You don't have permission to edit student statuses." }, { status: 403 });
  }

  const { termSlug, admissionNos, status, validityDate, graduationCohort } = (await req.json()) as {
    termSlug?: string;
    admissionNos?: string[];
    status?: string;
    validityDate?: string;
    graduationCohort?: string;
  };

  if (!termSlug || !status || !Array.isArray(admissionNos) || admissionNos.length === 0) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }
  if (admissionNos.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, reason: `Too many students selected (max ${MAX_ROWS})` }, { status: 400 });
  }

  const clean = admissionNos.map((a) => String(a).trim()).filter(Boolean);

  // Campus-scoped editors only get to mark students in their own campus —
  // this is the real enforcement point; the dashboard's own campus filter
  // is just UX on top of it. Anything outside scope is silently dropped
  // from the batch (not written, not reported as an error) rather than
  // failing the whole request, since in normal use a scoped editor's
  // Unmarked list is already filtered to their own campus and this should
  // rarely trigger.
  let toProcess = clean;
  if (me.campusScope !== "ALL") {
    const campusByAdmission = await campusForAdmissionNumbers(clean);
    toProcess = clean.filter((a) => campusByAdmission.get(a) === me.campusScope);
  }
  if (toProcess.length === 0) {
    return NextResponse.json({ ok: false, reason: "None of those students are in your assigned campus." }, { status: 403 });
  }

  const result = await bulkMarkUnmarked(
    termSlug,
    toProcess,
    status,
    me.displayName,
    validityDate?.trim() || undefined,
    graduationCohort?.trim() || undefined
  );

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

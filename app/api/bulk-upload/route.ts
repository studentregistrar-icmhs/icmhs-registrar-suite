import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bulkUploadStatuses } from "@/lib/writeStatus";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";

const MAX_ROWS = 2000; // generous ceiling — this is meant for lists of tens/hundreds of students

// Admin-only — protected by middleware.ts (session auth) and then by role here.
export async function POST(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  const body = (await req.json()) as {
    termSlug?: string;
    rows?: { admissionNo?: string; status?: string }[];
    override?: boolean;
    validityDate?: string;
    graduationCohort?: string;
  };
  const { termSlug, rows, override, validityDate, graduationCohort } = body;

  if (!termSlug || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, reason: "invalid-status", detail: `Too many rows (max ${MAX_ROWS})` }, { status: 400 });
  }

  const cleanRows = rows
    .map((r) => ({ admissionNo: String(r.admissionNo ?? "").trim(), status: String(r.status ?? "").trim() }))
    .filter((r) => r.admissionNo !== "");

  const result = await bulkUploadStatuses(
    termSlug,
    cleanRows,
    !!override,
    validityDate?.trim() || undefined,
    graduationCohort?.trim() || undefined
  );

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

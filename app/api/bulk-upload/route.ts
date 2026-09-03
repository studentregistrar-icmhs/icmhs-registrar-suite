import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bulkUploadStatuses } from "@/lib/writeStatus";
import { checkResolvePassword } from "@/lib/resolveAuth";

const MAX_ROWS = 2000; // generous ceiling — this is meant for lists of tens/hundreds of students

// Registrar-only — protected by middleware.ts (Basic Auth) before this runs.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    termSlug?: string;
    rows?: { admissionNo?: string; status?: string }[];
    override?: boolean;
    password?: string;
  };
  const { termSlug, rows, override, password } = body;

  if (!termSlug || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, reason: "invalid-status", detail: `Too many rows (max ${MAX_ROWS})` }, { status: 400 });
  }
  if (!checkResolvePassword(password)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const cleanRows = rows
    .map((r) => ({ admissionNo: String(r.admissionNo ?? "").trim(), status: String(r.status ?? "").trim() }))
    .filter((r) => r.admissionNo !== "");

  const result = await bulkUploadStatuses(termSlug, cleanRows, !!override);

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

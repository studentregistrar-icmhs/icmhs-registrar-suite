import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bulkMarkUnmarked } from "@/lib/writeStatus";

const MAX_ROWS = 500; // this is the Unmarked list, not a CSV upload — a generous but sane ceiling

// No resolve-password gate here for now (removed on request) — still
// protected by middleware.ts (Basic Auth), and every write still lands in
// RESOLVE LOG (legacy terms) or is directly visible in the status column
// (live-column terms) with who did it.
export async function POST(req: NextRequest) {
  const { termSlug, admissionNos, status, markedBy, validityDate } = (await req.json()) as {
    termSlug?: string;
    admissionNos?: string[];
    status?: string;
    markedBy?: string;
    validityDate?: string;
  };

  if (!termSlug || !status || !Array.isArray(admissionNos) || admissionNos.length === 0) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }
  if (admissionNos.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, reason: `Too many students selected (max ${MAX_ROWS})` }, { status: 400 });
  }

  const name = (markedBy || "").trim() || "Unknown";
  const clean = admissionNos.map((a) => String(a).trim()).filter(Boolean);
  const result = await bulkMarkUnmarked(termSlug, clean, status, name, validityDate?.trim() || undefined);

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bulkCarryForwardStatuses } from "@/lib/writeStatus";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";

// Admin-only — carry-forward writes to the live sheet for a whole term's
// worth of students at once, so it's gated the same way as bulk-upload and
// cohort tagging rather than left open to every editor.
export async function POST(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  const { termSlug } = (await req.json()) as { termSlug?: string };

  if (!termSlug) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  const result = await bulkCarryForwardStatuses(termSlug);

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

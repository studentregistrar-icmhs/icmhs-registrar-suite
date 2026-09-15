import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveLegacyConflictsBulk } from "@/lib/writeStatus";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";

// Admin-only.
export async function POST(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  const { admissionNos, termSlug } = (await req.json()) as {
    admissionNos: string[];
    termSlug: string;
  };

  if (!Array.isArray(admissionNos) || admissionNos.length === 0 || !termSlug) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  // The authenticated user's own name, not whatever the client sends —
  // more accurate audit trail now that every registrar has their own
  // account instead of typing a name into a shared login.
  const results = await resolveLegacyConflictsBulk(admissionNos, termSlug, me.displayName);
  const succeeded = results.filter((r) => r.result.ok).map((r) => r.admissionNo);
  const failed = results.filter((r) => !r.result.ok);

  if (succeeded.length > 0) {
    revalidatePath(`/terms/${termSlug}`);
  }

  return NextResponse.json({ ok: failed.length === 0, succeeded, failed });
}

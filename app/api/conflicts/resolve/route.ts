import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveLegacyConflict } from "@/lib/writeStatus";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";
import { logAudit } from "@/lib/auth/auditLog";

// Admin-only.
export async function POST(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  const { admissionNo, termSlug } = (await req.json()) as {
    admissionNo: string;
    termSlug: string;
  };

  if (!admissionNo || !termSlug) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  const result = await resolveLegacyConflict(admissionNo, termSlug, me.displayName);

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    await logAudit({
      actorId: me.userId,
      actorName: me.displayName,
      action: "conflict_resolve",
      admissionNo,
      termSlug,
      detail: "Resolved a legacy status conflict",
    });
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

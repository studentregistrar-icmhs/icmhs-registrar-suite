import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveLegacyConflict } from "@/lib/writeStatus";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";

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
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

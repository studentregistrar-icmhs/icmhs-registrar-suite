import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bulkCarryForwardStatuses } from "@/lib/writeStatus";
import { checkResolvePassword } from "@/lib/resolveAuth";

// Registrar-only — protected by middleware.ts (Basic Auth) before this runs.
// Also re-uses the same "resolve password" gate as conflict resolution and
// unmarked-marking, since this writes to the live sheet the same way those do.
export async function POST(req: NextRequest) {
  const { termSlug, password } = (await req.json()) as {
    termSlug?: string;
    password?: string;
  };

  if (!termSlug) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  if (!checkResolvePassword(password)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const result = await bulkCarryForwardStatuses(termSlug);

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { markUnmarkedStudent } from "@/lib/writeStatus";

// No resolve-password gate here for now (removed on request) — still
// protected by middleware.ts (Basic Auth) like every other registrar route,
// and every write is still logged to RESOLVE LOG with who did it.
export async function POST(req: NextRequest) {
  const { admissionNo, termSlug, status, markedBy } = (await req.json()) as {
    admissionNo: string;
    termSlug: string;
    status?: string;
    markedBy?: string;
  };

  if (!admissionNo || !termSlug || !status) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  const name = (markedBy || "").trim() || "Unknown";
  const result = await markUnmarkedStudent(admissionNo, termSlug, status, name);

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    revalidatePath(`/students/${admissionNo}`);
    return NextResponse.json(result);
  }

  const statusCode = result.reason === "terminal-lock" ? 409 : result.reason === "not-found" ? 404 : 400;
  return NextResponse.json(result, { status: statusCode });
}

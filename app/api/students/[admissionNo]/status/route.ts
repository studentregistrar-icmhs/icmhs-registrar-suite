import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateStudentStatus } from "@/lib/writeStatus";

export async function POST(
  req: NextRequest,
  { params }: { params: { admissionNo: string } }
) {
  const body = await req.json();
  const { termSlug, status, override, validityDate, graduationCohort } = body as {
    termSlug: string;
    status: string;
    override?: boolean;
    validityDate?: string;
    graduationCohort?: string;
  };

  if (!termSlug || !status) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  const result = await updateStudentStatus({
    admissionNo: params.admissionNo,
    termSlug,
    newStatusLabel: status,
    override,
    validityDate: validityDate?.trim() || undefined,
    graduationCohort: graduationCohort?.trim() || undefined,
  });

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    revalidatePath(`/students/${params.admissionNo}`);
    return NextResponse.json(result);
  }

  const statusCode = result.reason === "terminal-lock" ? 409 : result.reason === "not-found" ? 404 : 400;
  return NextResponse.json(result, { status: statusCode });
}

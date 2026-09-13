import { NextRequest, NextResponse } from "next/server";
import { getStudentTimeline } from "@/lib/studentTimeline";

export async function GET(
  req: NextRequest,
  { params }: { params: { admissionNo: string } }
) {
  const term = req.nextUrl.searchParams.get("term") ?? undefined;
  const profile = await getStudentTimeline(params.admissionNo, term);
  if (!profile) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  return NextResponse.json(profile);
}

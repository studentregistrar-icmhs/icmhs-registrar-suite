import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { loadTermData } from "@/lib/loadTermData";
import { getCurrentUserFromRequest, canAccessTerm } from "@/lib/auth/currentUser";

export async function GET(req: NextRequest, { params }: { params: { term: string } }) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!canAccessTerm(me, params.term)) return NextResponse.json({ error: "Unknown term" }, { status: 404 });
  const campusFilter = me.campusScope !== "ALL" ? me.campusScope : undefined;
  const departmentFilter = me.departmentScope ?? undefined;
  const data = await loadTermData(params.term, campusFilter, departmentFilter);
  if (!data) return NextResponse.json({ error: "Unknown term" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { term: string } }) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!canAccessTerm(me, params.term)) return NextResponse.json({ error: "Unknown term" }, { status: 404 });
  const campusFilter = me.campusScope !== "ALL" ? me.campusScope : undefined;
  const departmentFilter = me.departmentScope ?? undefined;
  revalidatePath(`/terms/${params.term}`);
  const data = await loadTermData(params.term, campusFilter, departmentFilter);
  return NextResponse.json({ ok: true, ...data });
}

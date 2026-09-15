import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { loadTermData } from "@/lib/loadTermData";
import { getCurrentUserFromRequest } from "@/lib/auth/currentUser";

export async function GET(req: NextRequest, { params }: { params: { term: string } }) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const campusFilter = me.campusScope !== "ALL" ? me.campusScope : undefined;
  const data = await loadTermData(params.term, campusFilter);
  if (!data) return NextResponse.json({ error: "Unknown term" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { term: string } }) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const campusFilter = me.campusScope !== "ALL" ? me.campusScope : undefined;
  revalidatePath(`/terms/${params.term}`);
  const data = await loadTermData(params.term, campusFilter);
  return NextResponse.json({ ok: true, ...data });
}

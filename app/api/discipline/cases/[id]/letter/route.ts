import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/currentUser";
import { logAudit } from "@/lib/auth/auditLog";
import { guardStudent } from "@/lib/discipline/guard";
import { getCase } from "@/lib/discipline/cases";
import { generateLetter, letterAvailability, type LetterType } from "@/lib/discipline/letters";

// Official documents: same access as recording a case (not view-only).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = getCurrentUserFromRequest(req);
  const id = Number(params.id);
  const type = req.nextUrl.searchParams.get("type");
  if (!Number.isFinite(id) || (type !== "suspension" && type !== "reinstatement")) {
    return NextResponse.json({ ok: false, reason: "Choose a letter type: suspension or reinstatement." }, { status: 400 });
  }

  const c = await getCase(id).catch(() => null);
  if (!c) return NextResponse.json({ ok: false, reason: "Case not found." }, { status: 404 });

  const g = await guardStudent(me, c.admission_no, "write");
  if (!g.ok) return g.res;

  if (!letterAvailability(c)[type as LetterType]) {
    return NextResponse.json(
      { ok: false, reason: type === "suspension" ? "This case has no suspension to write a letter for." : "This suspension hasn't been reinstated yet." },
      { status: 409 }
    );
  }

  try {
    const bytes = await generateLetter(c, type as LetterType, g.student.courseName);
    await logAudit({
      actorId: me!.userId, actorName: me!.displayName, action: "discipline_letter",
      admissionNo: c.admission_no, termSlug: c.term_slug,
      detail: `Generated ${type} letter for case ${c.case_ref}`,
    });
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${c.case_ref}-${type}-letter.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Letter generation failed:", err);
    return NextResponse.json({ ok: false, reason: "Couldn't generate the letter." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUserFromRequest } from "@/lib/auth/currentUser";
import { logAudit } from "@/lib/auth/auditLog";
import { canViewDisciplinary } from "@/lib/discipline/access";
import { listAllCasesForOverview } from "@/lib/discipline/cases";
import { scopeCases } from "@/lib/discipline/guard";
import { CATEGORIES, CASE_STATUSES, OUTCOMES, labelFor, isSuspensionActive } from "@/lib/discipline/constants";

// Excel export of the case list. Deliberately excludes the description and
// all notes: spreadsheets get forwarded, and those fields can name witnesses
// or other students.
export async function GET(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ ok: false, reason: "Not logged in." }, { status: 401 });
  if (!(await canViewDisciplinary(me))) {
    return NextResponse.json({ ok: false, reason: "You don't have access to disciplinary records." }, { status: 403 });
  }
  try {
    const cases = scopeCases(me, await listAllCasesForOverview());

    const wb = new ExcelJS.Workbook();
    wb.creator = "ICMHS Registrar Suite";
    wb.created = new Date();
    const ws = wb.addWorksheet("Disciplinary cases");
    ws.columns = [
      { header: "Case ref", key: "ref", width: 15 },
      { header: "Admission No", key: "adm", width: 18 },
      { header: "Student", key: "name", width: 26 },
      { header: "Course", key: "course", width: 12 },
      { header: "Campus", key: "campus", width: 14 },
      { header: "Incident date", key: "incident", width: 14 },
      { header: "Category", key: "category", width: 30 },
      { header: "Case status", key: "status", width: 12 },
      { header: "Outcome", key: "outcome", width: 15 },
      { header: "Decision date", key: "decision", width: 14 },
      { header: "Suspension from", key: "from", width: 15 },
      { header: "Suspension to", key: "to", width: 15 },
      { header: "Currently suspended", key: "active", width: 18 },
      { header: "Reinstated on", key: "reinstated", width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const c of cases) {
      ws.addRow({
        ref: c.case_ref, adm: c.admission_no, name: c.student_name, course: c.course_code ?? "",
        campus: c.campus === "MAIN" ? "Thika Main" : "Nakuru",
        incident: c.incident_date, category: labelFor(CATEGORIES, c.category),
        status: labelFor(CASE_STATUSES, c.case_status), outcome: c.outcome ? labelFor(OUTCOMES, c.outcome) : "",
        decision: c.decision_date ?? "", from: c.suspension_start ?? "",
        to: c.suspension_indefinite ? "Indefinite" : c.suspension_end ?? "",
        active: isSuspensionActive(c) ? "Yes" : "", reinstated: c.reinstated_on ?? "",
      });
    }
    const buf = await wb.xlsx.writeBuffer();

    await logAudit({
      actorId: me.userId, actorName: me.displayName, action: "discipline_view",
      detail: `Exported disciplinary case list (${cases.length} case${cases.length === 1 ? "" : "s"}, no descriptions)`,
    });
    return new NextResponse(Buffer.from(buf as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="disciplinary-cases-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Disciplinary export failed:", err);
    return NextResponse.json({ ok: false, reason: "Couldn't generate the export." }, { status: 500 });
  }
}

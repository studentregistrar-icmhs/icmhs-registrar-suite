import ExcelJS from "exceljs";

const COLUMNS = [
  { header: "Reference", key: "id", width: 26 },
  { header: "Full Name", key: "full_name", width: 22 },
  { header: "Admission Number", key: "admission_number", width: 20 },
  { header: "Email", key: "email", width: 26 },
  { header: "Phone", key: "phone", width: 16 },
  { header: "Application Date", key: "application_date", width: 16 },
  { header: "Program", key: "program", width: 34 },
  { header: "Campus", key: "campus", width: 18 },
  { header: "Type of Deferment", key: "type_of_deferment", width: 18 },
  { header: "Semester Deferring", key: "semester_deferring", width: 20 },
  { header: "Defer Year", key: "defer_year", width: 12 },
  { header: "Resumption Date", key: "resumption_date", width: 16 },
  { header: "Reason Category", key: "reason_category", width: 24 },
  { header: "Explanation", key: "reason_details", width: 44 },
  { header: "Status", key: "status", width: 12 },
  { header: "Reviewer Notes", key: "reviewer_notes", width: 30 },
  { header: "Submitted At", key: "submitted_at", width: 20 },
  { header: "Reviewed At", key: "reviewed_at", width: 20 }
];

export async function generateRequestsExcel(records, label = "All") {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ICMHS Office of Admissions & Records";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Deferment Requests - ${label}`.slice(0, 31));
  sheet.columns = COLUMNS;

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2545" } };
    cell.alignment = { vertical: "middle" };
  });
  headerRow.height = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + COLUMNS.length)}1` };

  for (const r of records) {
    sheet.addRow({
      id: r.id,
      full_name: r.full_name,
      admission_number: r.admission_number,
      email: r.email,
      phone: r.phone,
      application_date: r.application_date,
      program: r.program,
      campus: r.campus,
      type_of_deferment: r.type_of_deferment,
      semester_deferring: r.semester_deferring,
      defer_year: r.defer_year,
      resumption_date: r.resumption_date,
      reason_category: r.reason_category,
      reason_details: r.reason_details,
      status: (r.status || "").toUpperCase(),
      reviewer_notes: r.reviewer_notes,
      submitted_at: r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "",
      reviewed_at: r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : ""
    });
  }

  sheet.getColumn("reason_details").alignment = { wrapText: true, vertical: "top" };
  sheet.getColumn("reviewer_notes").alignment = { wrapText: true, vertical: "top" };

  return workbook.xlsx.writeBuffer();
}

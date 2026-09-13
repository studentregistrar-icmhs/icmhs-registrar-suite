import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { parseCsv } from "@/lib/csv";

const MAX_ROWS = 2000;

/**
 * Parses an uploaded cohort-tagging file into { admissionNo, cohortYear }
 * rows — accepts either .csv or a real .xlsx (using the same `exceljs`
 * dependency the deferments module already uses to write Excel files,
 * here used to read one instead). Takes the first two columns
 * positionally (same convention as the existing status bulk-upload CSV),
 * skips the header row, and skips any row with an empty first column.
 *
 * Parsing happens server-side rather than in the browser so a real .xlsx
 * file never needs a spreadsheet-parsing library bundled into the client.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, reason: "No file uploaded" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  let rows: { admissionNo: string; cohortYear: string }[] = [];

  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("no-worksheet");
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // header
        const admissionNo = String(row.getCell(1).value ?? "").trim();
        const cohortYear = String(row.getCell(2).value ?? "").trim();
        if (admissionNo) rows.push({ admissionNo, cohortYear });
      });
    } else {
      const text = buffer.toString("utf-8");
      rows = parseCsv(text)
        .map((cols) => ({ admissionNo: (cols[0] ?? "").trim(), cohortYear: (cols[1] ?? "").trim() }))
        .filter((r) => r.admissionNo !== "");
    }
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Couldn't read that file — is it a valid .csv or .xlsx?" },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, reason: "No rows found in that file" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, reason: `Too many rows (max ${MAX_ROWS})` }, { status: 400 });
  }

  return NextResponse.json({ ok: true, rows });
}

import { fetchSheetRows } from "./googleSheets";
import { Campus } from "./parse";

export type RowLocation = { campus: Campus; sheetRowNumber: number; rawRow: any[] };

// Ranges must reach column AC: that's where the Sept-Dec 2026 "live-column"
// term's status/validity/date-reported columns live (see lib/terms.ts).
// A:Z / A:X used to be enough when Jan-Apr/May-Aug were the last columns on
// each tab, but stopping there silently truncates rawRow before AA/AB/AC —
// which is exactly why the Sept-Dec status couldn't be read or edited from
// a student's profile. Widening the range here is enough on its own; write
// calls in lib/writeStatus.ts already address columns by letter, not by
// rawRow index, so they weren't affected.
const TABS: { campus: Campus; range: string; admissionCol: number }[] = [
  { campus: "MAIN", range: "MAIN CAMPUS!A:AC", admissionCol: 1 },
  { campus: "NAKURU", range: "NAKURU CAMPUS!A:AC", admissionCol: 1 },
];

/**
 * Locates a student's row by admission number. Returns the 1-indexed
 * sheet row number (for A1-notation writes) and which campus tab they're on.
 */
export async function findStudentRow(admissionNo: string): Promise<RowLocation | null> {
  for (const tab of TABS) {
    const rows = await fetchSheetRows(tab.range);
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (row && String(row[tab.admissionCol]) === admissionNo) {
        return { campus: tab.campus, sheetRowNumber: i + 1, rawRow: row };
      }
    }
  }
  return null;
}

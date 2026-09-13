import { fetchSheetRows } from "./googleSheets";
import { Campus } from "./parse";

export type RowLocation = { campus: Campus; sheetRowNumber: number; rawRow: any[] };

// Ranges must reach column AD: AA/AB/AC hold the Sept-Dec 2026 "live-column"
// term's status/validity/date-reported (see lib/terms.ts), and AD holds the
// standalone Graduation Cohort tag (see lib/graduationCohort.ts) — neither
// would be readable from rawRow if the range stopped short of them, which is
// exactly why the Sept-Dec status couldn't be read/edited before AA/AB/AC
// were added here, and would be the same problem for cohort tagging if AD
// isn't included too. Write calls in lib/writeStatus.ts already address
// columns by letter, not by rawRow index, so they aren't affected by this.
const TABS: { campus: Campus; range: string; admissionCol: number }[] = [
  { campus: "MAIN", range: "MAIN CAMPUS!A:AD", admissionCol: 1 },
  { campus: "NAKURU", range: "NAKURU CAMPUS!A:AD", admissionCol: 1 },
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

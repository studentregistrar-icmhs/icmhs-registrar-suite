import { getTerm, getTermPeriod } from "./terms";
import { fetchSheetRows } from "./googleSheets";
import { parseCampusRows } from "./parse";
import { columnIndex } from "./columns";
import { getDepartment } from "./departments";
import { isFutureIntake } from "./intake";

export type ReportingTrendPoint = { date: string; count: number; cumulative: number };
export type ReportingTrendDept = { department: string; reported: number; total: number };

export type ReportingTrendResult =
  | {
      ok: true;
      statusLabel: string; // whichever status this term's dateReportedColumn is tied to — "In Session" today
      totalRoster: number;
      totalReported: number;
      points: ReportingTrendPoint[];
      byDepartment: ReportingTrendDept[];
    }
  | { ok: false; reason: "unsupported-term" }
  | { ok: false; reason: "error"; message: string };

/**
 * Reads a live-column term's dateReportedColumn (see lib/terms.ts) across
 * both campus tabs and turns it into a day-by-day trend: how many students'
 * entries were stamped on each date, plus a running cumulative total. This
 * column is only ever auto-stamped by the app itself (never typed in), so
 * every date here reflects an actual registrar action, not a guess.
 *
 * Only works for a term configured with a dateReportedColumn — currently
 * just Sept-Dec 2026. Returns { ok: false } for any other term so the page
 * can show a clear "not available for this term" message instead of an
 * empty or misleading chart. Also never throws — a Sheets fetch failure
 * (bad creds, renamed tab, transient API error) surfaces as a friendly
 * { ok: false, reason: "error" } instead of crashing the page, the same
 * way loadTermData already handles this for the term dashboards.
 */
export async function getReportingTrend(termSlug: string): Promise<ReportingTrendResult> {
  const term = getTerm(termSlug);
  if (!term || term.source.kind !== "live-column" || !term.source.dateReportedColumn) {
    return { ok: false, reason: "unsupported-term" };
  }

  try {
    const dateCol = term.source.dateReportedColumn;
    const dateIdx = columnIndex(dateCol);
    const [mainRows, nakuruRows] = await Promise.all([
      fetchSheetRows(`MAIN CAMPUS!A:${dateCol}`),
      fetchSheetRows(`NAKURU CAMPUS!A:${dateCol}`),
    ]);

    const roster = [...parseCampusRows(mainRows, "MAIN"), ...parseCampusRows(nakuruRows, "NAKURU")];
    const period = getTermPeriod(term);
    const inRosterForTerm = roster.filter((s) => !period || !isFutureIntake(s.intakeYear, period));
    const totalRoster = inRosterForTerm.length;

    // admissionNo -> date reported, straight off the raw rows (same row as
    // the roster entry, so no separate join step is needed).
    const dateByAdmission = new Map<string, string>();
    for (const rowsArr of [mainRows, nakuruRows]) {
      for (let i = 2; i < rowsArr.length; i++) {
        const row = rowsArr[i];
        if (!row) continue;
        const admissionNo = row[1];
        if (admissionNo == null || String(admissionNo).trim() === "") continue;
        const dateVal = String(row[dateIdx] ?? "").trim();
        if (dateVal) dateByAdmission.set(String(admissionNo).trim(), dateVal);
      }
    }

    const dayCounts = new Map<string, number>();
    const deptTotals = new Map<string, number>();
    const deptReported = new Map<string, number>();
    let totalReported = 0;

    for (const s of inRosterForTerm) {
      const dept = getDepartment(s.courseCode);
      deptTotals.set(dept, (deptTotals.get(dept) ?? 0) + 1);
      const date = dateByAdmission.get(s.admissionNo);
      if (!date) continue;
      dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
      deptReported.set(dept, (deptReported.get(dept) ?? 0) + 1);
      totalReported++;
    }

    let running = 0;
    const points: ReportingTrendPoint[] = Array.from(dayCounts.keys())
      .sort()
      .map((date) => {
        const count = dayCounts.get(date)!;
        running += count;
        return { date, count, cumulative: running };
      });

    const byDepartment: ReportingTrendDept[] = Array.from(deptTotals.entries())
      .map(([department, total]) => ({ department, total, reported: deptReported.get(department) ?? 0 }))
      .sort((a, b) => b.total - a.total);

    return { ok: true, statusLabel: "In Session", totalRoster, totalReported, points, byDepartment };
  } catch (err: any) {
    return { ok: false, reason: "error", message: err?.message ?? "Failed to load the reporting trend." };
  }
}

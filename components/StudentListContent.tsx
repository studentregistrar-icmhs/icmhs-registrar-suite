"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toCsv, downloadCsv } from "@/lib/csv";
import { getDepartment } from "@/lib/departments";

const C = {
  ink: "#122A28", bg: "#EEF1EA", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", navy: "#2C3E66", amber: "#C2760F", sage: "#3F7D4F",
  rose: "#B0432E", violet: "#6B4FA3", slate: "#54625D", grey: "#98A39C",
};

const fmt = (n: number) => n.toLocaleString("en-US");

type StudentRow = {
  admissionNo: string;
  name: string;
  courseCode: string;
  courseName: string;
  campus: string;
  contacts: string;
  graduationCohort?: string;
};

/**
 * The breakdown-by-department/cohort + searchable table + CSV export for
 * one status category. Used two ways: inside StudentListPanel's slide-out
 * drawer (cramped by design — 560px, meant for a quick look) and on its own
 * full page (components/StudentListPage.tsx) for real work on the list —
 * cross-referencing, bookmarking a specific category, or just needing the
 * room a drawer can't give. Both render this exact same logic so the two
 * never drift apart; only the surrounding chrome (drawer vs. full page)
 * differs between the two call sites.
 */
export default function StudentListContent({
  status,
  students,
  unmarkedStudents,
  termSlug,
  query,
  onQueryChange,
  onClose,
  onOpenCohortTag,
  fullPageHref,
  autoFocusSearch = true,
}: {
  status: string;
  students: StudentRow[];
  /** Unmarked students in the same current filter scope, for the "In Session"
   * reporting-rate denominator below. Empty/unused for every other status. */
  unmarkedStudents?: { courseCode: string }[];
  termSlug: string;
  query: string;
  onQueryChange: (q: string) => void;
  /** Only passed by the drawer — the full page has nothing to close back to. */
  onClose?: () => void;
  /** Opens the "Tag graduation cohort" tool — only ever passed/used when status is "Graduated". */
  onOpenCohortTag?: () => void;
  /** When set, shows a "View full page" link that opens this URL in a new tab. */
  fullPageHref?: string;
  autoFocusSearch?: boolean;
}) {
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState<string | null>(null);
  useEffect(() => { setDeptFilter(null); setCohortFilter(null); }, [status]);

  // Only "In Session" gets the reporting-rate treatment: department count
  // measured against (that department's In Session + still-Unmarked) —
  // i.e. how far each department has gotten through reporting, rather
  // than that department's share of everyone who has reported so far.
  const isReportingRate = status === "In Session" && !!unmarkedStudents;
  const isGraduatedPanel = status === "Graduated";

  // Cohort- and department-scoped views of the same list, used to make the
  // two breakdowns below answer each other: select a cohort and the
  // department breakdown recomputes for just that cohort; select a
  // department and the cohort breakdown does the same in reverse. Neither
  // one filters against its OWN filter (byDept isn't narrowed by deptFilter,
  // byCohort isn't narrowed by cohortFilter) so each breakdown stays a
  // stable, clickable set of rows to switch between rather than collapsing
  // to one row the moment something's selected.
  const cohortScopedStudents = useMemo(() => {
    if (!cohortFilter) return students;
    return students.filter((s) => ((s.graduationCohort ?? "").trim() || "Untagged") === cohortFilter);
  }, [students, cohortFilter]);

  const deptScopedStudents = useMemo(() => {
    if (!deptFilter) return students;
    return students.filter((s) => getDepartment(s.courseCode) === deptFilter);
  }, [students, deptFilter]);

  const byDept = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of cohortScopedStudents) {
      const d = getDepartment(s.courseCode);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [cohortScopedStudents]);

  const unmarkedByDept = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of unmarkedStudents ?? []) {
      const d = getDepartment(s.courseCode);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return counts;
  }, [unmarkedStudents]);

  // For the reporting-rate view, a department that hasn't reported anyone
  // yet (0 In Session but some still-Unmarked) needs to show up as 0% —
  // byDept alone would silently drop it, since it's only ever built from
  // In Session students.
  const reportingRows = useMemo(() => {
    if (!isReportingRate) return byDept;
    const depts = new Set<string>([...byDept.map(([d]) => d), ...unmarkedByDept.keys()]);
    return Array.from(depts)
      .map((d): [string, number] => [d, byDept.find(([n]) => n === d)?.[1] ?? 0])
      .sort((a, b) => b[1] + (unmarkedByDept.get(b[0]) ?? 0) - (a[1] + (unmarkedByDept.get(a[0]) ?? 0)));
  }, [isReportingRate, byDept, unmarkedByDept]);

  const totalExpected = students.length + (unmarkedStudents?.length ?? 0);
  const totalPct = totalExpected ? Math.round((students.length / totalExpected) * 100) : 0;

  // Cohort breakdown, Graduated only — "Untagged" catches anyone graduated
  // before the cohort column existed (or backfilled yet), sorted to the
  // end so the real cohort years read top-to-bottom, most recent first.
  const byCohort = useMemo(() => {
    if (!isGraduatedPanel) return [];
    const counts = new Map<string, number>();
    for (const s of deptScopedStudents) {
      const c = (s.graduationCohort ?? "").trim() || "Untagged";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => {
      if (a[0] === "Untagged") return 1;
      if (b[0] === "Untagged") return -1;
      return b[0].localeCompare(a[0]);
    });
  }, [isGraduatedPanel, deptScopedStudents]);

  const displayedStudents = useMemo(() => {
    let rows = students;
    if (deptFilter) rows = rows.filter((s) => getDepartment(s.courseCode) === deptFilter);
    if (cohortFilter) rows = rows.filter((s) => ((s.graduationCohort ?? "").trim() || "Untagged") === cohortFilter);
    return rows;
  }, [students, deptFilter, cohortFilter]);

  return (
    <>
      <div style={panelStyles.header}>
        <div>
          <div style={panelStyles.eyebrow}>STATUS</div>
          <h2 style={panelStyles.title}>{status}</h2>
        </div>
        <div style={panelStyles.headerActions}>
          {fullPageHref && (
            <Link href={fullPageHref} target="_blank" rel="noopener noreferrer" style={panelStyles.fullPageLink}>
              View full page ↗
            </Link>
          )}
          {onClose && <button style={panelStyles.closeBtn} onClick={onClose}>✕</button>}
        </div>
      </div>
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search name or admission no…"
        style={panelStyles.search}
        autoFocus={autoFocusSearch}
      />
      {(byDept.length > 1 || (isReportingRate && reportingRows.length > 1)) && (
        <div style={panelStyles.deptBreakdown}>
          <div style={panelStyles.deptBreakdownTitle}>
            Breakdown by School/Department{cohortFilter ? ` — ${cohortFilter} cohort` : ""} {deptFilter && <button style={panelStyles.deptClear} onClick={() => setDeptFilter(null)}>clear filter ✕</button>}
          </div>
          {reportingRows.map(([dept, count]) => {
            const expected = isReportingRate ? count + (unmarkedByDept.get(dept) ?? 0) : cohortScopedStudents.length;
            const pct = expected ? Math.round((count / expected) * 100) : 0;
            const active = deptFilter === dept;
            return (
              <div
                key={dept}
                onClick={() => setDeptFilter(active ? null : dept)}
                style={{
                  ...panelStyles.deptRow,
                  ...(isReportingRate ? { gridTemplateColumns: "1fr 90px 100px" } : null),
                  opacity: deptFilter && !active ? 0.45 : 1,
                }}
                title={
                  isReportingRate
                    ? "Click to filter · % is this department's In Session count against In Session + still-Unmarked for that department"
                    : "Click to filter the list below to this School/Department"
                }
              >
                <div style={{ ...panelStyles.deptLabel, fontWeight: active ? 700 : 500 }}>{dept}</div>
                <div style={panelStyles.deptBarTrack}>
                  <div style={{ ...panelStyles.deptBarFill, width: `${pct}%`, background: active ? C.rose : C.teal }} />
                </div>
                <div style={panelStyles.deptFigures}>
                  {isReportingRate ? `${count}/${expected}` : count} · {pct}%
                </div>
              </div>
            );
          })}
          {isReportingRate && (
            <div style={{ ...panelStyles.deptTotalRow, gridTemplateColumns: "1fr 90px 100px" }}>
              <div style={{ ...panelStyles.deptLabel, fontWeight: 700 }}>Total reported</div>
              <div style={panelStyles.deptBarTrack}>
                <div style={{ ...panelStyles.deptBarFill, width: `${totalPct}%`, background: C.ink }} />
              </div>
              <div style={{ ...panelStyles.deptFigures, fontWeight: 700 }}>
                {students.length}/{totalExpected} · {totalPct}%
              </div>
            </div>
          )}
        </div>
      )}
      {isGraduatedPanel && byCohort.length > 0 && (
        <div style={panelStyles.deptBreakdown}>
          <div style={panelStyles.deptBreakdownTitle}>
            Breakdown by graduation cohort{deptFilter ? ` — ${deptFilter}` : ""} {cohortFilter && <button style={panelStyles.deptClear} onClick={() => setCohortFilter(null)}>clear filter ✕</button>}
          </div>
          {byCohort.map(([cohort, count]) => {
            const pct = deptScopedStudents.length ? Math.round((count / deptScopedStudents.length) * 100) : 0;
            const active = cohortFilter === cohort;
            return (
              <div
                key={cohort}
                onClick={() => setCohortFilter(active ? null : cohort)}
                style={{ ...panelStyles.deptRow, opacity: cohortFilter && !active ? 0.45 : 1 }}
                title="Click to filter the list below to this cohort"
              >
                <div style={{ ...panelStyles.deptLabel, fontWeight: active ? 700 : 500 }}>
                  {cohort === "Untagged" ? "Untagged (no cohort year set)" : cohort}
                </div>
                <div style={panelStyles.deptBarTrack}>
                  <div style={{ ...panelStyles.deptBarFill, width: `${pct}%`, background: active ? C.rose : cohort === "Untagged" ? C.slate : C.teal }} />
                </div>
                <div style={panelStyles.deptFigures}>{count} · {pct}%</div>
              </div>
            );
          })}
        </div>
      )}
      {isGraduatedPanel && onOpenCohortTag && (
        <div style={panelStyles.cohortTagBar}>
          <span style={{ fontSize: 12, color: C.slate }}>
            Backfilling an older cohort, or fixing a wrong year? Tag a batch by admission number.
          </span>
          <button style={panelStyles.cohortTagBtn} onClick={onOpenCohortTag}>Tag graduation cohort…</button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={panelStyles.count}>
          {fmt(displayedStudents.length)} student{displayedStudents.length === 1 ? "" : "s"}
          {deptFilter ? ` in ${deptFilter}` : ""}
          {cohortFilter ? ` · cohort ${cohortFilter}` : ""}
        </div>
        {displayedStudents.length > 0 && (
          <button
            style={panelStyles.exportBtn}
            onClick={() =>
              downloadCsv(
                `${status.replace(/\s+/g, "-")}${deptFilter ? "-" + deptFilter.replace(/\s+/g, "-") : ""}-students.csv`,
                toCsv(
                  ["Admission No.", "Name", "Programme", "School/Department", "Campus", "Contacts"],
                  displayedStudents.map((s) => [s.admissionNo, s.name, s.courseName || s.courseCode, getDepartment(s.courseCode), s.campus, s.contacts])
                )
              )
            }
          >
            Export CSV
          </button>
        )}
      </div>
      <div style={panelStyles.listWrap}>
        <table style={panelStyles.table}>
          <thead>
            <tr>
              <th style={panelStyles.th}>Admission No.</th>
              <th style={{ ...panelStyles.th, textAlign: "left" }}>Name</th>
              <th style={{ ...panelStyles.th, textAlign: "left" }}>Programme</th>
              <th style={panelStyles.th}>Campus</th>
              <th style={{ ...panelStyles.th, textAlign: "left" }}>Contacts</th>
            </tr>
          </thead>
          <tbody>
            {displayedStudents.map((s, i) => (
              <tr key={s.admissionNo + i} style={i % 2 ? panelStyles.trOdd : undefined}>
                <td style={panelStyles.tdCode}>
                  <Link href={`/students/${encodeURIComponent(s.admissionNo)}?term=${termSlug}`} style={{ color: C.teal }}>
                    {s.admissionNo}
                  </Link>
                </td>
                <td style={panelStyles.tdName}>{s.name}</td>
                <td style={panelStyles.tdName}>{s.courseName || s.courseCode}</td>
                <td style={panelStyles.tdNum}>{s.campus}</td>
                <td style={panelStyles.tdName}>{s.contacts || "—"}</td>
              </tr>
            ))}
            {displayedStudents.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: C.slate }}>
                  No matching students.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export const panelStyles: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(18,42,40,0.45)", display: "flex", justifyContent: "flex-end", zIndex: 50 },
  panel: { background: "#fff", width: "min(560px, 100%)", height: "100%", padding: "24px 24px 16px", boxSizing: "border-box", display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.15)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerActions: { display: "flex", alignItems: "center", gap: 14 },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.12em", color: C.teal, fontWeight: 600 },
  title: { fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 700, margin: "4px 0 0" },
  closeBtn: { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: C.slate, padding: 4 },
  fullPageLink: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, fontWeight: 600, color: C.teal, textDecoration: "none", whiteSpace: "nowrap", border: `1px solid ${C.teal}`, borderRadius: 6, padding: "5px 10px" },
  exportBtn: { border: `1px solid ${C.line}`, background: "#fff", color: C.ink, padding: "5px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  search: { border: `1px solid ${C.line}`, borderRadius: 6, padding: "9px 12px", fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none", marginBottom: 10 },
  count: { fontSize: 12, color: C.slate, fontFamily: "IBM Plex Mono, monospace", marginBottom: 10 },
  deptBreakdown: { border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14, background: "#F5F7F2" },
  deptBreakdownTitle: { fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: C.slate, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" },
  deptClear: { border: "none", background: "transparent", color: C.teal, fontSize: 10.5, cursor: "pointer", fontFamily: "IBM Plex Mono, monospace", padding: 0, textTransform: "none", letterSpacing: 0 },
  deptRow: { display: "grid", gridTemplateColumns: "1fr 90px 70px", alignItems: "center", gap: 8, padding: "3px 0", cursor: "pointer" },
  deptTotalRow: { display: "grid", gridTemplateColumns: "1fr 90px 70px", alignItems: "center", gap: 8, padding: "6px 0 2px", marginTop: 4, borderTop: `1px solid ${C.line}` },
  cohortTagBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, border: `1px dashed ${C.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14, flexWrap: "wrap" },
  cohortTagBtn: { border: `1px solid ${C.teal}`, background: "#fff", color: C.teal, borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  deptLabel: { fontSize: 11.5, color: C.ink },
  deptBarTrack: { background: "#fff", borderRadius: 4, height: 10, overflow: "hidden", border: `1px solid ${C.line}` },
  deptBarFill: { height: "100%", borderRadius: 4 },
  deptFigures: { fontSize: 11, fontFamily: "IBM Plex Mono, monospace", color: C.slate, textAlign: "right" },
  listWrap: { overflowY: "auto", flex: 1 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 8px", borderBottom: `2px solid ${C.ink}`, position: "sticky", top: 0, background: "#fff" },
  trOdd: { background: "#F5F7F2" },
  tdCode: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, padding: "6px 8px", color: C.teal, fontWeight: 600, whiteSpace: "nowrap" },
  tdName: { padding: "6px 8px", color: C.ink },
  tdNum: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, padding: "6px 8px", textAlign: "right", color: C.slate },
};

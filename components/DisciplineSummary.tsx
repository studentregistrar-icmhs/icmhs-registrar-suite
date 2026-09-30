import Link from "next/link";
import { formatSheetDate } from "@/lib/sheetDates";
import { CATEGORIES, CASE_STATUSES, labelFor } from "@/lib/discipline/constants";
import type { DisciplineSummaryData } from "@/lib/discipline/summary";

const C = { ink: "#122A28", line: "#D9DFD3", slate: "#54625D", amber: "#8A5A0B", amberBg: "#FBF0DC", rose: "#B0432E" };
const MAX_ROWS = 8;

/** Server-rendered; only mounted for accounts with disciplinary access (see app/terms/[term]/page.tsx). */
export default function DisciplineSummary({ data }: { data: DisciplineSummaryData }) {
  const { activeSuspensions, openCases, overdueCount } = data;
  if (activeSuspensions.length === 0 && openCases.length === 0) return null;

  return (
    <section style={s.wrap} aria-label="Disciplinary overview">
      <div style={s.cards}>
        <div style={s.stat}>
          <div style={s.num}>{activeSuspensions.length}</div>
          <div style={s.lbl}>Active suspensions</div>
          {overdueCount > 0 && <div style={s.overdue}>{overdueCount} past end date, awaiting reinstatement</div>}
        </div>
        <div style={s.stat}>
          <div style={s.num}>{openCases.length}</div>
          <div style={s.lbl}>Open cases</div>
          <div style={s.sub}>open, hearing or appealed</div>
        </div>
      </div>

      <div style={s.lists}>
        {activeSuspensions.length > 0 && (
          <div style={s.list}>
            <div style={s.listTitle}>Suspended students</div>
            {activeSuspensions.slice(0, MAX_ROWS).map((c) => (
              <Link key={c.id} href={`/students/${encodeURIComponent(c.admission_no)}`} style={s.row}>
                <span style={s.name}>{c.student_name}</span>
                <span style={s.meta}>
                  {c.case_ref} ·{" "}
                  {c.suspension_indefinite ? "indefinite" : `until ${formatSheetDate(c.suspension_end ?? "")}`}
                </span>
                {c.overdue && <span style={s.badge}>reinstate</span>}
              </Link>
            ))}
            {activeSuspensions.length > MAX_ROWS && <div style={s.more}>+ {activeSuspensions.length - MAX_ROWS} more</div>}
          </div>
        )}
        {openCases.length > 0 && (
          <div style={s.list}>
            <div style={s.listTitle}>Open cases</div>
            {openCases.slice(0, MAX_ROWS).map((c) => (
              <Link key={c.id} href={`/students/${encodeURIComponent(c.admission_no)}`} style={s.row}>
                <span style={s.name}>{c.student_name}</span>
                <span style={s.meta}>
                  {c.case_ref} · {labelFor(CATEGORIES, c.category)} · {labelFor(CASE_STATUSES, c.case_status)}
                  {c.hearing_date ? ` · hearing ${formatSheetDate(c.hearing_date)}` : ""}
                </span>
              </Link>
            ))}
            {openCases.length > MAX_ROWS && <div style={s.more}>+ {openCases.length - MAX_ROWS} more</div>}
          </div>
        )}
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 18px", margin: "0 0 20px" },
  cards: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  stat: { background: "#F7F8F4", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 16px", minWidth: 170 },
  num: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 26, color: C.ink, lineHeight: 1.1 },
  lbl: { fontSize: 12.5, fontWeight: 600, color: C.ink, marginTop: 2 },
  sub: { fontSize: 11, color: C.slate, marginTop: 2 },
  overdue: { fontSize: 11, color: C.amber, fontWeight: 600, marginTop: 3 },
  lists: { display: "flex", gap: 18, flexWrap: "wrap" },
  list: { flex: "1 1 320px", minWidth: 280 },
  listTitle: { fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: C.slate, fontWeight: 700, marginBottom: 4 },
  row: { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", padding: "6px 0", borderTop: `1px solid ${C.line}`, textDecoration: "none", color: C.ink },
  name: { fontSize: 13, fontWeight: 600 },
  meta: { fontSize: 11.5, color: C.slate },
  badge: { fontSize: 10.5, fontWeight: 700, background: C.amberBg, color: C.amber, borderRadius: 20, padding: "1px 8px" },
  more: { fontSize: 11.5, color: C.slate, padding: "6px 0 0" },
};

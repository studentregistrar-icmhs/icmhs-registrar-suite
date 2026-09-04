import Link from "next/link";
import { TERMS } from "@/lib/terms";
import { getReportingTrend } from "@/lib/reportingTrend";
import ReportingTrendChart from "@/components/ReportingTrendChart";

export const dynamic = "force-dynamic"; // always fetch fresh — never attempt to prerender this at build time

const C = {
  ink: "#122A28", bg: "#EEF1EA", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", navy: "#2C3E66", slate: "#54625D", grey: "#98A39C",
};

export default async function ReportsPage() {
  // Currently only Sept-Dec 2026 is set up with a dateReportedColumn — this
  // picks whichever configured term comes first, so a future term set up
  // the same way (see lib/terms.ts) starts showing up here automatically,
  // with no change needed to this page.
  const reportableTerm = TERMS.find((t) => t.source.kind === "live-column" && t.source.dateReportedColumn);
  const trend = reportableTerm ? await getReportingTrend(reportableTerm.slug) : null;

  return (
    <div style={styles.page}>
      <Link href="/" style={styles.back}>← Back</Link>
      <div style={styles.eyebrow}>ICMHS · REGISTRAR'S OFFICE</div>
      <h1 style={styles.h1}>Reports</h1>
      <p style={styles.sub}>
        Cross-cutting reports that don't belong to a single term's dashboard. More will land here over time.
      </p>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <div>
            <h2 style={styles.h2}>Daily Reporting Trend</h2>
            <span style={styles.cardNote}>
              {reportableTerm ? `${reportableTerm.label} · students marked "In Session," by the day they were entered` : ""}
            </span>
          </div>
        </div>

        {!reportableTerm || !trend ? (
          <div style={{ padding: "20px 0", color: C.slate }}>
            No term is currently set up for this report.
          </div>
        ) : !trend.ok ? (
          <div style={{ padding: "20px 0", color: C.slate }}>
            {trend.reason === "error"
              ? `Couldn't load this report right now (${trend.message}). Try refreshing the page.`
              : `${reportableTerm.label} isn't configured with a date-reported column, so this report isn't available for it.`}
          </div>
        ) : (
          <>
            <ReportingTrendChart
              points={trend.points}
              totalRoster={trend.totalRoster}
              totalReported={trend.totalReported}
              statusLabel={trend.statusLabel}
            />

            {trend.byDepartment.length > 1 && (
              <div style={{ marginTop: 26 }}>
                <div style={styles.deptTitle}>Breakdown by School/Department</div>
                {trend.byDepartment.map((d) => {
                  const pct = d.total > 0 ? Math.round((d.reported / d.total) * 100) : 0;
                  return (
                    <div key={d.department} style={styles.deptRow}>
                      <div style={styles.deptLabel}>{d.department}</div>
                      <div style={styles.deptBarTrack}>
                        <div style={{ ...styles.deptBarFill, width: `${pct}%` }} />
                      </div>
                      <div style={styles.deptFigures}>{d.reported} / {d.total} · {pct}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, padding: "48px 32px", minHeight: "100vh", boxSizing: "border-box" },
  back: { fontSize: 13, color: C.teal, textDecoration: "none", fontWeight: 600, display: "inline-block", marginBottom: 18 },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.12em", color: C.teal, fontWeight: 600, marginBottom: 6 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 32, margin: 0 },
  sub: { fontSize: 14, color: C.slate, marginTop: 8, marginBottom: 28, maxWidth: 620 },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "22px 24px", maxWidth: 900, boxShadow: "0 1px 3px rgba(18,42,40,0.07)" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 },
  h2: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 18, margin: 0 },
  cardNote: { fontSize: 12, color: C.slate },
  deptTitle: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: C.slate, marginBottom: 10, borderTop: `1px dashed ${C.line}`, paddingTop: 16 },
  deptRow: { display: "grid", gridTemplateColumns: "1fr 160px 110px", alignItems: "center", gap: 10, padding: "4px 0" },
  deptLabel: { fontSize: 12.5, color: C.ink },
  deptBarTrack: { background: C.bg, borderRadius: 4, height: 10, overflow: "hidden", border: `1px solid ${C.line}` },
  deptBarFill: { height: "100%", borderRadius: 4, background: C.teal },
  deptFigures: { fontSize: 11.5, fontFamily: "IBM Plex Mono, monospace", color: C.slate, textAlign: "right" },
};

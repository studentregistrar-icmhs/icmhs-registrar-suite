"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const C = {
  ink: "#122A28", line: "#D9DFD3", teal: "#0F7268", navy: "#2C3E66", slate: "#54625D", grey: "#98A39C",
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ReportingTrendChart({
  points,
  totalRoster,
  totalReported,
  statusLabel,
}: {
  points: { date: string; count: number; cumulative: number }[];
  totalRoster: number;
  totalReported: number;
  statusLabel: string;
}) {
  const pct = totalRoster > 0 ? Math.round((totalReported / totalRoster) * 100) : 0;
  const data = points.map((p) => ({ ...p, label: formatDate(p.date) }));

  return (
    <div>
      <div style={styles.statRow}>
        <div style={styles.stat}>
          <div style={styles.statNum}>{totalReported.toLocaleString()}</div>
          <div style={styles.statLabel}>Reported so far</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNum}>{totalRoster.toLocaleString()}</div>
          <div style={styles.statLabel}>Total roster this term</div>
        </div>
        <div style={styles.stat}>
          <div style={{ ...styles.statNum, color: C.teal }}>{pct}%</div>
          <div style={styles.statLabel}>Have reported</div>
        </div>
        {data.length > 0 && (
          <div style={styles.stat}>
            <div style={styles.statNum}>{data[data.length - 1].count}</div>
            <div style={styles.statLabel}>Reported on {data[data.length - 1].label}</div>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div style={{ padding: "24px 0", color: C.grey, fontStyle: "italic", fontSize: 13 }}>
          No students have been marked "{statusLabel}" through the Unmarked list yet — this fills in as
          registrars process resumption.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={C.line} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: C.slate, fontFamily: "IBM Plex Mono, monospace" }} axisLine={{ stroke: C.line }} tickLine={false} />
            <YAxis yAxisId="daily" tick={{ fontSize: 11.5, fill: C.slate, fontFamily: "IBM Plex Mono, monospace" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis yAxisId="cumulative" orientation="right" tick={{ fontSize: 11.5, fill: C.slate, fontFamily: "IBM Plex Mono, monospace" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, borderRadius: 8, border: `1px solid ${C.line}` }}
              labelStyle={{ fontWeight: 600, color: C.ink }}
            />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter, sans-serif" }} />
            <Bar yAxisId="daily" dataKey="count" name={`Reported that day`} fill={C.teal} radius={[3, 3, 0, 0]} barSize={22} />
            <Line yAxisId="cumulative" type="monotone" dataKey="cumulative" name="Cumulative total" stroke={C.navy} strokeWidth={2.5} dot={{ r: 3, fill: C.navy }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  statRow: { display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 18 },
  stat: { minWidth: 120 },
  statNum: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 26, color: C.ink, lineHeight: 1.1 },
  statLabel: { fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: C.slate, marginTop: 4 },
};

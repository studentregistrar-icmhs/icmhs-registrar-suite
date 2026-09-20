"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const C = {
  ink: "#122A28", bg: "#EEF1EA", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", rose: "#B0432E", slate: "#54625D",
};

type AuditAction =
  | "status_edit" | "unmarked_mark" | "unmarked_mark_bulk" | "bulk_upload"
  | "carry_forward" | "conflict_resolve" | "conflict_resolve_bulk" | "cohort_tag";

type Row = {
  id: number;
  at: string;
  actor_id: number | null;
  actor_name: string;
  action: AuditAction;
  admission_no: string | null;
  term_slug: string | null;
  detail: string;
};

const ACTION_LABEL: Record<AuditAction, string> = {
  status_edit: "Status edit",
  unmarked_mark: "Unmarked → set",
  unmarked_mark_bulk: "Unmarked bulk set",
  bulk_upload: "CSV bulk upload",
  carry_forward: "Carry forward",
  conflict_resolve: "Conflict resolved",
  conflict_resolve_bulk: "Conflicts bulk resolved",
  cohort_tag: "Graduation cohort tagged",
};

export default function AuditLogView() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [admissionNo, setAdmissionNo] = useState("");
  const [actorName, setActorName] = useState("");
  const [action, setAction] = useState<string>("");

  async function load() {
    setError(null);
    const params = new URLSearchParams();
    if (admissionNo.trim()) params.set("admissionNo", admissionNo.trim());
    if (actorName.trim()) params.set("actorName", actorName.trim());
    if (action) params.set("action", action);
    const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
    const json = await res.json();
    if (json.ok) setRows(json.rows);
    else setError(json.reason ?? "Couldn't load the audit log.");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatWhen(iso: string): string {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={styles.h1}>Audit log</h1>
      <p style={styles.sub}>
        Every status edit, bulk upload, carry-forward run, conflict resolution, and cohort tag —
        who did it, when, and what changed.
      </p>

      <div style={styles.filterBar}>
        <input
          style={styles.input}
          placeholder="Admission number contains…"
          value={admissionNo}
          onChange={(e) => setAdmissionNo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <input
          style={styles.input}
          placeholder="Actor name contains…"
          value={actorName}
          onChange={(e) => setActorName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <select style={styles.input} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {Object.entries(ACTION_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button style={styles.filterBtn} onClick={load}>Filter</button>
      </div>

      {error && (
        <p style={{ color: C.rose, fontSize: 13.5, lineHeight: 1.6 }}>{error}</p>
      )}

      {!error && (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <div>When</div>
            <div>Who</div>
            <div>Action</div>
            <div>Admission No</div>
            <div>Detail</div>
          </div>
          {(rows ?? []).map((r) => (
            <div key={r.id} style={styles.tableRow}>
              <div style={{ fontSize: 12, color: C.slate }}>{formatWhen(r.at)}</div>
              <div style={{ fontSize: 13 }}>{r.actor_name}</div>
              <div style={{ fontSize: 12.5 }}>{ACTION_LABEL[r.action] ?? r.action}</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>
                {r.admission_no ? (
                  <Link href={`/students/${encodeURIComponent(r.admission_no)}`} style={{ color: C.teal }}>
                    {r.admission_no}
                  </Link>
                ) : (
                  <span style={{ color: C.slate }}>—</span>
                )}
              </div>
              <div style={{ fontSize: 13 }}>{r.detail}</div>
            </div>
          ))}
          {rows !== null && rows.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: C.slate }}>No matching entries.</div>
          )}
          {rows === null && (
            <div style={{ padding: 16, fontSize: 13, color: C.slate }}>Loading…</div>
          )}
        </div>
      )}
      {rows && rows.length >= 200 && (
        <p style={{ fontSize: 12, color: C.slate, marginTop: 8 }}>
          Showing the most recent 200 matches — narrow the filters above to find something older.
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 26, margin: "4px 0 6px" },
  sub: { fontSize: 13.5, color: C.slate, margin: "0 0 20px", lineHeight: 1.6, maxWidth: 640 },
  filterBar: { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" },
  input: { border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, minWidth: 180 },
  filterBtn: { border: "none", background: C.ink, color: "#fff", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  table: { border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: "#fff" },
  tableHeader: { display: "grid", gridTemplateColumns: "1.2fr 1fr 1.3fr 1fr 2.5fr", gap: 10, padding: "10px 14px", fontSize: 11, fontWeight: 700, color: C.slate, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.line}`, background: "#F5F7F2" },
  tableRow: { display: "grid", gridTemplateColumns: "1.2fr 1fr 1.3fr 1fr 2.5fr", gap: 10, padding: "9px 14px", alignItems: "center", borderBottom: `1px solid ${C.line}` },
};

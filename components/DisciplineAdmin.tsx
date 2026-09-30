"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DisciplineSection from "@/components/DisciplineSection";
import { formatSheetDate } from "@/lib/sheetDates";
import {
  CATEGORIES, CASE_STATUSES, OUTCOMES, labelFor,
  isSuspensionActive, isReinstatementOverdue,
} from "@/lib/discipline/constants";
import type { ListCase } from "@/lib/discipline/cases";

const C = {
  ink: "#122A28", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", rose: "#B0432E", amber: "#8A5A0B", slate: "#54625D",
};

type View = "all" | "suspended" | "overdue" | "open" | "decided" | "closed";
type Selected = { admissionNo: string; name: string; startWithNew: boolean; termSlug: string };

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function DisciplineAdmin({
  canManage, currentTermSlug,
}: {
  canManage: boolean;
  currentTermSlug: string;
}) {
  const [cases, setCases] = useState<ListCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [view, setView] = useState<View>("all");
  const [outcome, setOutcome] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState<Selected | null>(null);
  const [findOpen, setFindOpen] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/discipline/list", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (json.ok) { setCases(json.cases); setError(null); }
      else { setError(json.reason ?? "Couldn't load disciplinary cases."); setCases([]); }
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const today = todayIso();

  // Counts for the chips, computed on the whole list so they don't shift as filters change.
  const counts = useMemo(() => {
    const all = cases ?? [];
    return {
      all: all.length,
      suspended: all.filter(isSuspensionActive).length,
      overdue: all.filter((c) => isReinstatementOverdue(c, today)).length,
      open: all.filter((c) => ["open", "hearing", "appealed"].includes(c.case_status)).length,
      decided: all.filter((c) => c.case_status === "decided").length,
      closed: all.filter((c) => c.case_status === "closed").length,
    };
  }, [cases, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (cases ?? []).filter((c) => {
      if (view === "suspended" && !isSuspensionActive(c)) return false;
      if (view === "overdue" && !isReinstatementOverdue(c, today)) return false;
      if (view === "open" && !["open", "hearing", "appealed"].includes(c.case_status)) return false;
      if (view === "decided" && c.case_status !== "decided") return false;
      if (view === "closed" && c.case_status !== "closed") return false;
      if (outcome !== "all" && (c.outcome ?? "none") !== outcome) return false;
      if (category !== "all" && c.category !== category) return false;
      if (q && !(`${c.student_name} ${c.admission_no} ${c.case_ref}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [cases, view, outcome, category, query, today]);

  const chips: { key: View; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "suspended", label: "Active suspensions", n: counts.suspended },
    { key: "overdue", label: "Reinstatement due", n: counts.overdue },
    { key: "open", label: "Open cases", n: counts.open },
    { key: "decided", label: "Decided", n: counts.decided },
    { key: "closed", label: "Closed", n: counts.closed },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={s.headRow}>
        <div>
          <div style={s.eyebrow}>ICMHS · REGISTRAR'S OFFICE</div>
          <h1 style={s.h1}>Disciplinary</h1>
          <div style={s.sub}>Cases and suspensions. Descriptions open one student at a time and never appear in this list or the export.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={s.ghostBtn} onClick={load} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>
          <a style={s.linkBtn} href="/api/discipline/export">Export list (Excel)</a>
          {canManage && <button style={s.primaryBtn} onClick={() => setFindOpen((v) => !v)}>Record a case</button>}
        </div>
      </div>

      {findOpen && canManage && (
        <FindStudent
          onCancel={() => setFindOpen(false)}
          onFound={(st) => {
            setFindOpen(false);
            setSelected({ admissionNo: st.admissionNo, name: st.name, startWithNew: true, termSlug: currentTermSlug });
          }}
        />
      )}

      <div style={s.chips}>
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setView(c.key)}
            style={{ ...s.chip, ...(view === c.key ? s.chipActive : {}) }}
          >
            {c.label} <span style={{ opacity: 0.65 }}>{c.n}</span>
          </button>
        ))}
      </div>

      <div style={s.filters}>
        <input
          style={{ ...s.input, flex: "1 1 220px" }}
          placeholder="Search name, admission number or case ref…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select style={s.input} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="all">All outcomes</option>
          <option value="none">Not decided</option>
          {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select style={s.input} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {error && <div style={s.errBox}>{error}</div>}
      {cases === null && <div style={s.empty}>Loading…</div>}
      {cases !== null && !error && filtered.length === 0 && (
        <div style={s.empty}>{cases.length === 0 ? "No disciplinary cases have been recorded yet." : "No cases match these filters."}</div>
      )}

      {filtered.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Case", "Student", "Category", "Status", "Outcome", "Suspension"].map((h) => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const overdue = isReinstatementOverdue(c, today);
                return (
                  <tr
                    key={c.id}
                    style={s.tr}
                    onClick={() => setSelected({ admissionNo: c.admission_no, name: c.student_name, startWithNew: false, termSlug: c.term_slug })}
                    title="Open this student's disciplinary record"
                  >
                    <td style={s.td}>
                      <div style={s.mono}>{c.case_ref}</div>
                      <div style={s.small}>{formatSheetDate(c.incident_date)}</div>
                    </td>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600 }}>{c.student_name}</div>
                      <div style={s.small}>{c.admission_no}{c.course_code ? ` · ${c.course_code}` : ""}</div>
                    </td>
                    <td style={s.td}>{labelFor(CATEGORIES, c.category)}</td>
                    <td style={s.td}><span style={{ ...s.pill, background: "#EEF1EA", color: C.slate }}>{labelFor(CASE_STATUSES, c.case_status)}</span></td>
                    <td style={s.td}>
                      {c.outcome
                        ? <span style={{ ...s.pill, background: "#F6EFE3", color: c.outcome === "expulsion" ? C.rose : c.outcome === "suspension" ? C.amber : C.slate }}>{labelFor(OUTCOMES, c.outcome)}</span>
                        : <span style={s.small}>—</span>}
                    </td>
                    <td style={s.td}>
                      {c.outcome === "suspension" ? (
                        <>
                          <div style={{ fontSize: 12.5 }}>
                            {c.suspension_indefinite
                              ? `From ${formatSheetDate(c.suspension_start ?? "")} · indefinite`
                              : `${formatSheetDate(c.suspension_start ?? "")} → ${formatSheetDate(c.suspension_end ?? "")}`}
                          </div>
                          {c.reinstated_on
                            ? <div style={s.small}>Reinstated {formatSheetDate(c.reinstated_on)}</div>
                            : overdue
                              ? <div style={{ ...s.small, color: C.amber, fontWeight: 600 }}>Ended — reinstate</div>
                              : <div style={{ ...s.small, color: C.amber, fontWeight: 600 }}>Active</div>}
                        </>
                      ) : <span style={s.small}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) { setSelected(null); load(); } }}>
          <div style={s.modal} role="dialog" aria-modal="true">
            <div style={s.modalHead}>
              <div>
                <div style={s.modalTitle}>{selected.name}</div>
                <div style={s.small}>
                  {selected.admissionNo} ·{" "}
                  <Link href={`/students/${encodeURIComponent(selected.admissionNo)}`} style={{ color: C.teal }}>Open student profile</Link>
                </div>
              </div>
              <button style={s.ghostBtn} onClick={() => { setSelected(null); load(); }}>Close</button>
            </div>
            <DisciplineSection
              key={`${selected.admissionNo}-${selected.startWithNew}`}
              admissionNo={selected.admissionNo}
              termSlug={selected.termSlug}
              canEdit={canManage}
              startWithNew={selected.startWithNew}
              onStatusMayHaveChanged={load}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FindStudent({
  onFound, onCancel,
}: {
  onFound: (s: { admissionNo: string; name: string }) => void;
  onCancel: () => void;
}) {
  const [adm, setAdm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (!adm.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/discipline/lookup?admissionNo=${encodeURIComponent(adm.trim())}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (json.ok) onFound(json.student);
      else setErr(res.status === 404 ? "No student found with that admission number." : json.reason ?? "Couldn't look that up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={find} style={s.findBox}>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Which student is this case about?</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input autoFocus style={{ ...s.input, flex: "1 1 240px" }} placeholder="Admission number" value={adm} onChange={(e) => setAdm(e.target.value)} />
        <button type="submit" style={s.primaryBtn} disabled={busy || !adm.trim()}>{busy ? "Looking…" : "Find student"}</button>
        <button type="button" style={s.ghostBtn} onClick={onCancel}>Cancel</button>
      </div>
      {err && <div style={{ ...s.errBox, marginTop: 8 }}>{err}</div>}
    </form>
  );
}

const s: Record<string, React.CSSProperties> = {
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 18 },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: 0.8, color: C.slate },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 28, margin: "4px 0 4px" },
  sub: { fontSize: 13, color: C.slate, maxWidth: 560, lineHeight: 1.5 },
  chips: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  chip: { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 20, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: C.slate },
  chipActive: { background: C.ink, borderColor: C.ink, color: "#fff" },
  filters: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 },
  input: { border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, background: "#fff", boxSizing: "border-box" },
  tableWrap: { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: C.slate, padding: "10px 14px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" },
  tr: { cursor: "pointer", borderBottom: `1px solid ${C.line}` },
  td: { padding: "10px 14px", verticalAlign: "top" },
  mono: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12 },
  small: { fontSize: 11.5, color: C.slate, marginTop: 2 },
  pill: { fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" },
  empty: { fontSize: 13, color: C.slate, background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 8, padding: "18px 16px" },
  errBox: { background: "#F3E7E4", color: C.rose, borderRadius: 8, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5, margin: "8px 0" },
  findBox: { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 14 },
  overlay: { position: "fixed", inset: 0, background: "rgba(18,42,40,0.45)", display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "40px 16px", zIndex: 50 },
  modal: { background: "#EEF1EA", borderRadius: 12, width: "100%", maxWidth: 760, padding: "20px 22px 24px", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  modalTitle: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 20 },
  primaryBtn: { border: "none", background: C.ink, color: "#fff", borderRadius: 6, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  ghostBtn: { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", color: C.slate },
  linkBtn: { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: "7px 12px", fontSize: 12.5, color: C.teal, fontWeight: 600, textDecoration: "none", display: "inline-block" },
};

"use client";

import { useEffect, useState } from "react";
import { formatSheetDate } from "@/lib/sheetDates";
import {
  CATEGORIES, CASE_STATUSES, OUTCOMES, labelFor,
  isSuspensionActive, isReinstatementOverdue,
  type DisciplinaryCase,
} from "@/lib/discipline/constants";

const C = {
  ink: "#122A28", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", rose: "#B0432E", amber: "#C2760F", slate: "#54625D",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

type FormState = {
  incident_date: string; reported_by: string; category: string; description: string;
  case_status: string; hearing_date: string;
  outcome: string; outcome_notes: string; decision_date: string; decided_by: string; letter_ref: string;
  appeal_notes: string;
  suspension_start: string; suspension_end: string; suspension_indefinite: boolean;
};

const blankForm = (): FormState => ({
  incident_date: todayIso(), reported_by: "", category: "", description: "",
  case_status: "open", hearing_date: "",
  outcome: "", outcome_notes: "", decision_date: "", decided_by: "", letter_ref: "",
  appeal_notes: "",
  suspension_start: "", suspension_end: "", suspension_indefinite: false,
});

const formFromCase = (c: DisciplinaryCase): FormState => ({
  incident_date: c.incident_date, reported_by: c.reported_by ?? "", category: c.category, description: c.description,
  case_status: c.case_status, hearing_date: c.hearing_date ?? "",
  outcome: c.outcome ?? "", outcome_notes: c.outcome_notes ?? "", decision_date: c.decision_date ?? "",
  decided_by: c.decided_by ?? "", letter_ref: c.letter_ref ?? "",
  appeal_notes: c.appeal_notes ?? "",
  suspension_start: c.suspension_start ?? "", suspension_end: c.suspension_end ?? "",
  suspension_indefinite: c.suspension_indefinite,
});

export default function DisciplineSection({
  admissionNo, termSlug, canEdit, onStatusMayHaveChanged,
}: {
  admissionNo: string;
  termSlug: string;
  canEdit: boolean;
  /** Recording/lifting a suspension changes the student's status in the
   * sheet, so the profile timeline above needs to re-fetch. */
  onStatusMayHaveChanged: () => void;
}) {
  const [cases, setCases] = useState<DisciplinaryCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [reinstating, setReinstating] = useState<number | null>(null);

  async function load() {
    const res = await fetch(`/api/discipline/cases?admissionNo=${encodeURIComponent(admissionNo)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (json.ok) { setCases(json.cases); setError(null); }
    else { setError(json.reason ?? "Couldn't load disciplinary records."); setCases([]); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [admissionNo]);

  function afterSave(warning: string | null | undefined) {
    setNotice(warning ?? null);
    setEditing(null);
    setReinstating(null);
    load();
    onStatusMayHaveChanged();
  }

  const today = todayIso();
  const active = (cases ?? []).find(isSuspensionActive);

  return (
    <div style={s.wrap}>
      <div style={s.headRow}>
        <div>
          <div style={s.h2}>Disciplinary</div>
          <div style={s.hint}>Visible only to accounts with disciplinary access. Descriptions never appear in lists or exports.</div>
        </div>
        {canEdit && editing === null && (
          <button style={s.primaryBtn} onClick={() => { setEditing("new"); setNotice(null); }}>Record case</button>
        )}
      </div>

      {active && (
        <div style={s.suspBanner}>
          Currently suspended
          {active.suspension_indefinite
            ? ` from ${formatSheetDate(active.suspension_start ?? "")} (indefinite)`
            : ` ${formatSheetDate(active.suspension_start ?? "")} → ${formatSheetDate(active.suspension_end ?? "")}`}
          {" · "}{active.case_ref}
        </div>
      )}

      {notice && <div style={s.warn}>{notice}</div>}
      {error && <div style={s.errBox}>{error}</div>}

      {editing === "new" && (
        <CaseForm
          key="new"
          title="Record a disciplinary case"
          initial={blankForm()}
          submitLabel="Save case"
          onCancel={() => setEditing(null)}
          onSubmit={async (f) => {
            if (f.outcome === "expulsion" && !confirm("Recording an expulsion sets this student's status to Dropped, which is locked everywhere else in the app. Continue?")) return null;
            const res = await fetch("/api/discipline/cases", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ admissionNo, termSlug, ...f }),
            });
            const json = await res.json().catch(() => ({}));
            if (!json.ok) return json.reason ?? "Couldn't save the case.";
            afterSave(json.warning);
            return null;
          }}
        />
      )}

      {cases === null && <div style={s.hint}>Loading…</div>}
      {cases !== null && cases.length === 0 && !error && editing !== "new" && (
        <div style={s.empty}>No disciplinary cases on record.</div>
      )}

      {(cases ?? []).map((c) => (
        <div key={c.id} style={s.card}>
          {editing === c.id ? (
            <CaseForm
              title={`Edit ${c.case_ref}`}
              initial={formFromCase(c)}
              submitLabel="Save changes"
              lockOutcome={!!c.reinstated_on}
              onCancel={() => setEditing(null)}
              onSubmit={async (f) => {
                if (f.outcome === "expulsion" && c.outcome !== "expulsion" && !confirm("Recording an expulsion sets this student's status to Dropped, which is locked everywhere else in the app. Continue?")) return null;
                const res = await fetch(`/api/discipline/cases/${c.id}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(f),
                });
                const json = await res.json().catch(() => ({}));
                if (!json.ok) return json.reason ?? "Couldn't save changes.";
                afterSave(json.warning);
                return null;
              }}
            />
          ) : (
            <CaseCard
              c={c}
              overdue={isReinstatementOverdue(c, today)}
              canEdit={canEdit}
              onEdit={() => { setEditing(c.id); setNotice(null); }}
              onReinstate={() => setReinstating(c.id)}
            />
          )}
          {reinstating === c.id && (
            <ReinstateForm
              minDate={c.suspension_start ?? undefined}
              onCancel={() => setReinstating(null)}
              onSubmit={async (date, notes) => {
                const res = await fetch(`/api/discipline/cases/${c.id}/reinstate`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date, notes }),
                });
                const json = await res.json().catch(() => ({}));
                if (!json.ok) return json.reason ?? "Couldn't reinstate.";
                afterSave(json.warning);
                return null;
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CaseCard({
  c, overdue, canEdit, onEdit, onReinstate,
}: {
  c: DisciplinaryCase; overdue: boolean; canEdit: boolean; onEdit: () => void; onReinstate: () => void;
}) {
  const active = isSuspensionActive(c);
  const outcomeColor = c.outcome === "expulsion" ? C.rose : c.outcome === "suspension" ? C.amber : C.slate;
  return (
    <div>
      <div style={s.cardHead}>
        <div>
          <div style={s.cardRef}>{c.case_ref} · {formatSheetDate(c.incident_date)}</div>
          <div style={s.cardTitle}>{labelFor(CATEGORIES, c.category)}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ ...s.pill, background: "#EEF1EA", color: C.slate }}>{labelFor(CASE_STATUSES, c.case_status)}</span>
          {c.outcome && <span style={{ ...s.pill, background: "#F6EFE3", color: outcomeColor }}>{labelFor(OUTCOMES, c.outcome)}</span>}
        </div>
      </div>

      {c.outcome === "suspension" && (
        <div style={s.line}>
          <strong>Suspension:</strong>{" "}
          {c.suspension_indefinite
            ? `from ${formatSheetDate(c.suspension_start ?? "")} · indefinite`
            : `${formatSheetDate(c.suspension_start ?? "")} → ${formatSheetDate(c.suspension_end ?? "")}`}
          {c.reinstated_on && (
            <span> · reinstated {formatSheetDate(c.reinstated_on)}{c.reinstated_by ? ` by ${c.reinstated_by}` : ""}</span>
          )}
        </div>
      )}
      {overdue && (
        <div style={s.warn}>
          The suspension period ended on {formatSheetDate(c.suspension_end ?? "")}. The student stays Suspended until you reinstate them.
        </div>
      )}

      <details style={{ marginTop: 8 }}>
        <summary style={s.summary}>Description &amp; details</summary>
        <div style={s.desc}>{c.description}</div>
        <div style={s.metaGrid}>
          {c.reported_by && <Meta k="Reported by" v={c.reported_by} />}
          {c.hearing_date && <Meta k="Hearing" v={formatSheetDate(c.hearing_date)} />}
          {c.decision_date && <Meta k="Decided" v={`${formatSheetDate(c.decision_date)}${c.decided_by ? ` · ${c.decided_by}` : ""}`} />}
          {c.letter_ref && <Meta k="Letter ref" v={c.letter_ref} />}
          {c.outcome_notes && <Meta k="Outcome notes" v={c.outcome_notes} />}
          {c.appeal_notes && <Meta k="Appeal notes" v={c.appeal_notes} />}
          {c.reinstatement_notes && <Meta k="Reinstatement notes" v={c.reinstatement_notes} />}
          <Meta k="Recorded by" v={`${c.created_by_name}`} />
        </div>
      </details>

      {canEdit && (
        <div style={s.actions}>
          <button style={s.ghostBtn} onClick={onEdit}>Edit</button>
          {active && <button style={s.reinstateBtn} onClick={onReinstate}>Reinstate student</button>}
        </div>
      )}
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
      <span style={{ color: C.slate }}>{k}: </span>{v}
    </div>
  );
}

function CaseForm({
  title, initial, submitLabel, lockOutcome = false, onCancel, onSubmit,
}: {
  title: string; initial: FormState; submitLabel: string; lockOutcome?: boolean;
  onCancel: () => void;
  /** Resolve to an error message to show, or null on success. */
  onSubmit: (f: FormState) => Promise<string | null>;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try { setErr(await onSubmit(f)); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} style={s.form}>
      <div style={s.formTitle}>{title}</div>

      <div style={s.grid2}>
        <Field label="Incident date *">
          <input type="date" required style={s.input} value={f.incident_date} max={todayIso()} onChange={(e) => set("incident_date", e.target.value)} />
        </Field>
        <Field label="Category *">
          <select required style={s.input} value={f.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Select…</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Description of the matter *">
        <textarea required rows={5} style={{ ...s.input, resize: "vertical", fontFamily: "inherit" }} value={f.description}
          placeholder="What happened, who reported it, and any evidence considered."
          onChange={(e) => set("description", e.target.value)} />
      </Field>

      <div style={s.grid2}>
        <Field label="Reported by">
          <input style={s.input} value={f.reported_by} placeholder="e.g. invigilator, HOD" onChange={(e) => set("reported_by", e.target.value)} />
        </Field>
        <Field label="Hearing date">
          <input type="date" style={s.input} value={f.hearing_date} onChange={(e) => set("hearing_date", e.target.value)} />
        </Field>
      </div>

      <div style={s.grid2}>
        <Field label="Case status">
          <select style={s.input} value={f.case_status} onChange={(e) => set("case_status", e.target.value)}>
            {CASE_STATUSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Outcome">
          <select style={s.input} value={f.outcome} disabled={lockOutcome} onChange={(e) => set("outcome", e.target.value)}>
            <option value="">Not decided yet</option>
            {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      {lockOutcome && <div style={s.hint}>This suspension has been reinstated, so its outcome and dates are locked.</div>}

      {f.outcome === "suspension" && (
        <div style={s.suspBox}>
          <div style={s.grid2}>
            <Field label="Suspension starts *">
              <input type="date" required style={s.input} value={f.suspension_start} disabled={lockOutcome} onChange={(e) => set("suspension_start", e.target.value)} />
            </Field>
            <Field label="Suspension ends">
              <input type="date" style={s.input} value={f.suspension_indefinite ? "" : f.suspension_end}
                required={!f.suspension_indefinite} disabled={f.suspension_indefinite || lockOutcome} min={f.suspension_start || undefined}
                onChange={(e) => set("suspension_end", e.target.value)} />
            </Field>
          </div>
          <label style={s.check}>
            <input type="checkbox" checked={f.suspension_indefinite} disabled={lockOutcome}
              onChange={(e) => set("suspension_indefinite", e.target.checked)} />
            Indefinite — until a committee reviews and reinstates the student
          </label>
        </div>
      )}
      {f.outcome === "expulsion" && (
        <div style={s.warn}>Saving an expulsion sets the student's status to Dropped, which is locked everywhere else in the app.</div>
      )}

      {f.outcome && (
        <>
          <div style={s.grid2}>
            <Field label="Decision date">
              <input type="date" style={s.input} value={f.decision_date} placeholder="Today" onChange={(e) => set("decision_date", e.target.value)} />
            </Field>
            <Field label="Decided by">
              <input style={s.input} value={f.decided_by} placeholder="Defaults to you" onChange={(e) => set("decided_by", e.target.value)} />
            </Field>
          </div>
          <div style={s.grid2}>
            <Field label="Letter reference">
              <input style={s.input} value={f.letter_ref} onChange={(e) => set("letter_ref", e.target.value)} />
            </Field>
            <Field label="Outcome notes">
              <input style={s.input} value={f.outcome_notes} onChange={(e) => set("outcome_notes", e.target.value)} />
            </Field>
          </div>
        </>
      )}

      {(f.case_status === "appealed" || f.appeal_notes) && (
        <Field label="Appeal notes">
          <textarea rows={2} style={{ ...s.input, resize: "vertical", fontFamily: "inherit" }} value={f.appeal_notes} onChange={(e) => set("appeal_notes", e.target.value)} />
        </Field>
      )}

      {err && <div style={s.errBox}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="submit" style={s.primaryBtn} disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
        <button type="button" style={s.ghostBtn} onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

function ReinstateForm({
  minDate, onCancel, onSubmit,
}: {
  minDate?: string; onCancel: () => void;
  onSubmit: (date: string, notes: string) => Promise<string | null>;
}) {
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try { setErr(await onSubmit(date, notes)); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} style={{ ...s.form, marginTop: 10 }}>
      <div style={s.formTitle}>Reinstate student</div>
      <div style={s.hint}>
        Their status will move to Not Yet Reported, so they report again (new lecture card and validity date) before showing as In Session.
      </div>
      <div style={s.grid2}>
        <Field label="Effective date">
          <input type="date" required style={s.input} value={date} min={minDate} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Notes">
          <input style={s.input} value={notes} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {err && <div style={s.errBox}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={s.reinstateBtn} disabled={saving}>{saving ? "Saving…" : "Confirm reinstatement"}</button>
        <button type="button" style={s.ghostBtn} onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, color: C.slate, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </label>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { marginTop: 32 },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  h2: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 18 },
  hint: { fontSize: 11.5, color: C.slate, lineHeight: 1.5, marginTop: 2 },
  empty: { fontSize: 13, color: C.slate, background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 8, padding: "14px 16px" },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "14px 16px", marginBottom: 10 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardRef: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, color: C.slate },
  cardTitle: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14.5, marginTop: 2 },
  pill: { fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20 },
  line: { fontSize: 13, marginTop: 8, lineHeight: 1.5 },
  summary: { fontSize: 12.5, color: C.teal, cursor: "pointer", fontWeight: 600 },
  desc: { fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", background: "#F7F8F4", borderRadius: 6, padding: "10px 12px", margin: "8px 0" },
  metaGrid: { display: "grid", gap: 3 },
  actions: { display: "flex", gap: 8, marginTop: 12 },
  suspBanner: { background: "#FBF0DC", color: "#8A5A0B", border: "1px solid #EBD3A0", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 12 },
  warn: { background: "#FBF0DC", color: "#8A5A0B", border: "1px solid #EBD3A0", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5, margin: "8px 0" },
  errBox: { background: "#F3E7E4", color: C.rose, borderRadius: 8, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5, margin: "8px 0" },
  form: { background: "#FAFBF8", border: `1px solid ${C.line}`, borderRadius: 8, padding: 14 },
  formTitle: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 10 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 6, padding: "7px 9px", fontSize: 13, background: "#fff" },
  suspBox: { background: "#FBF0DC55", border: "1px solid #EBD3A0", borderRadius: 8, padding: "10px 12px", marginBottom: 10 },
  check: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" },
  primaryBtn: { border: "none", background: C.ink, color: "#fff", borderRadius: 6, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  ghostBtn: { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", color: C.slate },
  reinstateBtn: { border: "none", background: C.teal, color: "#fff", borderRadius: 6, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
};

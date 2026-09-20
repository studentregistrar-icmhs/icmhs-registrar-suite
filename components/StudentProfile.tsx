"use client";

import { useState } from "react";
import type { StudentProfile as Profile, TimelineEntry } from "@/lib/studentTimeline";
import { formatSheetDate } from "@/lib/sheetDates";
import AppNav from "@/components/AppNav";

const STATUS_OPTIONS = [
  "Graduated", "In Session", "Attachment", "Clinicals",
  "Deferred", "Dropped", "Completed", "Not Yet Reported",
];

const C = {
  ink: "#122A28", bg: "#EEF1EA", card: "#FFFFFF", line: "#D9DFD3",
  teal: "#0F7268", rose: "#B0432E", slate: "#54625D",
};

type LockNotice = {
  termSlug: string;
  status: string;
  blockingTerm: string;
  blockingStatus: string;
  validityDate?: string;
  graduationCohort?: string;
};

export default function StudentProfile({
  initialProfile,
  canEdit = true,
  me,
}: {
  initialProfile: Profile;
  canEdit?: boolean;
  me: {
    displayName: string;
    role: "admin" | "editor" | "viewer";
    campusScope: "ALL" | "MAIN" | "NAKURU";
    departmentScope: string[] | null;
    termScope: string[] | null;
    canViewDeferments: boolean;
  };
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [pendingTerm, setPendingTerm] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string>("");
  const [pendingValidityDate, setPendingValidityDate] = useState<string>("");
  const [pendingGraduationCohort, setPendingGraduationCohort] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [lockNotice, setLockNotice] = useState<LockNotice | null>(null);

  async function refresh() {
    // Keep the same viewing-term context on refresh — otherwise a save would
    // silently jump back to whatever the current calendar term is.
    const res = await fetch(
      `/api/students/${encodeURIComponent(profile.admissionNo)}?term=${encodeURIComponent(profile.viewingTermSlug)}`,
      { cache: "no-store" }
    );
    if (res.ok) setProfile(await res.json());
  }

  async function save(
    termSlug: string,
    status: string,
    override = false,
    validityDate?: string,
    graduationCohort?: string
  ) {
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(profile.admissionNo)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termSlug, status, override, validityDate, graduationCohort }),
      });
      const json = await res.json();
      if (json.ok) {
        setLockNotice(null);
        setPendingTerm(null);
        await refresh();
      } else if (json.reason === "terminal-lock") {
        setLockNotice({ termSlug, status, blockingTerm: json.blockingTerm, blockingStatus: json.blockingStatus, validityDate, graduationCohort });
      } else {
        alert(`Couldn't update status: ${json.reason ?? "unknown error"}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <AppNav me={me} active="students" />
      <div style={styles.eyebrow}>{profile.admissionNo}</div>
      <h1 style={styles.h1}>{profile.name}</h1>
      <div style={styles.sub}>{profile.courseName || profile.courseCode} · {profile.campus}{profile.gender ? ` · ${profile.gender}` : ""}</div>
      <div style={styles.contactRow}>
        {profile.contacts && <span>📞 {profile.contacts}</span>}
        {profile.intakeYear && <span>Intake: {profile.intakeYear}</span>}
        {profile.graduationCohort && <span>🎓 Graduation cohort: {profile.graduationCohort}</span>}
      </div>
      <div style={styles.viewingNote}>
        Viewing as of {profile.timeline.find((e) => e.termSlug === profile.viewingTermSlug)?.termLabel ?? "the current term"} —
        only that term can be edited here; later terms aren't shown.
      </div>

      <div style={styles.timeline}>
        {profile.timeline.map((entry) => (
          <TimelineRow
            key={entry.termSlug}
            entry={entry}
            isPending={pendingTerm === entry.termSlug}
            saving={saving}
            canEdit={canEdit}
            onStartEdit={() => {
              setPendingTerm(entry.termSlug);
              setPendingStatus(entry.status === "Unmarked" ? STATUS_OPTIONS[0] : entry.status);
              // Prefill from what's already on file, so re-saving an
              // already-"In Session" student doesn't silently blank out
              // their validity date or force it to be retyped.
              setPendingValidityDate(entry.validityDate || "");
              setPendingGraduationCohort(profile.graduationCohort || "");
            }}
            onCancel={() => setPendingTerm(null)}
            pendingStatus={pendingStatus}
            onStatusChange={setPendingStatus}
            pendingValidityDate={pendingValidityDate}
            onValidityDateChange={setPendingValidityDate}
            pendingGraduationCohort={pendingGraduationCohort}
            onGraduationCohortChange={setPendingGraduationCohort}
            onSave={() =>
              save(
                entry.termSlug,
                pendingStatus,
                false,
                pendingStatus === "In Session" ? pendingValidityDate : undefined,
                pendingStatus === "Graduated" ? pendingGraduationCohort : undefined
              )
            }
          />
        ))}
        {profile.timeline.length === 0 && (
          <div style={{ color: C.slate, fontSize: 13 }}>No status data found for this student yet.</div>
        )}
      </div>

      {lockNotice && (
        <div style={styles.lockOverlay} onClick={() => setLockNotice(null)}>
          <div style={styles.lockModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.lockTitle}>This student is locked</h3>
            <p style={styles.lockBody}>
              {profile.name} was marked <strong>{lockNotice.blockingStatus}</strong> in{" "}
              <strong>{lockNotice.blockingTerm}</strong>. Graduated and Dropped are treated as final —
              changing their status elsewhere requires an explicit override.
            </p>
            <p style={styles.lockBody}>
              Continue and set <strong>{lockNotice.termSlug}</strong> to <strong>{lockNotice.status}</strong> anyway?
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={styles.cancelBtn} onClick={() => setLockNotice(null)}>Cancel</button>
              <button
                style={styles.overrideBtn}
                onClick={() => save(lockNotice.termSlug, lockNotice.status, true, lockNotice.validityDate, lockNotice.graduationCohort)}
              >
                Override and save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({
  entry, isPending, saving, canEdit, onStartEdit, onCancel,
  pendingStatus, onStatusChange,
  pendingValidityDate, onValidityDateChange,
  pendingGraduationCohort, onGraduationCohortChange,
  onSave,
}: {
  entry: TimelineEntry;
  isPending: boolean;
  saving: boolean;
  canEdit: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  pendingStatus: string;
  onStatusChange: (s: string) => void;
  pendingValidityDate: string;
  onValidityDateChange: (d: string) => void;
  pendingGraduationCohort: string;
  onGraduationCohortChange: (c: string) => void;
  onSave: () => void;
}) {
  const isTerminal = entry.status === "Graduated" || entry.status === "Dropped";
  const needsValidityDate = pendingStatus === "In Session";
  const canSave = !needsValidityDate || pendingValidityDate.trim() !== "";
  return (
    <div style={styles.row}>
      <div>
        <div style={styles.rowLabel}>{entry.termLabel}</div>
        {/* Only ever populated for an "In Session" status on a term whose
            sheet has these columns — so this line simply doesn't render for
            other statuses or older terms, rather than showing blanks. */}
        {(entry.validityDate || entry.dateReported) && (
          <div style={styles.rowMeta}>
            {entry.validityDate && <span>Valid until {formatSheetDate(entry.validityDate)}</span>}
            {entry.validityDate && entry.dateReported && <span style={{ opacity: 0.5 }}> · </span>}
            {entry.dateReported && <span>Reported {formatSheetDate(entry.dateReported)}</span>}
          </div>
        )}
      </div>
      {isPending ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <select value={pendingStatus} onChange={(e) => onStatusChange(e.target.value)} style={styles.select}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {pendingStatus === "In Session" && (
            <input
              type="date"
              style={styles.select}
              value={pendingValidityDate}
              onChange={(e) => onValidityDateChange(e.target.value)}
              title="Lecture card validity date — today's date is auto-recorded alongside it as the date reported"
            />
          )}
          {pendingStatus === "Graduated" && (
            <input
              type="text"
              placeholder="Cohort year, e.g. 2026"
              style={{ ...styles.select, width: 140 }}
              value={pendingGraduationCohort}
              onChange={(e) => onGraduationCohortChange(e.target.value)}
              title="Graduation cohort year — leave blank to skip tagging it now"
            />
          )}
          <button style={styles.saveBtn} disabled={saving || !canSave} onClick={onSave}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button style={styles.cancelBtnSmall} onClick={onCancel}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ ...styles.statusPill, background: isTerminal ? "#F3E7E4" : "#EAF3EF", color: isTerminal ? C.rose : C.teal }}>
            {entry.status}
          </span>
          {entry.editable && canEdit && (
            <button style={styles.editBtn} onClick={onStartEdit}>Edit</button>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, padding: "40px 32px", minHeight: "100vh", boxSizing: "border-box", maxWidth: 640 },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: C.teal, fontWeight: 600 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 28, margin: "4px 0 0" },
  sub: { fontSize: 13, color: C.slate, marginBottom: 6 },
  contactRow: { display: "flex", gap: 16, fontSize: 12.5, color: C.slate, fontFamily: "IBM Plex Mono, monospace", marginBottom: 8, flexWrap: "wrap" },
  viewingNote: { fontSize: 12, color: C.slate, marginBottom: 20, lineHeight: 1.5 },
  timeline: { display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "14px 16px" },
  rowLabel: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14 },
  rowMeta: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, color: C.slate, marginTop: 3 },
  statusPill: { fontSize: 12.5, fontWeight: 600, padding: "4px 10px", borderRadius: 20 },
  editBtn: { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: C.slate },
  select: { border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 },
  saveBtn: { border: "none", background: C.ink, color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  cancelBtnSmall: { border: "none", background: "transparent", color: C.slate, fontSize: 12, cursor: "pointer" },
  lockOverlay: { position: "fixed", inset: 0, background: "rgba(18,42,40,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 },
  lockModal: { background: "#fff", borderRadius: 10, padding: 24, maxWidth: 420, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" },
  lockTitle: { fontFamily: "Space Grotesk, sans-serif", fontSize: 18, margin: "0 0 10px", color: C.rose },
  lockBody: { fontSize: 13.5, color: C.slate, lineHeight: 1.6, margin: "0 0 8px" },
  cancelBtn: { flex: 1, border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: "9px 0", cursor: "pointer", fontSize: 13 },
  overrideBtn: { flex: 1, border: "none", background: C.rose, color: "#fff", borderRadius: 6, padding: "9px 0", cursor: "pointer", fontSize: 13, fontWeight: 600 },
};

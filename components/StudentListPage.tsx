"use client";

import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/aggregate";
import { getDepartment } from "@/lib/departments";
import AppNav from "@/components/AppNav";
import BackLink from "@/components/BackLink";
import StudentListContent from "@/components/StudentListContent";

const C = { ink: "#122A28", bg: "#EEF1EA", slate: "#54625D", teal: "#0F7268", line: "#D9DFD3" };

/**
 * The full-page counterpart to the status drawer in Dashboard.tsx — same
 * breakdown + searchable table + export (via StudentListContent), just with
 * room to work: no 560px cap, a URL you can bookmark or hand to a colleague,
 * and nothing closing over it when you switch tabs. Reached via "View full
 * page" inside the drawer for every status category (Graduated, In Session,
 * Deferred, Unmarked, etc.) — this one component covers all of them, same
 * as the drawer does.
 */
export default function StudentListPage({
  initialData,
  termLabel,
  apiTermSlug,
  me,
  canViewContacts = false,
  initialStatus,
  initialCampus,
  initialGender,
  initialCourse,
  initialDepartment,
  initialIntake,
}: {
  initialData: DashboardData;
  termLabel: string;
  apiTermSlug: string;
  me: {
    displayName: string;
    role: "admin" | "editor" | "viewer";
    campusScope: "ALL" | "MAIN" | "NAKURU";
    departmentScope: string[] | null;
    termScope: string[] | null;
    canViewDeferments: boolean;
  };
  /** Server-decided — see lib/contacts/access.ts. */
  canViewContacts?: boolean;
  initialStatus: string;
  initialCampus?: string;
  initialGender?: string;
  initialCourse?: string;
  initialDepartment?: string;
  initialIntake?: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState("");

  const allStudentsFlat = useMemo(() => {
    const out: { admissionNo: string; name: string; courseCode: string; courseName: string; campus: string; gender: string; contacts: string; intakeYear: string; graduationCohort: string; status: string }[] = [];
    for (const [statusKey, list] of Object.entries(initialData.studentsByStatus)) {
      for (const s of list) out.push({ ...s, status: statusKey });
    }
    return out;
  }, [initialData]);

  // Same ambient scope (campus/gender/course/department/intake) the
  // dashboard had active when "View full page" was clicked, carried over
  // via the URL so this shows the identical slice, not everyone.
  const scopedStudents = useMemo(() => {
    let rows = allStudentsFlat;
    if (initialCampus) rows = rows.filter((s) => s.campus === initialCampus);
    if (initialGender) rows = rows.filter((s) => s.gender === initialGender);
    if (initialCourse) rows = rows.filter((s) => s.courseCode === initialCourse);
    if (initialDepartment) rows = rows.filter((s) => getDepartment(s.courseCode) === initialDepartment);
    if (initialIntake) rows = rows.filter((s) => s.intakeYear === initialIntake);
    return rows;
  }, [allStudentsFlat, initialCampus, initialGender, initialCourse, initialDepartment, initialIntake]);

  const statusOptions = useMemo(
    () => Object.keys(initialData.studentsByStatus).filter((k) => initialData.studentsByStatus[k].length > 0 || k === status),
    [initialData, status]
  );

  const students = useMemo(() => {
    let rows = scopedStudents.filter((s) => s.status === status);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((s) => s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q));
    }
    return rows;
  }, [scopedStudents, status, query]);

  const unmarkedStudents = useMemo(() => {
    if (status !== "In Session") return [];
    return scopedStudents.filter((s) => s.status === "Unmarked");
  }, [scopedStudents, status]);

  const scopeNote = [
    initialCampus,
    initialGender,
    initialCourse,
    initialDepartment,
    initialIntake && `intake ${initialIntake}`,
  ].filter(Boolean).join(" · ");

  return (
    <div style={styles.page}>
      <AppNav me={me} />
      <BackLink fallbackHref={`/terms/${apiTermSlug}`} style={{ marginBottom: 14 }} />
      <div style={styles.header}>
        <div style={styles.eyebrow}>{termLabel}{scopeNote ? ` · ${scopeNote}` : ""}</div>
        <div style={styles.statusRow}>
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setQuery(""); }}
              style={{ ...styles.statusChip, ...(s === status ? styles.statusChipActive : null) }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.panel}>
        <StudentListContent
          status={status}
          students={students}
          unmarkedStudents={unmarkedStudents}
          termSlug={apiTermSlug}
          query={query}
          onQueryChange={setQuery}
          autoFocusSearch={false}
          canViewContacts={canViewContacts}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: C.bg, color: C.ink, padding: "28px 32px 60px", minHeight: "100vh", boxSizing: "border-box" },
  header: { marginBottom: 18 },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, color: C.slate, marginBottom: 10 },
  statusRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  statusChip: { border: `1px solid ${C.line}`, background: "#fff", color: C.ink, borderRadius: 20, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  statusChipActive: { background: C.ink, color: "#fff", borderColor: C.ink },
  panel: { background: "#fff", borderRadius: 10, padding: "22px 24px", boxShadow: "0 1px 3px rgba(18,42,40,0.07)", border: `1px solid ${C.line}`, maxWidth: 1200 },
};

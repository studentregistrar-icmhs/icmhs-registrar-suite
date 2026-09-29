/**
 * Shared by server code and the profile UI — no server-only imports here.
 */

export const CATEGORIES = [
  { value: "exam_malpractice", label: "Examination malpractice" },
  { value: "academic_dishonesty", label: "Academic dishonesty / plagiarism" },
  { value: "attendance", label: "Attendance / absenteeism" },
  { value: "conduct", label: "Misconduct toward staff or students" },
  { value: "clinical_conduct", label: "Clinical / attachment conduct" },
  { value: "substance", label: "Substance abuse" },
  { value: "property", label: "Damage to or theft of property" },
  { value: "other", label: "Other" },
] as const;

export const CASE_STATUSES = [
  { value: "open", label: "Open" },
  { value: "hearing", label: "Hearing" },
  { value: "decided", label: "Decided" },
  { value: "appealed", label: "Appealed" },
  { value: "closed", label: "Closed" },
] as const;

export const OUTCOMES = [
  { value: "warning", label: "Warning" },
  { value: "final_warning", label: "Final warning" },
  { value: "suspension", label: "Suspension" },
  { value: "expulsion", label: "Expulsion" },
  { value: "no_action", label: "No action" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];
export type CaseStatusValue = (typeof CASE_STATUSES)[number]["value"];
export type OutcomeValue = (typeof OUTCOMES)[number]["value"];

export const labelFor = (
  list: readonly { value: string; label: string }[],
  value: string | null | undefined
): string => list.find((x) => x.value === value)?.label ?? (value ?? "");

export type DisciplinaryCase = {
  id: number;
  case_ref: string;
  admission_no: string;
  student_name: string;
  course_code: string | null;
  campus: "MAIN" | "NAKURU";
  term_slug: string;
  incident_date: string;
  reported_by: string | null;
  category: CategoryValue;
  description: string;
  case_status: CaseStatusValue;
  hearing_date: string | null;
  outcome: OutcomeValue | null;
  outcome_notes: string | null;
  decision_date: string | null;
  decided_by: string | null;
  letter_ref: string | null;
  appeal_notes: string | null;
  suspension_start: string | null;
  suspension_end: string | null;
  suspension_indefinite: boolean;
  reinstated_on: string | null;
  reinstated_by: string | null;
  reinstatement_notes: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

/** A suspension is "active" from decision until someone records the
 * reinstatement — it does NOT lapse silently on its end date, so the
 * registrar always makes (and logs) the call to put the student back. */
export function isSuspensionActive(c: Pick<DisciplinaryCase, "outcome" | "reinstated_on">): boolean {
  return c.outcome === "suspension" && !c.reinstated_on;
}

/** Fixed-term suspension whose end date has passed but hasn't been reinstated yet. */
export function isReinstatementOverdue(
  c: Pick<DisciplinaryCase, "outcome" | "reinstated_on" | "suspension_indefinite" | "suspension_end">,
  todayIso: string
): boolean {
  return (
    isSuspensionActive(c) &&
    !c.suspension_indefinite &&
    !!c.suspension_end &&
    c.suspension_end < todayIso
  );
}

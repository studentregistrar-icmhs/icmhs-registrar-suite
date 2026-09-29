import { sql } from "@/lib/auth/db";
import {
  CATEGORIES, CASE_STATUSES, OUTCOMES,
  type DisciplinaryCase, type CategoryValue, type CaseStatusValue, type OutcomeValue,
} from "./constants";

/** The fields a registrar can type/select. Everything else on a case
 * (student snapshot, term, reinstatement, timestamps) is set by the system. */
export type CaseFields = {
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
};

const FIELD_KEYS: (keyof CaseFields)[] = [
  "incident_date", "reported_by", "category", "description", "case_status",
  "hearing_date", "outcome", "outcome_notes", "decision_date", "decided_by",
  "letter_ref", "appeal_notes", "suspension_start", "suspension_end", "suspension_indefinite",
];

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};

export type Validated = { ok: true; fields: CaseFields } | { ok: false; reason: string };

/**
 * Merges what the client sent over `base` (the existing case, on update)
 * and validates the RESULT — so a PATCH with one field can't leave the
 * case in an inconsistent state. Also fills in the obvious defaults: a
 * chosen outcome moves an open/hearing case to "decided", stamps today as
 * the decision date and the signed-in user as the decider.
 */
export function mergeAndValidate(
  raw: Record<string, any>,
  base: Partial<CaseFields> | null,
  actorName: string
): Validated {
  const m: Record<string, any> = { ...(base ?? {}) };
  for (const k of FIELD_KEYS) if (raw[k] !== undefined) m[k] = raw[k];

  const incident_date = m.incident_date;
  if (!isIsoDate(incident_date)) return { ok: false, reason: "Incident date is required." };
  if (incident_date > todayIso()) return { ok: false, reason: "Incident date can't be in the future." };

  if (!CATEGORIES.some((c) => c.value === m.category)) return { ok: false, reason: "Choose a category." };
  const description = text(m.description, 8000);
  if (!description) return { ok: false, reason: "A description of the matter is required." };

  let case_status = m.case_status ?? "open";
  if (!CASE_STATUSES.some((s) => s.value === case_status)) return { ok: false, reason: "Invalid case status." };

  const hearing_date = m.hearing_date ? String(m.hearing_date) : null;
  if (hearing_date && !isIsoDate(hearing_date)) return { ok: false, reason: "Hearing date is not a valid date." };

  const outcome: OutcomeValue | null = m.outcome ? m.outcome : null;
  if (outcome && !OUTCOMES.some((o) => o.value === outcome)) return { ok: false, reason: "Invalid outcome." };

  let decision_date = m.decision_date ? String(m.decision_date) : null;
  let decided_by = text(m.decided_by, 200);
  if (outcome) {
    if (case_status === "open" || case_status === "hearing") case_status = "decided";
    if (!decision_date) decision_date = todayIso();
    if (!decided_by) decided_by = actorName;
  } else if (case_status === "decided") {
    return { ok: false, reason: "Choose an outcome, or set the case status back to Open or Hearing." };
  }
  if (decision_date && !isIsoDate(decision_date)) return { ok: false, reason: "Decision date is not a valid date." };

  let suspension_start: string | null = null;
  let suspension_end: string | null = null;
  let suspension_indefinite = false;
  if (outcome === "suspension") {
    suspension_start = m.suspension_start ? String(m.suspension_start) : null;
    if (!isIsoDate(suspension_start)) return { ok: false, reason: "A suspension needs a start date." };
    suspension_indefinite = !!m.suspension_indefinite;
    if (!suspension_indefinite) {
      suspension_end = m.suspension_end ? String(m.suspension_end) : null;
      if (!isIsoDate(suspension_end)) return { ok: false, reason: "Give an end date, or mark the suspension as indefinite." };
      if (suspension_end < suspension_start) return { ok: false, reason: "The suspension can't end before it starts." };
    }
  }

  return {
    ok: true,
    fields: {
      incident_date,
      reported_by: text(m.reported_by, 200),
      category: m.category,
      description,
      case_status,
      hearing_date,
      outcome,
      outcome_notes: text(m.outcome_notes, 4000),
      decision_date,
      decided_by,
      letter_ref: text(m.letter_ref, 100),
      appeal_notes: text(m.appeal_notes, 4000),
      suspension_start,
      suspension_end,
      suspension_indefinite,
    },
  };
}

export async function listCasesForStudent(admissionNo: string): Promise<DisciplinaryCase[]> {
  return (await sql`
    SELECT * FROM disciplinary_cases WHERE admission_no = ${admissionNo}
    ORDER BY incident_date DESC, id DESC
  `) as DisciplinaryCase[];
}

export async function getCase(id: number): Promise<DisciplinaryCase | null> {
  const rows = (await sql`SELECT * FROM disciplinary_cases WHERE id = ${id} LIMIT 1`) as DisciplinaryCase[];
  return rows[0] ?? null;
}

export async function createCase(opts: {
  fields: CaseFields;
  student: { admissionNo: string; name: string; courseCode: string; campus: "MAIN" | "NAKURU" };
  termSlug: string;
  actor: { id: number; name: string };
}): Promise<DisciplinaryCase> {
  const f = opts.fields;
  const s = opts.student;
  const rows = (await sql`
    INSERT INTO disciplinary_cases (
      admission_no, student_name, course_code, campus, term_slug,
      incident_date, reported_by, category, description,
      case_status, hearing_date, outcome, outcome_notes, decision_date, decided_by, letter_ref, appeal_notes,
      suspension_start, suspension_end, suspension_indefinite,
      created_by_id, created_by_name
    ) VALUES (
      ${s.admissionNo}, ${s.name}, ${s.courseCode}, ${s.campus}, ${opts.termSlug},
      ${f.incident_date}, ${f.reported_by}, ${f.category}, ${f.description},
      ${f.case_status}, ${f.hearing_date}, ${f.outcome}, ${f.outcome_notes}, ${f.decision_date}, ${f.decided_by}, ${f.letter_ref}, ${f.appeal_notes},
      ${f.suspension_start}, ${f.suspension_end}, ${f.suspension_indefinite},
      ${opts.actor.id}, ${opts.actor.name}
    )
    RETURNING *
  `) as DisciplinaryCase[];
  return rows[0];
}

export async function updateCase(id: number, f: CaseFields): Promise<DisciplinaryCase | null> {
  const rows = (await sql`
    UPDATE disciplinary_cases SET
      incident_date = ${f.incident_date}, reported_by = ${f.reported_by}, category = ${f.category},
      description = ${f.description}, case_status = ${f.case_status}, hearing_date = ${f.hearing_date},
      outcome = ${f.outcome}, outcome_notes = ${f.outcome_notes}, decision_date = ${f.decision_date},
      decided_by = ${f.decided_by}, letter_ref = ${f.letter_ref}, appeal_notes = ${f.appeal_notes},
      suspension_start = ${f.suspension_start}, suspension_end = ${f.suspension_end},
      suspension_indefinite = ${f.suspension_indefinite}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `) as DisciplinaryCase[];
  return rows[0] ?? null;
}

/** Only succeeds for a suspension that hasn't already been reinstated. */
export async function markReinstated(
  id: number,
  on: string,
  by: string,
  notes: string | null
): Promise<DisciplinaryCase | null> {
  const rows = (await sql`
    UPDATE disciplinary_cases SET
      reinstated_on = ${on}, reinstated_by = ${by}, reinstatement_notes = ${notes},
      case_status = 'closed', updated_at = now()
    WHERE id = ${id} AND outcome = 'suspension' AND reinstated_on IS NULL
    RETURNING *
  `) as DisciplinaryCase[];
  return rows[0] ?? null;
}

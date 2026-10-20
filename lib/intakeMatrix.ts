import { DEPARTMENTS, getDepartment } from "./departments";
import { parseIntake } from "./intake";

/** The only three student fields the matrix needs. */
export type MatrixStudent = { courseCode: string; courseName: string; intakeYear: string };

export type IntakeColumn = {
  /** Stable key — "YYYY-MM", or NO_INTAKE_KEY for blank/unrecognised values. */
  key: string;
  label: string;
};

export type MatrixRow = {
  code: string;
  name: string;
  counts: Record<string, number>;
  total: number;
};

export type MatrixGroup = {
  department: string;
  rows: MatrixRow[];
  counts: Record<string, number>;
  total: number;
};

export type IntakeMatrix = {
  columns: IntakeColumn[];
  groups: MatrixGroup[];
  grandCounts: Record<string, number>;
  grandTotal: number;
};

export const NO_INTAKE_KEY = "none";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function intakeKey(raw: string): { key: string; label: string; order: number } {
  const p = parseIntake(raw);
  if (!p) return { key: NO_INTAKE_KEY, label: "No intake", order: Infinity };
  return {
    key: `${p.year}-${String(p.month).padStart(2, "0")}`,
    label: `${MONTH_NAMES[p.month - 1]} ${p.year}`,
    order: p.year * 12 + p.month,
  };
}

/**
 * Course × intake admissions matrix: how many students on the roster were
 * admitted to each course in each intake, grouped by School/Department with
 * a subtotal per department and a grand total.
 *
 * Intake spellings are normalised through parseIntake ("Sep-2025" and
 * "SEP - 2025" land in the same column). Students whose Intake/Year is blank
 * or unrecognisable are NOT dropped — they go in a trailing "No intake"
 * column (only present when there are any) so row totals always equal the
 * real head-count for that course.
 */
export function buildIntakeMatrix(students: MatrixStudent[]): IntakeMatrix {
  const colMeta = new Map<string, { label: string; order: number }>();
  const courses = new Map<string, { name: string; dept: string; counts: Record<string, number> }>();

  for (const s of students) {
    const ik = intakeKey(s.intakeYear);
    if (!colMeta.has(ik.key)) colMeta.set(ik.key, { label: ik.label, order: ik.order });

    const code = s.courseCode?.trim() || "UNKNOWN";
    let c = courses.get(code);
    if (!c) {
      c = { name: s.courseName?.trim() || code, dept: getDepartment(code), counts: {} };
      courses.set(code, c);
    }
    c.counts[ik.key] = (c.counts[ik.key] ?? 0) + 1;
  }

  const columns: IntakeColumn[] = [...colMeta.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, m]) => ({ key, label: m.label }));

  const sum = (into: Record<string, number>, from: Record<string, number>) => {
    for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
  };
  const totalOf = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

  const byDept = new Map<string, MatrixRow[]>();
  for (const [code, c] of courses) {
    const row: MatrixRow = { code, name: c.name, counts: c.counts, total: totalOf(c.counts) };
    if (!byDept.has(c.dept)) byDept.set(c.dept, []);
    byDept.get(c.dept)!.push(row);
  }

  // Known departments in their fixed display order, then anything else
  // (e.g. "Unassigned" for a course code not yet in departments.ts).
  const deptOrder = [
    ...DEPARTMENTS.filter((d) => byDept.has(d)),
    ...[...byDept.keys()].filter((d) => !DEPARTMENTS.includes(d)).sort(),
  ];

  const grandCounts: Record<string, number> = {};
  const groups: MatrixGroup[] = deptOrder.map((department) => {
    const rows = byDept.get(department)!.sort((a, b) => a.name.localeCompare(b.name));
    const counts: Record<string, number> = {};
    for (const r of rows) sum(counts, r.counts);
    sum(grandCounts, counts);
    return { department, rows, counts, total: totalOf(counts) };
  });

  return { columns, groups, grandCounts, grandTotal: totalOf(grandCounts) };
}

/** Flat rows for CSV export: Department, Code, Course, one column per intake, Total. */
export function intakeMatrixToCsvRows(m: IntakeMatrix): { headers: string[]; rows: (string | number)[][] } {
  const headers = ["Department", "Code", "Course", ...m.columns.map((c) => c.label), "Total"];
  const rows: (string | number)[][] = [];
  for (const g of m.groups) {
    for (const r of g.rows) {
      rows.push([g.department, r.code, r.name, ...m.columns.map((c) => r.counts[c.key] ?? 0), r.total]);
    }
    rows.push([g.department, "", "SUB-TOTAL", ...m.columns.map((c) => g.counts[c.key] ?? 0), g.total]);
  }
  rows.push(["", "", "GRAND TOTAL", ...m.columns.map((c) => m.grandCounts[c.key] ?? 0), m.grandTotal]);
  return { headers, rows };
}

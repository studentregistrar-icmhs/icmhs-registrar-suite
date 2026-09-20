import { DEPARTMENTS } from "../departments";
import { TERMS } from "../terms";

/** Parses+validates a department-scope array from a request body. Returns
 * null (unrestricted) for an empty/omitted array, or throws a descriptive
 * Error if any entry doesn't match a real department name — validated
 * against lib/departments.ts rather than a DB constraint, since that list
 * can change without a migration. */
export function parseDepartmentScope(input: unknown): string[] | null {
  if (input == null) return null;
  if (!Array.isArray(input)) throw new Error("departmentScope must be an array.");
  const clean = input.map((v) => String(v).trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const invalid = clean.filter((d) => !DEPARTMENTS.includes(d));
  if (invalid.length > 0) throw new Error(`Unknown department(s): ${invalid.join(", ")}`);
  return clean;
}

/** Same idea for term scope, validated against lib/terms.ts's TERMS. */
export function parseTermScope(input: unknown): string[] | null {
  if (input == null) return null;
  if (!Array.isArray(input)) throw new Error("termScope must be an array.");
  const clean = input.map((v) => String(v).trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const validSlugs = new Set(TERMS.map((t) => t.slug));
  const invalid = clean.filter((slug) => !validSlugs.has(slug));
  if (invalid.length > 0) throw new Error(`Unknown term(s): ${invalid.join(", ")}`);
  return clean;
}

/** Course scope — unlike department/term, there's no static list of course
 * codes to validate against (see lib/courses.ts: they're derived live from
 * the roster, not a config file). The Manage Accounts UI only ever offers
 * codes it fetched from that live list, so a typo can't reach here through
 * normal use — this just does light shape-checking (non-empty strings),
 * not membership validation, to avoid coupling account writes to a live
 * Sheets fetch. Worth knowing: an entry that doesn't match any real course
 * (e.g. a stale code after a course is renamed) fails safe — the account
 * simply sees nothing for that entry, not everything. */
export function parseCourseScope(input: unknown): string[] | null {
  if (input == null) return null;
  if (!Array.isArray(input)) throw new Error("courseScope must be an array.");
  const clean = input.map((v) => String(v).trim()).filter(Boolean);
  return clean.length === 0 ? null : clean;
}

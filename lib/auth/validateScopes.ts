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

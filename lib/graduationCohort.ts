/**
 * One column, on both MAIN CAMPUS and NAKURU CAMPUS tabs, holding the year a
 * student graduated — independent of which term or mechanism set their
 * "Graduated" status. Unlike a term's status column, this isn't tied to any
 * particular term in lib/terms.ts: a student only graduates once, so there's
 * exactly one cohort value per student, not one per term.
 *
 * Placed right after the Sept-Dec 2026 term's AA/AB/AC (status/validity/
 * date-reported) columns — appended at the end, so it doesn't shift or
 * touch any existing column. If you add this column to the live sheet at a
 * different letter, update it here (nowhere else needs to change).
 */
export const GRADUATION_COHORT_COLUMN = "AD";

/** Header text to use for the new column, if you're adding it fresh. */
export const GRADUATION_COHORT_COLUMN_HEADER = "Graduation Cohort";

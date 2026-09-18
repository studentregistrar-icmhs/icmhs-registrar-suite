/**
 * Normalizes a date cell read from Google Sheets into a plain "YYYY-MM-DD"
 * string, or "" if the cell is empty or unparseable.
 *
 * Why this is needed: fetchSheetRows() requests UNFORMATTED_VALUE, so what
 * comes back depends on how the cell was filled in:
 *
 *   - Written by this app (valueInputOption RAW, e.g. writeValidityDate)
 *     -> a plain string like "2026-09-14".
 *   - Typed into the sheet by hand, or auto-coerced by Sheets into a real
 *     date cell -> a serial NUMBER (days since the 1899-12-30 epoch), e.g.
 *     46280. Rendering that straight to the page shows the registrar a
 *     meaningless five-digit number instead of a date.
 *
 * Both cases have to be handled, since a registrar can always edit the
 * sheet directly rather than going through the dashboard.
 */

// Google Sheets (like Excel) counts days from 1899-12-30.
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeSheetDate(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    // Serial dates are day counts; a fractional part is the time of day,
    // which we don't care about for a date-only display.
    const ms = SHEETS_EPOCH_MS + Math.floor(value) * MS_PER_DAY;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) return "";

  // Already the shape we want (what this app writes).
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // A numeric string is still a serial date (Sheets sometimes returns
  // numbers as strings depending on cell formatting).
  if (/^\d+(\.\d+)?$/.test(raw)) return normalizeSheetDate(Number(raw));

  // Anything else (e.g. "14/09/2026", "Sep 14, 2026") — hand it to Date and
  // use it only if it actually parses. Returning the original string on
  // failure would be worse than showing nothing, since it may be a stray
  // note rather than a date.
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

/** Formats a normalized date for display, e.g. "14 Sep 2026". Returns ""
 * for an empty/unparseable value so callers can conditionally render. */
export function formatSheetDate(value: unknown): string {
  const iso = normalizeSheetDate(value);
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

import { fetchSheetRows, updateRange, appendRow, appendRows, batchUpdateRanges } from "./googleSheets";
import { findStudentRow } from "./rosterLookup";
import { getTerm, getPreviousTerm, TERMS } from "./terms";
import { reconcile, STATUS_LABEL, LABEL_TO_FLAG, TERMINAL_STATUSES, CARRY_FORWARD_STATUSES } from "./reconcile";
import { readFlagsAt, LAYOUT_FOR_WRITE, parseCampusRows } from "./parse";
import { inheritedTerminalFlags } from "./statusLog";
import { columnIndex } from "./columns";
import { loadTermData } from "./loadTermData";

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: "terminal-lock"; blockingTerm: string; blockingStatus: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "unsupported-term" }
  | { ok: false; reason: "invalid-status" };

/**
 * Checks every live term for this student and returns the first one found
 * with a terminal status (Graduated/Dropped), if any. A student who has
 * ever graduated or dropped is locked everywhere unless overridden.
 */
async function findTerminalBlock(admissionNo: string): Promise<{ term: string; status: string } | null> {
  const loc = await findStudentRow(admissionNo);
  if (loc) {
    for (const term of TERMS) {
      if (term.source.kind !== "live-legacy") continue;
      const flags = readFlagsAt(loc.rawRow, loc.campus, term.source.block);
      const r = reconcile(flags);
      if (r.canonicalStatus !== "UNMARKED" && TERMINAL_STATUSES.includes(r.canonicalStatus)) {
        return { term: term.label, status: STATUS_LABEL[r.canonicalStatus] };
      }
    }
  }

  const logRows = await fetchSheetRows("STATUS LOG!A:D").catch(() => []);
  const latestPerTerm = new Map<string, string>();
  for (let i = 1; i < logRows.length; i++) {
    const [rowAdmission, term, status] = logRows[i] ?? [];
    if (String(rowAdmission) !== admissionNo) continue;
    latestPerTerm.set(String(term), String(status));
  }
  for (const [term, status] of latestPerTerm) {
    const key = LABEL_TO_FLAG[status.trim()];
    if (key && TERMINAL_STATUSES.includes(key)) {
      return { term, status };
    }
  }

  return null;
}

/** Sets a student's status for a term. Enforces the terminal lock unless override is true. */
export async function updateStudentStatus(opts: {
  admissionNo: string;
  termSlug: string;
  newStatusLabel: string;
  override?: boolean;
}): Promise<WriteResult> {
  const { admissionNo, termSlug, newStatusLabel, override } = opts;
  const term = getTerm(termSlug);
  if (!term) return { ok: false, reason: "unsupported-term" };
  const newKey = LABEL_TO_FLAG[newStatusLabel];
  if (!newKey) return { ok: false, reason: "invalid-status" };

  if (!override) {
    const blocked = await findTerminalBlock(admissionNo);
    if (blocked) {
      return { ok: false, reason: "terminal-lock", blockingTerm: blocked.term, blockingStatus: blocked.status };
    }
  }

  if (term.source.kind === "live-legacy") {
    const loc = await findStudentRow(admissionNo);
    if (!loc) return { ok: false, reason: "not-found" };
    const layout = LAYOUT_FOR_WRITE[loc.campus];
    const startCol = term.source.block === "flagsJanApr" ? layout.janApr : layout.mayAug;
    const values = (Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((k) =>
      k === newKey ? STATUS_LABEL[newKey] : "-"
    );
    const range = `${loc.campus === "MAIN" ? "MAIN CAMPUS" : "NAKURU CAMPUS"}!${colLetter(startCol)}${loc.sheetRowNumber}:${colLetter(startCol + 7)}${loc.sheetRowNumber}`;
    await updateRange(range, values);
    return { ok: true };
  }

  if (term.source.kind === "live-statuslog") {
    await appendRow("STATUS LOG", [admissionNo, term.source.termLabel, newStatusLabel, new Date().toISOString().slice(0, 10)]);
    return { ok: true };
  }

  if (term.source.kind === "live-column") {
    const loc = await findStudentRow(admissionNo);
    if (!loc) return { ok: false, reason: "not-found" };
    const tabName = loc.campus === "MAIN" ? "MAIN CAMPUS" : "NAKURU CAMPUS";
    await updateRange(`${tabName}!${term.source.column}${loc.sheetRowNumber}`, [newStatusLabel]);
    return { ok: true };
  }

  return { ok: false, reason: "unsupported-term" }; // static historical terms are read-only
}

/** Clears every flag except the canonical one for a legacy term's conflict. Never touches Status Log terms (they can't conflict).
 * Logs a RESOLVE LOG row first, capturing exactly what was set before the write — this is what makes a mistaken
 * resolve recoverable: the log has enough to manually restore the previous flags in the sheet if needed. */
export async function resolveLegacyConflict(admissionNo: string, termSlug: string, resolvedBy: string): Promise<WriteResult> {
  const term = getTerm(termSlug);
  if (!term || term.source.kind !== "live-legacy") return { ok: false, reason: "unsupported-term" };

  const loc = await findStudentRow(admissionNo);
  if (!loc) return { ok: false, reason: "not-found" };

  const flags = readFlagsAt(loc.rawRow, loc.campus, term.source.block);
  const r = reconcile(flags);
  if (r.canonicalStatus === "UNMARKED") return { ok: false, reason: "invalid-status" };

  const previousFlags = r.setFlags.map((f) => STATUS_LABEL[f]).join("; ");
  const resolvedTo = STATUS_LABEL[r.canonicalStatus];

  const writeResult = await updateStudentStatus({
    admissionNo,
    termSlug,
    newStatusLabel: resolvedTo,
    override: true, // resolving a conflict never counts as "changing away from" a terminal status
  });

  if (writeResult.ok) {
    await appendRow("RESOLVE LOG", [
      new Date().toISOString(),
      admissionNo,
      term.label,
      previousFlags,
      resolvedTo,
      resolvedBy,
    ]);
  }

  return writeResult;
}

/**
 * Same as resolveLegacyConflict, but for many students at once. Fetches each
 * campus tab ONCE (instead of once per student) and writes every resolved
 * row in a single Sheets API call via batchUpdateRanges — plus one RESOLVE
 * LOG append covering the whole batch. Like the single version, this never
 * triggers the terminal lock — resolving a conflict is never treated as
 * "changing away from" a terminal status.
 */
export async function resolveLegacyConflictsBulk(
  admissionNos: string[],
  termSlug: string,
  resolvedBy: string
): Promise<{ admissionNo: string; result: WriteResult }[]> {
  const term = getTerm(termSlug);
  if (!term || term.source.kind !== "live-legacy") {
    return admissionNos.map((admissionNo) => ({ admissionNo, result: { ok: false, reason: "unsupported-term" } }));
  }

  const [mainRows, nakuruRows] = await Promise.all([
    fetchSheetRows("MAIN CAMPUS!A:Z"),
    fetchSheetRows("NAKURU CAMPUS!A:X"),
  ]);

  const byAdmission = new Map<string, { campus: "MAIN" | "NAKURU"; sheetRowNumber: number; rawRow: any[] }>();
  for (const [campus, rows] of [["MAIN", mainRows], ["NAKURU", nakuruRows]] as const) {
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (row && row[1] != null && String(row[1]).trim() !== "") {
        byAdmission.set(String(row[1]), { campus, sheetRowNumber: i + 1, rawRow: row });
      }
    }
  }

  const results: { admissionNo: string; result: WriteResult }[] = [];
  const updates: { range: string; values: any[] }[] = [];
  const logRows: any[][] = [];

  for (const admissionNo of admissionNos) {
    const loc = byAdmission.get(admissionNo);
    if (!loc) {
      results.push({ admissionNo, result: { ok: false, reason: "not-found" } });
      continue;
    }

    const flags = readFlagsAt(loc.rawRow, loc.campus, term.source.block);
    const r = reconcile(flags);
    if (r.canonicalStatus === "UNMARKED") {
      results.push({ admissionNo, result: { ok: false, reason: "invalid-status" } });
      continue;
    }

    const layout = LAYOUT_FOR_WRITE[loc.campus];
    const startCol = term.source.block === "flagsJanApr" ? layout.janApr : layout.mayAug;
    const winningKey = r.canonicalStatus;
    const values = (Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((k) =>
      k === winningKey ? STATUS_LABEL[winningKey] : "-"
    );
    const range = `${loc.campus === "MAIN" ? "MAIN CAMPUS" : "NAKURU CAMPUS"}!${colLetter(startCol)}${loc.sheetRowNumber}:${colLetter(startCol + 7)}${loc.sheetRowNumber}`;
    updates.push({ range, values });
    logRows.push([
      new Date().toISOString(),
      admissionNo,
      term.label,
      r.setFlags.map((f) => STATUS_LABEL[f]).join("; "),
      STATUS_LABEL[winningKey],
      resolvedBy,
    ]);
    results.push({ admissionNo, result: { ok: true } });
  }

  if (updates.length > 0) {
    await batchUpdateRanges(updates);
  }

  if (logRows.length > 0) {
    await appendRows("RESOLVE LOG", logRows);
  }

  return results;
}

/**
 * Sets a status for a student who is currently Unmarked in this term (no
 * status flag/log entry at all yet), from the "Unmarked Students" list.
 * Unlike resolveLegacyConflict (which only ever picks among flags the sheet
 * already has set), this writes a status the registrar chooses from
 * scratch — so it re-verifies the student is still genuinely Unmarked right
 * before writing, to avoid clobbering a status someone else just set.
 * Logs to the same RESOLVE LOG sheet as conflict resolution, with "Unmarked"
 * as the previous value, so both kinds of write share one audit trail.
 */
export async function markUnmarkedStudent(
  admissionNo: string,
  termSlug: string,
  newStatusLabel: string,
  markedBy: string
): Promise<WriteResult> {
  const term = getTerm(termSlug);
  if (!term) return { ok: false, reason: "unsupported-term" };
  if (!LABEL_TO_FLAG[newStatusLabel]) return { ok: false, reason: "invalid-status" };

  // Only legacy wide-column terms have flag columns to re-check against;
  // Status Log terms treat "no row yet" as Unmarked and can be written directly.
  if (term.source.kind === "live-legacy") {
    const loc = await findStudentRow(admissionNo);
    if (!loc) return { ok: false, reason: "not-found" };
    const flags = readFlagsAt(loc.rawRow, loc.campus, term.source.block);
    const r = reconcile(flags);
    if (r.canonicalStatus !== "UNMARKED") return { ok: false, reason: "invalid-status" };
  }

  // No override: a student who is genuinely terminal-locked elsewhere should
  // still be blocked here, same as the profile page's first attempt.
  const writeResult = await updateStudentStatus({ admissionNo, termSlug, newStatusLabel });

  if (writeResult.ok) {
    await appendRow("RESOLVE LOG", [
      new Date().toISOString(),
      admissionNo,
      term.label,
      "Unmarked",
      newStatusLabel,
      markedBy,
    ]);
  }

  return writeResult;
}

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Bulk-carries Graduated / Dropped / Completed forward from the immediately
 * previous term into THIS term's status column (only valid for a
 * "live-column" term — that's the only kind with a single column to write
 * into). Meant to be run once near the start of each new semester instead
 * of registrars re-entering these three categories by hand, since they
 * essentially never change once set.
 *
 * Only fills in students whose cell for this term is still blank — it
 * never overwrites a value someone already set (manually, via the
 * dashboard, or via a deferment approval), so it's always safe to re-run.
 */
export type CarryForwardResult =
  | { ok: true; updated: string[]; alreadySet: number }
  | { ok: false; reason: "unsupported-term" | "no-previous-term" };

export async function bulkCarryForwardStatuses(termSlug: string): Promise<CarryForwardResult> {
  const term = getTerm(termSlug);
  if (!term || term.source.kind !== "live-column") return { ok: false, reason: "unsupported-term" };

  const previousTerm = getPreviousTerm(termSlug);
  if (!previousTerm) return { ok: false, reason: "no-previous-term" };

  const previousData = await loadTermData(previousTerm.slug);
  if (!previousData) return { ok: false, reason: "no-previous-term" };

  // Which admission numbers resolved to Graduated/Dropped/Completed in the
  // previous term, and under which exact label (so the label written here
  // matches STATUS_LABEL exactly, ready for the next term to read back).
  const carryLabels = new Set(CARRY_FORWARD_STATUSES.map((k) => STATUS_LABEL[k]));
  const candidates = new Map<string, string>();
  for (const [label, students] of Object.entries(previousData.dashboard.studentsByStatus)) {
    if (!carryLabels.has(label)) continue;
    for (const s of students) candidates.set(s.admissionNo, label);
  }

  if (candidates.size === 0) return { ok: true, updated: [], alreadySet: 0 };

  const col = term.source.column;
  const colIdx = columnIndex(col);
  const [mainRows, nakuruRows] = await Promise.all([
    fetchSheetRows(`MAIN CAMPUS!A:${col}`),
    fetchSheetRows(`NAKURU CAMPUS!A:${col}`),
  ]);

  const updates: { range: string; values: any[] }[] = [];
  const updated: string[] = [];
  let alreadySet = 0;

  for (const [tabName, rows] of [["MAIN CAMPUS", mainRows], ["NAKURU CAMPUS", nakuruRows]] as const) {
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const admissionNo = row[1] != null ? String(row[1]).trim() : "";
      const label = admissionNo ? candidates.get(admissionNo) : undefined;
      if (!label) continue;
      const currentValue = String(row[colIdx] ?? "").trim();
      if (currentValue !== "") {
        alreadySet++;
        continue;
      }
      updates.push({ range: `${tabName}!${col}${i + 1}`, values: [label] });
      updated.push(admissionNo);
    }
  }

  if (updates.length > 0) {
    await batchUpdateRanges(updates);
  }

  return { ok: true, updated, alreadySet };
}

/**
 * Sets many students' statuses at once from an uploaded list — for the
 * "students who were In Session May-Aug and are now on Attachment" kind of
 * case, where the set of students and their new status comes from outside
 * the app (a registrar-curated list) rather than being derivable from a
 * rule. Only valid for a "live-column" term. Unlike bulkCarryForwardStatuses,
 * this DOES overwrite an existing value — that's the point, it's a
 * deliberate reassignment — but it still respects the terminal lock
 * (Graduated/Dropped elsewhere) unless override is set for the whole batch.
 * One row's problem (unknown admission number, bad status, locked student)
 * never blocks the rest of the file — every row gets its own result.
 */
export type BulkUploadOutcome =
  | { admissionNo: string; ok: true }
  | { admissionNo: string; ok: false; reason: "not-found" | "invalid-status" | "terminal-lock" | "duplicate"; detail?: string };

export async function bulkUploadStatuses(
  termSlug: string,
  rows: { admissionNo: string; status: string }[],
  override: boolean
): Promise<{ ok: true; results: BulkUploadOutcome[] } | { ok: false; reason: "unsupported-term" }> {
  const term = getTerm(termSlug);
  if (!term || term.source.kind !== "live-column") return { ok: false, reason: "unsupported-term" };

  const col = term.source.column;
  const [mainRows, nakuruRows, logRows] = await Promise.all([
    fetchSheetRows(`MAIN CAMPUS!A:${col}`),
    fetchSheetRows(`NAKURU CAMPUS!A:${col}`),
    override ? Promise.resolve([]) : fetchSheetRows("STATUS LOG!A:D").catch(() => []),
  ]);

  const byAdmission = new Map<
    string,
    { tab: "MAIN CAMPUS" | "NAKURU CAMPUS"; campus: "MAIN" | "NAKURU"; row: number; rawRow: any[] }
  >();
  for (const [tab, campus, rowsArr] of [
    ["MAIN CAMPUS", "MAIN", mainRows],
    ["NAKURU CAMPUS", "NAKURU", nakuruRows],
  ] as const) {
    for (let i = 2; i < rowsArr.length; i++) {
      const r = rowsArr[i];
      if (r && r[1] != null && String(r[1]).trim() !== "") {
        byAdmission.set(String(r[1]).trim(), { tab, campus, row: i + 1, rawRow: r });
      }
    }
  }

  // One-time STATUS LOG read (skipped entirely when overriding), instead of
  // findTerminalBlock's per-student fetch — this file could be hundreds of rows.
  const logByAdmission = new Map<string, Map<string, string>>();
  for (let i = 1; i < logRows.length; i++) {
    const [admissionNo, logTerm, status] = logRows[i] ?? [];
    if (!admissionNo) continue;
    const key = String(admissionNo);
    if (!logByAdmission.has(key)) logByAdmission.set(key, new Map());
    logByAdmission.get(key)!.set(String(logTerm), String(status));
  }

  function terminalBlockFor(loc: { rawRow: any[]; campus: "MAIN" | "NAKURU" }, admissionNo: string) {
    for (const t of TERMS) {
      if (t.source.kind !== "live-legacy") continue;
      const flags = readFlagsAt(loc.rawRow, loc.campus, t.source.block);
      const r = reconcile(flags);
      if (r.canonicalStatus !== "UNMARKED" && TERMINAL_STATUSES.includes(r.canonicalStatus)) {
        return { term: t.label, status: STATUS_LABEL[r.canonicalStatus] };
      }
    }
    for (const [logTerm, status] of logByAdmission.get(admissionNo) ?? []) {
      const key = LABEL_TO_FLAG[status.trim()];
      if (key && TERMINAL_STATUSES.includes(key)) return { term: logTerm, status };
    }
    return null;
  }

  const results: BulkUploadOutcome[] = [];
  const updates: { range: string; values: any[] }[] = [];
  const seen = new Set<string>();

  for (const { admissionNo, status } of rows) {
    const adm = admissionNo.trim();
    const val = status.trim();
    if (!adm) continue;

    if (seen.has(adm)) {
      results.push({ admissionNo: adm, ok: false, reason: "duplicate", detail: "duplicate row in file — only the first was applied" });
      continue;
    }
    seen.add(adm);

    if (!LABEL_TO_FLAG[val]) {
      results.push({ admissionNo: adm, ok: false, reason: "invalid-status", detail: `"${val}" isn't a recognized status` });
      continue;
    }

    const loc = byAdmission.get(adm);
    if (!loc) {
      results.push({ admissionNo: adm, ok: false, reason: "not-found" });
      continue;
    }

    if (!override) {
      const blocked = terminalBlockFor(loc, adm);
      if (blocked) {
        results.push({ admissionNo: adm, ok: false, reason: "terminal-lock", detail: `${blocked.status} in ${blocked.term}` });
        continue;
      }
    }

    updates.push({ range: `${loc.tab}!${col}${loc.row}`, values: [val] });
    results.push({ admissionNo: adm, ok: true });
  }

  if (updates.length > 0) {
    await batchUpdateRanges(updates);
  }

  return { ok: true, results };
}

/**
 * Sets many currently-Unmarked students to the same status at once — the
 * "select 50 students on the Unmarked list, pick a status, Set All" flow,
 * as an alternative to CSV bulk upload for a quick ad-hoc batch. Delegates
 * to bulkUploadStatuses for a "live-column" term (one batched write); for a
 * "live-legacy" term there's no cheap batch path (each student's flags live
 * in their own 8-column block), so it goes one at a time through the exact
 * same markUnmarkedStudent path the single "Set" button already uses —
 * same "must currently be Unmarked" safety check, same RESOLVE LOG entry.
 */
export type BulkMarkOutcome = { admissionNo: string; ok: true } | { admissionNo: string; ok: false; reason: string; detail?: string };

export async function bulkMarkUnmarked(
  termSlug: string,
  admissionNos: string[],
  status: string,
  markedBy: string
): Promise<{ ok: true; results: BulkMarkOutcome[] } | { ok: false; reason: string }> {
  const term = getTerm(termSlug);
  if (!term) return { ok: false, reason: "unsupported-term" };
  if (!LABEL_TO_FLAG[status.trim()]) return { ok: false, reason: "invalid-status" };

  if (term.source.kind === "live-column") {
    const rows = admissionNos.map((admissionNo) => ({ admissionNo, status }));
    return bulkUploadStatuses(termSlug, rows, false);
  }

  const results: BulkMarkOutcome[] = [];
  for (const admissionNo of admissionNos) {
    const r = await markUnmarkedStudent(admissionNo, termSlug, status, markedBy);
    results.push(
      r.ok
        ? { admissionNo, ok: true }
        : {
            admissionNo,
            ok: false,
            reason: r.reason,
            detail: r.reason === "terminal-lock" ? `${r.blockingStatus} in ${r.blockingTerm}` : undefined,
          }
    );
  }
  return { ok: true, results };
}

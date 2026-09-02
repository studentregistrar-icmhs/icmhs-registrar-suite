import { google } from "googleapis";

/**
 * Client against the same Google Sheet the deferment app uses. Reuses
 * GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY from that project.
 *
 * Scope is now full read/write (not readonly) since the dashboard can
 * write status updates back to the sheet. The service account itself
 * must have Editor access on this specific sheet — it almost certainly
 * already does, since the deferment app writes to column W using the
 * same credentials.
 */
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY env vars."
    );
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function getSheetId(): string {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Missing GOOGLE_SHEET_ID env var.");
  return sheetId;
}

export async function fetchSheetRows(tabRange: string): Promise<any[][]> {
  const res = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: tabRange,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values ?? [];
}

/** Overwrites a single range (e.g. "MAIN CAMPUS!S15:Z15") with the given row values. */
export async function updateRange(range: string, values: any[]): Promise<void> {
  await getSheetsClient().spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

/** Overwrites several ranges in a single API call — used for bulk conflict resolution
 * so resolving N students costs one Sheets write instead of N. */
export async function batchUpdateRanges(updates: { range: string; values: any[] }[]): Promise<void> {
  if (updates.length === 0) return;
  await getSheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: {
      valueInputOption: "RAW",
      data: updates.map((u) => ({ range: u.range, values: [u.values] })),
    },
  });
}

/** Appends one row to the end of a tab (used for the append-only Status Log). */
export async function appendRow(tabName: string, values: any[]): Promise<void> {
  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

/** Appends several rows to the end of a tab in a single API call. */
export async function appendRows(tabName: string, rows: any[][]): Promise<void> {
  if (rows.length === 0) return;
  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

// ---------------------------------------------------------------------------
// Deferments module support
//
// Ported from the standalone deferment app during the merge into this
// single Registrar suite. These use the same service-account client as
// everything above; kept here (rather than duplicated) since both modules
// now share one Google Sheets connection.
// ---------------------------------------------------------------------------

/** Finds the 1-indexed sheet row for a given admission number in a tab's ID column. */
async function findRowNumberInTab(
  sheetName: string,
  admissionNumber: string,
  idColumn: string = "B"
): Promise<number | null> {
  const res = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${sheetName}!${idColumn}:${idColumn}`,
  });
  const rows = res.data.values || [];
  const target = admissionNumber.toString().trim().toLowerCase();
  const rowIndex = rows.findIndex(
    (row: any[]) => (row[0] || "").toString().trim().toLowerCase() === target
  );
  return rowIndex === -1 ? null : rowIndex + 1;
}

const STATUS_LOG_TAB = "STATUS LOG";
const STATUS_LOG_ID_COLUMN = "A";
const STATUS_LOG_STATUS_COLUMN = "C";

/**
 * Writes (or clears) a student's deferment status into the "STATUS LOG" tab.
 * Pass an empty string to clear the cell (used on deny / reset-to-pending).
 */
export async function updateDefermentStatusInSheet(
  admissionNumber: string,
  statusText: string
): Promise<{ skipped?: boolean; found: boolean; sheet?: string; row?: number }> {
  if (!admissionNumber) {
    console.warn("No admission number provided — skipping Sheets update.");
    return { skipped: true, found: false };
  }

  const rowNumber = await findRowNumberInTab(STATUS_LOG_TAB, admissionNumber, STATUS_LOG_ID_COLUMN);

  if (rowNumber) {
    await updateRange(`${STATUS_LOG_TAB}!${STATUS_LOG_STATUS_COLUMN}${rowNumber}`, [statusText]);
    return { found: true, sheet: STATUS_LOG_TAB, row: rowNumber };
  }

  console.warn(`Admission number ${admissionNumber} not found in ${STATUS_LOG_TAB}.`);
  return { found: false };
}

async function findStudentInTab(
  sheetName: string,
  admissionNumber: string
): Promise<{ name: string; programmeRaw: string } | null> {
  const res = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${sheetName}!B:E`,
  });
  const rows = res.data.values || [];
  const target = admissionNumber.toString().trim().toLowerCase();
  const rowIndex = rows.findIndex(
    (row: any[]) => (row[0] || "").toString().trim().toLowerCase() === target
  );
  if (rowIndex === -1) return null;
  const row = rows[rowIndex];
  return {
    name: row[1] || "",         // column C
    programmeRaw: row[3] || "", // column E
  };
}

/**
 * Looks up a student by admission number for the deferment apply form.
 * Searches MAIN CAMPUS first, then NAKURU CAMPUS — whichever tab the
 * admission number is found in determines the campus (column J on MAIN
 * CAMPUS is not a reliable per-student value).
 */
export async function lookupStudentByAdmissionNumber(
  admissionNumber: string
): Promise<{ found: boolean; campus?: string; name?: string; programmeRaw?: string }> {
  if (!admissionNumber) return { found: false };

  let match = await findStudentInTab("MAIN CAMPUS", admissionNumber);
  if (match) return { found: true, campus: "Thika Main Campus", ...match };

  match = await findStudentInTab("NAKURU CAMPUS", admissionNumber);
  if (match) return { found: true, campus: "Nakuru Campus", ...match };

  return { found: false };
}

// ---------------------------------------------------------------------------
// Optional: mirror deferment status onto the campus tabs for glanceability
//
// STATUS LOG remains the source of truth (updateDefermentStatusInSheet,
// above) — this additionally copies the same status text into a single
// column on MAIN CAMPUS / NAKURU CAMPUS so it's visible without switching
// tabs. Deliberately NOT auto-appended: this app doesn't know how wide
// your campus tabs currently are, and guessing a column risks overwriting
// real data. Instead:
//
//   1. In the Sheet, manually add a header column on BOTH MAIN CAMPUS and
//      NAKURU CAMPUS (same column letter on both), e.g. titled
//      "SEPT-DEC 2026 STATUS".
//   2. Set CAMPUS_STATUS_MIRROR_COLUMN in your environment variables to
//      that column's letter (e.g. "AC").
//
// If that env var isn't set, this is a no-op — STATUS LOG alone still
// works exactly as before. Failures here never block an approval; they're
// caught and logged the same way the STATUS LOG write already is.
// ---------------------------------------------------------------------------

const CAMPUS_TAB_BY_NAME: Record<string, string> = {
  "Thika Main Campus": "MAIN CAMPUS",
  "Nakuru Campus": "NAKURU CAMPUS",
};

export async function mirrorDefermentStatusToCampusTab(
  campus: string,
  admissionNumber: string,
  statusText: string
): Promise<{ skipped: boolean; found?: boolean; sheet?: string; row?: number; reason?: string }> {
  const mirrorColumn = process.env.CAMPUS_STATUS_MIRROR_COLUMN;
  if (!mirrorColumn) {
    return { skipped: true, reason: "CAMPUS_STATUS_MIRROR_COLUMN not set" };
  }

  const tabName = CAMPUS_TAB_BY_NAME[campus];
  if (!tabName) {
    console.warn(`Unrecognized campus "${campus}" — skipping mirror write.`);
    return { skipped: true, reason: "unrecognized campus" };
  }

  if (!admissionNumber) {
    return { skipped: true, reason: "no admission number" };
  }

  // Admission number lives in column B on both campus tabs (same column
  // used by findStudentInTab above).
  const rowNumber = await findRowNumberInTab(tabName, admissionNumber, "B");

  if (rowNumber) {
    await updateRange(`${tabName}!${mirrorColumn}${rowNumber}`, [statusText]);
    return { skipped: false, found: true, sheet: tabName, row: rowNumber };
  }

  console.warn(`Admission number ${admissionNumber} not found in ${tabName} — skipping mirror write.`);
  return { skipped: false, found: false };
}

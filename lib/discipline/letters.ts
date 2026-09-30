import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { ICMHS_LOGO_BASE64 } from "@/lib/deferments/icmhs-logo";
import { CATEGORIES, labelFor, type DisciplinaryCase } from "./constants";

/**
 * Suspension and reinstatement letters, drawn with pdf-lib in the same style
 * as the deferment form (A4, crest top-left, college name in navy).
 *
 * ALL of the wording lives in the LETTER_TEXT block below so it can be edited
 * in one place to match the college's Student Code of Conduct. The letters
 * deliberately say only the category of the matter (e.g. "Examination
 * malpractice") — never the free-text case description, which may contain
 * evidence, witness details or other students' names.
 */

export type LetterType = "suspension" | "reinstatement";

const LETTER_TEXT = {
  college: "IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES",
  office: "OFFICE OF THE REGISTRAR",
  suspension: {
    title: "NOTICE OF SUSPENSION",
    intro: (category: string, incident: string) =>
      `Following the college's disciplinary process concerning a matter of ${category.toLowerCase()} dated ${incident}, the institution has decided to suspend you from your studies as set out below.`,
    periodFixed: (from: string, to: string) => `The suspension runs from ${from} to ${to}, both dates inclusive.`,
    periodIndefinite: (from: string) =>
      `The suspension takes effect on ${from} and continues until you are notified in writing that it has been lifted.`,
    conduct:
      "During the suspension you must not attend classes, examinations, or clinical or practical sessions, or use college facilities, unless the Registrar has authorised this in writing.",
    appeal:
      "If you wish to appeal this decision, submit your appeal in writing to the Registrar within the period provided in the college's disciplinary policy.",
    ccLine: "cc: Head of Department · Accounts · Student file",
  },
  reinstatement: {
    title: "NOTICE OF REINSTATEMENT",
    intro: (suspendedFrom: string) =>
      `This letter confirms that your suspension, which began on ${suspendedFrom}, has ended and that you are reinstated as a student of the college.`,
    effective: (on: string) => `Your reinstatement takes effect on ${on}.`,
    report:
      "Before resuming classes you must report to the Registrar's office so that your return is recorded and your lecture card is validated.",
    ccLine: "cc: Head of Department · Accounts · Student file",
  },
  signOff: "Registrar of Students",
} as const;

const NAVY = rgb(11 / 255, 37 / 255, 69 / 255);
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.44);
const LINE = rgb(0.55, 0.55, 0.58);
const PAGE: [number, number] = [595.28, 841.89]; // A4
const MARGIN = 60;

/** 2026-10-01 -> "1 October 2026". Parsed by hand: no timezone shifting. */
export function longDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? "";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d} ${months[m - 1]} ${y}`;
}

/** Today's date in Nairobi, so a letter printed late evening isn't dated tomorrow/yesterday by server UTC. */
function todayNairobiIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** pdf-lib's standard fonts can't encode characters outside WinAnsi; keep a stray one from crashing the PDF. */
const safe = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u00B7]/g, "?");

export function letterAvailability(c: DisciplinaryCase): { suspension: boolean; reinstatement: boolean } {
  return {
    suspension: c.outcome === "suspension" && !!c.suspension_start,
    reinstatement: c.outcome === "suspension" && !!c.reinstated_on,
  };
}

export async function generateLetter(c: DisciplinaryCase, type: LetterType, courseName?: string): Promise<Uint8Array> {
  const avail = letterAvailability(c);
  if (!avail[type]) throw new Error(`No ${type} letter applies to case ${c.case_ref}`);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(PAGE);
  const W = PAGE[0], H = PAGE[1];
  const textW = W - MARGIN * 2;

  // Letterhead
  let textX = MARGIN;
  try {
    const logo = await pdf.embedPng(Buffer.from(ICMHS_LOGO_BASE64, "base64"));
    const box = 70;
    const k = Math.min(box / logo.width, box / logo.height);
    page.drawImage(logo, { x: MARGIN, y: H - 50 - logo.height * k, width: logo.width * k, height: logo.height * k });
    textX = MARGIN + 88;
  } catch { /* no crest: letter is still valid */ }
  page.drawText(LETTER_TEXT.college, { x: textX, y: H - 68, size: 13, font: bold, color: INK });
  page.drawText(LETTER_TEXT.office, { x: textX, y: H - 86, size: 10.5, font: bold, color: NAVY });

  let y = H - 130;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1.2, color: INK });
  y -= 26;

  const row = (label: string, value: string) => {
    page.drawText(label, { x: MARGIN, y, size: 10, font: bold, color: INK });
    page.drawText(safe(value), { x: MARGIN + 88, y, size: 10, font, color: INK });
    y -= 16;
  };
  row("Date:", longDate(todayNairobiIso()));
  row("Our ref:", c.case_ref + (c.letter_ref ? `  (${c.letter_ref})` : ""));
  y -= 8;

  page.drawText("To:", { x: MARGIN, y, size: 10, font: bold, color: INK });
  page.drawText(safe(c.student_name), { x: MARGIN + 88, y, size: 10, font: bold, color: INK }); y -= 15;
  page.drawText(`Admission No: ${c.admission_no}`, { x: MARGIN + 88, y, size: 10, font, color: INK }); y -= 15;
  const prog = [c.course_code, courseName].filter(Boolean).join(" \u2013 ");
  if (prog) { page.drawText(safe(prog), { x: MARGIN + 88, y, size: 10, font, color: INK }); y -= 15; }
  page.drawText(c.campus === "MAIN" ? "Thika Main Campus" : "Nakuru Campus", { x: MARGIN + 88, y, size: 10, font, color: INK });
  y -= 30;

  const t = type === "suspension" ? LETTER_TEXT.suspension : LETTER_TEXT.reinstatement;
  page.drawText(t.title, { x: MARGIN, y, size: 13, font: bold, color: NAVY });
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + bold.widthOfTextAtSize(t.title, 13), y }, thickness: 1, color: NAVY });
  y -= 26;

  const paragraphs: string[] = [`Dear ${c.student_name},`];
  if (type === "suspension") {
    const s = LETTER_TEXT.suspension;
    paragraphs.push(
      s.intro(labelFor(CATEGORIES, c.category), longDate(c.incident_date)),
      c.suspension_indefinite ? s.periodIndefinite(longDate(c.suspension_start)) : s.periodFixed(longDate(c.suspension_start), longDate(c.suspension_end)),
      s.conduct,
      s.appeal,
    );
  } else {
    const r = LETTER_TEXT.reinstatement;
    paragraphs.push(r.intro(longDate(c.suspension_start)), r.effective(longDate(c.reinstated_on)), r.report);
  }

  for (const p of paragraphs) {
    for (const line of wrap(font, safe(p), 10.5, textW)) {
      page.drawText(line, { x: MARGIN, y, size: 10.5, font, color: INK });
      y -= 15.5;
    }
    y -= 8;
  }

  y -= 20;
  page.drawText("Yours faithfully,", { x: MARGIN, y, size: 10.5, font, color: INK });
  y -= 50;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 190, y }, thickness: 0.75, color: LINE });
  y -= 15;
  page.drawText(LETTER_TEXT.signOff, { x: MARGIN, y, size: 10.5, font: bold, color: INK });
  y -= 30;
  page.drawText(t.ccLine, { x: MARGIN, y, size: 9, font, color: MUTED });

  return pdf.save();
}

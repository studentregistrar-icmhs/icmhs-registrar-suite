import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const NAVY = rgb(11 / 255, 37 / 255, 69 / 255);
const RED = rgb(0.72, 0.11, 0.11);
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.44);
const LINE = rgb(0.55, 0.55, 0.58);
const PAGE = [595.28, 841.89]; // A4
const MARGIN = 50;

const LOGO_URL = "https://drive.google.com/uc?export=view&id=1aZk30Wt-SBo5URezAFNHq71mCVsM7Yc6";
const LOGO_URL_FALLBACK = "https://drive.google.com/thumbnail?id=1aZk30Wt-SBo5URezAFNHq71mCVsM7Yc6&sz=w1000";

function fmt(v) {
  return v === null || v === undefined || String(v).trim() === "" ? "" : String(v);
}

function fmtDate(isoOrText) {
  if (!isoOrText) return "";
  const d = new Date(isoOrText);
  if (isNaN(d.getTime())) return String(isoOrText);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Best-effort: fetch the real logo at request time. Tries the direct Drive
// link first, then falls back to Drive's thumbnail CDN if that fails (Drive
// sometimes serves an HTML warning page instead of raw bytes for uc?export
// links). The logo file is a JPG, so we embed it with embedJpg (the
// thumbnail fallback always returns JPEG too, regardless of source format).
// The deployed app has normal internet access, so this works in production
// even though it can't be tested from a network-restricted sandbox. Any
// failure just skips the logo instead of breaking PDF generation.
async function tryEmbedLogo(pdf) {
  for (const url of [LOGO_URL, LOGO_URL_FALLBACK]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      return await pdf.embedJpg(bytes);
    } catch {
      // try next URL
    }
  }
  return null;
}

function wrapText(font, text, size, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateSingleRequestPdf(r) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(PAGE);
  const W = PAGE[0];
  const H = PAGE[1];

  const logo = await tryEmbedLogo(pdf);
  const textStartX = MARGIN + 100;

  if (logo) {
    const maxBox = 80;
    const scale = Math.min(maxBox / logo.width, maxBox / logo.height);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, { x: MARGIN, y: H - 60 - h, width: w, height: h });
  }

  page.drawText("IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES", {
    x: textStartX, y: H - 62, size: 13, font: bold, color: INK
  });
  page.drawText("DEFERMENT FORM", { x: textStartX, y: H - 82, size: 12, font: bold, color: INK });
  page.drawText("(This form is filled by students who want to defer their course to resume later)", {
    x: textStartX, y: H - 100, size: 8.5, font, color: MUTED
  });

  let y = H - 135;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1.2, color: INK });
  y -= 28;

  page.drawText("STUDENT DETAILS", { x: MARGIN, y, size: 11.5, font: bold, color: NAVY });
  y -= 24;

  // A single "field row": one or two label/value pairs on the same line,
  // each value drawn with an underline beneath it (blank if no value given).
  function fieldRow(fields) {
    for (const f of fields) {
      page.drawText(f.label, { x: f.x, y, size: 9.5, font: bold, color: INK });
      const labelWidth = bold.widthOfTextAtSize(f.label, 9.5);
      const valueX = f.x + labelWidth + 6;
      const valueEnd = f.x + f.width;
      if (f.value) {
        page.drawText(fmt(f.value), { x: valueX, y, size: 9.5, font, color: INK });
      }
      page.drawLine({ start: { x: valueX, y: y - 3 }, end: { x: valueEnd, y: y - 3 }, thickness: 0.75, color: LINE });
    }
    y -= 22;
  }

  const fullW = W - MARGIN * 2;
  const half = fullW / 2;

  fieldRow([
    { label: "Admission No:", value: r.admission_number, x: MARGIN, width: half - 10 },
    { label: "Date of Application:", value: fmtDate(r.application_date), x: MARGIN + half + 10, width: half - 10 - (MARGIN + half + 10 - MARGIN - half) }
  ]);
  fieldRow([{ label: "Student Name:", value: r.full_name, x: MARGIN, width: fullW }]);
  fieldRow([{ label: "Programme / Intake:", value: r.program, x: MARGIN, width: fullW }]);
  fieldRow([{ label: "Campus:", value: r.campus, x: MARGIN, width: fullW }]);

  y -= 2;
  page.drawText("Reason for Deferring:", { x: MARGIN, y, size: 9.5, font: bold, color: INK });
  y -= 16;
  const reasonLines = wrapText(font, r.reason_details, 9.5, fullW);
  for (const line of reasonLines) {
    page.drawText(line, { x: MARGIN, y, size: 9.5, font, color: INK });
    y -= 14;
  }
  y -= 8;

  fieldRow([
    { label: "Expected Resuming Date:", value: r.resumption_date, x: MARGIN, width: half - 10 },
    { label: "Student Sign:", value: "", x: MARGIN + half + 10, width: half - 10 }
  ]);

  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1.2, color: INK });
  y -= 22;

  // Approval sections — intentionally left blank for physical sign-off.
  const approvers = [
    { title: "HEAD OF DEPARTMENT" },
    { title: "ACCOUNTS", extraLine: "Current Fees Balance:" },
    { title: "REGISTRAR" },
    { title: "PRINCIPAL" },
    { title: "MANAGING DIRECTOR" }
  ];

  for (const a of approvers) {
    page.drawText(a.title, { x: MARGIN, y, size: 10.5, font: bold, color: NAVY });
    y -= 17;

    if (a.extraLine) {
      const label = a.extraLine;
      page.drawText(label, { x: MARGIN, y, size: 9, font: bold, color: INK });
      const lw = bold.widthOfTextAtSize(label, 9);
      page.drawLine({ start: { x: MARGIN + lw + 6, y: y - 3 }, end: { x: MARGIN + 260, y: y - 3 }, thickness: 0.75, color: LINE });
      y -= 16;
    }

    page.drawText("Comments:", { x: MARGIN, y, size: 9, font: bold, color: INK });
    const cw = bold.widthOfTextAtSize("Comments:", 9);
    page.drawLine({ start: { x: MARGIN + cw + 6, y: y - 3 }, end: { x: W - MARGIN, y: y - 3 }, thickness: 0.75, color: LINE });
    y -= 16;

    const approveLabel = "Approved / Not Approved:";
    page.drawText(approveLabel, { x: MARGIN, y, size: 9, font: bold, color: INK });
    let lx = MARGIN + bold.widthOfTextAtSize(approveLabel, 9) + 6;
    page.drawLine({ start: { x: lx, y: y - 3 }, end: { x: lx + 110, y: y - 3 }, thickness: 0.75, color: LINE });

    const signX = lx + 130;
    page.drawText("Sign:", { x: signX, y, size: 9, font: bold, color: INK });
    let sx = signX + bold.widthOfTextAtSize("Sign:", 9) + 6;
    page.drawLine({ start: { x: sx, y: y - 3 }, end: { x: sx + 110, y: y - 3 }, thickness: 0.75, color: LINE });

    const dateX = sx + 130;
    page.drawText("Date:", { x: dateX, y, size: 9, font: bold, color: INK });
    let dx = dateX + bold.widthOfTextAtSize("Date:", 9) + 6;
    page.drawLine({ start: { x: dx, y: y - 3 }, end: { x: W - MARGIN, y: y - 3 }, thickness: 0.75, color: LINE });

    y -= 18;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.87) });
    y -= 16;
  }

  y -= 4;
  const footerLines = wrapText(
    font,
    "This form should be filled three (3) days before the leave and in triplicate: one filed in the department, one in the Registrar's office, and one retained by the student.",
    8, fullW
  );
  for (const line of footerLines) {
    page.drawText(line, { x: MARGIN, y, size: 8, font, color: MUTED });
    y -= 11;
  }
  y -= 4;
  page.drawText("PLEASE NOTE: Students cannot have more than one (1) semester deferment simultaneously.", {
    x: MARGIN, y, size: 8.5, font: bold, color: RED
  });

  return pdf.save();
}

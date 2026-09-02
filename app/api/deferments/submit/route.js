import { NextResponse } from "next/server";
import { sql } from "@/lib/deferments/db";
import {
  SEMESTERS,
  getCurrentSemesterValue,
  isCurrentSemesterDeadlinePassed,
  isSemesterYearAllowed
} from "@/lib/deferments/deferment";
import crypto from "crypto";

function genId() {
  return (
    "ICMHS-DFR-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    crypto.randomBytes(3).toString("hex").toUpperCase()
  );
}

const REQUIRED = [
  "fullName",
  "admissionNumber",
  "email",
  "phone",
  "applicationDate",
  "program",
  "campus",
  "typeOfDeferment",
  "semesterDeferring",
  "deferYear",
  "resumptionDate",
  "reasonCategory",
  "reasonDetails"
];

const PHONE_PATTERN = /^\+?\d{7,15}$/;

// Public — needed by the student-facing apply form. Allowed through by
// middleware.ts without Basic Auth.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const now = new Date();

  for (const field of REQUIRED) {
    if (!body[field] || String(body[field]).trim() === "") {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  if (!PHONE_PATTERN.test(body.phone)) {
    return NextResponse.json({ error: "Phone number must contain digits only." }, { status: 400 });
  }

  // Fetch the registrar-set deadline for the CURRENT ongoing semester (if any),
  // then apply the same allowed-semester rule the client uses — recomputed
  // here independently so the client can never bypass this by editing the page.
  const isMaternity = body.typeOfDeferment === "Maternity Leave";
  let currentDeadlineRow = null;
  try {
    const currentSemesterValue = getCurrentSemesterValue(now);
    const currentYear = String(now.getFullYear());
    const rows = await sql`
      SELECT deadline FROM deferment_deadlines
      WHERE semester = ${currentSemesterValue} AND year = ${currentYear}
      LIMIT 1
    `;
    if (rows.length > 0) currentDeadlineRow = rows[0];
  } catch (err) {
    console.error("Deadline lookup failed:", err);
    return NextResponse.json({ error: "Could not verify the deferment window. Please try again." }, { status: 500 });
  }

  const currentDeadlinePassed = isCurrentSemesterDeadlinePassed(currentDeadlineRow, now);

  if (!isSemesterYearAllowed(body.semesterDeferring, body.deferYear, now, currentDeadlinePassed, isMaternity)) {
    return NextResponse.json(
      { error: "That semester has already passed its deferment deadline, or is not a valid target. Please choose a current or future semester." },
      { status: 400 }
    );
  }

  // Block a second application for the same admission number + semester + year,
  // regardless of that earlier request's status (pending/approved/denied all count).
  try {
    const existing = await sql`
      SELECT id FROM deferment_requests
      WHERE admission_number = ${body.admissionNumber}
        AND semester_deferring = ${body.semesterDeferring}
        AND defer_year = ${body.deferYear}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "You have already submitted a deferment request for this semester. Only one request per semester is allowed." },
        { status: 409 }
      );
    }
  } catch (err) {
    console.error("Duplicate check failed:", err);
    return NextResponse.json({ error: "Could not verify your request. Please try again." }, { status: 500 });
  }

  const id = genId();

  try {
    await sql`
      INSERT INTO deferment_requests (
        id, full_name, admission_number, email, phone, application_date, program, campus,
        type_of_deferment, semester_deferring, defer_year, resumption_date,
        reason_category, reason_details, status
      ) VALUES (
        ${id}, ${body.fullName}, ${body.admissionNumber}, ${body.email}, ${body.phone},
        ${body.applicationDate}, ${body.program}, ${body.campus}, ${body.typeOfDeferment},
        ${body.semesterDeferring}, ${body.deferYear}, ${body.resumptionDate},
        ${body.reasonCategory}, ${body.reasonDetails}, 'pending'
      )
    `;
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("Submit insert failed:", err);
    return NextResponse.json({ error: "Could not save your request. Please try again." }, { status: 500 });
  }
}

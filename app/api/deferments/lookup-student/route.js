import { NextResponse } from "next/server";
import { lookupStudentByAdmissionNumber } from "@/lib/googleSheets";
import { mapProgrammeName } from "@/lib/deferments/programmeMapping";

// Public — needed by the student-facing apply form. Allowed through by
// middleware.ts without Basic Auth.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const admissionNumber = searchParams.get("admissionNumber");

  if (!admissionNumber || !admissionNumber.trim()) {
    return NextResponse.json({ error: "Admission number is required." }, { status: 400 });
  }

  try {
    const result = await lookupStudentByAdmissionNumber(admissionNumber.trim());
    if (!result.found) {
      return NextResponse.json({ found: false });
    }
    const mappedProgramme = mapProgrammeName(result.programmeRaw);
    return NextResponse.json({
      found: true,
      name: result.name,
      campus: result.campus,
      programme: mappedProgramme, // null if we couldn't confidently match it
    });
  } catch (err) {
    console.error("Student lookup failed:", err);
    return NextResponse.json({ error: "Could not look up student." }, { status: 500 });
  }
}

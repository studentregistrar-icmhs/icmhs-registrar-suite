import { NextResponse } from "next/server";
import { sql } from "@/lib/deferments/db";
import { generateSingleRequestPdf } from "@/lib/deferments/pdf";

// Registrar-only — protected by middleware.ts (Basic Auth) before this runs.
export async function GET(request, context) {
  const { id } = await context.params;

  try {
    const rows = await sql`SELECT * FROM deferment_requests WHERE id = ${id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    const bytes = await generateSingleRequestPdf(rows[0]);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${id}.pdf"`
      }
    });
  } catch (err) {
    console.error("Single export failed:", err);
    return NextResponse.json({ error: "Could not generate PDF." }, { status: 500 });
  }
}

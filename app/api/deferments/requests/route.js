import { NextResponse } from "next/server";
import { sql } from "@/lib/deferments/db";

// Registrar-only — protected by middleware.ts (Basic Auth) before this runs.
export async function GET() {
  try {
    const rows = await sql`
      SELECT * FROM deferment_requests ORDER BY submitted_at DESC
    `;
    return NextResponse.json({ requests: rows });
  } catch (err) {
    console.error("List fetch failed:", err);
    return NextResponse.json({ error: "Could not load requests." }, { status: 500 });
  }
}

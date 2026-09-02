import { NextResponse } from "next/server";
import { sql } from "@/lib/deferments/db";

// This route has no dynamic function usage (no params, no cookies/headers
// access), so Next.js's App Router will otherwise treat it as static and
// cache the response — meaning a newly-submitted deferment request would
// not show up here until the cache happened to revalidate. That's the
// "takes a long time to appear" bug: force this route to always run fresh.
export const dynamic = "force-dynamic";

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

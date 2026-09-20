import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, isAdmin } from "@/lib/auth/currentUser";
import { listAuditLog, AuditAction } from "@/lib/auth/auditLog";

export async function GET(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me || !isAdmin(me)) return NextResponse.json({ ok: false, reason: "Admins only." }, { status: 403 });

  const params = req.nextUrl.searchParams;
  try {
    const rows = await listAuditLog({
      admissionNo: params.get("admissionNo") || undefined,
      actorName: params.get("actorName") || undefined,
      action: (params.get("action") as AuditAction) || undefined,
      termSlug: params.get("termSlug") || undefined,
    });
    return NextResponse.json({ ok: true, rows });
  } catch (err: any) {
    // Most likely cause: schema_audit_log.sql hasn't been run yet on this
    // deployment — surface that clearly rather than a raw SQL error.
    return NextResponse.json(
      { ok: false, reason: "Couldn't load the audit log — has schema_audit_log.sql been run against this database?" },
      { status: 500 }
    );
  }
}

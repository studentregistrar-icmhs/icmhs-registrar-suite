import Link from "next/link";
import UserMenu from "@/components/UserMenu";

const C = { ink: "#122A28", line: "#D9DFD3", teal: "#0F7268" };

/**
 * The same set of destinations (Home, Find a student, Reports, Deferments,
 * Manage accounts) plus the logged-in user's own menu, used identically on
 * every main page — not just the home page. Before this, only the home
 * page had links to Reports/Deferments/Manage accounts, so a term-scoped
 * account landing straight on their dashboard (see app/page.tsx's
 * single-term redirect) would have had no way back to those without
 * first going through "All terms". A page passes `active` so its own link
 * doesn't render as clickable.
 *
 * Takes only the specific fields it needs (not the full CurrentUser type)
 * so callers with their own narrower "me" shape — like Dashboard.tsx,
 * which only receives what it actually uses from the server component
 * above it — can pass it straight through without reshaping it first.
 */
export default function AppNav({
  me,
  active,
}: {
  me: {
    displayName: string;
    role: "admin" | "editor" | "viewer";
    campusScope: "ALL" | "MAIN" | "NAKURU";
    departmentScope: string[] | null;
    termScope: string[] | null;
    canViewDeferments: boolean;
  };
  active?: "home" | "students" | "reports" | "deferments" | "admin";
}) {
  const linkStyle = (key: string): React.CSSProperties => ({
    fontSize: 13, fontWeight: 600, textDecoration: "none",
    color: active === key ? C.ink : C.teal,
    borderBottom: active === key ? `2px solid ${C.teal}` : "2px solid transparent",
    paddingBottom: 2,
  });

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/" style={linkStyle("home")}>All terms</Link>
        <Link href="/students" style={linkStyle("students")}>Find a student</Link>
        <Link href="/reports" style={linkStyle("reports")}>Reports</Link>
        {me.canViewDeferments && (
          <Link href="/deferments/admin" style={linkStyle("deferments")}>Deferments</Link>
        )}
        {me.role === "admin" && <Link href="/admin/users" style={linkStyle("admin")}>Manage accounts</Link>}
      </div>
      <UserMenu displayName={me.displayName} role={me.role} campusScope={me.campusScope} departmentScope={me.departmentScope} termScope={me.termScope} />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";

const C = { ink: "#122A28", line: "#D9DFD3", slate: "#54625D", teal: "#0F7268" };

const ROLE_LABEL: Record<string, string> = { admin: "Admin", editor: "Editor", viewer: "Viewer" };
const SCOPE_LABEL: Record<string, string> = { ALL: "", MAIN: " · Main only", NAKURU: " · Nakuru only" };

export default function UserMenu({
  displayName,
  role,
  campusScope,
  departmentScope,
  termScope,
}: {
  displayName: string;
  role: string;
  campusScope: string;
  departmentScope?: string[] | null;
  termScope?: string[] | null;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const deptNote = departmentScope && departmentScope.length > 0
    ? ` · ${departmentScope.length === 1 ? departmentScope[0].replace(/^School of /, "") : `${departmentScope.length} schools`}`
    : "";
  const termNote = termScope && termScope.length > 0
    ? ` · ${termScope.length === 1 ? "1 term" : `${termScope.length} terms`}`
    : "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "right", fontSize: 12.5, color: C.slate, lineHeight: 1.4 }}>
        <div style={{ color: C.ink, fontWeight: 600 }}>{displayName}</div>
        <div>{ROLE_LABEL[role] ?? role}{SCOPE_LABEL[campusScope] ?? ""}{deptNote}{termNote}</div>
      </div>
      <button
        onClick={logout}
        style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.teal, borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
      >
        Log out
      </button>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth/currentUser";
import AuditLogView from "@/components/AuditLogView";
import AppNav from "@/components/AppNav";

export default function AuditLogPage() {
  const me = getCurrentUser();
  if (!me) redirect("/login");
  if (!isAdmin(me)) redirect("/");
  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#EEF1EA", color: "#122A28", padding: "40px 32px", minHeight: "100vh", boxSizing: "border-box" }}>
      <AppNav me={me} />
      <AuditLogView />
    </div>
  );
}

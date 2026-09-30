import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { canViewDisciplinary, canManageDisciplinary } from "@/lib/discipline/access";
import { getCurrentTermSlug } from "@/lib/terms";
import AppNav from "@/components/AppNav";
import DisciplineAdmin from "@/components/DisciplineAdmin";

export const dynamic = "force-dynamic";

export default async function DisciplinePage() {
  const me = getCurrentUser();
  if (!me) redirect("/login");
  // Same 404 as a page that doesn't exist, for accounts without access.
  if (!(await canViewDisciplinary(me))) notFound();
  const canManage = await canManageDisciplinary(me);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#EEF1EA", color: "#122A28", padding: "40px 32px", minHeight: "100vh", boxSizing: "border-box" }}>
      <AppNav me={me} active="discipline" />
      <DisciplineAdmin canManage={canManage} currentTermSlug={getCurrentTermSlug()} />
    </div>
  );
}

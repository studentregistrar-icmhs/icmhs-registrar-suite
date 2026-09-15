import { notFound } from "next/navigation";
import { getStudentTimeline } from "@/lib/studentTimeline";
import StudentProfile from "@/components/StudentProfile";
import { getCurrentUser, canAccessCampus } from "@/lib/auth/currentUser";

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: { admissionNo: string };
  searchParams: { term?: string };
}) {
  const me = getCurrentUser();
  const profile = await getStudentTimeline(decodeURIComponent(params.admissionNo), searchParams?.term);
  // Same 404 either way (never found vs. found-but-wrong-campus) — a
  // campus-scoped user shouldn't be able to tell the two apart.
  if (!profile || !me || !canAccessCampus(me, profile.campus)) notFound();
  return <StudentProfile initialProfile={profile} canEdit={me.role !== "viewer"} />;
}

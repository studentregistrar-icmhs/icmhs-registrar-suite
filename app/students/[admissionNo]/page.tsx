import { notFound } from "next/navigation";
import { getStudentTimeline } from "@/lib/studentTimeline";
import StudentProfile from "@/components/StudentProfile";
import { getCurrentUser, canAccessCampus, canAccessDepartment, canAccessCourse, canAccessTerm } from "@/lib/auth/currentUser";

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: { admissionNo: string };
  searchParams: { term?: string };
}) {
  const me = getCurrentUser();
  if (!me) notFound();
  // A term-scoped viewer's "as of" term is clamped to their allowed set —
  // an out-of-scope ?term= in the URL falls back the same way an
  // unrecognized one already did, rather than 404ing the whole profile
  // (this student may well have a status within a term they ARE allowed
  // to see; the requested viewing term is just wrong, not the request).
  const viewingTerm = searchParams?.term && canAccessTerm(me, searchParams.term) ? searchParams.term : undefined;
  const profile = await getStudentTimeline(decodeURIComponent(params.admissionNo), viewingTerm, me.termScope);
  // Same 404 either way (never found vs. out of scope) — a scoped user
  // shouldn't be able to tell "doesn't exist" from "exists but not yours."
  if (!profile || !canAccessCampus(me, profile.campus) || !canAccessDepartment(me, profile.courseCode) || !canAccessCourse(me, profile.courseCode)) {
    notFound();
  }
  return <StudentProfile initialProfile={profile} canEdit={me.role !== "viewer"} me={me} />;
}

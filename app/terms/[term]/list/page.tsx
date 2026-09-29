import { notFound, redirect } from "next/navigation";
import StudentListPage from "@/components/StudentListPage";
import { getTerm } from "@/lib/terms";
import { loadTermData } from "@/lib/loadTermData";
import { getCurrentUser, canAccessTerm } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";

export default async function TermStudentListPage({
  params,
  searchParams,
}: {
  params: { term: string };
  searchParams: { status?: string; campus?: string; gender?: string; course?: string; department?: string; intake?: string };
}) {
  const term = getTerm(params.term);
  if (!term) notFound();

  const me = getCurrentUser();
  if (!me) redirect("/login");
  if (!canAccessTerm(me, params.term)) notFound();

  // Same scoping a term-restricted account gets on the dashboard itself —
  // this page can't show anyone more than their own dashboard would.
  const campusFilter = me.campusScope !== "ALL" ? me.campusScope : undefined;
  const departmentFilter = me.departmentScope ?? undefined;
  const courseFilter = me.courseScope ?? undefined;

  const data = await loadTermData(params.term, campusFilter, departmentFilter, courseFilter);
  if (!data || data.error) redirect(`/terms/${params.term}`);

  // No status means this wasn't reached via a "View full page" link (or
  // the link was malformed) — the dashboard is the right place to pick one.
  const status = searchParams.status;
  if (!status || !(status in data.dashboard.studentsByStatus)) redirect(`/terms/${params.term}`);

  return (
    <StudentListPage
      initialData={data.dashboard}
      termLabel={term.label}
      apiTermSlug={params.term}
      me={me}
      initialStatus={status}
      initialCampus={searchParams.campus}
      initialGender={searchParams.gender}
      initialCourse={searchParams.course}
      initialDepartment={searchParams.department}
      initialIntake={searchParams.intake}
    />
  );
}

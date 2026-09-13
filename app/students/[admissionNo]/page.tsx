import { notFound } from "next/navigation";
import { getStudentTimeline } from "@/lib/studentTimeline";
import StudentProfile from "@/components/StudentProfile";

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: { admissionNo: string };
  searchParams: { term?: string };
}) {
  const profile = await getStudentTimeline(decodeURIComponent(params.admissionNo), searchParams?.term);
  if (!profile) notFound();
  return <StudentProfile initialProfile={profile} />;
}

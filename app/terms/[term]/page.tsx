import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { getTerm, getPreviousTerm, TERMS } from "@/lib/terms";
import { loadTermData } from "@/lib/loadTermData";
import { getCurrentUser, canAccessTerm } from "@/lib/auth/currentUser";
import BackLink from "@/components/BackLink";

export const revalidate = Number(process.env.REVALIDATE_SECONDS ?? 120);

export function generateStaticParams() {
  return TERMS.map((t) => ({ term: t.slug }));
}

export default async function TermPage({ params }: { params: { term: string } }) {
  const term = getTerm(params.term);
  if (!term) notFound();

  const me = getCurrentUser();
  if (!me) redirect("/login"); // shouldn't happen — middleware already guards this route — but keeps this page honest on its own
  // A term-scoped account (e.g. an HOD who should only see the current
  // semester) can't reach a dashboard outside their allowed terms even by
  // typing the URL directly — 404 rather than a redirect, so it behaves
  // the same as a term slug that doesn't exist at all.
  if (!canAccessTerm(me, params.term)) notFound();
  const campusFilter = me.campusScope !== "ALL" ? me.campusScope : undefined;
  const departmentFilter = me.departmentScope ?? undefined;
  const courseFilter = me.courseScope ?? undefined;

  const previousTerm = getPreviousTerm(params.term);
  const [data, previousData] = await Promise.all([
    loadTermData(params.term, campusFilter, departmentFilter, courseFilter),
    previousTerm && canAccessTerm(me, previousTerm.slug)
      ? loadTermData(previousTerm.slug, campusFilter, departmentFilter, courseFilter)
      : Promise.resolve(null),
  ]);
  if (!data) notFound();

  if (data.error) {
    return (
      <div style={notReadyStyles.page}>
        <BackLink fallbackHref="/" style={notReadyStyles.backLink} />
        <h1 style={notReadyStyles.h1}>{term.label} isn't set up yet</h1>
        <p style={notReadyStyles.p}>{data.error}</p>
        <p style={notReadyStyles.p}>
          {term.source.kind === "live-column"
            ? `Add a "${term.source.column}" status column to both MAIN CAMPUS and NAKURU CAMPUS in the Google Sheet (see README.md) and this page will pick it up automatically.`
            : "Check that this term's data source is configured correctly in lib/terms.ts."}
        </p>
      </div>
    );
  }

  return (
    <Dashboard
      initialData={data.dashboard}
      initialConflicts={data.conflicts}
      termLabel={term.label}
      isLive={data.isLive}
      canCarryForward={term.source.kind === "live-column" && !!previousTerm}
      isColumnTerm={term.source.kind === "live-column"}
      apiTermSlug={params.term}
      previousTermLabel={previousTerm && canAccessTerm(me, previousTerm.slug) ? previousTerm.label : undefined}
      previousData={previousData && !previousData.error ? previousData.dashboard : null}
      me={me}
    />
  );
}

const notReadyStyles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: "#EEF1EA", color: "#122A28", padding: "48px 32px", minHeight: "100vh", boxSizing: "border-box", maxWidth: 640 },
  backLink: { fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#54625D", textDecoration: "none", display: "inline-block", marginBottom: 20 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 26, margin: "0 0 14px" },
  p: { fontSize: 14, color: "#54625D", lineHeight: 1.6, marginBottom: 10 },
};

import Link from "next/link";
import { redirect } from "next/navigation";
import { TERMS, getCurrentTermSlug } from "@/lib/terms";
import { loadTermData } from "@/lib/loadTermData";
import TermStatusPie from "@/components/TermStatusPie";
import { getCurrentUser, isAdmin, canAccessTerm } from "@/lib/auth/currentUser";
import AppNav from "@/components/AppNav";

export const revalidate = Number(process.env.REVALIDATE_SECONDS ?? 120);

export default async function Home() {
  const me = getCurrentUser();
  const campusFilter = me && me.campusScope !== "ALL" ? me.campusScope : undefined;
  const departmentFilter = me?.departmentScope ?? undefined;
  const courseFilter = me?.courseScope ?? undefined;
  const currentTermSlug = getCurrentTermSlug();
  // Term-scoped accounts (e.g. an HOD restricted to the current semester)
  // never see a card for a term outside their scope at all — not shown
  // greyed out, just absent, same as the direct-URL block on /terms/[term].
  const visibleTerms = me ? TERMS.filter((t) => canAccessTerm(me, t.slug)) : TERMS;

  // A scoped account (department and/or term restricted, so not an admin —
  // admins always see every term) with exactly one term to choose from
  // gets no picker at all: straight to their dashboard. AppNav on every
  // main page (including the dashboard itself) means they're never
  // stranded without a way back to Find a student / Reports / etc, which
  // is what made this redirect safe to add.
  if (me && !isAdmin(me) && visibleTerms.length === 1) {
    redirect(`/terms/${visibleTerms[0].slug}`);
  }

  const results = await Promise.all(
    visibleTerms.map(async (t) => ({ term: t, data: await loadTermData(t.slug, campusFilter, departmentFilter, courseFilter) }))
  );

  // A single-department account gets a personalized heading ("School of
  // Nursing" rather than generic) — purely cosmetic, doesn't affect what
  // data loads, since that's already scoped regardless of this heading.
  const deptHeading =
    departmentFilter && departmentFilter.length === 1 ? departmentFilter[0] : null;

  return (
    <div style={styles.page}>
      {me ? (
        <AppNav me={me} active="home" />
      ) : (
        <div style={styles.eyebrow}>ICMHS · REGISTRAR'S OFFICE</div>
      )}
      <h1 style={styles.h1}>{deptHeading ?? "Student Population Tracker"}</h1>
      <p style={styles.sub}>
        {deptHeading ? "Student Population Tracker — choose a term to view its dashboard." : "Choose a term to view its dashboard."}
      </p>
      <div style={styles.grid}>
        {results.map(({ term: t, data }) => {
          const ready = !!data && !data.error;
          return (
            <Link key={t.slug} href={`/terms/${t.slug}`} style={styles.card}>
              <div style={styles.cardLabel}>{t.label}</div>
              <div style={styles.cardMeta}>
                {t.source.kind === "static" ? "Static snapshot" : "Live"}
                {t.slug === currentTermSlug ? " · current" : ""}
              </div>
              {ready ? (
                <TermStatusPie statusCounts={data!.dashboard.statusCounts.all} />
              ) : (
                <div style={styles.cardNotReady}>Not set up yet</div>
              )}
            </Link>
          );
        })}
        {visibleTerms.length === 0 && (
          <div style={{ color: "#54625D", fontSize: 13.5 }}>
            No terms are available for your account yet — ask an admin to check your term access.
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: "#EEF1EA", color: "#122A28", padding: "48px 32px", minHeight: "100vh", boxSizing: "border-box" },
  eyebrow: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, letterSpacing: "0.12em", color: "#0F7268", fontWeight: 600, marginBottom: 6 },
  h1: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 32, margin: 0 },
  sub: { fontSize: 14, color: "#54625D", marginTop: 8, marginBottom: 28 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, maxWidth: 900 },
  card: { display: "block", background: "#fff", border: "1px solid #D9DFD3", borderRadius: 10, padding: "20px 18px", textDecoration: "none", color: "#122A28", boxShadow: "0 1px 3px rgba(18,42,40,0.07)" },
  cardLabel: { fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 17, marginBottom: 6 },
  cardMeta: { fontFamily: "IBM Plex Mono, monospace", fontSize: 11.5, color: "#54625D", textTransform: "uppercase", letterSpacing: "0.04em" },
  cardNotReady: { fontSize: 11.5, color: "#98A39C", fontStyle: "italic", marginTop: 14 },
};

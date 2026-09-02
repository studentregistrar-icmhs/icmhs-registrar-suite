import Dashboard from "./Dashboard";

// Auth is enforced by middleware.ts (Basic Auth) before this page ever
// renders, so — unlike the standalone deferment app — there's no
// login/logout state to manage here.
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="wrap">
      <div className="letterhead">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="logo"
            src="https://images.icmhs.co.ke/admin/janus/files/icmhs_new_logo.webp"
            alt="ICMHS logo"
          />
          <div>
            <div className="eyebrow">Office of the Registrar of Students</div>
            <h1>Registrar Review</h1>
            <div className="sub">Imperial College of Medical and Health Sciences</div>
          </div>
        </div>
      </div>

      <div className="settings-nav">
        <a href="/deferments/admin/settings" className="tab-btn">Deadline Settings &rarr;</a>
        <a href="/" className="tab-btn">&larr; Back to Registrar Suite</a>
      </div>

      <Dashboard />
    </div>
  );
}

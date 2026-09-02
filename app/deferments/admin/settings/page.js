import DeadlineSettings from "./DeadlineSettings";

// Auth is enforced by middleware.ts (Basic Auth) before this page ever
// renders — see app/deferments/admin/page.js for the same note.
export const dynamic = "force-dynamic";

export default function SettingsPage() {
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
            <h1>Deferment Deadline Settings</h1>
            <div className="sub">Imperial College of Medical and Health Sciences</div>
          </div>
        </div>
      </div>

      <div className="settings-nav">
        <a href="/deferments/admin" className="tab-btn">&larr; Back to Dashboard</a>
      </div>

      <DeadlineSettings />
    </div>
  );
}

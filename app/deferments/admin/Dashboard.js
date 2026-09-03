"use client";

import { useEffect, useRef, useState } from "react";

const AUTO_REFRESH_MS = 30 * 1000; // this list needs to feel closer to instant than the term dashboards do

export default function Dashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const loadingRef = useRef(false); // guards against overlapping fetches if one is slow

  useEffect(() => {
    load();
  }, []);

  // Auto-refresh so a request submitted while this page is sitting open
  // shows up on its own, not only after someone thinks to reload the tab.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load({ background: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  async function load({ background = false } = {}) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (background) setRefreshing(true);
    else setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/deferments/requests", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load requests.");
      setRequests(data.requests);
      setLastLoadedAt(new Date());
    } catch (err) {
      setLoadError(err.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  function exportPdf() {
    const url = filter === "all" ? "/api/deferments/requests/export" : `/api/deferments/requests/export?status=${filter}`;
    window.open(url, "_blank");
  }

  if (loading) return <div className="loading">Loading requests…</div>;
  if (loadError) return <div className="empty">{loadError}</div>;

  return (
    <div>
      <div className="filters-row">
        <div className="filters">
          {["all", "pending", "approved", "denied"].map((f) => (
            <button
              key={f}
              className={"chip" + (filter === f ? " active" : "")}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="refresh-status">
            {refreshing ? "Refreshing…" : lastLoadedAt ? `Updated ${lastLoadedAt.toLocaleTimeString()}` : ""}
          </span>
          <button className="export-btn" type="button" onClick={() => load()} disabled={refreshing}>
            Refresh
          </button>
          <button className="export-btn" type="button" onClick={exportPdf}>
            Export {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)} (Excel)
          </button>
        </div>
      </div>


      {filtered.length === 0 ? (
        <div className="empty">No requests here yet.</div>
      ) : (
        <div className="ledger">
          {filtered.map((r) => (
            <Entry
              key={r.id}
              record={r}
              open={openId === r.id}
              onToggle={() => setOpenId(openId === r.id ? null : r.id)}
              onUpdated={(updated) => {
                setRequests((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Entry({ record, open, onToggle, onUpdated }) {
  const [notes, setNotes] = useState(record.reviewer_notes || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function setStatus(status) {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/deferments/requests/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewerNotes: notes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update request.");
      onUpdated(data.request);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="entry">
      <div className="entry-head" onClick={onToggle}>
        <div>
          <div className="name">{record.full_name || "Unnamed applicant"}</div>
          <div className="meta">
            {record.id} · {record.admission_number || "no admission no."} · {record.program} · filed{" "}
            {new Date(record.submitted_at).toLocaleDateString()}
          </div>
        </div>
        <div className={`status-badge status-${record.status}`}>
          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
        </div>
      </div>

      {open && (
        <div className="entry-body">
          <div className="detail-grid">
            <Detail k="Admission Number" v={record.admission_number} />
            <Detail k="Email" v={record.email} />
            <Detail k="Phone" v={record.phone} />
            <Detail k="Campus" v={record.campus} />
            <Detail k="Application Date" v={record.application_date} />
            <Detail k="Type of Deferment" v={record.type_of_deferment} />
            <Detail k="Semester Deferring" v={`${record.semester_deferring || ""} ${record.defer_year || ""}`.trim()} />
            <Detail k="Resumption Date" v={record.resumption_date} />
            <Detail k="Reason category" v={record.reason_category} />
            <Detail full k="Explanation" v={record.reason_details} />
          </div>

          <div className="review-controls">
            <label>Reviewer notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes for this request" />
            <div className="action-row">
              <button className="approve" disabled={saving} onClick={() => setStatus("approved")}>Approve</button>
              <button className="deny" disabled={saving} onClick={() => setStatus("denied")}>Deny</button>
              <button className="reset" disabled={saving} onClick={() => setStatus("pending")}>Reset to Pending</button>
              <button className="reset" type="button" onClick={() => window.open(`/api/deferments/requests/${record.id}/export`, "_blank")}>Download PDF</button>
              {err && <span className="err">{err}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ k, v, full }) {
  return (
    <div className={full ? "detail-full" : ""}>
      <div className="k">{k}</div>
      <div className="v">{v || "—"}</div>
    </div>
  );
}

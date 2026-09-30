"use client";

import { useEffect, useRef, useState } from "react";

const AUTO_REFRESH_MS = 30 * 1000; // this list needs to feel closer to instant than the term dashboards do

// The fixed set of options on the apply form's "Type of Deferment" field.
// Anything that doesn't match one of these (blank, or a legacy/free-text
// value from before the field existed) is bucketed as "Other" rather than
// silently dropped, so the category breakdown always accounts for every
// request.
const KNOWN_CATEGORIES = ["Semester Deferment", "Attachment Deferment", "Maternity Leave"];
const OTHER_CATEGORY = "Other";

function categoryOf(record) {
  const v = (record.type_of_deferment || "").trim();
  return KNOWN_CATEGORIES.includes(v) ? v : OTHER_CATEGORY;
}

function countBy(list, keyFn) {
  const counts = {};
  for (const item of list) {
    const k = keyFn(item);
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

export default function Dashboard() {
  const [requests, setRequests] = useState([]);
  const [contactsHidden, setContactsHidden] = useState(true); // fail closed until the server says otherwise
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
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
      setContactsHidden(data.contactsHidden !== false);
      setLastLoadedAt(new Date());
    } catch (err) {
      setLoadError(err.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Status and category filters are independent facets that combine (AND),
  // so each facet's own counts are computed against the *other* facet's
  // current selection — that way selecting "Pending" updates the category
  // counts to "pending requests per category" rather than the flat totals.
  const statusBase = categoryFilter === "all" ? requests : requests.filter((r) => categoryOf(r) === categoryFilter);
  const categoryBase = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const statusCounts = countBy(statusBase, (r) => r.status);
  const categoryCounts = countBy(categoryBase, categoryOf);

  const filtered = requests
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => categoryFilter === "all" || categoryOf(r) === categoryFilter);

  function exportPdf() {
    const url = filter === "all" ? "/api/deferments/requests/export" : `/api/deferments/requests/export?status=${filter}`;
    window.open(url, "_blank");
  }

  if (loading) return <div className="loading">Loading requests…</div>;
  if (loadError) return <div className="empty">{loadError}</div>;

  return (
    <div>
      <div className="stats-bar">
        <div className="stat-total">
          <span className="stat-num">{requests.length}</span>
          <span className="stat-label">Total deferments received</span>
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

      <div className="filter-facet">
        <div className="facet-label">Status</div>
        <div className="filters">
          {["all", "pending", "approved", "denied"].map((f) => (
            <button
              key={f}
              className={"chip" + (filter === f ? " active" : "")}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="chip-count">{f === "all" ? statusBase.length : statusCounts[f] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="filter-facet">
        <div className="facet-label">Category</div>
        <div className="filters">
          {["all", ...KNOWN_CATEGORIES, OTHER_CATEGORY].map((c) => (
            <button
              key={c}
              className={"chip" + (categoryFilter === c ? " active" : "")}
              onClick={() => setCategoryFilter(c)}
              type="button"
            >
              {c === "all" ? "All types" : c}
              <span className="chip-count">{c === "all" ? categoryBase.length : categoryCounts[c] || 0}</span>
            </button>
          ))}
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
              contactsHidden={contactsHidden}
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

function Entry({ record, contactsHidden, open, onToggle, onUpdated }) {
  const [notes, setNotes] = useState(record.reviewer_notes || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const category = categoryOf(record);

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
      if (data.sheetWarning) alert(data.sheetWarning);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="entry">
      <div className="entry-row">
        <div className="entry-actions">
          <button
            className="approve"
            disabled={saving || record.status === "approved"}
            onClick={() => setStatus("approved")}
          >
            Approve
          </button>
          <button
            className="deny"
            disabled={saving || record.status === "denied"}
            onClick={() => setStatus("denied")}
          >
            Deny
          </button>
          <button
            className="reset"
            disabled={saving || record.status === "pending"}
            onClick={() => setStatus("pending")}
          >
            Reset
          </button>
          {err && <span className="err">{err}</span>}
        </div>

        <div className="entry-summary" onClick={onToggle}>
          <div className="entry-summary-top">
            <div className="name">{record.full_name || "Unnamed applicant"}</div>
            <div className="badges">
              <span className="category-badge">{category}</span>
              <span className={`status-badge status-${record.status}`}>
                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
              </span>
              <span className="chevron">{open ? "▾" : "▸"}</span>
            </div>
          </div>
          <div className="meta">
            {record.id} · {record.admission_number || "no admission no."} · {record.program} · filed{" "}
            {new Date(record.submitted_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {open && (
        <div className="entry-body">
          <div className="detail-grid">
            <Detail k="Admission Number" v={record.admission_number} />
            {!contactsHidden && <Detail k="Email" v={record.email} />}
            {!contactsHidden && <Detail k="Phone" v={record.phone} />}
            <Detail k="Campus" v={record.campus} />
            <Detail k="Application Date" v={record.application_date} />
            <Detail k="Type of Deferment" v={record.type_of_deferment} />
            <Detail k="Semester Deferring" v={`${record.semester_deferring || ""} ${record.defer_year || ""}`.trim()} />
            <Detail k="Resumption Date" v={record.resumption_date} />
            <Detail k="Deferred previous semester" v={record.deferred_previous_semester || "—"} />
            <Detail k="Reason category" v={record.reason_category} />
            <Detail full k="Explanation" v={record.reason_details} />
          </div>

          <div className="review-controls">
            <label>Reviewer notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes for this request" />
            <div className="action-row">
              <button className="reset" type="button" onClick={() => window.open(`/api/deferments/requests/${record.id}/export`, "_blank")}>Download PDF</button>
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

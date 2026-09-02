"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SEMESTERS,
  getAllowedYears,
  getAllowedSemesters,
  getResumptionDate,
  getCurrentSemesterValue,
  isCurrentSemesterDeadlinePassed,
  formatDeadline
} from "@/lib/deferments/deferment";
import DeadlineBanner from "./DeadlineBanner";

const initialState = {
  fullName: "",
  admissionNumber: "",
  email: "",
  phone: "",
  program: "",
  campus: "",
  typeOfDeferment: "",
  semesterDeferring: "",
  deferYear: "",
  reasonCategory: "",
  reasonDetails: "",
  declare: false
};

function sanitizePhone(value) {
  // Keep digits, and a leading "+" only.
  let v = value.replace(/[^\d+]/g, "");
  const hasLeadingPlus = v.startsWith("+");
  v = v.replace(/\+/g, "");
  if (hasLeadingPlus) v = "+" + v;
  return v;
}

export default function ApplyPage() {
  const [now] = useState(() => new Date());
  const [form, setForm] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmedId, setConfirmedId] = useState(null);
  const [lookupStatus, setLookupStatus] = useState("idle"); // idle | loading | found | not_found | error
  const [locked, setLocked] = useState(false);

  // Registrar-set deadlines, fetched once on mount. Empty array until loaded;
  // no deadline configured for an intake means it stays open (permissive).
  const [deadlines, setDeadlines] = useState([]);

  useEffect(() => {
    fetch("/api/deferments/deadlines")
      .then((res) => res.json())
      .then((data) => setDeadlines(data.deadlines || []))
      .catch(() => setDeadlines([]));
  }, []);

  const isMaternity = form.typeOfDeferment === "Maternity Leave";

  const currentSemesterValue = useMemo(() => getCurrentSemesterValue(now), [now]);
  const currentYear = now.getFullYear();
  const currentDeadlineRow = useMemo(
    () => deadlines.find((d) => d.semester === currentSemesterValue && Number(d.year) === currentYear),
    [deadlines, currentSemesterValue, currentYear]
  );
  const currentDeadlinePassed = isCurrentSemesterDeadlinePassed(currentDeadlineRow, now);

  const allowedYears = useMemo(() => getAllowedYears(now), [now]);
  const allowedSemesters = useMemo(
    () =>
      form.deferYear
        ? getAllowedSemesters(form.deferYear, now, currentDeadlinePassed, isMaternity)
        : SEMESTERS,
    [form.deferYear, now, currentDeadlinePassed, isMaternity]
  );

  const applicationDateDisplay = now.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const applicationDateISO = now.toISOString().slice(0, 10);

  const resumptionDate = useMemo(
    () => getResumptionDate(form.semesterDeferring, form.deferYear),
    [form.semesterDeferring, form.deferYear]
  );

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  async function handleLookup() {
  if (!form.admissionNumber.trim()) return;
  setLookupStatus("loading");
  try {
    const res = await fetch(`/api/deferments/lookup-student?admissionNumber=${encodeURIComponent(form.admissionNumber.trim())}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lookup failed.");
    if (!data.found) {
      setLookupStatus("not_found");
      return;
    }
    setForm((f) => ({
      ...f,
      fullName: data.name || f.fullName,
      campus: data.campus || f.campus,
      program: data.programme || f.program
    }));
    setLocked(true);
    setLookupStatus("found");
  } catch (err) {
    setLookupStatus("error");
  }
}

function unlockDetails() {
  setLocked(false);
  setLookupStatus("idle");
}

  // If the chosen year/type no longer allows the chosen semester, clear it.
  useEffect(() => {
    if (form.semesterDeferring && form.deferYear) {
      const stillAllowed = allowedSemesters.some((s) => s.value === form.semesterDeferring);
      if (!stillAllowed) update("semesterDeferring", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.deferYear, form.typeOfDeferment]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/deferments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          applicationDate: applicationDateISO,
          resumptionDate
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }
      setConfirmedId(data.id);
    } catch (err) {
      setError(err.message || "Something went wrong saving your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedId) {
    return (
      <div className="wrap">
        <Letterhead />
        <div className="confirm">
          <div className="stamp">On<br />File</div>
          <h3>Request received</h3>
          <p>Your deferment request has been logged with the ICMHS Office of the Registrar of Students.</p>
          <p className="id">Reference number: {confirmedId}</p>
          <div style={{ marginTop: 18 }}>
            <button
              className="primary"
              type="button"
              onClick={() => {
                setForm(initialState);
                setConfirmedId(null);
              }}
            >
              Submit another request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <Letterhead />
      {!isMaternity && currentDeadlineRow && !currentDeadlinePassed && (
        <DeadlineBanner deadline={new Date(currentDeadlineRow.deadline)} />
      )}
      <div className="doc">
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <div className="num">01</div>
            <h2>Applicant Information</h2>
            <div className="row">
              <div className="field">
              <label>Admission Number <span className="req">*</span></label>
              <input
                type="text"
                required
                placeholder="DPTT/S-0000/IC/26"
                value={form.admissionNumber}
                disabled={locked}
                onChange={(e) => update("admissionNumber", e.target.value)}
              />
              {!locked && (
                <button
                  type="button"
                  className="secondary"
                  style={{ marginTop: 6 }}
                  onClick={handleLookup}
                  disabled={lookupStatus === "loading" || !form.admissionNumber.trim()}
                >
                  {lookupStatus === "loading" ? "Checking…" : "Verify admission number"}
                </button>
              )}
              {lookupStatus === "not_found" && (
                <div className="err" style={{ marginTop: 6 }}>
                  Admission number not found in our records. Please double-check it, or contact the Office of the Registrar of Students for assistance.
                </div>
              )}
              {lookupStatus === "error" && (
                <div className="err" style={{ marginTop: 6 }}>
                  Could not verify right now. You can continue filling the form manually.
                </div>
              )}
              {locked && (
                <button type="button" className="secondary" style={{ marginTop: 6 }} onClick={unlockDetails}>
                  Not you? Change admission number
                </button>
              )}
            </div>
            <div className="field">
                <label>Full Name <span className="req">*</span></label>
                <input type="text" required value={form.fullName} disabled onChange={(e) => update("fullName", e.target.value)} />
            </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Email address <span className="req">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div className="field">
                <label>Phone number <span className="req">*</span></label>
                <input
                  type="tel"
                  required
                  inputMode="tel"
                  placeholder="07XXXXXXXX"
                  value={form.phone}
                  onChange={(e) => update("phone", sanitizePhone(e.target.value))}
                />
              </div>
            </div>
            <div className="field">
              <label>Date of Application</label>
              <div className="readonly-field">{applicationDateDisplay}</div>
            </div>
          </div>

          <div className="field-group">
            <div className="num">02</div>
            <h2>Program &amp; Campus</h2>
            <div className="field">
              <label>Program applied to <span className="req">*</span></label>
              <div className="readonly-field">{form.program || "Not yet verified"}</div>
              {locked && !form.program && (
                <div className="disclaimer" style={{ marginTop: 4 }}>
                  We found your record, but couldn't match your programme automatically. Please contact the Office of the Registrar of Students for assistance.
                </div>
              )}
            </div>
            <div className="field">
              <label>Campus <span className="req">*</span></label>
              <div className="readonly-field">{form.campus || "Not yet verified"}</div>
            </div>
          </div>

          <div className="field-group">
            <div className="num">03</div>
            <h2>Deferment Details</h2>
            <div className="row">
              <div className="field">
                <label>Type of Deferment <span className="req">*</span></label>
                <select required value={form.typeOfDeferment} onChange={(e) => update("typeOfDeferment", e.target.value)}>
                  <option value="">Select…</option>
                  <option>Semester Deferment</option>
                  <option>Attachment Deferment</option>
                  <option>Maternity Leave</option>
                </select>
                {isMaternity && (
                  <div className="hint" style={{ marginTop: 4 }}>
                    Maternity Deferment has no submission deadline — you may apply at any time during the semester.
                  </div>
                )}
              </div>
              <div className="field">
                <label>Year <span className="req">*</span></label>
                <select required value={form.deferYear} onChange={(e) => update("deferYear", e.target.value)}>
                  <option value="">Select…</option>
                  {allowedYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Semester Deferring <span className="req">*</span></label>
                <select
                  required
                  value={form.semesterDeferring}
                  disabled={!form.deferYear}
                  onChange={(e) => update("semesterDeferring", e.target.value)}
                >
                  <option value="">{form.deferYear ? "Select…" : "Select a year first"}</option>
                  {allowedSemesters.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Resumption Date</label>
                <div className="readonly-field">
                  {resumptionDate || "Select semester and year first"}
                </div>
              </div>
            </div>
            <div className="disclaimer">
              ICMHS deferment policy permits deferring a maximum of one semester (approximately
              three months) at a time. Your resumption date above is calculated automatically
              according to this policy and cannot be extended. Anyone who wishes to extend their Deferment MUST reapply for extension during that semester.
            </div>
          </div>

          <div className="field-group">
            <div className="num">04</div>
            <h2>Reason for Deferment</h2>
            <div className="field">
              <label>Category <span className="req">*</span></label>
              <select required value={form.reasonCategory} onChange={(e) => update("reasonCategory", e.target.value)}>
                <option value="">Select one…</option>
                <option>Financial hardship</option>
                <option>Medical or health circumstances</option>
                <option>Personal or family circumstances</option>
                <option>Pending Supplementary</option>
                <option>Employment or work obligation</option>
                <option>Did not meet admission requirements in time</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label>Explanation <span className="req">*</span></label>
              <textarea required placeholder="Describe your circumstances and why a deferment is needed." value={form.reasonDetails} onChange={(e) => update("reasonDetails", e.target.value)} />
            </div>
          </div>

          <div className="field-group">
            <div className="num">05</div>
            <h2>Declaration</h2>
            <div className="declaration">
              <input type="checkbox" required checked={form.declare} onChange={(e) => update("declare", e.target.checked)} id="declare" />
              <label htmlFor="declare" style={{ margin: 0 }}>
                I certify that the information provided in this request is accurate and complete to the best of my knowledge, and I understand that a deferment does not guarantee admission under future terms. I understand ICMHS programs are regulated by TVETA and relevant professional bodies.
              </label>
            </div>
            <div className="badge-row">
              <span className="accred-badge">TVETA Accredited</span>
              <span className="accred-badge">NCK Recognized</span>
              <span className="accred-badge">Thika &amp; Nakuru Campuses</span>
            </div>
          </div>

          <div className="submit-row">
            <div className="note">Submissions are reviewed by the ICMHS Office of the Registrar of Students.</div>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
        {error && <div className="err" style={{ padding: "0 26px 16px" }}>{error}</div>}
      </div>
    </div>
  );
}

function Letterhead() {
  return (
    <div className="letterhead">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="https://images.icmhs.co.ke/admin/janus/files/icmhs_new_logo.webp" alt="ICMHS logo" onError={(e) => (e.currentTarget.style.display = "none")} />
        <div>
          <div className="eyebrow">Office of the Registrar of Students</div>
          <h1>Enrollment Deferment Request</h1>
          <div className="sub">Imperial College of Medical and Health Sciences</div>
        </div>
      </div>
      <div className="ref">Form ICMHS-AD/14<br />Session 2026</div>
    </div>
  );
}

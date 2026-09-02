"use client";

import { useEffect, useState } from "react";
import { SEMESTERS, getAllowedYears } from "@/lib/deferments/deferment";

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in LOCAL time, not UTC ISO.
function toDatetimeLocalValue(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DeadlineSettings() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const now = useState(() => new Date())[0];
  const years = getAllowedYears(now);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/deferments/deadlines");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load deadlines.");
      setDeadlines(data.deadlines || []);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function findDeadline(semester, year) {
    return deadlines.find((d) => d.semester === semester && Number(d.year) === Number(year));
  }

  function updateLocal(semester, year, isoValue) {
    setDeadlines((prev) => {
      const existing = findDeadline(semester, year);
      if (existing) {
        return prev.map((d) => (d === existing ? { ...d, deadline: isoValue } : d));
      }
      return [...prev, { semester, year: String(year), deadline: isoValue }];
    });
  }

  if (loading) return <div className="loading">Loading deadlines…</div>;
  if (loadError) return <div className="empty">{loadError}</div>;

  return (
    <div className="doc" style={{ marginTop: 20 }}>
      <div className="field-group">
        <h2>Per-Intake Deadlines</h2>
        <div className="hint" style={{ marginBottom: 16 }}>
          Set the cutoff date and time for each intake. Once an intake's deadline passes, students
          can no longer choose it as their CURRENT semester to defer (they can still defer a future
          one). Maternity Deferment always ignores these deadlines. Leaving a row blank means that
          intake has no cutoff yet — it stays open.
        </div>
        <div className="deadline-grid">
          {years.map((year) =>
            SEMESTERS.map((s) => (
              <DeadlineRow key={`${s.value}-${year}`} semester={s} year={year} row={findDeadline(s.value, year)} onSaved={load} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DeadlineRow({ semester, year, row, onSaved }) {
  const [value, setValue] = useState(toDatetimeLocalValue(row?.deadline));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setValue(toDatetimeLocalValue(row?.deadline));
  }, [row?.deadline]);

  async function save() {
    if (!value) {
      setErr("Pick a date and time first.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/deferments/deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semester: semester.value, year, deadline: new Date(value).toISOString() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="deadline-row">
      <div className="deadline-row-label">
        {semester.label} <span className="deadline-row-year">{year}</span>
      </div>
      <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      <button className="reset" type="button" disabled={saving} onClick={save}>
        {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save"}
      </button>
      {err && <span className="err">{err}</span>}
    </div>
  );
}

// Deferment policy logic shared between the client form and the server API.
// Deadlines are no longer auto-calculated — they're set by the registrar per
// intake (semester + year) and stored in the database. These functions are
// pure: callers supply the relevant deadline row(s) rather than this module
// fetching them, so the same logic works identically on the client and server.

export const SEMESTERS = [
  { value: "Jan-Apr", label: "January - April", idx: 0, startMonthLabel: "January" },
  { value: "May-Aug", label: "May - August", idx: 1, startMonthLabel: "May" },
  { value: "Sep-Dec", label: "September - December", idx: 2, startMonthLabel: "September" }
];

export function getCurrentSemesterIndex(date) {
  const m = date.getMonth(); // 0-11
  if (m <= 3) return 0; // Jan(0)-Apr(3)
  if (m <= 7) return 1; // May(4)-Aug(7)
  return 2; // Sep(8)-Dec(11)
}

export function getCurrentSemesterValue(date) {
  return SEMESTERS[getCurrentSemesterIndex(date)].value;
}

export function getAllowedYears(now) {
  const y = now.getFullYear();
  return [y, y + 1];
}

// currentDeadlineRow is the deadline row (if any) for the CURRENT ongoing
// semester — { semester, year, deadline } or null/undefined if the registrar
// hasn't set one yet. No deadline set = treated as not passed (permissive
// default, so students aren't blocked just because nothing's configured).
export function isCurrentSemesterDeadlinePassed(currentDeadlineRow, now) {
  if (!currentDeadlineRow || !currentDeadlineRow.deadline) return false;
  return now.getTime() > new Date(currentDeadlineRow.deadline).getTime();
}

// Which semesters can be selected for a given target year: the currently
// ongoing semester (if its own deadline hasn't passed) or any later one.
// A future year has no such restriction. isExempt (e.g. Maternity Deferment)
// bypasses the deadline restriction entirely — every semester stays selectable.
export function getAllowedSemesters(selectedYear, now, currentDeadlinePassed, isExempt) {
  if (isExempt) return SEMESTERS;
  const currentYear = now.getFullYear();
  const currentIdx = getCurrentSemesterIndex(now);
  const minIdx = currentDeadlinePassed ? currentIdx + 1 : currentIdx;

  if (Number(selectedYear) === currentYear) {
    return SEMESTERS.filter((s) => s.idx >= minIdx);
  }
  return SEMESTERS;
}

export function isSemesterYearAllowed(semesterValue, year, now, currentDeadlinePassed, isExempt) {
  const allowedYears = getAllowedYears(now);
  if (!allowedYears.includes(Number(year))) return false;
  const allowed = getAllowedSemesters(year, now, currentDeadlinePassed, isExempt);
  return allowed.some((s) => s.value === semesterValue);
}

// Deferment is limited to a single semester (~3 months): resumption is the
// start of the very next semester after the one being deferred.
export function getResumptionDate(semesterValue, year) {
  const s = SEMESTERS.find((x) => x.value === semesterValue);
  if (!s || !year) return null;
  const nextIdx = (s.idx + 1) % 3;
  const nextSemester = SEMESTERS[nextIdx];
  const resumeYear = s.idx === 2 ? Number(year) + 1 : Number(year);
  return `${nextSemester.startMonthLabel} ${resumeYear}`;
}

export function formatDeadline(date) {
  return date.toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" }) +
    " at " +
    date.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
}

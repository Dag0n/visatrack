// Shared formatting helpers. Dates from PocketBase are UTC-midnight stamps
// ("2026-05-04 00:00:00.000Z"), so all date formatting must read UTC fields —
// local-time formatting shows the previous day for users west of UTC.

export function stripRedditPrefix(value) {
  return (value || "").trim().replace(/^\/?u\//i, "");
}

export function formatRedditUsername(value) {
  const clean = stripRedditPrefix(value);
  return clean ? `u/${clean}` : "Anon";
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

// A percentage value → "94.1%" ("100%" without the decimal).
export function formatRateValue(value) {
  if (value == null) return "—";
  return `${value === 100 ? "100" : value.toFixed(1)}%`;
}

export function formatApprovalRate(approved, decided) {
  if (!decided) return "—";
  return formatRateValue((approved / decided) * 100);
}

// "4 May 2026" from a PocketBase date string or Date.
export function formatDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// "Aug 2026" from a "2026-08" month key.
export function formatMonth(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  if (!year || !month) return String(monthKey);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

// The user's local calendar date as YYYY-MM-DD, for comparing against
// <input type="date"> values (which are in the user's local calendar).
export function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

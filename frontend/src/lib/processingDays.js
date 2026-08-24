import { isBankHoliday } from "./ukBankHolidays";

// PocketBase date strings are UTC midnight ("2026-05-01 00:00:00.000Z").
// All calendar math below must stay in UTC — mixing local getDay() with the
// UTC-based bank-holiday lookup shifts "Day 1" onto a weekend for users west
// of UTC and makes working-day counts disagree with the backend.
export function parseUTCDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  return new Date(String(value).replace(" ", "T"));
}

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function isNonWorkingDay(date) {
  return isWeekend(date) || isBankHoliday(date);
}

// UKVI counts "Day 1" of processing time as the first working day
// after the biometrics appointment.
export function firstWorkingDayAfter(dateStr) {
  const d = parseUTCDate(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  while (isNonWorkingDay(d)) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

export function calendarDaysBetween(from, to) {
  const diff = parseUTCDate(to).getTime() - parseUTCDate(from).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

// The calendar date of the nth working day counting the start date (when it
// is a working day) as day 1 — used to turn cohort quartiles into real dates.
export function addWorkingDays(start, workingDays) {
  const d = parseUTCDate(start);
  if (workingDays <= 1 && !isNonWorkingDay(d)) return d;
  let count = isNonWorkingDay(d) ? 0 : 1;
  while (count < workingDays) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isNonWorkingDay(d)) count++;
  }
  return d;
}

export function workingDaysBetween(from, to) {
  let count = 0;
  const cur = parseUTCDate(from);
  const end = parseUTCDate(to);
  while (cur <= end) {
    if (!isNonWorkingDay(cur)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

// Returns the Day-1 start of UKVI processing time for an application: the
// first working day after biometrics. Processing time is undefined until
// biometrics has happened — there is no fallback to the application date.
export function processingStartDate(item) {
  if (!item.biometrics_date) return null;
  return firstWorkingDayAfter(item.biometrics_date);
}

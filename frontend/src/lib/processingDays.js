import { isBankHoliday } from "./ukBankHolidays";

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isNonWorkingDay(date) {
  return isWeekend(date) || isBankHoliday(date);
}

// UKVI counts "Day 1" of processing time as the first working day
// after the biometrics appointment.
export function firstWorkingDayAfter(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  while (isNonWorkingDay(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function calendarDaysBetween(from, to) {
  const diff = to.getTime() - from.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

export function workingDaysBetween(from, to) {
  let count = 0;
  const cur = new Date(from);
  cur.setDate(cur.getDate() + 1);
  while (cur <= to) {
    if (!isNonWorkingDay(cur)) count++;
    cur.setDate(cur.getDate() + 1);
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

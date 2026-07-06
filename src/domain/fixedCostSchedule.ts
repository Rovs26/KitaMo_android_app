/**
 * Pure fixed-cost recurrence math. Dependency-free so it compiles standalone
 * for scripts/check-fixed-costs.js.
 *
 * Occurrences are computed on the fly from an anchor due date — nothing is
 * materialized ahead of time. Rules kept deliberately simple:
 * - daily: every day
 * - weekly: every 7 days from the anchor
 * - monthly: same day each month, clamped to the month's last day (Jan 31 -> Feb 28)
 * - one_time: exactly the anchor date
 * An occurrence is an expense of the reporting period it falls in, whether or
 * not it has been paid; payments track cash-flow visibility only.
 */

export type FixedCostFrequency = "daily" | "weekly" | "monthly" | "one_time";

const MAX_OCCURRENCES = 5000;

type DateParts = { year: number; month: number; day: number };

function parseIsoDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }

  return { year, month, day };
}

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function isValidIsoDate(value: string) {
  return parseIsoDate(value) !== null;
}

/**
 * All occurrence dates (ISO YYYY-MM-DD, ascending) of a cost inside
 * [rangeStart, rangeEnd] inclusive, respecting the cost's own end date.
 */
export function listOccurrences(
  anchorDueDate: string,
  frequency: FixedCostFrequency,
  endDate: string | null,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const anchor = parseIsoDate(anchorDueDate);
  if (!anchor || !isValidIsoDate(rangeStart) || !isValidIsoDate(rangeEnd) || rangeStart > rangeEnd) {
    return [];
  }

  const effectiveEnd = endDate && isValidIsoDate(endDate) && endDate < rangeEnd ? endDate : rangeEnd;
  if (anchorDueDate > effectiveEnd) {
    return [];
  }

  if (frequency === "one_time") {
    return anchorDueDate >= rangeStart && anchorDueDate <= effectiveEnd ? [anchorDueDate] : [];
  }

  const occurrences: string[] = [];

  if (frequency === "monthly") {
    const cursor = { year: anchor.year, month: anchor.month };
    for (let index = 0; index < MAX_OCCURRENCES; index += 1) {
      const clampedDay = Math.min(anchor.day, daysInMonth(cursor.year, cursor.month - 1));
      const iso = toIso(new Date(cursor.year, cursor.month - 1, clampedDay));
      if (iso > effectiveEnd) {
        break;
      }

      if (iso >= rangeStart) {
        occurrences.push(iso);
      }

      cursor.month += 1;
      if (cursor.month > 12) {
        cursor.month = 1;
        cursor.year += 1;
      }
    }

    return occurrences;
  }

  const stepDays = frequency === "daily" ? 1 : 7;
  const cursor = new Date(anchor.year, anchor.month - 1, anchor.day);
  for (let index = 0; index < MAX_OCCURRENCES; index += 1) {
    const iso = toIso(cursor);
    if (iso > effectiveEnd) {
      break;
    }

    if (iso >= rangeStart) {
      occurrences.push(iso);
    }

    cursor.setDate(cursor.getDate() + stepDays);
  }

  return occurrences;
}

/**
 * The next unpaid occurrence a "Mark paid" action should settle: the oldest
 * unpaid occurrence up to today when one exists (overdue first), otherwise the
 * next upcoming occurrence within the lookahead window.
 */
export function findPayableOccurrence(
  anchorDueDate: string,
  frequency: FixedCostFrequency,
  endDate: string | null,
  paidDueDates: readonly string[],
  todayIso: string,
  lookAheadDays = 62,
): string | null {
  const paid = new Set(paidDueDates);

  const pastAndToday = listOccurrences(anchorDueDate, frequency, endDate, anchorDueDate, todayIso);
  for (const occurrence of pastAndToday) {
    if (!paid.has(occurrence)) {
      return occurrence;
    }
  }

  const lookahead = new Date(todayIso + "T00:00:00");
  lookahead.setDate(lookahead.getDate() + lookAheadDays);
  const future = listOccurrences(anchorDueDate, frequency, endDate, todayIso, toIso(lookahead));
  for (const occurrence of future) {
    if (!paid.has(occurrence)) {
      return occurrence;
    }
  }

  return null;
}

export type FixedCostStatus = "overdue" | "due_soon" | "scheduled" | "paid_up" | "done";

/** Status of a cost given its unpaid occurrences relative to today. */
export function classifyFixedCost(
  anchorDueDate: string,
  frequency: FixedCostFrequency,
  endDate: string | null,
  paidDueDates: readonly string[],
  todayIso: string,
  dueSoonDays = 7,
): { status: FixedCostStatus; nextDueDate: string | null } {
  const payable = findPayableOccurrence(anchorDueDate, frequency, endDate, paidDueDates, todayIso);
  if (payable === null) {
    return { status: frequency === "one_time" ? "done" : "paid_up", nextDueDate: null };
  }

  if (payable < todayIso) {
    return { status: "overdue", nextDueDate: payable };
  }

  const soonCutoff = new Date(todayIso + "T00:00:00");
  soonCutoff.setDate(soonCutoff.getDate() + dueSoonDays);
  if (payable <= toIso(soonCutoff)) {
    return { status: "due_soon", nextDueDate: payable };
  }

  return { status: "scheduled", nextDueDate: payable };
}

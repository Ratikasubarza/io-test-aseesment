// Generates booking dates. The demo site is shared and keeps bookings, so fixed dates
// (like the ones in the manual test case) would clash with earlier runs.

export interface Stay {
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  nights: number;
}

export interface BookedRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const MIN_DAYS_AHEAD = 30;
const WINDOW_DAYS = 700;
const MAX_ATTEMPTS = 25;

const pad = (n: number): string => String(n).padStart(2, '0');

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysFromToday(days: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0); // midday avoids daylight-saving edge cases
  date.setDate(date.getDate() + days);
  return date;
}

// Touching ranges count as overlapping, to stay clear of any same-day check-in/check-out rule.
function overlaps(stay: Stay, range: BookedRange): boolean {
  return stay.checkin <= range.end && range.start <= stay.checkout;
}

export function pickFreeStay(booked: BookedRange[], nights: number): Stay {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const offset = MIN_DAYS_AHEAD + Math.floor(Math.random() * WINDOW_DAYS);
    const stay: Stay = {
      checkin: toIsoDate(daysFromToday(offset)),
      checkout: toIsoDate(daysFromToday(offset + nights)),
      nights,
    };
    if (!booked.some((range) => overlaps(stay, range))) {
      return stay;
    }
  }
  throw new Error(`Could not find a free ${nights}-night stay after ${MAX_ATTEMPTS} attempts`);
}

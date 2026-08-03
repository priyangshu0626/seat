/**
 * Seat Planner Engine — Deterministic 120-Day Cycle
 *
 * Pre-computes an optimal sequence of all 120 permutations.
 * Given any date + holidays list, returns the arrangement for that day.
 * Same date + same holidays = same arrangement, on any device.
 */

export const PEOPLE = ["Priyangshu", "Aryavrat", "Yatharth", "Sachin", "Gaurav"];
export const SEAT_COUNT = PEOPLE.length;

// ─── Start date of the cycle (first working day) ───
export const CYCLE_START = new Date("2026-08-04T00:00:00"); // Tuesday Aug 4, 2026

/**
 * Generate all permutations of an array (Heap's algorithm).
 */
function generateAllPermutations(arr) {
  const result = [];
  const a = [...arr];

  function heapPermute(n) {
    if (n === 1) {
      result.push([...a]);
      return;
    }
    for (let i = 0; i < n; i++) {
      heapPermute(n - 1);
      if (n % 2 === 0) {
        [a[i], a[n - 1]] = [a[n - 1], a[i]];
      } else {
        [a[0], a[n - 1]] = [a[n - 1], a[0]];
      }
    }
  }

  heapPermute(a.length);
  return result;
}

/**
 * Get sorted adjacent pair key.
 */
function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Score a permutation against history (deterministic).
 */
function scorePerm(perm, history) {
  let score = 0;
  const yesterday = history.length > 0 ? history[history.length - 1] : null;

  if (yesterday) {
    for (let i = 0; i < SEAT_COUNT; i++) {
      if (perm[i] === yesterday[i]) score -= 1000;
    }
  }

  if (yesterday) {
    const yPairs = new Set();
    for (let i = 0; i < yesterday.length - 1; i++) {
      yPairs.add(pairKey(yesterday[i], yesterday[i + 1]));
    }
    for (let i = 0; i < perm.length - 1; i++) {
      if (yPairs.has(pairKey(perm[i], perm[i + 1]))) score -= 50;
    }
  }

  const seen = new Set();
  for (const day of history) {
    for (let i = 0; i < day.length - 1; i++) {
      seen.add(pairKey(day[i], day[i + 1]));
    }
  }
  for (let i = 0; i < perm.length - 1; i++) {
    if (!seen.has(pairKey(perm[i], perm[i + 1]))) score += 10;
  }

  const seatCounts = {};
  for (const p of PEOPLE) seatCounts[p] = new Array(SEAT_COUNT).fill(0);
  for (const day of history) {
    for (let i = 0; i < SEAT_COUNT; i++) seatCounts[day[i]][i]++;
  }
  const avg = history.length / SEAT_COUNT;
  for (let i = 0; i < SEAT_COUNT; i++) {
    const c = seatCounts[perm[i]][i];
    if (c > avg) score -= 5 * (c - avg);
  }

  return score;
}

/**
 * Build the full 120-day optimal sequence (computed once, cached).
 */
let _cachedSequence = null;

export function getFullSequence() {
  if (_cachedSequence) return _cachedSequence;

  const allPerms = generateAllPermutations(PEOPLE);
  const used = new Set();
  const sequence = [];

  for (let day = 0; day < allPerms.length; day++) {
    let bestScore = -Infinity;
    let bestIdx = -1;

    for (let i = 0; i < allPerms.length; i++) {
      if (used.has(i)) continue;
      const s = scorePerm(allPerms[i], sequence);
      if (
        s > bestScore ||
        (s === bestScore && allPerms[i].join(",") < allPerms[bestIdx].join(","))
      ) {
        bestScore = s;
        bestIdx = i;
      }
    }

    used.add(bestIdx);
    sequence.push(allPerms[bestIdx]);
  }

  _cachedSequence = sequence;
  return sequence;
}

/**
 * Format date to ISO string (YYYY-MM-DD).
 */
export function toDateStr(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Check if a date is a working day (Mon–Fri, not a holiday).
 */
export function isWorkingDay(date, holidays = []) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const dateStr = toDateStr(date);
  return !holidays.includes(dateStr);
}

/**
 * Check if a date is a holiday.
 */
export function isHoliday(date, holidays = []) {
  return holidays.includes(toDateStr(date));
}

/**
 * Check if a date is a weekend.
 */
export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Count working days from cycle start to target.
 * Returns -1 if target is not a working day or before cycle start.
 */
export function workingDayIndex(target, holidays = []) {
  const start = new Date(CYCLE_START);
  start.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);

  if (t < start) return -1;
  if (!isWorkingDay(t, holidays)) return -1;

  let count = 0;
  const cursor = new Date(start);

  while (cursor < t) {
    cursor.setDate(cursor.getDate() + 1);
    if (isWorkingDay(cursor, holidays)) count++;
  }

  return count;
}

/**
 * Get the arrangement for a specific date.
 */
export function getArrangementForDate(date, holidays = []) {
  const idx = workingDayIndex(date, holidays);
  if (idx < 0) return null;

  const sequence = getFullSequence();
  const cycleIdx = idx % sequence.length;
  return {
    arrangement: sequence[cycleIdx],
    dayNumber: idx + 1,
    cycleDay: cycleIdx + 1,
  };
}

/**
 * Get today's arrangement.
 */
export function getTodayArrangement(holidays = []) {
  return getArrangementForDate(new Date(), holidays);
}

/**
 * Get a timeline of dates with arrangement info.
 * Includes weekends and holidays with status markers.
 */
export function getTimeline(holidays = [], daysBack = 2, daysForward = 8) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Collect calendar days backwards
  const pastDays = [];
  const cursor = new Date(today);
  while (pastDays.length < daysBack) {
    cursor.setDate(cursor.getDate() - 1);
    if (cursor < CYCLE_START) break;
    if (!isWeekend(cursor)) {
      pastDays.unshift(new Date(cursor));
    }
  }

  // Collect today + future weekdays
  const futureDays = [];
  if (!isWeekend(today)) {
    futureDays.push(new Date(today));
  }
  const cursor2 = new Date(today);
  while (futureDays.length < daysForward + 1) {
    cursor2.setDate(cursor2.getDate() + 1);
    if (!isWeekend(cursor2)) {
      futureDays.push(new Date(cursor2));
    }
  }

  const allDates = [...pastDays, ...futureDays];
  const results = [];

  for (const d of allDates) {
    const holiday = isHoliday(d, holidays);
    const result = holiday ? null : getArrangementForDate(d, holidays);
    results.push({
      date: d,
      isToday: d.getTime() === today.getTime(),
      isHoliday: holiday,
      isWeekend: isWeekend(d),
      ...(result || {}),
    });
  }

  return results;
}

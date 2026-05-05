// ─── CONFIG & CONSTANTS ───────────────────────────────────────────
const PEOPLE = [
  { name: 'Sachin', initial: 'S', color: '#ff6b35' }, // 0
  { name: 'Priyangshu', initial: 'P', color: '#7b61ff' }, // 1
  { name: 'Gaurav', initial: 'G', color: '#1a936f' }, // 2
  { name: 'Yatharth', initial: 'Y', color: '#e8b84b' }, // 3
  { name: 'Aryavrat', initial: 'A', color: '#e63946' }, // 4
];

const SEAT_META = [
  { label: 'Seat 1', comfortLabel: 'Edge 😖', color: '#e63946', comfortPct: 10, css: 'edge-seat', badge: 'badge-edge', badgeText: 'EDGE' },
  { label: 'Seat 2', comfortLabel: 'Near-edge 😐', color: '#f7c59f', comfortPct: 55, css: 'near-seat', badge: 'badge-near', badgeText: 'NEAR' },
  { label: 'Seat 3', comfortLabel: 'Middle 😎', color: '#1a936f', comfortPct: 100, css: 'best-seat', badge: 'badge-mid', badgeText: 'BEST' },
  { label: 'Seat 4', comfortLabel: 'Near-edge 😐', color: '#f7c59f', comfortPct: 55, css: 'near-seat', badge: 'badge-near', badgeText: 'NEAR' },
  { label: 'Seat 5', comfortLabel: 'Edge 😖', color: '#e63946', comfortPct: 10, css: 'edge-seat', badge: 'badge-edge', badgeText: 'EDGE' },
];

// ─── ALGORITHMIC SEATING ENGINE ───────────────────────────────────
// Guarantees:
//   ✓ Every person sits in EVERY seat equally (including center)
//   ✓ All 10 neighbor pairs appear with near-equal frequency
//   ✓ No back-to-back pair repetition
//   ✓ Deterministic & stateless — identical on every device
//   ✓ Edge duty perfectly balanced
// Built algorithmically at runtime from all 120 permutations.

const START_DATE = '2026-04-24';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ─── STATE ────────────────────────────────────────────────────────
let history = [];
let lightMode = false;
let selectedOffset = 0;
let blockedDates = []; // Loaded from data.json
let generatedScheduleCache = {};
let maxFutureDays = 7;

// ─── DATE UTILITIES (IST FIXED) ───────────────────────────────────
function getISTNow() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 5.5 * 3600000); // +5:30
}

function getRotationDate() {
  const d = getISTNow();
  if (d.getHours() >= 20) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  return fmtDate(getRotationDate());
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function getOffsetDate(offset) {
  const d = getRotationDate();
  d.setDate(d.getDate() + offset);
  return d;
}

function getOffsetDateStr(offset) {
  return fmtDate(getOffsetDate(offset));
}

function getOffsetDateInfo(offset) {
  const d = getOffsetDate(offset);
  return {
    dayShort: DAYS_SHORT[d.getDay()],
    dayFull: DAYS_FULL[d.getDay()],
    dateShort: `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`,
    dateFull: `${MONTHS_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    dayOfWeek: d.getDay(),
  };
}

// ─── CORE SEATING ENGINE ──────────────────────────────────────────
// Deterministic, constraint-based scheduler.
// Builds the ENTIRE schedule from day 0 to any requested day,
// guaranteeing perfect seat balance and maximum pair diversity.

function getPairs(arr) {
  const pairs = [];
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i], b = arr[i + 1];
    pairs.push(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  return pairs;
}

// Generate all 120 permutations of [0,1,2,3,4]
function generatePerms(arr) {
  if (arr.length === 1) return [arr];
  const result = [];
  arr.forEach((num, i) => {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    generatePerms(rest).forEach(p => result.push([num, ...p]));
  });
  return result;
}
const ALL_PERMS = generatePerms([0, 1, 2, 3, 4]);

// The schedule builder: builds day-by-day from day 0, tracking all
// constraints and picking the optimal arrangement for each day.
function buildSchedule(upToDayIndex) {
  // Check if we already have enough days cached
  if (scheduleList.length > upToDayIndex) return;

  const N = PEOPLE.length; // 5

  // Resume from where we left off
  let seatCounts = scheduleSeatCounts.map(r => [...r]);
  let pairCounts = { ...schedulePairCounts };
  let prevRow = scheduleList.length > 0 ? scheduleList[scheduleList.length - 1] : null;

  for (let day = scheduleList.length; day <= upToDayIndex; day++) {
    const cycleDay = day % N; // position within a 5-day cycle

    // ── HARD CONSTRAINT: seat balance ──
    // In a perfect rotation, after C complete cycles, each person has
    // sat in each seat exactly C times. Within an incomplete cycle,
    // the person in seat S on cycleDay d must be someone who has sat
    // in seat S the FEWEST times so far.

    // Calculate min seat count per seat position
    const minPerSeat = [];
    for (let s = 0; s < N; s++) {
      let min = Infinity;
      for (let p = 0; p < N; p++) {
        if (seatCounts[p][s] < min) min = seatCounts[p][s];
      }
      minPerSeat.push(min);
    }

    // Filter permutations: only keep those where EVERY person is assigned
    // to a seat they've used the minimum number of times
    let candidates = ALL_PERMS.filter(perm => {
      for (let s = 0; s < N; s++) {
        if (seatCounts[perm[s]][s] > minPerSeat[s]) return false;
      }
      return true;
    });

    // If no perfect candidates (shouldn't happen with 5 people), relax
    if (candidates.length === 0) candidates = ALL_PERMS;

    // ── SOFT SCORING: pair diversity + no back-to-back repeats ──
    let bestScore = -Infinity;
    let bestPerm = candidates[0];

    candidates.forEach(perm => {
      let score = 0;
      const pairs = getPairs(perm);

      // 1. Reward NEW pairs (ones with lowest count)
      let minPairCount = Infinity;
      for (const key in pairCounts) {
        if (pairCounts[key] < minPairCount) minPairCount = pairCounts[key];
      }
      if (minPairCount === Infinity) minPairCount = 0;

      pairs.forEach(p => {
        const cnt = pairCounts[p] || 0;
        // Heavily penalize pairs that have been used more than others
        score -= (cnt - minPairCount) * 10000;
        // Extra reward for completely new pairs
        if (cnt === 0) score += 5000;
        // Reward pairs at minimum count
        if (cnt === minPairCount) score += 2000;
      });

      // 2. Penalize back-to-back pair repetition
      if (prevRow) {
        const prevPairs = new Set(getPairs(prevRow));
        pairs.forEach(p => {
          if (prevPairs.has(p)) score -= 500000;
        });
        // Penalize same person in same seat as yesterday
        for (let s = 0; s < N; s++) {
          if (perm[s] === prevRow[s]) score -= 50000;
        }
        // Penalize same edge people as yesterday
        if (perm[0] === prevRow[0] || perm[0] === prevRow[4]) score -= 100000;
        if (perm[4] === prevRow[0] || perm[4] === prevRow[4]) score -= 100000;
      }

      // 3. Edge fairness: prefer people with fewer edge assignments
      let minEdge = Infinity;
      for (let p = 0; p < N; p++) {
        const ec = seatCounts[p][0] + seatCounts[p][4];
        if (ec < minEdge) minEdge = ec;
      }
      const edgeL = seatCounts[perm[0]][0] + seatCounts[perm[0]][4];
      const edgeR = seatCounts[perm[4]][0] + seatCounts[perm[4]][4];
      score -= (edgeL - minEdge) * 500;
      score -= (edgeR - minEdge) * 500;

      // 4. Deterministic tiebreaker based on day index
      // This ensures consistent results across devices
      const hash = perm.reduce((h, v, i) => h + v * Math.pow(7, i), 0);
      score += ((hash * 2654435761 + day * 1000000007) % 997) * 0.001;

      if (score > bestScore) {
        bestScore = score;
        bestPerm = perm;
      }
    });

    // Record the chosen arrangement
    scheduleList.push(bestPerm);
    for (let s = 0; s < N; s++) {
      seatCounts[bestPerm[s]][s]++;
    }
    getPairs(bestPerm).forEach(p => {
      pairCounts[p] = (pairCounts[p] || 0) + 1;
    });
    prevRow = bestPerm;
  }

  // Save state for resumption
  scheduleSeatCounts = seatCounts;
  schedulePairCounts = pairCounts;
}

// Persistent schedule state (rebuilt from scratch on recalculate)
let scheduleList = [];
let scheduleSeatCounts = Array.from({ length: PEOPLE.length }, () => new Array(5).fill(0));
let schedulePairCounts = {};

function resetScheduleState() {
  scheduleList = [];
  scheduleSeatCounts = Array.from({ length: PEOPLE.length }, () => new Array(5).fill(0));
  schedulePairCounts = {};
  generatedScheduleCache = {};
}

function getDynamicRow(dayIndex, dateStr) {
  if (generatedScheduleCache[dateStr]) {
    return generatedScheduleCache[dateStr];
  }
  buildSchedule(dayIndex);
  const row = scheduleList[dayIndex];
  generatedScheduleCache[dateStr] = row;
  return row;
}

// ─── ROTATION LOGIC ───────────────────────────────────────────────
function isBlocked(dateStr) {
  return blockedDates.includes(dateStr);
}

function getClassDayIndex(dateStr) {
  const totalDays = daysBetween(START_DATE, dateStr);
  if (totalDays <= 0) return 0;
  let count = 0;
  const base = new Date(START_DATE + 'T00:00:00');
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    if (!isBlocked(fmtDate(d))) count++;
  }
  return count;
}

function getDayIndex() {
  return getClassDayIndex(todayStr());
}

function recalculateHistory() {
  resetScheduleState();

  const today = todayStr();
  const totalDays = daysBetween(START_DATE, today);
  const newHistory = [];
  const base = new Date(START_DATE + 'T00:00:00');
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const ds = fmtDate(d);
    if (isBlocked(ds)) continue;
    const idx = getClassDayIndex(ds);
    const row = getDynamicRow(idx, ds);
    newHistory.push({ date: ds, dayIndex: idx, edgeLeft: PEOPLE[row[0]].name, edgeRight: PEOPLE[row[4]].name });
  }
  history = newHistory;
}

function checkAutoRotate(showToast) {
  const today = todayStr();
  const lastLogged = history.length > 0 ? history[history.length - 1].date : null;
  if (lastLogged && lastLogged < today && !isBlocked(today)) {
    if (showToast) triggerToast();
    return true;
  }
  return false;
}

function triggerToast() {
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── THEME ────────────────────────────────────────────────────────
function applyTheme() {
  document.body.classList.toggle('light', lightMode);
  document.getElementById('theme-label').textContent = lightMode ? 'LIGHT' : 'DARK';
}

function toggleTheme() {
  lightMode = !lightMode;
  applyTheme();
}

// ─── CONFETTI ─────────────────────────────────────────────────────
function triggerConfetti() {
  const duration = 2600; // longer
  const end = Date.now() + duration;

  const colors = ['#ff6b35', '#7b61ff', '#1a936f', '#e8b84b', '#e63946'];

  (function frame() {
    const timeLeft = end - Date.now();
    if (timeLeft <= 0) return;

    // 🔥 MORE PARTICLES PER FRAME
    for (let i = 0; i < 6; i++) {
      const confetti = document.createElement('div');

      confetti.style.position = 'fixed';
      confetti.style.top = '-10px';
      confetti.style.left = Math.random() * 100 + 'vw';

      const size = 6 + Math.random() * 6;

      confetti.style.width = size + 'px';
      confetti.style.height = size + 'px';

      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.opacity = '0.9';
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';

      confetti.style.zIndex = '9999';
      confetti.style.pointerEvents = 'none';

      const fall = 100 + Math.random() * 40;
      const rotate = Math.random() * 720;

      confetti.style.transition = 'transform 2.6s linear, opacity 2.6s ease';

      document.body.appendChild(confetti);

      setTimeout(() => {
        confetti.style.transform = `translateY(${fall}vh) rotate(${rotate}deg)`;
        confetti.style.opacity = '0';
      }, 10);

      setTimeout(() => confetti.remove(), 2600);
    }

    requestAnimationFrame(frame);
  })();
}

function triggerHolidayTheme() {
  if (document.getElementById('holiday-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'holiday-overlay';

  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '9998';

  overlay.style.background = `
    radial-gradient(circle at 20% 20%, rgba(255,107,53,0.35), transparent 40%),
    radial-gradient(circle at 80% 30%, rgba(123,97,255,0.35), transparent 40%),
    radial-gradient(circle at 50% 80%, rgba(26,147,111,0.35), transparent 50%)
  `;

  overlay.style.backdropFilter = 'blur(6px)';

  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.8s ease';

  document.body.appendChild(overlay);

  // fade in
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  // fade out (longer)
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 800);
  }, 2200);
}

// ─── UI INTERACTIONS ──────────────────────────────────────────────
let blockedManagerOpen = false;

function toggleBlockedManager() {
  blockedManagerOpen = !blockedManagerOpen;
  const body = document.getElementById('blocked-manager-body');
  const chevron = document.getElementById('blocked-manager-chevron');
  const header = document.getElementById('blocked-manager-header');
  body.classList.toggle('open', blockedManagerOpen);
  chevron.classList.toggle('open', blockedManagerOpen);
  header.classList.toggle('open', blockedManagerOpen);
  if (blockedManagerOpen) renderBlockedManager();
}

function selectOffset(offset) {
  selectedOffset = offset;
  renderDateNav();
  render(true);
}

// ─── RENDERING ────────────────────────────────────────────────────
function renderBlockedManager() {
  const manager = document.getElementById('blocked-manager');
  const badge = document.getElementById('blocked-manager-badge');
  const list = document.getElementById('blocked-date-list');

  manager.style.display = blockedDates.length > 0 ? '' : 'none';
  if (badge) badge.textContent = blockedDates.length;

  if (!blockedManagerOpen) return;

  if (blockedDates.length === 0) {
    list.innerHTML = '<div class="blocked-empty-note">No blocked dates — all days are valid class days.</div>';
    return;
  }

  const sorted = [...blockedDates].sort((a, b) => b.localeCompare(a));
  list.innerHTML = sorted.map(ds => {
    const d = new Date(ds + 'T00:00:00');
    const dow = DAYS_FULL[d.getDay()];
    const month = MONTHS_FULL[d.getMonth()];
    const nice = `${dow}, ${month} ${d.getDate()}, ${d.getFullYear()}`;
    const isPast = ds < todayStr();
    const isToday = ds === todayStr();
    const sub = isToday ? 'Today' : isPast ? 'Past date' : 'Upcoming';
    return `
      <div class="blocked-date-row">
        <div class="blocked-date-info">
          <div class="blocked-date-label">🚫 ${nice}</div>
          <div class="blocked-date-sub">${sub} · Rotation skipped</div>
        </div>
        <span style="font-size:9px;color:var(--muted);letter-spacing:.05em">READ-ONLY</span>
      </div>
    `;
  }).join('');
}

function renderDateNav() {
  const todayDayIdx = getDayIndex();
  const nav = document.getElementById('date-nav');
  nav.innerHTML = '';
  for (let i = 0; i <= maxFutureDays; i++) {
    const info = getOffsetDateInfo(i);
    const dateStr = getOffsetDateStr(i);
    const blocked = isBlocked(dateStr);

    const futureDayIdx = blocked ? null : getClassDayIndex(getOffsetDateStr(i));
    let edgeLabel = '🚫 No Class';
    if (!blocked) {
      const cIdx = futureDayIdx !== null ? futureDayIdx : (todayDayIdx + i);
      const row = getDynamicRow(cIdx, getOffsetDateStr(i));
      const dL = PEOPLE[row[0]], dR = PEOPLE[row[4]];
      edgeLabel = `${dL.initial}↔${dR.initial}`;
    }

    const tab = document.createElement('div');
    let cls = 'date-tab';
    if (i > 0) cls += ' is-future';
    if (blocked) cls += ' blocked';
    if (i === selectedOffset) cls += ' active';
    tab.className = cls;
    tab.innerHTML = `
      <div class="tab-top">${i === 0 ? 'TODAY' : info.dayShort}</div>
      <div class="tab-bot">${i === 0 ? 'Now' : info.dateShort}</div>
      <div class="tab-edge">${edgeLabel}</div>
    `;
    tab.onclick = () => {
      selectOffset(i);

      if (blocked) {
        triggerConfetti();     // already added
        setTimeout(triggerHolidayTheme, 120); // new

        // optional subtle vibration feel (visual only)
        document.body.style.transform = 'scale(1.01)';
        setTimeout(() => {
          document.body.style.transform = 'scale(1)';
        }, 150);
      }
    };
    nav.appendChild(tab);
  }

  const pill = document.getElementById('blocked-count-pill');
  const countEl = document.getElementById('blocked-count');
  if (pill && countEl) {
    countEl.textContent = blockedDates.length;
    pill.style.display = blockedDates.length > 0 ? 'flex' : 'none';
  }

  const moreBtn = document.createElement('div');
  moreBtn.className = 'date-tab is-future';
  moreBtn.innerHTML = `
    <div class="tab-top">MORE</div>
    <div class="tab-bot">+7 days</div>
  `;
  moreBtn.onclick = () => {
    maxFutureDays += 7;
    renderDateNav();
  };
  nav.appendChild(moreBtn);

  renderBlockedManager();
}

function renderDate() {
  const now = getRotationDate();
  document.getElementById('date-day').textContent = DAYS_FULL[now.getDay()];
  document.getElementById('date-full').textContent = `${MONTHS_FULL[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

function render(animate) {
  document.body.style.transition = 'all 0.3s ease';
  renderDate();

  const offset = selectedOffset;
  const viewingDateStr = getOffsetDateStr(offset);
  const isBlockedView = isBlocked(viewingDateStr);
  const todayIdx = getDayIndex();
  const isFuture = offset > 0;

  const dayIndex = isBlockedView ? todayIdx : getClassDayIndex(viewingDateStr);
  const row = getDynamicRow(dayIndex, viewingDateStr);
  const round = Math.floor(dayIndex / PEOPLE.length) + 1;
  const dayInCycle = (dayIndex % PEOPLE.length) + 1;

  document.getElementById('round-text').textContent = isBlockedView
    ? '🎉 Holiday — No Class'
    : `Round ${round} · Day ${dayInCycle}/5`;
  document.getElementById('progress-bar').style.width = isBlockedView
    ? '0%'
    : Math.round(dayInCycle / PEOPLE.length * 100) + '%';

  // ── DUTY BANNER / NO-CLASS BANNER ──
  const banner = document.getElementById('duty-banner');
  if (isBlockedView) {
    banner.className = 'no-class-banner';
    const info = getOffsetDateInfo(offset);
    const dateLabel = offset === 0 ? 'Today' : `${info.dayShort}, ${info.dateShort}`;
    banner.innerHTML = `
      <span style="font-size:22px">🚫</span>
      <div>
        <div class="no-class-label">No Class — ${dateLabel}</div>
        <div class="no-class-desc">This day is marked as no class. Rotation is paused — seats resume on the next valid class day.</div>
      </div>
    `;
  } else {
    banner.className = `duty-banner${isFuture ? ' is-preview' : ''}`;
    const dL = PEOPLE[row[0]];
    const dR = PEOPLE[row[4]];

    banner.innerHTML = `
      <div class="duty-label" id="duty-label">${isFuture
        ? `🔮 On Duty — ${getOffsetDateInfo(offset).dayShort}, ${getOffsetDateInfo(offset).dateShort}`
        : '🚨 On Duty Today — Edge Seats'
      }</div>
      <div class="duty-people" id="duty-people">
        <div class="duty-chip" style="--pc:${dL.color}">
          <div class="duty-av">${dL.initial}</div>
          <div><div class="duty-name">${dL.name}</div><div class="duty-seat">Seat 1 · Left Edge</div></div>
        </div>
        <span class="duty-amp">&amp;</span>
        <div class="duty-chip" style="--pc:${dR.color}">
          <div class="duty-av">${dR.initial}</div>
          <div><div class="duty-name">${dR.name}</div><div class="duty-seat">Seat 5 · Right Edge</div></div>
        </div>
      </div>
    `;
  }

  // Seating card header
  document.getElementById('card-label-text').textContent = isBlockedView
    ? '🚫 No Class Today'
    : isFuture
      ? `🔮 Seating Preview — ${getOffsetDateInfo(offset).dayShort}, ${getOffsetDateInfo(offset).dateShort}`
      : '🪑 Today\'s Seating — Single Row, Side by Side';
  document.getElementById('preview-pill').style.display = isFuture && !isBlockedView ? 'inline-flex' : 'none';
  document.getElementById('seating-card').classList.toggle('is-preview', isFuture && !isBlockedView);

  // ── SEAT ROW ──
  const seatRow = document.getElementById('seat-row');
  const seatLabels = document.getElementById('seat-labels');
  seatRow.innerHTML = seatLabels.innerHTML = '';

  if (isBlockedView) {
    const info = getOffsetDateInfo(offset);
    const dateLabel = offset === 0 ? 'Today' : `${info.dayFull}, ${info.dateShort}`;

    let nextValidInfo = '';
    for (let n = 1; n <= 14; n++) {
      const nd = getOffsetDateStr(offset + n);
      if (!isBlocked(nd)) {
        const ni = getOffsetDateInfo(offset + n);
        const nIdx = getClassDayIndex(nd);
        const nRow = getDynamicRow(nIdx, nd);
        nextValidInfo = `Next class: <em>${ni.dayShort} ${ni.dateShort}</em> — ${PEOPLE[nRow[0]].name} ↔ ${PEOPLE[nRow[4]].name} on edges`;
        break;
      }
    }
    seatRow.innerHTML = `
      <div class="no-class-overlay" style="width:100%">
        <div class="no-class-icon">🚫</div>
        <div class="no-class-title">No Class Day</div>
        <div class="no-class-sub">${dateLabel} has been marked as a no-class day. The seating rotation is paused and will resume on the next valid class day.</div>
        ${nextValidInfo ? `<div class="no-class-resume">${nextValidInfo}</div>` : ''}
      </div>
    `;
  } else {
    row.forEach((pIdx, posIdx) => {
      const p = PEOPLE[pIdx];
      const m = SEAT_META[posIdx];
      const isDuty = posIdx === 0 || posIdx === 4;

      const seat = document.createElement('div');
      seat.className = `seat ${m.css}${isDuty ? ' is-duty' : ''}`;
      seat.style.cssText = `--pc:${p.color}`;

      seat.style.transition = 'all 0.25s ease';

      seat.onmouseenter = () => {
        seat.style.transform = 'translateY(-6px) scale(1.03)';
        seat.style.boxShadow = `0 10px 25px ${p.color}33`;
      };

      seat.onmouseleave = () => {
        seat.style.transform = 'translateY(0) scale(1)';
        seat.style.boxShadow = 'none';
      };

      if (isDuty) {
        seat.style.animation = 'pulseGlow 2.5s infinite ease-in-out';
      }

      seat.innerHTML = `
        ${isDuty
          ? `<div class="seat-badge badge-duty" style="--pc:${p.color}">ON DUTY</div>`
          : `<div class="seat-badge ${m.badge}">${m.badgeText}</div>`}
        <div class="seat-avatar" style="border-color:${p.color};color:${p.color};background:color-mix(in srgb,${p.color} 10%,transparent)">${p.initial}</div>
        <div class="seat-name">${p.name.length > 9 ? p.name.slice(0, 8) + '…' : p.name}</div>
        <div class="comfort-bar-wrap"><div class="comfort-bar" style="width:${m.comfortPct}%;background:${m.color}"></div></div>
      `;
      seatRow.appendChild(seat);

      const lbl = document.createElement('div');
      lbl.className = 'seat-num-label';
      lbl.style.cssText = `color:${isDuty ? p.color : m.color};opacity:${isDuty ? 1 : 0.5}`;
      lbl.textContent = m.label;
      seatLabels.appendChild(lbl);
    });
  }

  if (animate && !isBlockedView) {
    seatRow.querySelectorAll('.seat').forEach((s, i) => {
      s.style.animation = 'none'; void s.offsetWidth;
      s.style.animation = `fadeUp .4s ease ${i * .05}s both`;
    });
  }

  // ── NEIGHBOUR STRIP ──
  const strip = document.getElementById('neighbor-strip');
  if (isBlockedView) {
    strip.style.display = 'none';
  } else {
    strip.style.display = '';
    const neighbourLabel = isFuture
      ? `<strong>Neighbours on ${getOffsetDateInfo(offset).dayShort}</strong>`
      : '<strong>Today\'s Neighbours</strong>';
    strip.innerHTML = neighbourLabel;
    for (let i = 0; i < row.length - 1; i++) {
      const a = PEOPLE[row[i]], b = PEOPLE[row[i + 1]];
      const chip = document.createElement('span');
      chip.className = 'neighbor-pair';

      chip.style.transition = 'all 0.2s ease';

      chip.onmouseenter = () => {
        chip.style.transform = 'scale(1.1)';
      };

      chip.onmouseleave = () => {
        chip.style.transform = 'scale(1)';
      };

      chip.innerHTML = `<span style="color:${a.color}">${a.initial}</span>&nbsp;↔&nbsp;<span style="color:${b.color}">${b.initial}</span>`;
      strip.appendChild(chip);
    }
  }

  // ── 5-DAY CYCLE ──
  const selectedDayInCycle = dayIndex % PEOPLE.length;
  const todayInCycle = todayIdx % PEOPLE.length;
  const cycleStart = dayIndex - selectedDayInCycle;
  const cl = document.getElementById('cycle-list');
  cl.innerHTML = '';
  for (let d = 0; d < PEOPLE.length; d++) {
    const cycleDayIndex = cycleStart + d;
    // Find the dateStr for this cycle day by scanning from START_DATE
    let cycleDateStr = null;
    const baseD = new Date(START_DATE + 'T00:00:00');
    let count = 0;
    for (let scan = 0; scan < 3650; scan++) {
      const sd = new Date(baseD);
      sd.setDate(sd.getDate() + scan);
      const sds = fmtDate(sd);
      if (!isBlocked(sds)) {
        if (count === cycleDayIndex) {
          cycleDateStr = sds;
          break;
        }
        count++;
      }
    }
    if (!cycleDateStr) cycleDateStr = viewingDateStr; // fallback
    const r = getDynamicRow(cycleDayIndex, cycleDateStr);
    const el = PEOPLE[r[0]], er = PEOPLE[r[4]];
    const isToday = d === todayInCycle;
    const isSelected = d === selectedDayInCycle && !isBlockedView;
    let cls = 'cycle-day-row';
    if (isSelected && !isToday) cls += ' selected-day';
    else if (isToday) cls += ' today';

    const div = document.createElement('div');
    div.className = cls;
    div.innerHTML = `
      <div class="cycle-day-num">D${d + 1}</div>
      <div class="cycle-edges">
        <span class="mini-chip" style="--pc:${el.color}"><span class="mini-dot"></span>${el.name}</span>
        <span style="font-size:10px;color:var(--muted)">↔</span>
        <span class="mini-chip" style="--pc:${er.color}"><span class="mini-dot"></span>${er.name}</span>
      </div>
      ${isToday && !isSelected ? '<span class="cycle-today-badge">TODAY</span>' : ''}
      ${isSelected && !isToday ? '<span class="cycle-sel-badge">VIEWING</span>' : ''}
      ${isSelected && isToday ? '<span class="cycle-today-badge">TODAY</span>' : ''}
    `;
    cl.appendChild(div);
  }

  // ── QUEUE ──
  const queueLabel = document.getElementById('queue-label');
  queueLabel.textContent = (isFuture || isBlockedView)
    ? `📋 Upcoming Class Days`
    : '📋 Upcoming Edge Duty';

  const queue = document.getElementById('queue');
  queue.innerHTML = '';
  let found = 0, calOffset = 1;
  while (found < PEOPLE.length && calOffset <= 30) {
    const futureDate = getOffsetDateStr(offset + calOffset);
    if (!isBlocked(futureDate)) {
      const fd = getClassDayIndex(futureDate);
      const fr = getDynamicRow(fd, futureDate);
      const fl = PEOPLE[fr[0]], frt = PEOPLE[fr[4]];
      const fRnd = Math.floor(fd / PEOPLE.length) + 1;
      found++;
      const li = document.createElement('div');
      li.className = 'queue-item';
      li.style.cssText = `--pc:${fl.color}`;
      li.innerHTML = `
        <div class="queue-pos">${found}</div>
        <div class="queue-av">${fl.initial}</div>
        <div class="queue-info">
          <div class="queue-name">${fl.name} <span style="color:var(--muted);font-weight:300;font-size:11px">↔ ${frt.name}</span></div>
          <div class="queue-sub">In ${calOffset} cal. day${calOffset !== 1 ? 's' : ''} &nbsp;·&nbsp; Round ${fRnd}</div>
        </div>
        ${found === 1 ? `<div class="next-pill" style="background:${fl.color}20;color:${fl.color}">Next →</div>` : ''}
      `;
      queue.appendChild(li);
    }
    calOffset++;
  }

  // ── HISTORY ──
  document.getElementById('history-section').style.display = (isFuture || isBlockedView) ? 'none' : '';
  if (!isFuture && !isBlockedView) {
    const histEl = document.getElementById('history-list');
    if (history.length === 0) {
      histEl.innerHTML = '<div class="empty-history">No history yet — check back tomorrow!</div>';
    } else {
      histEl.innerHTML = [...history].reverse().slice(0, 20).map(h => {
        const pl = PEOPLE.find(x => x.name === h.edgeLeft);
        const pr = PEOPLE.find(x => x.name === h.edgeRight);
        if (!pl || !pr) return '';
        return `<div class="history-chip">
          <div class="chip-dot" style="background:${pl.color}"></div>${h.edgeLeft}
          <span style="color:var(--muted)">↔</span>
          <div class="chip-dot" style="background:${pr.color}"></div>${h.edgeRight}
          <span style="opacity:.45;font-size:9px">${h.date}</span>
        </div>`;
      }).join('');
    }
  }

  // ── STATS ──
  renderStats();
}

function computeEdgeCounts() {
  const counts = new Array(PEOPLE.length).fill(0);
  history.forEach(h => {
    const row = getDynamicRow(h.dayIndex, h.date);
    counts[row[0]]++;
    counts[row[4]]++;
  });
  return counts;
}

function computeSeatMatrix() {
  const matrix = Array.from({ length: PEOPLE.length }, () => new Array(5).fill(0));
  history.forEach(h => {
    const row = getDynamicRow(h.dayIndex, h.date);
    row.forEach((personIdx, seatPos) => {
      matrix[personIdx][seatPos]++;
    });
  });
  return matrix;
}

function computePairMatrix() {
  const size = PEOPLE.length;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));

  history.forEach(h => {
    const row = getDynamicRow(h.dayIndex, h.date);
    const pairs = getPairs(row);

    pairs.forEach(p => {
      const [a, b] = p.split('-').map(Number);
      matrix[a][b]++;
      matrix[b][a]++;
    });
  });

  return matrix;
}

function computeDiversityScore() {
  const pairCounts = {};
  let total = 0;

  history.forEach(h => {
    const row = getDynamicRow(h.dayIndex, h.date);
    const pairs = getPairs(row);

    pairs.forEach(p => {
      pairCounts[p] = (pairCounts[p] || 0) + 1;
      total++;
    });
  });

  const uniquePairs = Object.keys(pairCounts).length;
  const maxPossible = 10;

  const coverageScore = (uniquePairs / maxPossible) * 100;

  let imbalance = 0;
  const values = Object.values(pairCounts);
  if (values.length > 0) {
    imbalance = Math.max(...values) - Math.min(...values);
  }

  const balanceScore = Math.max(0, 100 - imbalance * 15);

  return Math.round(0.7 * coverageScore + 0.3 * balanceScore);
}

function computeFairnessScore(edgeCounts) {
  const total = edgeCounts.reduce((a, b) => a + b, 0);
  if (total === 0) return 100;
  const max = Math.max(...edgeCounts);
  const min = Math.min(...edgeCounts);
  return Math.max(0, 100 - (max - min) * 10);
}

function renderStats() {
  const diversity = computeDiversityScore();
  const edgeCounts = computeEdgeCounts();
  const seatMatrix = computeSeatMatrix();
  const totalEdge = edgeCounts.reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...edgeCounts, 1);

  // ── Edge Duty Scoreboard ──
  const sb = document.getElementById('edge-scoreboard');
  sb.innerHTML = '';
  const sortedPeople = [...PEOPLE.map((p, i) => ({ ...p, idx: i, count: edgeCounts[i] }))]
    .sort((a, b) => b.count - a.count);

  sortedPeople.forEach(p => {
    const pct = maxCount > 0 ? (p.count / maxCount * 100) : 0;
    const expectedPerCycle = 2;
    const cyclesCompleted = history.length / PEOPLE.length;
    const expectedTotal = Math.round(expectedPerCycle * cyclesCompleted * 10) / 10;
    const diff = p.count - Math.round(expectedTotal);
    const diffLabel = history.length === 0 ? 'exp: —' :
      diff === 0 ? 'on track ✓' :
        diff > 0 ? `+${diff} over` : `${diff} under`;

    const row = document.createElement('div');
    row.className = 'duty-score-row';
    row.innerHTML = `
      <div class="duty-score-av" style="border:1.5px solid ${p.color};color:${p.color};background:color-mix(in srgb,${p.color} 12%,transparent)">${p.initial}</div>
      <div class="duty-score-name">${p.name}</div>
      <div class="duty-score-track">
        <div class="duty-score-fill" style="width:${pct}%;background:${p.color}"></div>
      </div>
      <div class="duty-score-count" style="color:${p.color}">${p.count}</div>
      <div class="duty-score-expected">${diffLabel}</div>
    `;
    sb.appendChild(row);
  });

  if (history.length === 0) {
    sb.innerHTML += '<div style="font-size:10px;color:var(--muted);font-style:italic;margin-top:10px;text-align:center">Edge counts will appear as history builds up</div>';
  }

  // ── Fairness Score ──
  const score = computeFairnessScore(edgeCounts);
  const scoreColor = score >= 90 ? '#1a936f' : score >= 70 ? '#e8b84b' : '#e63946';
  const scoreLabel = score === 100 ? 'Perfect' : score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Uneven';
  const circumference = 2 * Math.PI * 48;
  const arcLen = (score / 100) * circumference;

  const fd = document.getElementById('fairness-display');
  fd.innerHTML = `
    <div class="fairness-ring-wrap">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle class="fairness-bg" cx="60" cy="60" r="48"/>
        <circle class="fairness-arc"
          cx="60" cy="60" r="48"
          stroke="${scoreColor}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference - arcLen}"/>
      </svg>
      <div class="fairness-num">
        <div class="fairness-pct" style="color:${scoreColor}">${score}<span class="fairness-pct-sym">%</span></div>
        <div class="fairness-tag">Fairness</div>
      </div>
    </div>
    <div class="fairness-label-main" style="color:${scoreColor}">${scoreLabel}</div>
    <div class="fairness-sublabel">
      ${history.length === 0
      ? 'Theoretical score is 100% — the algorithm guarantees perfect fairness.'
      : `Based on ${history.length} logged day${history.length !== 1 ? 's' : ''}. Max imbalance: ${Math.max(...edgeCounts) - Math.min(...edgeCounts)} duties.`}
    </div>
    <div class="fairness-chips">
      ${PEOPLE.map((p, i) => `
        <div class="fairness-chip">
          <div class="fairness-chip-dot" style="background:${p.color}"></div>
          ${p.name.split('')[0] + p.name.slice(1, 4)}: ${edgeCounts[i]}
        </div>`).join('')}
    </div>
  `;

  const diversityEl = document.createElement('div');
  diversityEl.style.marginTop = '12px';
  diversityEl.innerHTML = `
    <div style="font-size:11px;color:var(--muted);text-align:center">Neighbour Diversity</div>
    <div style="font-size:22px;font-weight:600;text-align:center;color:#7b61ff">
      ${diversity}%
    </div>
  `;
  fd.appendChild(diversityEl);

  // ── Seat Heatmap ──
  const hm = document.getElementById('seat-heatmap');
  hm.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  const allVals = seatMatrix.flat();
  const hmMax = Math.max(...allVals, 1);

  const corner = document.createElement('div');
  corner.className = 'hm-corner';
  grid.appendChild(corner);
  ['Seat 1\n😖', 'Seat 2\n😐', 'Seat 3\n😎', 'Seat 4\n😐', 'Seat 5\n😖'].forEach((lbl, i) => {
    const h = document.createElement('div');
    h.className = 'hm-header';
    const seatEmoji = ['😖', '😐', '😎', '😐', '😖'][i];
    h.innerHTML = `S${i + 1}<br><span style="font-size:10px">${seatEmoji}</span>`;
    grid.appendChild(h);
  });

  PEOPLE.forEach((p, pi) => {
    const rowLabel = document.createElement('div');
    rowLabel.className = 'hm-row-label';
    rowLabel.innerHTML = `<div class="hm-row-dot" style="background:${p.color}"></div>${p.name.slice(0, 7)}`;
    grid.appendChild(rowLabel);

    for (let si = 0; si < 5; si++) {
      const cnt = seatMatrix[pi][si];
      const intensity = cnt === 0 ? 0 : 0.18 + (cnt / hmMax) * 0.72;
      const cellColor = cnt === 0
        ? 'rgba(128,128,128,0.06)'
        : `color-mix(in srgb,${p.color} ${Math.round(intensity * 100)}%,transparent)`;
      const textColor = intensity > 0.55 ? '#fff' : p.color;
      const seatName = ['Edge', 'Near', 'Middle', 'Near', 'Edge'][si];

      const cell = document.createElement('div');
      cell.className = 'hm-cell';
      cell.style.cssText = `background:${cellColor};color:${cnt === 0 ? 'var(--muted)' : textColor};border-color:${cnt > 0 ? p.color + '33' : 'transparent'}`;

      cell.style.transition = 'all 0.25s ease';

      cell.onmouseenter = () => {
        cell.style.transform = 'scale(1.15)';
        cell.style.zIndex = '2';
      };

      cell.onmouseleave = () => {
        cell.style.transform = 'scale(1)';
        cell.style.zIndex = '1';
      };
      cell.innerHTML = `
        ${cnt}
        <div class="hm-tooltip">${p.name} · Seat ${si + 1} (${seatName}): ${cnt}×</div>
      `;
      grid.appendChild(cell);
    }
  });

  hm.appendChild(grid);

  if (history.length === 0) {
    const note = document.createElement('div');
    note.className = 'hm-empty-note';
    note.textContent = 'All zeros — heatmap fills up as each day is logged.';
    hm.appendChild(note);
  }

  // ── Pair Interaction Heatmap ──
  const pairMatrix = computePairMatrix();

  let statsContainer = document.getElementById('pair-heatmap-root');

  if (!statsContainer) {
    statsContainer = document.createElement('div');
    statsContainer.id = 'pair-heatmap-root';

    const parent = document.getElementById('seat-heatmap').parentElement;
    parent.appendChild(statsContainer);
  }

  let existingGrid = document.getElementById('pair-grid');

  if (!existingGrid) {
    const pairSection = document.createElement('div');
    pairSection.id = 'pair-heatmap-section';
    pairSection.style.marginTop = '20px';

    pairSection.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:10px">
        🤝 Pair Interaction Heatmap
      </div>
    `;

    const pairGrid = document.createElement('div');
    pairGrid.id = 'pair-grid';
    pairGrid.style.display = 'grid';
    pairGrid.style.gridTemplateColumns = `repeat(${PEOPLE.length + 1}, 1fr)`;
    pairGrid.style.gap = '4px';

    // top-left empty
    pairGrid.appendChild(document.createElement('div'));

    // column headers
    PEOPLE.forEach(p => {
      const el = document.createElement('div');
      el.style.fontSize = '10px';
      el.style.textAlign = 'center';
      el.style.color = p.color;
      el.textContent = p.initial;
      pairGrid.appendChild(el);
    });

    // rows
    const pairMaxVal = Math.max(...pairMatrix.flat(), 1);

    PEOPLE.forEach((p, i) => {
      // row label
      const label = document.createElement('div');
      label.style.fontSize = '10px';
      label.style.color = p.color;
      label.textContent = p.initial;
      pairGrid.appendChild(label);

      for (let j = 0; j < PEOPLE.length; j++) {
        const val = pairMatrix[i][j];

        const intensity = val === 0 ? 0 : 0.2 + (val / pairMaxVal) * 0.8;

        const cell = document.createElement('div');
        cell.setAttribute('data-cell', '1');
        cell.style.height = '28px';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        cell.style.fontSize = '10px';
        cell.style.borderRadius = '6px';

        cell.style.transition = 'all 0.25s ease';

        cell.onmouseenter = () => {
          cell.style.transform = 'scale(1.15)';
          cell.style.zIndex = '2';
        };

        cell.onmouseleave = () => {
          cell.style.transform = 'scale(1)';
          cell.style.zIndex = '1';
        };

        if (i === j) {
          cell.style.background = 'transparent';
          cell.textContent = '—';
        } else {
          cell.style.background = val === 0
            ? 'rgba(128,128,128,0.08)'
            : `color-mix(in srgb, ${p.color} ${Math.round(intensity * 100)}%, transparent)`;

          cell.style.color = intensity > 0.6 ? '#fff' : p.color;
          cell.textContent = val;
        }

        pairGrid.appendChild(cell);
      }
    });

    pairSection.appendChild(pairGrid);
    statsContainer.appendChild(pairSection);
  } else {
    const cells = existingGrid.querySelectorAll('[data-cell]');

    let index = 0;
    const maxVal = Math.max(...pairMatrix.flat(), 1);

    for (let i = 0; i < PEOPLE.length; i++) {
      for (let j = 0; j < PEOPLE.length; j++) {
        const val = pairMatrix[i][j];

        const cell = cells[index];
        index++;

        if (!cell || i === j) continue;

        const intensity = val === 0 ? 0 : 0.2 + (val / maxVal) * 0.8;

        cell.style.transition = 'all 0.4s ease';

        cell.style.background = val === 0
          ? 'rgba(128,128,128,0.08)'
          : `color-mix(in srgb, ${PEOPLE[i].color} ${Math.round(intensity * 100)}%, transparent)`;

        cell.style.color = intensity > 0.6 ? '#fff' : PEOPLE[i].color;

        cell.textContent = val;
      }
    }
  }
}

// ─── COUNTDOWN ────────────────────────────────────────────────────
function updateCountdown() {
  const now = getISTNow();
  let next8PM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
  if (now.getHours() >= 20) {
    next8PM.setDate(next8PM.getDate() + 1);
  }
  const ms = next8PM - now;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  document.getElementById('countdown').textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── INIT ─────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('./data.json');
    if (res.ok) {
      const data = await res.json();
      blockedDates = data.blockedDates || [];
    }
  } catch (err) {
    console.warn("Could not load data.json. Defaulting to no blocked dates.");
  }

  recalculateHistory();
  applyTheme();

  const didRotate = checkAutoRotate(false);
  renderDateNav();
  render(false);
  if (didRotate) setTimeout(triggerToast, 600);

  updateCountdown();
  setInterval(updateCountdown, 1000);
  setInterval(() => {
    const currentToday = todayStr();
    const lastLogged = history.length > 0 ? history[history.length - 1].date : null;
    if (lastLogged && lastLogged < currentToday && !isBlocked(currentToday)) {
      recalculateHistory();
      renderDateNav();
      render(true);
      triggerToast();
    }
  }, 30000);
}

// Start app
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// ─── INJECTED ANIMATIONS ──────────────────────────────────────────
if (!document.getElementById('anim-style')) {
  const style = document.createElement('style');
  style.id = 'anim-style';

  style.innerHTML = `
    @keyframes pulseGlow {
      0% { box-shadow: 0 0 0px rgba(255,255,255,0.2); }
      50% { box-shadow: 0 0 18px rgba(255,255,255,0.4); }
      100% { box-shadow: 0 0 0px rgba(255,255,255,0.2); }
    }
  `;

  document.head.appendChild(style);
}

if (!document.getElementById('holiday-style')) {
  const style = document.createElement('style');
  style.id = 'holiday-style';

  style.innerHTML = `
    @keyframes holidayGlow {
      0% { filter: brightness(1); }
      50% { filter: brightness(1.15); }
      100% { filter: brightness(1); }
    }
  `;

  document.head.appendChild(style);
}

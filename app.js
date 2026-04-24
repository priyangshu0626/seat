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

// Mathematically verified schedule:
// ✓ Latin Square — each person occupies each seat exactly once per 5-day cycle
// ✓ Perfect neighbor mixing — every pair of people sits adjacent exactly TWICE per cycle
// ✓ Edge fairness — each person sits on an edge seat exactly twice per cycle
const SCHEDULE = [
  [0, 1, 2, 3, 4],  // Day 0: Sachin, Priyangshu, Gaurav, Yatharth, Aryavrat
  [1, 3, 0, 4, 2],  // Day 1: Priyangshu, Yatharth, Sachin, Aryavrat, Gaurav
  [2, 0, 4, 1, 3],  // Day 2: Gaurav, Sachin, Aryavrat, Priyangshu, Yatharth
  [3, 4, 1, 2, 0],  // Day 3: Yatharth, Aryavrat, Priyangshu, Gaurav, Sachin
  [4, 2, 3, 0, 1],  // Day 4: Aryavrat, Gaurav, Yatharth, Sachin, Priyangshu
];

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
    const row = SCHEDULE[idx % PEOPLE.length];
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
  for (let i = 0; i <= 7; i++) {
    const info = getOffsetDateInfo(i);
    const dateStr = getOffsetDateStr(i);
    const blocked = isBlocked(dateStr);

    const futureDayIdx = blocked ? null : getClassDayIndex(getOffsetDateStr(i));
    let edgeLabel = '🚫 No Class';
    if (!blocked) {
      const cIdx = futureDayIdx !== null ? futureDayIdx : (todayDayIdx + i);
      const row = SCHEDULE[cIdx % PEOPLE.length];
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
    tab.onclick = () => selectOffset(i);
    nav.appendChild(tab);
  }

  const pill = document.getElementById('blocked-count-pill');
  const countEl = document.getElementById('blocked-count');
  if (pill && countEl) {
    countEl.textContent = blockedDates.length;
    pill.style.display = blockedDates.length > 0 ? 'flex' : 'none';
  }

  renderBlockedManager();
}

function renderDate() {
  const now = getRotationDate();
  document.getElementById('date-day').textContent = DAYS_FULL[now.getDay()];
  document.getElementById('date-full').textContent = `${MONTHS_FULL[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

function render(animate) {
  renderDate();

  const offset = selectedOffset;
  const viewingDateStr = getOffsetDateStr(offset);
  const isBlockedView = isBlocked(viewingDateStr);
  const todayIdx = getDayIndex();
  const isFuture = offset > 0;

  const dayIndex = isBlockedView ? todayIdx : getClassDayIndex(viewingDateStr);
  const row = SCHEDULE[dayIndex % PEOPLE.length];
  const round = Math.floor(dayIndex / PEOPLE.length) + 1;
  const dayInCycle = (dayIndex % PEOPLE.length) + 1;

  document.getElementById('round-text').textContent = isBlockedView
    ? 'No Class Day'
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
        const nRow = SCHEDULE[nIdx % PEOPLE.length];
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
      chip.innerHTML = `<span style="color:${a.color}">${a.initial}</span>&nbsp;↔&nbsp;<span style="color:${b.color}">${b.initial}</span>`;
      strip.appendChild(chip);
    }
  }

  // ── 5-DAY CYCLE ──
  const selectedDayInCycle = dayIndex % PEOPLE.length;
  const todayInCycle = todayIdx % PEOPLE.length;
  const cl = document.getElementById('cycle-list');
  cl.innerHTML = '';
  for (let d = 0; d < PEOPLE.length; d++) {
    const r = SCHEDULE[d];
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
      const fr = SCHEDULE[fd % PEOPLE.length];
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
    const row = SCHEDULE[h.dayIndex % PEOPLE.length];
    counts[row[0]]++;
    counts[row[4]]++;
  });
  return counts;
}

function computeSeatMatrix() {
  const matrix = Array.from({ length: PEOPLE.length }, () => new Array(5).fill(0));
  history.forEach(h => {
    const row = SCHEDULE[h.dayIndex % PEOPLE.length];
    row.forEach((personIdx, seatPos) => {
      matrix[personIdx][seatPos]++;
    });
  });
  return matrix;
}

function computeFairnessScore(edgeCounts) {
  const total = edgeCounts.reduce((a, b) => a + b, 0);
  if (total === 0) return 100;
  const max = Math.max(...edgeCounts);
  const min = Math.min(...edgeCounts);
  return Math.max(0, 100 - (max - min) * 10);
}

function renderStats() {
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

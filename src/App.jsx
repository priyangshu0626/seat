import { useState, useEffect, useMemo } from "react";
import {
  PEOPLE,
  SEAT_COUNT,
  CYCLE_START,
  getTodayArrangement,
  getTimeline,
  isWeekend as checkWeekend,
  isWorkingDay,
  toDateStr,
} from "./engine";
import { useHolidays, useAvatars, getAvatarUrl } from "./useFirestore";
import AdminPanel from "./AdminPanel";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(date) {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function formatDateShort(date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("squad-theme");
    return stored ? stored === "dark" : true;
  });
  const [showAdmin, setShowAdmin] = useState(false);

  // Firebase hooks — real-time sync across all users
  const {
    holidays,
    loading: holidaysLoading,
    addHoliday,
    removeHoliday,
  } = useHolidays();
  const {
    avatars,
    loading: avatarsLoading,
    updateAvatar,
  } = useAvatars();

  const loading = holidaysLoading || avatarsLoading;

  // Apply theme
  useEffect(() => {
    document.body.classList.toggle("light", !isDark);
    localStorage.setItem("squad-theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Compute everything deterministically based on holidays
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const todayResult = useMemo(
    () => (loading ? null : getTodayArrangement(holidays)),
    [holidays, loading]
  );
  const timeline = useMemo(
    () => (loading ? [] : getTimeline(holidays, 2, 8)),
    [holidays, loading]
  );
  const isWeekendToday = checkWeekend(today);
  const isHolidayToday = holidays.includes(toDateStr(today));

  const totalPerms = 120;

  // Show/hide status
  const showArrangement = !loading && todayResult && !isWeekendToday && !isHolidayToday;
  const showWeekend = !loading && isWeekendToday;
  const showHoliday = !loading && isHolidayToday && !isWeekendToday;
  const showPreCycle = !loading && !todayResult && !isWeekendToday && !isHolidayToday;

  return (
    <>
      {/* Background */}
      <div className="bg-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="app">
        {/* Header */}
        <header className="header">
          <div>
            <h1 className="header-title">
              THE SQUAD <span>ROTATION</span>
            </h1>
            <p className="header-subtitle">
              {formatDate(today)} · {totalPerms}-day cycle
            </p>
          </div>
          <div className="header-actions">
            <button
              className="admin-gear"
              onClick={() => setShowAdmin(true)}
              aria-label="Admin panel"
              id="admin-gear"
            >
              ⚙
            </button>
            <button
              className="theme-toggle"
              onClick={() => setIsDark((d) => !d)}
              aria-label="Toggle theme"
              id="theme-toggle"
            />
          </div>
        </header>

        {/* Loading */}
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <div className="loading-text">Syncing...</div>
          </div>
        )}

        {/* Today's Arrangement with Avatars */}
        {showArrangement && (
          <>
            <section className="seat-section">
              <div className="seat-label">Today's Arrangement</div>
              <div className="seat-strip">
                {todayResult.arrangement.map((person, i) => {
                  const av = avatars[person] || {
                    style: "adventurer",
                    seed: person,
                  };
                  return (
                    <div className="seat-card filled animate-in" key={i}>
                      <div className="seat-number">Seat {i + 1}</div>
                      <div className="seat-avatar-wrap">
                        <img
                          className="seat-avatar"
                          src={getAvatarUrl(av.style, av.seed, 96)}
                          alt={person}
                          loading="lazy"
                        />
                      </div>
                      <div className="seat-name">{person}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="stats">
              <div className="stat-card">
                <div className="stat-value">{todayResult.dayNumber}</div>
                <div className="stat-label">Day #</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {todayResult.cycleDay}/{totalPerms}
                </div>
                <div className="stat-label">Cycle</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{PEOPLE.length}</div>
                <div className="stat-label">People</div>
              </div>
            </div>
          </>
        )}

        {/* Weekend */}
        {showWeekend && (
          <div className="notice-card">
            <div className="notice-emoji">☕</div>
            <div className="notice-title">It's the weekend</div>
            <div className="notice-sub">Seating resumes on Monday</div>
          </div>
        )}

        {/* Holiday */}
        {showHoliday && (
          <div className="notice-card holiday-notice">
            <div className="notice-emoji">🏖️</div>
            <div className="notice-title">Holiday Today</div>
            <div className="notice-sub">
              No seating arrangement today. Enjoy your day off!
            </div>
          </div>
        )}

        {/* Pre-cycle */}
        {showPreCycle && (
          <div className="notice-card">
            <div className="notice-emoji">🗓️</div>
            <div className="notice-title">Cycle hasn't started yet</div>
            <div className="notice-sub">
              Starts {formatDate(CYCLE_START)}
            </div>
          </div>
        )}

        {/* Timeline */}
        {!loading && (
          <section className="timeline-section">
            <div className="section-title">Schedule</div>
            <div className="timeline-list">
              {timeline.map((entry, idx) => (
                <div
                  className={`timeline-item ${
                    entry.isToday ? "is-today" : ""
                  } ${entry.isHoliday ? "is-holiday" : ""}`}
                  key={idx}
                >
                  <div className="timeline-item-header">
                    <div className="timeline-day-col">
                      {entry.isHoliday ? (
                        <div className="timeline-holiday-icon">🏖️</div>
                      ) : (
                        <div className="timeline-day-num">
                          {entry.dayNumber || "—"}
                        </div>
                      )}
                      <div className="timeline-day-label">
                        {WEEKDAY_NAMES[entry.date.getDay()]}
                      </div>
                    </div>
                    <div className="timeline-date">
                      {formatDateShort(entry.date)}
                    </div>
                    {entry.isToday && (
                      <div className="today-badge">Today</div>
                    )}
                  </div>

                  {entry.isHoliday ? (
                    <div className="timeline-holiday-text">Holiday</div>
                  ) : entry.arrangement ? (
                    <div className="timeline-seats">
                      {entry.arrangement.map((person, seatIdx) => {
                        const av = avatars[person] || {
                          style: "adventurer",
                          seed: person,
                        };
                        return (
                          <div className="timeline-seat" key={seatIdx}>
                            <img
                              className="timeline-seat-avatar"
                              src={getAvatarUrl(av.style, av.seed, 32)}
                              alt=""
                            />
                            <span>{person}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="timeline-holiday-text">—</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="footer">
          <p>
            Cycle of {totalPerms} unique arrangements · Restarts automatically
          </p>
        </footer>
      </div>

      {/* Admin Panel Modal */}
      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          holidays={holidays}
          addHoliday={addHoliday}
          removeHoliday={removeHoliday}
          avatars={avatars}
          updateAvatar={updateAvatar}
        />
      )}
    </>
  );
}

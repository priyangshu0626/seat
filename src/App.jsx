import { useState, useEffect, useMemo } from "react";
import {
  PEOPLE,
  CYCLE_START,
  getArrangementForDate,
  getTimeline,
  isWeekend as checkWeekend,
  toDateStr,
} from "./engine";
import {
  useHolidays,
  useAvatars,
  useTimetable,
  useMessMenu,
  useAnnouncements,
  getAvatarUrl,
} from "./useFirestore";
import AdminPanel from "./AdminPanel";
import Sidebar from "./Sidebar";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(date) {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("squad-theme");
    return stored ? stored === "dark" : true;
  });
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

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

  const {
    timetable,
    loading: timetableLoading,
    updateTimetableDay,
  } = useTimetable();

  const {
    messMenu,
    loading: messLoading,
    updateMessMenuDay,
  } = useMessMenu();

  const {
    announcements,
    loading: announcementsLoading,
    addAnnouncement,
    removeAnnouncement,
  } = useAnnouncements();

  const loading = holidaysLoading || avatarsLoading || timetableLoading || messLoading || announcementsLoading;

  // Apply theme
  useEffect(() => {
    document.body.classList.toggle("light", !isDark);
    localStorage.setItem("squad-theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Compute effective display date (if current time is 8 PM / 20:00 or later, advance to tomorrow)
  const isAfter8PM = useMemo(() => {
    return new Date().getHours() >= 20;
  }, []);

  const displayDate = useMemo(() => {
    const now = new Date();
    if (now.getHours() >= 20) {
      now.setDate(now.getDate() + 1);
    }
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const displayResult = useMemo(
    () => (loading ? null : getArrangementForDate(displayDate, holidays)),
    [displayDate, holidays, loading]
  );
  const timeline = useMemo(
    () => (loading ? [] : getTimeline(holidays, 2, 8)),
    [holidays, loading]
  );

  const isWeekendDisplay = checkWeekend(displayDate);
  const isHolidayDisplay = holidays.includes(toDateStr(displayDate));

  const dayOfWeekName = FULL_WEEKDAY_NAMES[displayDate.getDay()];
  const displayClasses = timetable[toDateStr(displayDate)] || [];
  const displayMessMenu = messMenu[dayOfWeekName] || {};

  const totalPerms = 120;

  // Show/hide status flags
  const showArrangement = !loading && displayResult && !isWeekendDisplay && !isHolidayDisplay;
  const showWeekend = !loading && isWeekendDisplay;
  const showHoliday = !loading && isHolidayDisplay && !isWeekendDisplay;
  const showPreCycle = !loading && !displayResult && !isWeekendDisplay && !isHolidayDisplay;

  const titlePrefix = isAfter8PM ? "Tomorrow's" : "Today's";

  return (
    <>
      {/* Background Blobs */}
      <div className="bg-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <button
              className="menu-toggle-btn"
              onClick={() => setShowSidebar(true)}
              aria-label="Open Schedule Sidebar"
              id="sidebar-menu-btn"
            >
              ☰ <span className="menu-btn-label">Hub & Menu</span>
            </button>
            <div>
              <h1 className="header-title">
                THE SQUAD <span>HUB</span>
              </h1>
              <p className="header-subtitle">
                {formatDate(displayDate)} · {isAfter8PM ? "Tomorrow's Overview (After 8 PM)" : "Today's Dashboard"}
              </p>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="admin-gear"
              onClick={() => setShowAdmin(true)}
              aria-label="Admin panel"
              id="admin-gear"
              title="Admin Panel"
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

        {/* Loading Indicator */}
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <div className="loading-text">Syncing real-time schedule & menu...</div>
          </div>
        )}

        {/* MAIN PAGE CONTENT — CURRENT / NEXT DAY DETAILS */}
        {!loading && (
          <main className="dashboard-grid">
            {/* 1. SEATING ARRANGEMENT */}
            <section className="dashboard-card seating-card">
              <div className="card-header-row">
                <div className="card-title">
                  <span className="card-icon">🪑</span> {titlePrefix} Seating Arrangement
                </div>
                {showArrangement && (
                  <span className={`badge ${isAfter8PM ? "badge-today" : "badge-live"}`}>
                    {isAfter8PM ? "Tomorrow (8 PM+)" : "Active Cycle"}
                  </span>
                )}
              </div>

              {showArrangement && (
                <>
                  <div className="seat-strip">
                    {displayResult.arrangement.map((person, i) => {
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

                  <div className="stats">
                    <div className="stat-card">
                      <div className="stat-value">{displayResult.dayNumber}</div>
                      <div className="stat-label">Day #</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        {displayResult.cycleDay}/{totalPerms}
                      </div>
                      <div className="stat-label">Cycle</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{PEOPLE.length}</div>
                      <div className="stat-label">Squad</div>
                    </div>
                  </div>
                </>
              )}

              {showWeekend && (
                <div className="notice-card">
                  <div className="notice-emoji">☕</div>
                  <div className="notice-title">It's the Weekend</div>
                  <div className="notice-sub">Seating resumes on Monday</div>
                </div>
              )}

              {showHoliday && (
                <div className="notice-card holiday-notice">
                  <div className="notice-emoji">🏖️</div>
                  <div className="notice-title">Holiday</div>
                  <div className="notice-sub">No seating arrangement for this day. Enjoy your day off!</div>
                </div>
              )}

              {showPreCycle && (
                <div className="notice-card">
                  <div className="notice-emoji">🗓️</div>
                  <div className="notice-title">Cycle Hasn't Started Yet</div>
                  <div className="notice-sub">Starts {formatDate(CYCLE_START)}</div>
                </div>
              )}
            </section>

            {/* 2. CLASS SCHEDULE */}
            <section className="dashboard-card schedule-card">
              <div className="card-header-row">
                <div className="card-title">
                  <span className="card-icon">📚</span> {titlePrefix} Class Schedule ({dayOfWeekName})
                </div>
              </div>

              {isWeekendDisplay ? (
                <div className="empty-card-state">☕ No classes scheduled on weekends</div>
              ) : isHolidayDisplay ? (
                <div className="empty-card-state">🏖️ Holiday — Enjoy your break!</div>
              ) : displayClasses.length === 0 ? (
                <div className="empty-card-state">🎉 No classes scheduled for this day</div>
              ) : (
                <div className="today-schedule-list">
                  {displayClasses.map((cls, idx) => (
                    <div className="schedule-slot-row" key={idx}>
                      <div className="slot-time-pill">{cls.time}</div>
                      <div className="slot-details">
                        <div className="slot-subject-title">{cls.subject}</div>
                        <div className="slot-meta">
                          <span className="slot-code-badge">{cls.code}</span>
                          <span className="slot-room-tag">📍 {cls.room}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. MESS FOOD MENU */}
            <section className="dashboard-card mess-card-section">
              <div className="card-header-row">
                <div className="card-title">
                  <span className="card-icon">🍽️</span> {titlePrefix} Mess Food Menu ({dayOfWeekName})
                </div>
              </div>

              <div className="today-mess-grid">
                <div className="mess-meal-box breakfast">
                  <div className="meal-box-header">
                    <span className="meal-emoji">🍳</span>
                    <span className="meal-name">Breakfast</span>
                  </div>
                  <div className="meal-food-desc">
                    {displayMessMenu.breakfast || "Menu pending update"}
                  </div>
                </div>

                <div className="mess-meal-box lunch">
                  <div className="meal-box-header">
                    <span className="meal-emoji">🍲</span>
                    <span className="meal-name">Lunch</span>
                  </div>
                  <div className="meal-food-desc">
                    {displayMessMenu.lunch || "Menu pending update"}
                  </div>
                </div>

                <div className="mess-meal-box snacks">
                  <div className="meal-box-header">
                    <span className="meal-emoji">☕</span>
                    <span className="meal-name">Evening Snacks</span>
                  </div>
                  <div className="meal-food-desc">
                    {displayMessMenu.snacks || "Menu pending update"}
                  </div>
                </div>

                <div className="mess-meal-box dinner">
                  <div className="meal-box-header">
                    <span className="meal-emoji">🌙</span>
                    <span className="meal-name">Dinner</span>
                  </div>
                  <div className="meal-food-desc">
                    {displayMessMenu.dinner || "Menu pending update"}
                  </div>
                </div>
              </div>
            </section>

            {/* 4. ANNOUNCEMENTS, QUIZZES & DEADLINES */}
            <section className="dashboard-card announcements-card-section">
              <div className="card-header-row">
                <div className="card-title">
                  <span className="card-icon">📢</span> Upcoming Deadlines, Quizzes & Readings
                </div>
                <span className="badge badge-today">{announcements.length} Active</span>
              </div>

              {announcements.length === 0 ? (
                <div className="empty-card-state">🎉 No upcoming assignments or quizzes posted</div>
              ) : (
                <div className="announcements-list">
                  {announcements.map((ann) => {
                    const categoryIcon =
                      ann.category === "Assignment"
                        ? "📝"
                        : ann.category === "Quiz"
                        ? "✍️"
                        : ann.category === "Reading"
                        ? "📖"
                        : "📢";

                    return (
                      <div className="announcement-item-row" key={ann.id}>
                        <div className="ann-category-pill">
                          <span>{categoryIcon}</span>
                          <span>{ann.category}</span>
                        </div>
                        <div className="ann-main-info">
                          <div className="ann-title">{ann.title}</div>
                          <div className="ann-meta">
                            <span className="ann-subject-tag">{ann.subject}</span>
                            <span className="ann-due-tag">📅 Due: {ann.dueDate}</span>
                          </div>
                          {ann.details && <div className="ann-details-text">{ann.details}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </main>
        )}

        {/* Footer */}
        <footer className="footer">
          <p>
            Cycle of {totalPerms} unique arrangements · Real-time synced schedule, mess menu & deadlines
          </p>
        </footer>
      </div>

      {/* Sidepanel Drawer */}
      <Sidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        timeline={timeline}
        timetable={timetable}
        messMenu={messMenu}
        avatars={avatars}
        onOpenAdmin={() => setShowAdmin(true)}
      />

      {/* Admin Panel Modal */}
      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          holidays={holidays}
          addHoliday={addHoliday}
          removeHoliday={removeHoliday}
          avatars={avatars}
          updateAvatar={updateAvatar}
          timetable={timetable}
          updateTimetableDay={updateTimetableDay}
          messMenu={messMenu}
          updateMessMenuDay={updateMessMenuDay}
          announcements={announcements}
          addAnnouncement={addAnnouncement}
          removeAnnouncement={removeAnnouncement}
        />
      )}
    </>
  );
}

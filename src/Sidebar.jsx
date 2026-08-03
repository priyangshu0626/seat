import { useState } from "react";
import { WEEKDAY_NAMES, formatDateShort, toDateStr } from "./engine";
import { getAvatarUrl } from "./useFirestore";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Sidebar({
  isOpen,
  onClose,
  timeline,
  timetable,
  messMenu,
  avatars,
  onOpenAdmin,
}) {
  const [activeTab, setActiveTab] = useState("upcoming"); // "upcoming" | "mess" | "subjects"
  const [selectedMessDay, setSelectedMessDay] = useState(() => {
    const todayIndex = new Date().getDay(); // 0 is Sun, 1 is Mon...
    const map = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return map[todayIndex] || "Monday";
  });

  if (!isOpen) return null;

  // Extract unique subjects from timetable
  const subjectsMap = {};
  Object.entries(timetable || {}).forEach(([day, slots]) => {
    (slots || []).forEach((slot) => {
      if (!subjectsMap[slot.subject]) {
        subjectsMap[slot.subject] = {
          code: slot.code || "—",
          name: slot.subject,
          room: slot.room || "TBD",
          slots: [],
        };
      }
      subjectsMap[slot.subject].slots.push({ day, time: slot.time, room: slot.room });
    });
  });
  const subjectsList = Object.values(subjectsMap);

  return (
    <div className="sidebar-backdrop" onClick={onClose}>
      <aside className="sidebar-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-title-group">
            <h2 className="sidebar-title">Squad Hub</h2>
            <span className="sidebar-subtitle">Schedule & Resources</span>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === "upcoming" ? "active" : ""}`}
            onClick={() => setActiveTab("upcoming")}
          >
            🗓️ Schedule
          </button>
          <button
            className={`sidebar-tab ${activeTab === "mess" ? "active" : ""}`}
            onClick={() => setActiveTab("mess")}
          >
            🍲 Mess Menu
          </button>
          <button
            className={`sidebar-tab ${activeTab === "subjects" ? "active" : ""}`}
            onClick={() => setActiveTab("subjects")}
          >
            📚 Subjects
          </button>
        </nav>

        {/* Tab Content */}
        <div className="sidebar-body">
          {/* TAB 1: UPCOMING SCHEDULE & SEATING */}
          {activeTab === "upcoming" && (
            <div className="sidebar-section">
              <h3 className="section-mini-heading">Upcoming Days</h3>
              <div className="upcoming-timeline">
                {timeline.map((entry, idx) => {
                  const dayOfWeek = entry.date ? WEEKDAY_NAMES[entry.date.getDay()] : "";
                  const dateString = toDateStr(entry.date);
                  const daySlots = timetable[dateString] || [];

                  return (
                    <div
                      key={idx}
                      className={`upcoming-card ${entry.isToday ? "is-today" : ""} ${
                        entry.isHoliday ? "is-holiday" : ""
                      }`}
                    >
                      <div className="upcoming-card-header">
                        <div>
                          <span className="upcoming-day-num">
                            {entry.dayNumber ? `Day #${entry.dayNumber}` : "Rest Day"}
                          </span>
                          <span className="upcoming-date-text">
                            {dayOfWeek}, {formatDateShort(entry.date)}
                          </span>
                        </div>
                        {entry.isToday && <span className="badge badge-today">Today</span>}
                        {entry.isHoliday && <span className="badge badge-holiday">Holiday</span>}
                      </div>

                      {/* Seating strip */}
                      {entry.isHoliday ? (
                        <div className="upcoming-notice">🏖️ Holiday — No seating or classes</div>
                      ) : entry.arrangement ? (
                        <>
                          <div className="upcoming-seats">
                            {entry.arrangement.map((person, sIdx) => {
                              const av = avatars[person] || {
                                style: "adventurer",
                                seed: person,
                              };
                              return (
                                <div className="upcoming-seat-pill" key={sIdx}>
                                  <img
                                    src={getAvatarUrl(av.style, av.seed, 32)}
                                    alt={person}
                                    className="upcoming-avatar"
                                  />
                                  <span>{person}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Classes for that day */}
                          {daySlots.length > 0 && (
                            <div className="upcoming-classes">
                              <span className="upcoming-classes-label">Classes:</span>
                              <div className="upcoming-class-list">
                                {daySlots.map((cls, cIdx) => (
                                  <div className="upcoming-class-item" key={cIdx}>
                                    <span className="class-time">{cls.time}</span>
                                    <span className="class-name">{cls.subject}</span>
                                    <span className="class-room">{cls.room}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="upcoming-notice">☕ Weekend</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: WEEKLY MESS MENU */}
          {activeTab === "mess" && (
            <div className="sidebar-section">
              {/* Day selector pills */}
              <div className="day-pills">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d}
                    className={`day-pill ${selectedMessDay === d ? "active" : ""}`}
                    onClick={() => setSelectedMessDay(d)}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>

              <div className="mess-day-header">
                <h3>{selectedMessDay}'s Menu</h3>
              </div>

              {messMenu[selectedMessDay] ? (
                <div className="mess-cards-list">
                  <div className="mess-card breakfast">
                    <div className="mess-card-top">
                      <span className="mess-icon">🍳</span>
                      <span className="mess-meal-title">Breakfast</span>
                    </div>
                    <p className="mess-food-text">{messMenu[selectedMessDay].breakfast || "Not set"}</p>
                  </div>

                  <div className="mess-card lunch">
                    <div className="mess-card-top">
                      <span className="mess-icon">🍲</span>
                      <span className="mess-meal-title">Lunch</span>
                    </div>
                    <p className="mess-food-text">{messMenu[selectedMessDay].lunch || "Not set"}</p>
                  </div>

                  <div className="mess-card snacks">
                    <div className="mess-card-top">
                      <span className="mess-icon">☕</span>
                      <span className="mess-meal-title">Evening Snacks</span>
                    </div>
                    <p className="mess-food-text">{messMenu[selectedMessDay].snacks || "Not set"}</p>
                  </div>

                  <div className="mess-card dinner">
                    <div className="mess-card-top">
                      <span className="mess-icon">🌙</span>
                      <span className="mess-meal-title">Dinner</span>
                    </div>
                    <p className="mess-food-text">{messMenu[selectedMessDay].dinner || "Not set"}</p>
                  </div>
                </div>
              ) : (
                <div className="upcoming-notice">No menu added for {selectedMessDay}</div>
              )}
            </div>
          )}

          {/* TAB 3: SUBJECTS DIRECTORY */}
          {activeTab === "subjects" && (
            <div className="sidebar-section">
              <h3 className="section-mini-heading">Enrolled Subjects</h3>
              {subjectsList.length === 0 ? (
                <div className="upcoming-notice">No subjects scheduled yet</div>
              ) : (
                <div className="subjects-grid">
                  {subjectsList.map((sub, idx) => (
                    <div className="subject-card" key={idx}>
                      <div className="subject-code">{sub.code}</div>
                      <div className="subject-name">{sub.name}</div>
                      <div className="subject-slots-list">
                        {sub.slots.map((s, sIdx) => (
                          <div className="subject-slot-badge" key={sIdx}>
                            <span>{s.day.slice(0, 3)}</span> • <span>{s.time}</span> (<span>{s.room}</span>)
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Admin Link */}
        <div className="sidebar-footer">
          <button
            className="sidebar-admin-btn"
            onClick={() => {
              onClose();
              onOpenAdmin();
            }}
          >
            ⚙️ Open Admin Control Panel
          </button>
        </div>
      </aside>
    </div>
  );
}

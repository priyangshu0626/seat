import { useState, useMemo } from "react";
import { PEOPLE } from "./engine";
import { AVATAR_STYLES, getAvatarUrl } from "./useFirestore";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "12345678";
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Admin Panel — Holidays, Avatars, Class Timetable & Mess Menu editor.
 * Password protected. Real-time Firebase sync across all connected clients.
 */
export default function AdminPanel({
  onClose,
  holidays,
  addHoliday,
  removeHoliday,
  avatars,
  updateAvatar,
  timetable,
  updateTimetableDay,
  messMenu,
  updateMessMenuDay,
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState("holidays"); // "holidays" | "avatars" | "timetable" | "mess"
  const [newDate, setNewDate] = useState("");
  const [editingPerson, setEditingPerson] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  };

  const sortedHolidays = useMemo(() => [...holidays].sort(), [holidays]);

  const handleAddHoliday = async () => {
    if (!newDate) return;
    await addHoliday(newDate);
    setNewDate("");
  };

  if (!authenticated) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal admin-login" onClick={(e) => e.stopPropagation()}>
          <div className="admin-lock">🔒</div>
          <div className="modal-title">Admin Access</div>
          <div className="modal-subtitle">Enter admin password to manage schedule & menu</div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              className="admin-pw-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPwError(false);
              }}
              placeholder="Password"
              autoFocus
              id="admin-password"
            />
            {pwError && <div className="admin-pw-error">Incorrect password</div>}
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" id="admin-login-btn">
                Unlock
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal admin-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-header">
          <div>
            <div className="modal-title">Admin Control Panel</div>
            <div className="modal-subtitle">Manage holidays, avatars, schedule & mess food</div>
          </div>
          <button className="admin-close" onClick={onClose} id="admin-close">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === "holidays" ? "active" : ""}`}
            onClick={() => setTab("holidays")}
          >
            🏖️ Holidays
          </button>
          <button
            className={`admin-tab ${tab === "avatars" ? "active" : ""}`}
            onClick={() => setTab("avatars")}
          >
            😎 Avatars
          </button>
          <button
            className={`admin-tab ${tab === "timetable" ? "active" : ""}`}
            onClick={() => setTab("timetable")}
          >
            📚 Schedule
          </button>
          <button
            className={`admin-tab ${tab === "mess" ? "active" : ""}`}
            onClick={() => setTab("mess")}
          >
            🍽️ Mess Menu
          </button>
        </div>

        {/* Content */}
        <div className="admin-content">
          {tab === "holidays" && (
            <HolidaysTab
              holidays={sortedHolidays}
              newDate={newDate}
              setNewDate={setNewDate}
              onAdd={handleAddHoliday}
              onRemove={removeHoliday}
            />
          )}

          {tab === "avatars" && (
            <AvatarsTab
              avatars={avatars}
              editingPerson={editingPerson}
              setEditingPerson={setEditingPerson}
              updateAvatar={updateAvatar}
            />
          )}

          {tab === "timetable" && (
            <TimetableTab
              timetable={timetable}
              updateTimetableDay={updateTimetableDay}
            />
          )}

          {tab === "mess" && (
            <MessMenuTab
              messMenu={messMenu}
              updateMessMenuDay={updateMessMenuDay}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Holidays Tab ─── */
function HolidaysTab({ holidays, newDate, setNewDate, onAdd, onRemove }) {
  const formatDisplay = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="holidays-tab">
      <div className="holiday-add-row">
        <input
          type="date"
          className="holiday-date-input"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          id="holiday-date-input"
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={onAdd}
          disabled={!newDate}
          id="add-holiday-btn"
        >
          + Add
        </button>
      </div>

      {holidays.length === 0 ? (
        <div className="holiday-empty">No holidays added yet. Add dates above.</div>
      ) : (
        <div className="holiday-list">
          {holidays.map((dateStr) => (
            <div className="holiday-item" key={dateStr}>
              <div className="holiday-icon">🏖️</div>
              <div className="holiday-info">
                <div className="holiday-date-text">{formatDisplay(dateStr)}</div>
              </div>
              <button
                className="holiday-remove"
                onClick={() => onRemove(dateStr)}
                aria-label={`Remove ${dateStr}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Avatars Tab ─── */
function AvatarsTab({ avatars, editingPerson, setEditingPerson, updateAvatar }) {
  if (editingPerson) {
    return (
      <AvatarPicker
        person={editingPerson}
        current={avatars[editingPerson]}
        onSelect={(style, seed) => {
          updateAvatar(editingPerson, style, seed);
          setEditingPerson(null);
        }}
        onBack={() => setEditingPerson(null)}
      />
    );
  }

  return (
    <div className="avatars-grid">
      {PEOPLE.map((person) => {
        const av = avatars[person] || { style: "adventurer", seed: person };
        return (
          <button
            className="avatar-card"
            key={person}
            onClick={() => setEditingPerson(person)}
          >
            <img
              className="avatar-img"
              src={getAvatarUrl(av.style, av.seed, 96)}
              alt={person}
              loading="lazy"
            />
            <div className="avatar-card-name">{person}</div>
            <div className="avatar-card-style">{av.style}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Avatar Picker ─── */
function AvatarPicker({ person, current, onSelect, onBack }) {
  const [selectedStyle, setSelectedStyle] = useState(current?.style || "adventurer");
  const [seed, setSeed] = useState(current?.seed || person);

  return (
    <div className="avatar-picker">
      <button className="avatar-back" onClick={onBack}>
        ← Back
      </button>
      <div className="avatar-picker-header">
        <img
          className="avatar-picker-preview"
          src={getAvatarUrl(selectedStyle, seed, 120)}
          alt={person}
        />
        <div className="avatar-picker-name">{person}</div>
      </div>

      <div className="avatar-seed-row">
        <label className="avatar-seed-label">Seed</label>
        <input
          type="text"
          className="avatar-seed-input"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Type any word..."
        />
      </div>

      <div className="avatar-style-grid">
        {AVATAR_STYLES.map(({ id, label }) => (
          <button
            className={`avatar-style-option ${selectedStyle === id ? "selected" : ""}`}
            key={id}
            onClick={() => setSelectedStyle(id)}
          >
            <img src={getAvatarUrl(id, seed, 56)} alt={label} loading="lazy" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary"
        onClick={() => onSelect(selectedStyle, seed)}
        style={{ marginTop: "1rem", width: "100%" }}
      >
        ✓ Save Avatar
      </button>
    </div>
  );
}

/* ─── Timetable / Schedule Tab ─── */
function TimetableTab({ timetable, updateTimetableDay }) {
  const [selectedDay, setSelectedDay] = useState("Monday");
  const currentSlots = timetable[selectedDay] || [];

  const [timeInput, setTimeInput] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [roomInput, setRoomInput] = useState("");

  const handleAddSlot = async () => {
    if (!timeInput || !subjectInput) return;
    const newSlot = {
      time: timeInput,
      subject: subjectInput,
      code: codeInput || "—",
      room: roomInput || "Room TBD",
    };
    const updated = [...currentSlots, newSlot];
    await updateTimetableDay(selectedDay, updated);
    setTimeInput("");
    setSubjectInput("");
    setCodeInput("");
    setRoomInput("");
  };

  const handleRemoveSlot = async (idx) => {
    const updated = currentSlots.filter((_, i) => i !== idx);
    await updateTimetableDay(selectedDay, updated);
  };

  return (
    <div className="admin-tab-content">
      <div className="day-pills">
        {DAYS_OF_WEEK.slice(0, 5).map((d) => (
          <button
            key={d}
            className={`day-pill ${selectedDay === d ? "active" : ""}`}
            onClick={() => setSelectedDay(d)}
          >
            {d.slice(0, 3)}
          </button>
        ))}
      </div>

      <h4 className="admin-sub-title">Classes for {selectedDay}</h4>

      {/* Add Slot Form */}
      <div className="admin-form-grid">
        <input
          type="text"
          className="admin-input"
          placeholder="Time (e.g. 09:00 - 10:30 AM)"
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
        />
        <input
          type="text"
          className="admin-input"
          placeholder="Subject Name"
          value={subjectInput}
          onChange={(e) => setSubjectInput(e.target.value)}
        />
        <input
          type="text"
          className="admin-input"
          placeholder="Code (e.g. ECO501)"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
        />
        <input
          type="text"
          className="admin-input"
          placeholder="Room (e.g. Hall A)"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={handleAddSlot}
          disabled={!timeInput || !subjectInput}
        >
          + Add Class Slot
        </button>
      </div>

      {/* Existing Slots */}
      <div className="admin-items-list">
        {currentSlots.length === 0 ? (
          <div className="holiday-empty">No classes scheduled for {selectedDay}</div>
        ) : (
          currentSlots.map((slot, idx) => (
            <div className="admin-slot-item" key={idx}>
              <div>
                <div className="slot-item-time">{slot.time}</div>
                <div className="slot-item-title">{slot.subject} ({slot.code})</div>
                <div className="slot-item-sub">Room: {slot.room}</div>
              </div>
              <button
                className="holiday-remove"
                onClick={() => handleRemoveSlot(idx)}
                aria-label="Remove slot"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Mess Menu Tab ─── */
function MessMenuTab({ messMenu, updateMessMenuDay }) {
  const [selectedDay, setSelectedDay] = useState("Monday");
  const dayMenu = messMenu[selectedDay] || {
    breakfast: "",
    lunch: "",
    snacks: "",
    dinner: "",
  };

  const [breakfast, setBreakfast] = useState(dayMenu.breakfast || "");
  const [lunch, setLunch] = useState(dayMenu.lunch || "");
  const [snacks, setSnacks] = useState(dayMenu.snacks || "");
  const [dinner, setDinner] = useState(dayMenu.dinner || "");

  // Update local state when day changes
  const handleSelectDay = (day) => {
    setSelectedDay(day);
    const m = messMenu[day] || {};
    setBreakfast(m.breakfast || "");
    setLunch(m.lunch || "");
    setSnacks(m.snacks || "");
    setDinner(m.dinner || "");
  };

  const handleSaveMenu = async () => {
    await updateMessMenuDay(selectedDay, { breakfast, lunch, snacks, dinner });
  };

  return (
    <div className="admin-tab-content">
      <div className="day-pills">
        {DAYS_OF_WEEK.map((d) => (
          <button
            key={d}
            className={`day-pill ${selectedDay === d ? "active" : ""}`}
            onClick={() => handleSelectDay(d)}
          >
            {d.slice(0, 3)}
          </button>
        ))}
      </div>

      <h4 className="admin-sub-title">Edit Mess Menu for {selectedDay}</h4>

      <div className="admin-form-vertical">
        <div className="form-group">
          <label className="form-label">🍳 Breakfast</label>
          <textarea
            className="admin-textarea"
            rows="2"
            value={breakfast}
            onChange={(e) => setBreakfast(e.target.value)}
            placeholder="Breakfast items..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">🍲 Lunch</label>
          <textarea
            className="admin-textarea"
            rows="2"
            value={lunch}
            onChange={(e) => setLunch(e.target.value)}
            placeholder="Lunch items..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">☕ Evening Snacks</label>
          <textarea
            className="admin-textarea"
            rows="2"
            value={snacks}
            onChange={(e) => setSnacks(e.target.value)}
            placeholder="Snacks items..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">🌙 Dinner</label>
          <textarea
            className="admin-textarea"
            rows="2"
            value={dinner}
            onChange={(e) => setDinner(e.target.value)}
            placeholder="Dinner items..."
          />
        </div>

        <button className="btn btn-primary" onClick={handleSaveMenu}>
          ✓ Save {selectedDay}'s Menu
        </button>
      </div>
    </div>
  );
}

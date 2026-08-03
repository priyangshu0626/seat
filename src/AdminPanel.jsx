import { useState, useMemo } from "react";
import { PEOPLE } from "./engine";
import { AVATAR_STYLES, getAvatarUrl } from "./useFirestore";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "12345678";

/**
 * Admin Panel — Holidays + Avatars management.
 * Password protected. Changes sync to all users via Firebase.
 */
export default function AdminPanel({
  onClose,
  holidays,
  addHoliday,
  removeHoliday,
  avatars,
  updateAvatar,
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState("holidays"); // "holidays" | "avatars"
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

  // Sort holidays for display
  const sortedHolidays = useMemo(
    () => [...holidays].sort(),
    [holidays]
  );

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
          <div className="modal-subtitle">Enter the admin password to continue</div>
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
            <div className="modal-title">Admin Panel</div>
            <div className="modal-subtitle">Manage holidays & avatars</div>
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
        </div>

        {/* Content */}
        <div className="admin-content">
          {tab === "holidays" ? (
            <HolidaysTab
              holidays={sortedHolidays}
              newDate={newDate}
              setNewDate={setNewDate}
              onAdd={handleAddHoliday}
              onRemove={removeHoliday}
            />
          ) : (
            <AvatarsTab
              avatars={avatars}
              editingPerson={editingPerson}
              setEditingPerson={setEditingPerson}
              updateAvatar={updateAvatar}
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
      {/* Add Holiday */}
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

      {/* Holiday List */}
      {holidays.length === 0 ? (
        <div className="holiday-empty">
          No holidays added yet. Add dates above.
        </div>
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

      {/* Seed input */}
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

      {/* Style Grid */}
      <div className="avatar-style-grid">
        {AVATAR_STYLES.map(({ id, label }) => (
          <button
            className={`avatar-style-option ${selectedStyle === id ? "selected" : ""}`}
            key={id}
            onClick={() => setSelectedStyle(id)}
          >
            <img
              src={getAvatarUrl(id, seed, 56)}
              alt={label}
              loading="lazy"
            />
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

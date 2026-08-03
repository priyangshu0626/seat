import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import {
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

/**
 * Real-time Firestore hook for shared app state.
 * Includes automatic timeout fallbacks so the page NEVER stays blank or stuck loading.
 */

// ─── Holidays ───

export function useHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout: stop loading after 2s even if offline/blocked
    const timer = setTimeout(() => setLoading(false), 2000);

    try {
      const unsub = onSnapshot(
        doc(db, "config", "holidays"),
        (snap) => {
          clearTimeout(timer);
          if (snap.exists()) {
            setHolidays(snap.data().dates || []);
          } else {
            setHolidays([]);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Holidays listener warning (using fallback):", err);
          clearTimeout(timer);
          setLoading(false);
        }
      );
      return () => {
        clearTimeout(timer);
        unsub();
      };
    } catch (e) {
      console.warn("Firestore error:", e);
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  const addHoliday = useCallback(async (dateStr) => {
    try {
      const ref = doc(db, "config", "holidays");
      const updated = [...new Set([...holidays, dateStr])].sort();
      await setDoc(ref, { dates: updated });
    } catch (e) {
      console.error("Failed to save holiday:", e);
    }
  }, [holidays]);

  const removeHoliday = useCallback(async (dateStr) => {
    try {
      const ref = doc(db, "config", "holidays");
      const updated = holidays.filter((d) => d !== dateStr);
      await setDoc(ref, { dates: updated });
    } catch (e) {
      console.error("Failed to remove holiday:", e);
    }
  }, [holidays]);

  return { holidays, loading, addHoliday, removeHoliday };
}

// ─── Avatars ───

const DEFAULT_AVATARS = {
  Priyangshu: { style: "adventurer", seed: "Priyangshu" },
  Aryavrat: { style: "adventurer", seed: "Aryavrat" },
  Yatharth: { style: "adventurer", seed: "Yatharth" },
  Sachin: { style: "adventurer", seed: "Sachin" },
  Gaurav: { style: "adventurer", seed: "Gaurav" },
};

export function useAvatars() {
  const [avatars, setAvatars] = useState(DEFAULT_AVATARS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);

    try {
      const unsub = onSnapshot(
        doc(db, "config", "avatars"),
        (snap) => {
          clearTimeout(timer);
          if (snap.exists()) {
            setAvatars({ ...DEFAULT_AVATARS, ...snap.data() });
          } else {
            setAvatars(DEFAULT_AVATARS);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Avatars listener warning (using fallback):", err);
          clearTimeout(timer);
          setLoading(false);
        }
      );
      return () => {
        clearTimeout(timer);
        unsub();
      };
    } catch (e) {
      console.warn("Firestore error:", e);
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  const updateAvatar = useCallback(
    async (person, style, seed) => {
      try {
        const ref = doc(db, "config", "avatars");
        const updated = { ...avatars, [person]: { style, seed } };
        await setDoc(ref, updated);
      } catch (e) {
        console.error("Failed to update avatar:", e);
      }
    },
    [avatars]
  );

  return { avatars, loading, updateAvatar };
}

// ─── Avatar URL Builder ───

export const AVATAR_STYLES = [
  { id: "adventurer", label: "Adventurer" },
  { id: "adventurer-neutral", label: "Adventurer Neutral" },
  { id: "avataaars", label: "Avataaars" },
  { id: "avataaars-neutral", label: "Avataaars Neutral" },
  { id: "big-ears", label: "Big Ears" },
  { id: "big-ears-neutral", label: "Big Ears Neutral" },
  { id: "bottts", label: "Robots" },
  { id: "bottts-neutral", label: "Robots Neutral" },
  { id: "fun-emoji", label: "Fun Emoji" },
  { id: "lorelei", label: "Lorelei" },
  { id: "lorelei-neutral", label: "Lorelei Neutral" },
  { id: "notionists", label: "Notionists" },
  { id: "notionists-neutral", label: "Notionists Neutral" },
  { id: "pixel-art", label: "Pixel Art" },
  { id: "pixel-art-neutral", label: "Pixel Neutral" },
  { id: "thumbs", label: "Thumbs" },
];

export function getAvatarUrl(style, seed, size = 80) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

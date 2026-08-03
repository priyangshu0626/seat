import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import {
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

/**
 * Real-time Firestore hooks for shared app state.
 * Includes automatic timeout fallbacks so the page NEVER stays blank or stuck loading.
 */

// ─── Holidays ───

export function useHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

// ─── Class Timetable / Schedule ───

export const DEFAULT_TIMETABLE = {
  Monday: [
    { time: "09:00 - 10:30 AM", subject: "Macroeconomics", code: "ECO501", room: "Hall A" },
    { time: "10:45 - 12:15 PM", subject: "Public Policy & Governance", code: "POL502", room: "Hall B" },
    { time: "02:00 - 03:30 PM", subject: "Data Analytics", code: "DAT503", room: "Lab 2" },
  ],
  Tuesday: [
    { time: "09:00 - 10:30 AM", subject: "Econometrics", code: "ECO504", room: "Hall A" },
    { time: "10:45 - 12:15 PM", subject: "Organizational Behavior", code: "MGT501", room: "Hall C" },
    { time: "02:00 - 03:30 PM", subject: "Financial Management", code: "FIN502", room: "Hall B" },
  ],
  Wednesday: [
    { time: "09:00 - 10:30 AM", subject: "Public Policy & Governance", code: "POL502", room: "Hall B" },
    { time: "10:45 - 12:15 PM", subject: "Macroeconomics", code: "ECO501", room: "Hall A" },
    { time: "02:00 - 03:30 PM", subject: "Leadership & Communication", code: "MGT505", room: "Auditorium" },
  ],
  Thursday: [
    { time: "09:00 - 10:30 AM", subject: "Econometrics", code: "ECO504", room: "Hall A" },
    { time: "10:45 - 12:15 PM", subject: "Financial Management", code: "FIN502", room: "Hall B" },
    { time: "02:00 - 03:30 PM", subject: "Capstone Seminar", code: "CAP500", room: "Seminar Room" },
  ],
  Friday: [
    { time: "09:00 - 10:30 AM", subject: "Data Analytics", code: "DAT503", room: "Lab 2" },
    { time: "10:45 - 12:15 PM", subject: "Leadership & Communication", code: "MGT505", room: "Auditorium" },
    { time: "02:00 - 03:30 PM", subject: "Guest Lecture / Workshop", code: "WKS501", room: "Main Hall" },
  ],
  Saturday: [],
  Sunday: [],
};

export function useTimetable() {
  const [timetable, setTimetable] = useState(DEFAULT_TIMETABLE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);

    try {
      const unsub = onSnapshot(
        doc(db, "config", "timetable"),
        (snap) => {
          clearTimeout(timer);
          if (snap.exists()) {
            setTimetable({ ...DEFAULT_TIMETABLE, ...snap.data() });
          } else {
            setTimetable(DEFAULT_TIMETABLE);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Timetable listener warning:", err);
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

  const updateTimetableDay = useCallback(
    async (day, slots) => {
      try {
        const ref = doc(db, "config", "timetable");
        const updated = { ...timetable, [day]: slots };
        await setDoc(ref, updated);
      } catch (e) {
        console.error("Failed to update timetable:", e);
      }
    },
    [timetable]
  );

  return { timetable, loading, updateTimetableDay };
}

// ─── Mess Menu ───

export const DEFAULT_MESS_MENU = {
  Monday: {
    breakfast: "Aloo Paratha, Curd, Butter, Tea/Coffee, Fruits",
    lunch: "Rajma Chawal, Chapati, Mix Veg, Boondi Raita, Salad",
    snacks: "Veg Sandwich, Cold Coffee / Masala Tea",
    dinner: "Kadhai Paneer, Dal Tadka, Rice, Chapati, Gulab Jamun",
  },
  Tuesday: {
    breakfast: "Idli Sambhar, Coconut Chutney, Banana, Tea/Coffee",
    lunch: "Chole Bhature, Jeera Rice, Salad, Pickle, Sweet Lassi",
    snacks: "Samosa, Green Chutney, Masala Tea",
    dinner: "Mushroom Matar, Yellow Dal, Chapati, Rice, Kheer",
  },
  Wednesday: {
    breakfast: "Poha, Sev, Jalebi, Masala Tea, Milk",
    lunch: "Paneer Butter Masala, Veg Pulao, Butter Roti, Cucumber Raita",
    snacks: "Veg Pasta, Lemonade / Tea",
    dinner: "Malai Kofta, Dal Makhani, Rice, Naan, Ice Cream",
  },
  Thursday: {
    breakfast: "Puri Bhaji, Fruits, Tea/Coffee, Boiled Eggs",
    lunch: "Kadi Pakoda, Steamed Rice, Mix Veg Fry, Papad, Salad",
    snacks: "Bhel Puri, Masala Tea/Coffee",
    dinner: "Mix Veg Makhani, Chana Dal, Chapati, Rice, Gajar Ka Halwa",
  },
  Friday: {
    breakfast: "Uttapam, Tomato Chutney, Omelette, Tea/Coffee",
    lunch: "Veg Biryani, Mirchi Ka Salan, Onion Raita, Papad",
    snacks: "French Fries, Cold Drink / Tea",
    dinner: "Shahi Paneer, Dal Fry, Chapati, Rice, Rasgulla",
  },
  Saturday: {
    breakfast: "Stuffed Gobhi Paratha, Curd, Pickle, Tea/Coffee",
    lunch: "Palak Paneer, Dal Tadka, Chapati, Rice, Salad",
    snacks: "Spring Rolls, Hot Tea",
    dinner: "Pav Bhaji, Jeera Rice, Salad, Chocolate Brownie",
  },
  Sunday: {
    breakfast: "Masala Dosa, Sambhar, Coconut Chutney, Filter Coffee",
    lunch: "Special Veg Thali, Dum Biryani, Sweet, Raita",
    snacks: "Chana Chaat, Hot Chocolate / Tea",
    dinner: "Paneer Tikka Masala, Dal Makhani, Butter Naan, Pulao, Dessert",
  },
};

export function useMessMenu() {
  const [messMenu, setMessMenu] = useState(DEFAULT_MESS_MENU);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);

    try {
      const unsub = onSnapshot(
        doc(db, "config", "messMenu"),
        (snap) => {
          clearTimeout(timer);
          if (snap.exists()) {
            setMessMenu({ ...DEFAULT_MESS_MENU, ...snap.data() });
          } else {
            setMessMenu(DEFAULT_MESS_MENU);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Mess menu listener warning:", err);
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

  const updateMessMenuDay = useCallback(
    async (day, meals) => {
      try {
        const ref = doc(db, "config", "messMenu");
        const updated = { ...messMenu, [day]: meals };
        await setDoc(ref, updated);
      } catch (e) {
        console.error("Failed to update mess menu:", e);
      }
    },
    [messMenu]
  );

  return { messMenu, loading, updateMessMenuDay };
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

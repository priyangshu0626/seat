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

// ─── Class Timetable / Schedule (From official BS MPP Schedule PDF) ───

export const DEFAULT_TIMETABLE = {
  Monday: [
    { time: "10:00 - 11:30 AM", subject: "Financial Accounting - FA(3)", code: "FA", room: "Prof. Vikas" },
    { time: "12:00 - 01:30 PM", subject: "Financial Accounting - FA(4)", code: "FA", room: "Prof. Vikas" },
    { time: "03:30 - 05:00 PM", subject: "Public Administration - PA(1)", code: "PA", room: "Prof. Manisha" },
  ],
  Tuesday: [
    { time: "10:00 - 11:30 AM", subject: "Policy Management - PM(1)", code: "PM", room: "Prof. Anoop" },
    { time: "12:00 - 01:30 PM", subject: "Public Administration - PA(2)", code: "PA", room: "Prof. Manisha" },
    { time: "03:30 - 05:00 PM", subject: "Policy Management - PM(3)", code: "PM", room: "Prof. Anoop" },
  ],
  Wednesday: [
    { time: "10:00 - 11:30 AM", subject: "Foundations of Management - FOM(3)", code: "FOM", room: "Prof. Rajiv" },
    { time: "12:00 - 01:30 PM", subject: "Public Administration - PA(3)", code: "PA", room: "Prof. Manisha" },
    { time: "03:30 - 05:00 PM", subject: "Intl Climate Finance - ICF(2)", code: "ICF", room: "Prof. Sibanjan" },
  ],
  Thursday: [
    { time: "10:00 - 11:30 AM", subject: "Public Administration - PA(4)", code: "PA", room: "Prof. Manisha" },
    { time: "12:00 - 01:30 PM", subject: "Policy Management - PM(2)", code: "PM", room: "Prof. Anoop" },
    { time: "03:30 - 05:00 PM", subject: "Policy Management - PM(4)", code: "PM", room: "Prof. Anoop" },
  ],
  Friday: [
    { time: "10:00 - 11:30 AM", subject: "Public Administration - PA(5)", code: "PA", room: "Prof. Manisha" },
    { time: "12:00 - 01:30 PM", subject: "Climate Change & Law - CCL-I(1)", code: "CCL-I", room: "Prof. Divya" },
    { time: "03:30 - 05:00 PM", subject: "Climate Change & Law - CCL-I(2)", code: "CCL-I", room: "Prof. Divya" },
  ],
  Saturday: [
    { time: "10:00 - 11:30 AM", subject: "Climate Change & Law - CCL-I(3)", code: "CCL-I", room: "Prof. Divya" },
    { time: "12:00 - 01:30 PM", subject: "Climate Change & Law - CCL-I(4)", code: "CCL-I", room: "Prof. Divya" },
    { time: "06:00 - 07:30 PM", subject: "Financial Accounting - FA(1)", code: "FA", room: "Prof. Vikas" },
  ],
  Sunday: [
    { time: "10:00 - 11:30 AM", subject: "Financial Accounting - FA(2)", code: "FA", room: "Prof. Vikas" },
  ],
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

// ─── Mess Menu (From official IIM Sambalpur Mess Menu PDF) ───

export const DEFAULT_MESS_MENU = {
  Monday: {
    breakfast: "Uttapam, Coconut Chutney + Peanut Chutney (Daily: Bread + Butter + Jam + Fruits + Milk + Tea/Coffee + Cornflakes + Sprouts + Boiled Egg)",
    lunch: "Onion Rice, Rajma Masala, Veg Jalfrezi, Dal Bhukhara, Boondi Raita, Green Salad",
    snacks: "Bhel Puri / Papdi Chat + Green Chutney + Dahi, Tea/Coffee",
    dinner: "Plain Rice, Malai Kofta, Black Chana Masala Dry, Chana Daal, Roti, Chickpea Salad, Thecha, Jalebi",
  },
  Tuesday: {
    breakfast: "Paneer Paratha, Curd (Daily: Bread + Butter + Jam + Fruits + Milk + Tea/Coffee + Cornflakes + Sprouts + Boiled Egg)",
    lunch: "Jeera Rice, Dry Bhindi with Pyaaz, Soyabean Aloo Curry, Dal Tadka, Buttermilk, Green Salad",
    snacks: "Schezwan Noodles / Dahi Bhalla + Imli + Green Chutney, Tea/Coffee",
    dinner: "Plain Rice, Chole Curry, Aloo Tomato Sabzi, Navratan Dal, Poori, Onion Laccha Salad, Tomato Onion Chutney, Moong Dal Halwa",
  },
  Wednesday: {
    breakfast: "Vermicelli Upma + Omelette, Red Chutney + Coconut Chutney (Daily: Bread + Butter + Jam + Fruits + Milk + Tea/Coffee + Cornflakes + Sprouts + Boiled Egg)",
    lunch: "Plain Rice, Kadi Pakore, Aloo Bhujiaya, Sambhar, Boondi Raita, Green Salad",
    snacks: "Mayo Sandwich / Aloo Sandwich, Tea/Coffee",
    dinner: "Veg Biryani, Paneer Tikka Masala, Chicken Biryani, Dal Tadka, Roti, Vinegar Onion & Raita",
  },
  Thursday: {
    breakfast: "Idly + Vada, Sambhar + Coconut Chutney (Daily: Bread + Butter + Jam + Fruits + Milk + Tea/Coffee + Cornflakes + Sprouts + Boiled Egg)",
    lunch: "Onion Rice, Veg Jalfrezi, Karela Chips, Tomato Dal, Plain Curd, Green Salad",
    snacks: "Veg Cutlet + Imli Chutney / Samosa Chat, Tea/Coffee",
    dinner: "Jeera Rice, Mushroom Corn Masala, Dry Aloo Capsicum, Dal Makhani, Roti, Corn Salad, Garlic Chutney",
  },
  Friday: {
    breakfast: "Tarri Poha + Omelette, Matar Sabji + Sev (Daily: Bread + Butter + Jam + Fruits + Milk + Tea/Coffee + Cornflakes + Sprouts + Boiled Egg)",
    lunch: "Lemon Rice, Kurkuri Bhindi, Lobiya Curry, Sambhar, Masala Butter Milk, Green Salad",
    snacks: "Mysore Bonda + Coconut Chutney / Vada Pav, Tea/Coffee",
    dinner: "Plain Rice, Kadhai Paneer (Red Gravy), Kadhai Chicken / Fish Curry, Rasam, Roti, Green Salad, Garlic Chutney, Shrikhand",
  },
  Saturday: {
    breakfast: "Aloo Paratha, Curd + Green Chutney (Daily: Bread + Butter + Jam + Fruits + Milk + Tea/Coffee + Cornflakes + Sprouts + Boiled Egg)",
    lunch: "Jeera Rice, Chole, Bhature, Dal Tadka, Plain Curd, Green Salad",
    snacks: "Red Sauce Pasta / Veg Macaroni, Tea/Coffee",
    dinner: "Plain Rice, Dahi Bhindi, Aloo Parwal Sabzi, Dal Makhani, Roti, Chickpea Salad, Garlic Chutney",
  },
  Sunday: {
    breakfast: "Dosa, Sambhar + Coconut Chutney (Daily: Bread + Butter + Jam + Fruits + Milk + Tea/Coffee + Cornflakes + Sprouts + Boiled Egg)",
    lunch: "Plain Rice, Aloo Chokha, Dahi Tirkari, Arhar Dal, Plain Curd, Green Salad",
    snacks: "Panipuri / Pav Bhaji, Tea/Coffee",
    dinner: "Plain Rice, Paneer Butter Masala, Butter Chicken, Chana Daal, Roti, Onion Laccha Salad, Ice Cream",
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

// ─── Announcements / Assignments / Quizzes / Readings ───

export const DEFAULT_ANNOUNCEMENTS = [
  {
    id: "ann-1",
    title: "Public Administration Policy Brief",
    category: "Assignment",
    subject: "PA — Public Administration",
    dueDate: "2026-08-10",
    details: "Submit 500-word policy brief on urban governance models on Moodle by 11:59 PM.",
  },
  {
    id: "ann-2",
    title: "Financial Accounting Quiz 1",
    category: "Quiz",
    subject: "FA — Financial Accounting",
    dueDate: "2026-08-08",
    details: "In-class 20-minute quiz covering Balance Sheets & Cash Flow Statements.",
  },
  {
    id: "ann-3",
    title: "Climate Change & Law Case Study Reading",
    category: "Reading",
    subject: "CCL-I — Climate Change & Law",
    dueDate: "2026-08-07",
    details: "Read Paris Agreement Articles 4 & 6 case notes prior to lecture.",
  },
];

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState(DEFAULT_ANNOUNCEMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);

    try {
      const unsub = onSnapshot(
        doc(db, "config", "announcements"),
        (snap) => {
          clearTimeout(timer);
          if (snap.exists()) {
            setAnnouncements(snap.data().list || DEFAULT_ANNOUNCEMENTS);
          } else {
            setAnnouncements(DEFAULT_ANNOUNCEMENTS);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Announcements listener warning:", err);
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

  const addAnnouncement = useCallback(
    async (item) => {
      try {
        const ref = doc(db, "config", "announcements");
        const newItem = { ...item, id: Date.now().toString() };
        const updated = [newItem, ...announcements];
        await setDoc(ref, { list: updated });
      } catch (e) {
        console.error("Failed to add announcement:", e);
      }
    },
    [announcements]
  );

  const removeAnnouncement = useCallback(
    async (id) => {
      try {
        const ref = doc(db, "config", "announcements");
        const updated = announcements.filter((a) => a.id !== id);
        await setDoc(ref, { list: updated });
      } catch (e) {
        console.error("Failed to remove announcement:", e);
      }
    },
    [announcements]
  );

  return { announcements, loading, addAnnouncement, removeAnnouncement };
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

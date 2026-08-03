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
  "2026-08-03": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(1)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-08-04": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Policy Management - PM(1)",
      "code": "PM",
      "room": "Prof. Anoop"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Administration - PA(2)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-08-05": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(3)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-08-06": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(4)",
      "code": "PA",
      "room": "Prof. Manisha"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Policy Management - PM(2)",
      "code": "PM",
      "room": "Prof. Anoop"
    }
  ],
  "2026-08-07": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(5)",
      "code": "PA",
      "room": "Prof. Manisha"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Corporate & Commercial Law - CCL-I(1)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Corporate & Commercial Law - CCL-I(2)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    }
  ],
  "2026-08-08": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Corporate & Commercial Law - CCL-I(3)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Corporate & Commercial Law - CCL-I(4)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    },
    {
      "time": "06:00 - 07:30 PM",
      "subject": "Financial Accounting - FA(1)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-08-09": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Financial Accounting - FA(2)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-08-10": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Financial Accounting - FA(3)",
      "code": "FA",
      "room": "Prof. Vikas"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Financial Accounting - FA(4)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-08-11": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Financial Accounting - FA(5)",
      "code": "FA",
      "room": "Prof. Vikas"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Policy Management - PM(3)",
      "code": "PM",
      "room": "Prof. Anoop"
    }
  ],
  "2026-08-12": [],
  "2026-08-13": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Policy Management - PM(4)",
      "code": "PM",
      "room": "Prof. Anoop"
    }
  ],
  "2026-08-14": [],
  "2026-08-15": [],
  "2026-08-16": [],
  "2026-08-17": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(1)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    }
  ],
  "2026-08-18": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Policy Management - PM(5)",
      "code": "PM",
      "room": "Prof. Anoop"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Foundations of Management - FOM(2)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    }
  ],
  "2026-08-19": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(3)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    }
  ],
  "2026-08-20": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(4)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Policy Management - PM(6)",
      "code": "PM",
      "room": "Prof. Anoop"
    }
  ],
  "2026-08-21": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(5)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Policy Design - PP-D&A(1)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-08-22": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Policy Design - PP-D&A(2)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Corporate & Commercial Law - CCL-I(5)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Corporate & Commercial Law - CCL-I(6)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    }
  ],
  "2026-08-23": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Policy Design - PP-D&A(3)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Corporate & Commercial Law - CCL-I(7)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    }
  ],
  "2026-08-24": [],
  "2026-08-25": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Policy Management - PM(7)",
      "code": "PM",
      "room": "Prof. Anoop"
    }
  ],
  "2026-08-26": [],
  "2026-08-27": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Policy Management - PM(8)",
      "code": "PM",
      "room": "Prof. Anoop"
    }
  ],
  "2026-08-28": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(1)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Intl Climate Finance - ICF(2)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    }
  ],
  "2026-08-29": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(3)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Intl Climate Finance - ICF(4)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    }
  ],
  "2026-08-30": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(5)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    }
  ],
  "2026-08-31": [],
  "2026-09-01": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Policy Management - PM(9)",
      "code": "PM",
      "room": "Prof. Anoop"
    }
  ],
  "2026-09-02": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(1)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Business Analytics - BA(1)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ],
  "2026-09-03": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Policy Management - PM(10)",
      "code": "PM",
      "room": "Prof. Anoop"
    }
  ],
  "2026-09-04": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(2)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Business Analytics - BA(2)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ],
  "2026-09-05": [],
  "2026-09-06": [],
  "2026-09-07": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(3)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Foundations of Management - FOM(6)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Business Analytics - BA(3)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ],
  "2026-09-08": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(7)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    }
  ],
  "2026-09-09": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(8)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Development Economics - DE(4)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Business Analytics - BA(4)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ],
  "2026-09-10": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(9)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    }
  ],
  "2026-09-11": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(10)",
      "code": "FOM",
      "room": "Prof. Rajiv"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Intl Climate Finance - ICF(6)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Business Analytics - BA(5)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ],
  "2026-09-12": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(7)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Intl Climate Finance - ICF(8)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    }
  ],
  "2026-09-13": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(9)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Intl Climate Finance - ICF(10)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    }
  ],
  "2026-09-14": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(5)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Corporate & Commercial Law - CCL-I(8)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Corporate & Commercial Law - CCL-I(9)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    }
  ],
  "2026-09-15": [],
  "2026-09-16": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Corporate & Commercial Law - CCL-I(10)",
      "code": "CCL-I",
      "room": "Prof. Divya"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Development Economics - DE(6)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Public Policy Design - PP-D&A(4)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-09-17": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Policy Design - PP-D&A(5)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Policy Design - PP-D&A(6)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-09-18": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Policy Design - PP-D&A(7)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Policy Design - PP-D&A(8)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    },
    {
      "time": "06:00 - 07:30 PM",
      "subject": "Financial Accounting - FA(6)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-09-19": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Financial Accounting - FA(7)",
      "code": "FA",
      "room": "Prof. Vikas"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Policy Design - PP-D&A(9)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-09-20": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Policy Design - PP-D&A(10)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Financial Accounting - FA(8)",
      "code": "FA",
      "room": "Prof. Vikas"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Financial Accounting - FA(9)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-09-21": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Financial Accounting - FA(10)",
      "code": "FA",
      "room": "Prof. Vikas"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Development Economics - DE(7)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    }
  ],
  "2026-09-22": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(6)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-09-23": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(8)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Administration - PA(7)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-09-24": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(8)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-09-25": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(9)",
      "code": "PA",
      "room": "Prof. Manisha"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Development Economics - DE(9)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    }
  ],
  "2026-09-26": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(10)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-09-27": [],
  "2026-09-28": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(10)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    }
  ],
  "2026-09-29": [],
  "2026-09-30": [],
  "2026-10-01": [],
  "2026-10-02": [],
  "2026-10-03": [],
  "2026-10-04": [],
  "2026-10-05": [],
  "2026-10-06": [],
  "2026-10-07": [],
  "2026-10-08": [],
  "2026-10-09": [],
  "2026-10-10": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Corporate & Commercial Law - CCL-I(11)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Corporate & Commercial Law - CCL-I(12)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    }
  ],
  "2026-10-11": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Corporate & Commercial Law - CCL-I(13)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Administration - PA(11)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-10-12": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(11)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Administration - PA(12)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-10-13": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(13)",
      "code": "PA",
      "room": "Prof. Manisha"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Foundations of Management - FOM(11)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    }
  ],
  "2026-10-14": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(14)",
      "code": "PA",
      "room": "Prof. Manisha"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Development Economics - DE(12)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    }
  ],
  "2026-10-15": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(15)",
      "code": "PA",
      "room": "Prof. Manisha"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Foundations of Management - FOM(12)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    }
  ],
  "2026-10-16": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(11)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Intl Climate Finance - ICF(12)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "06:00 - 07:30 PM",
      "subject": "Financial Accounting - FA(11)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-10-17": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(13)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Intl Climate Finance - ICF(14)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Financial Accounting - FA(12)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-10-18": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(15)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Financial Accounting - FA(13)",
      "code": "FA",
      "room": "Prof. Vikas"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Financial Accounting - FA(14)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-10-19": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Financial Accounting - FA(15)",
      "code": "FA",
      "room": "Prof. Vikas"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Development Economics - DE(13)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    }
  ],
  "2026-10-20": [],
  "2026-10-21": [],
  "2026-10-22": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(13)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    }
  ],
  "2026-10-23": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Policy Design - PP-D&A(11)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-10-24": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Corporate & Commercial Law - CCL-I(14)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Corporate & Commercial Law - CCL-I(15)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Public Policy Design - PP-D&A(12)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-10-25": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Corporate & Commercial Law - CCL-I(16)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Policy Design - PP-D&A(13)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-10-26": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(14)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Policy Design - PP-D&A(14)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-10-27": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Policy Design - PP-D&A(15)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Foundations of Management - FOM(14)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    }
  ],
  "2026-10-28": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(15)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    }
  ],
  "2026-10-29": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(15)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    }
  ],
  "2026-10-30": [],
  "2026-10-31": [],
  "2026-11-01": [],
  "2026-11-02": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(16)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Administration - PA(16)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-11-03": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(16)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Administration - PA(17)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-11-04": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(18)",
      "code": "PA",
      "room": "Prof. Manisha"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Development Economics - DE(17)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    }
  ],
  "2026-11-05": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(17)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Administration - PA(19)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-11-06": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Administration - PA(20)",
      "code": "PA",
      "room": "Prof. Manisha"
    }
  ],
  "2026-11-07": [],
  "2026-11-08": [],
  "2026-11-09": [],
  "2026-11-10": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(18)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    }
  ],
  "2026-11-11": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(18)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    }
  ],
  "2026-11-13": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Corporate & Commercial Law - CCL-I(17)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    },
    {
      "time": "06:00 - 07:30 PM",
      "subject": "Financial Accounting - FA(16)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-11-14": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Corporate & Commercial Law - CCL-I(18)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Corporate & Commercial Law - CCL-I(19)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Financial Accounting - FA(17)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-11-15": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Corporate & Commercial Law - CCL-I(20)",
      "code": "CCL-I",
      "room": "Mr. Chintan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Financial Accounting - FA(18)",
      "code": "FA",
      "room": "Prof. Vikas"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Financial Accounting - FA(19)",
      "code": "FA",
      "room": "Prof. Vikas"
    }
  ],
  "2026-11-16": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Financial Accounting - FA(20)",
      "code": "FA",
      "room": "Prof. Vikas"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Development Economics - DE(19)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "03:30 - 05:00 PM",
      "subject": "Public Policy Design - PP-D&A(16)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-11-17": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(19)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Policy Design - PP-D&A(17)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-11-18": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Development Economics - DE(20)",
      "code": "DE",
      "room": "Prof. Ashutosh"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Policy Design - PP-D&A(18)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-11-19": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Foundations of Management - FOM(20)",
      "code": "FOM",
      "room": "Prof. Ramakrushna"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Public Policy Design - PP-D&A(19)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-11-20": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Public Policy Design - PP-D&A(20)",
      "code": "PP-D&A",
      "room": "Prof. Vandana"
    }
  ],
  "2026-11-21": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(16)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Intl Climate Finance - ICF(17)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    }
  ],
  "2026-11-22": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(18)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    },
    {
      "time": "12:00 - 01:30 PM",
      "subject": "Intl Climate Finance - ICF(19)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    }
  ],
  "2026-11-23": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Intl Climate Finance - ICF(20)",
      "code": "ICF",
      "room": "Prof. Sibanjan"
    }
  ],
  "2026-11-24": [],
  "2026-11-25": [],
  "2026-11-26": [],
  "2026-11-27": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Business Analytics - BA(6)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ],
  "2026-11-28": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Business Analytics - BA(7)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ],
  "2026-11-29": [],
  "2026-11-30": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Business Analytics - BA(8)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ],
  "2026-12-01": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Business Analytics - BA(9)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ],
  "2026-12-02": [
    {
      "time": "10:00 - 11:30 AM",
      "subject": "Business Analytics - BA(10)",
      "code": "BA",
      "room": "Dr. Biplab"
    }
  ]
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
  "Monday": {
    "breakfast": "Uttapam, Coconut Chutney + Peanut Chutney",
    "lunch": "Onion Rice, Rajma Masala, Veg Jalfrezi, Dal Bhukhara, Boondi Raita, Green Salad",
    "snacks": "Bhel Puri, Papdi Chat + Green Chutney + Dahi, Tea/Coffee",
    "dinner": "Plain Rice, Malai Kofta, Black Chana Masala Dry, Chana Daal, Roti, Chickpea Salad, Thecha, Jalebi"
  },
  "Tuesday": {
    "breakfast": "Paneer Paratha, Curd",
    "lunch": "Jeera Rice, Dry Bhindi with Pyaaz, Soyabean Aloo Curry, Dal Tadka, Buttermilk, Green Salad",
    "snacks": "Schezwan Noodles, Dahi Bhalla + Imli + Green Chutney, Coffee",
    "dinner": "Plain Rice, Chole Curry, Aloo Tomato Sabzi, Navratan Dal, Poori, Onion Laccha Salad, Tomato Onion Chutney, Moong Dal Halwa"
  },
  "Wednesday": {
    "breakfast": "Vermicelli Upma + Omlette, Red Chutney + Coconut Chutney",
    "lunch": "Plain Rice, Kadi Pakore, Aloo Bhujiya, Sambhar, Boondi Raita, Green Salad",
    "snacks": "Mayo Sandwich, Aloo Sandwich, Tea",
    "dinner": "Veg Biryani, Paneer Tikka Masala, Chicken Biryani, Dal Tadka, Roti, Vinegar Onion & Raita, Garlic Chutney, Shrikhand"
  },
  "Thursday": {
    "breakfast": "Idly + Vada, Sambhar + Coconut Chutney",
    "lunch": "Onion Rice, Veg Jalfrezi, Karela Chips, Tomato Dal, Plain Curd, Green Salad",
    "snacks": "Veg Cutlet + Imli Chutney, Samosa Chat, Tea",
    "dinner": "Jeera Rice, Mushroom Corn Masala, Dry Aloo Capsicum, Dal Makhani, Roti, Corn Salad, Garlic Chutney"
  },
  "Friday": {
    "breakfast": "Tarri Poha + Omlette, Matar Sabji + Sev",
    "lunch": "Lemon Rice, Kurkuri Bhindi, Lobiya Curry, Sambhar, Masala Butter Milk, Green Salad",
    "snacks": "Mysore Bonda + Coconut Chutney, Vada Pav, Coffee",
    "dinner": "Plain Rice, Kadhai Paneer (Red Gravy), Kadhai Chicken / Fish Curry, Rasam, Roti, Green Salad, Shrikhand"
  },
  "Saturday": {
    "breakfast": "Aloo Paratha, Curd + Green Chutney",
    "lunch": "Jeera Rice, Chole, Bhature, Dal Tadka, Plain Curd, Green Salad",
    "snacks": "Red Sauce Pasta, Vegetable Macroni, Tea",
    "dinner": "Plain Rice, Dahi Bhindi, Aloo Parwal Sabzi, Dal Makhani, Roti, Chickpea Salad, Garlic Chutney"
  },
  "Sunday": {
    "breakfast": "Dosa, Sambhar + Coconut Chutney",
    "lunch": "Plain Rice, Aloo Chokha, Dahi Tirkari, Arhar Dal, Plain Curd, Green Salad",
    "snacks": "Panipuri, Pav Bhaji, Coffee",
    "dinner": "Plain Rice, Paneer Butter Masala, Butter Chicken, Chana Daal, Roti, Onion Laccha Salad, Ice Cream"
  }
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

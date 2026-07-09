import { doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";

// Base URL of the Express compute server. Defaults to localhost for dev;
// set VITE_API_URL in a .env file (or your host's env vars) for production.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function getUserSchedule(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("User profile not found");
  return snap.data().schedule;
}

export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function updateDailySummary(uid, punchIn, punchOut) {
  const schedule = await getUserSchedule(uid);

  // Compute the metrics on the backend (Express) instead of in the browser.
  const res = await fetch(`${API_URL}/compute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      punchIn: punchIn.toISOString(),
      punchOut: punchOut ? punchOut.toISOString() : null,
      schedule,
    }),
  });
  if (!res.ok) throw new Error("Failed to compute metrics");
  const metrics = await res.json();

  const date = toDateString(punchIn);

  await setDoc(doc(db, "dailySummary", `${uid}_${date}`), {
    userId: uid,
    date,
    ...metrics,
  });

  return metrics;
}

/**
 * Get a single day's summary for a user, e.g. getDailySummary(uid, "2026-07-08").
 * Returns null if that day has no summary yet (no completed punch-out recorded).
 */
export async function getDailySummary(uid, date) {
  const snap = await getDoc(doc(db, "dailySummary", `${uid}_${date}`));
  return snap.exists() ? snap.data() : null;
}

/**
 * Get the most recent `days` daily summaries for a user, newest first.
 * Date strings ("YYYY-MM-DD") sort correctly as plain strings, so orderBy("date", "desc") works.
 */
export async function getDailySummaryHistory(uid, days = 7) {
  const q = query(
    collection(db, "dailySummary"),
    where("userId", "==", uid),
    orderBy("date", "desc"),
    limit(days)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get all daily summaries for a user within an inclusive date range
 * (startDate/endDate are "YYYY-MM-DD" strings). Used for week navigation,
 * where the range isn't necessarily "the most recent N days."
 */
export async function getDailySummaryRange(uid, startDate, endDate) {
  const q = query(
    collection(db, "dailySummary"),
    where("userId", "==", uid),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "asc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

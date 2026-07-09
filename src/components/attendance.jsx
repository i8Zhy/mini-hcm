import { collection, query, where, orderBy, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp ,limit} from "firebase/firestore";
import {db} from "../config/firebase"

export async function getTodayAttendance(uid) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, "attendance"),
    where("userId", "==", uid),
    where("timestamp", ">=", Timestamp.fromDate(startOfToday)),
    orderBy("timestamp", "asc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get the single most recent punch for a user, regardless of date.
 */
export async function getLastPunch(uid) {
  const q = query(
    collection(db, "attendance"),
    where("userId", "==", uid),
    orderBy("timestamp", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Record a punch (clock in or out) for a user.
 */
export async function recordPunch(uid, type) {

    try{
        await addDoc(collection(db, "attendance"),{
            userId: uid,
            type,
            timestamp: serverTimestamp(),
        });
    }catch(err){
        console.log(err);
        throw err;
    }
}

/**
 * Get all punches for a user on a specific calendar date ("YYYY-MM-DD"), ordered oldest first.
 * Used by the admin edit panel, unlike getTodayAttendance which is always "today."
 */
export async function getAttendanceForDate(uid, dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0);
  const endOfDay = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

  const q = query(
    collection(db, "attendance"),
    where("userId", "==", uid),
    where("timestamp", ">=", Timestamp.fromDate(startOfDay)),
    where("timestamp", "<", Timestamp.fromDate(endOfDay)),
    orderBy("timestamp", "asc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Overwrite a single attendance doc's timestamp (admin correction).
 */
export async function updatePunchTime(punchId, newDate) {
  await updateDoc(doc(db, "attendance", punchId), {
    timestamp: Timestamp.fromDate(newDate),
  });
}


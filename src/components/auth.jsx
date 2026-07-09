import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import "./auth.css";

export const Auth = () => {
  const role = "employee";
  const timezone = "Asia/Manila";
  const schedule = { start: "09:00", end: "18:00" };

  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetFields = () => {
    setName("");
    setEmail("");
    setPassword("");
    setError("");
  };

  const switchMode = (registering) => {
    setIsRegistering(registering);
    resetFields();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegistering) {
        await registerUser({ name, email, password, role, timezone, schedule });
      } else {
        await loginUser({ email, password });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-logo">🕒</div>
      <h1 className="auth-title">
        {isRegistering ? "Create your account" : "Login to Mini HCM"}
      </h1>

      <form className="auth-form" onSubmit={handleSubmit}>
        {isRegistering && (
          <div className="auth-field">
            <span className="auth-icon">👤</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name..."
              autoComplete="name"
            />
          </div>
        )}

        <div className="auth-field">
          <span className="auth-icon">✉️</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email..."
            autoComplete="username"
          />
        </div>

        <div className="auth-field">
          <span className="auth-icon">🔒</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password..."
            autoComplete={isRegistering ? "new-password" : "current-password"}
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Please wait..." : isRegistering ? "Register" : "Login"}
        </button>
      </form>

      <div className="auth-toggle">
        {isRegistering ? (
          <>
            Already have an account?{" "}
            <button type="button" onClick={() => switchMode(false)}>Login</button>
          </>
        ) : (
          <>
            Don't have an account?{" "}
            <button type="button" onClick={() => switchMode(true)}>Register</button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Register the user in.
 */
export async function registerUser({ name, email, password, role, timezone, schedule }) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await setDoc(doc(db, "users", uid), {
      name: name.trim(),
      email,
      role,
      timezone,
      schedule,
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

/**
 * Log an existing user in.
 */
export async function loginUser({ email, password }) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);
    throw err;
  }
}

/**
 * Log the current user out.
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
    throw err;
  }
}

/**
 * Subscribe to auth state changes (user logs in/out, or on initial load).
 */
export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get a user's Firestore profile doc (name, email, role, timezone, schedule).
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("User profile not found");
  return snap.data();
}

/**
 * Get every employee profile (role === "employee"), for admin views.
 */
export async function getAllEmployees() {
  const q = query(collection(db, "users"), where("role", "==", "employee"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
}

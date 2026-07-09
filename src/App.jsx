import { useState, useEffect } from "react";
import "./App.css";
import { Auth, subscribeToAuthChanges, logoutUser, getUserProfile } from "./components/auth";
import { Dashboard } from "./components/Dashboard";
import { AdminDashboard } from "./components/AdminDashboard";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [roleChecked, setRoleChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      setRole(null);
      setRoleChecked(false);
      return;
    }
    setRoleChecked(false);
    getUserProfile(currentUser.uid)
      .then((profile) => {
        setProfile(profile);
        setRole(profile.role);
      })
      .finally(() => setRoleChecked(true));
  }, [currentUser]);

  const renderContent = () => {
    if (!authChecked) return <p>Loading...</p>;
    if (!currentUser) return <Auth />;
    if (!roleChecked) return <p>Loading...</p>;
    if (role === "admin") return <AdminDashboard user={currentUser} name={profile?.name} onLogout={logoutUser} />;
    return <Dashboard user={currentUser} name={profile?.name} onLogout={logoutUser} />;
  };

  return <main className="app">{renderContent()}</main>;
}

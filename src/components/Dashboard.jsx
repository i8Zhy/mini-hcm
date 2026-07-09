import "./Dashboard.css";
import { useState, useEffect } from "react";
import { getTodayAttendance, getLastPunch, recordPunch } from "./attendance";


import { updateDailySummary, getDailySummary, toDateString, getDailySummaryHistory } from "./dailySummary";


function formatShortDate(dateStr) {
  // dateStr is "YYYY-MM-DD" -> "Jul 8"
  const [, m, d] = dateStr.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHours(value) {
  return value === null || value === undefined ? "-" : value.toFixed(1);
}

export const Dashboard = ({ user, onLogout }) => {
  const [todayspunch, setTodayPunches] = useState([]);
  const [lastPunchEver, setLastPunchEver] = useState(null);
  const [punching, setPunching] = useState(false);
  const [todaySummary, setTodaySummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true)

  // TODO (data-fetching, not layout): populate these from dailySummary.js
  // — getDailySummary(user.uid, todayDateString) for todaySummary
  // — getDailySummaryHistory(user.uid) for 

  const refreshDailySummary = async () => {
    const today = toDateString(new Date());
    await Promise.all([
      getDailySummary(user.uid, today).then(setTodaySummary),
      getDailySummaryHistory(user.uid).then(setHistory),
    ]);
  };

  useEffect(() => {
    refreshDailySummary().finally(() => setLoading(false));
  }, [user.uid]);


  const refresh = async () => {
    const [today, last] = await Promise.all([
      getTodayAttendance(user.uid),
      getLastPunch(user.uid),
    ]);
    setTodayPunches(today);
    setLastPunchEver(last);
    return today;
  };

  useEffect(() => {
    refresh();
  }, [user.uid]);

  // Layer 1: an "in" with no matching "out" yet, regardless of date — an open shift.
  const hasOpenShift = lastPunchEver && lastPunchEver.type === "in";

  // Layer 2: only relevant if there's no open shift — has today already got a full in+out pair?
  const completedToday =
    !hasOpenShift &&
    todayspunch.some((p) => p.type === "in") &&
    todayspunch.some((p) => p.type === "out");

  const nextType = hasOpenShift ? "out" : "in";

  let label = "Punch In";
  if (punching) label = "Please wait...";
  else if (hasOpenShift) label = "Punch Out";
  else if (completedToday) label = "Completed for today";

  const handlePunch = async () => {
    setPunching(true);
    try {
      await recordPunch(user.uid, nextType);
      const today = await refresh();

      if (nextType === "out") {
        // Use the most recent "in"/"out" (not the first) in case today already
        // had an earlier completed cycle — e.g. an overnight shift closing out
        // followed by a fresh same-day in/out pair.
        const inPunch = today.findLast((p) => p.type === "in");
        const outPunch = today.findLast((p) => p.type === "out");
        if (inPunch && outPunch) {
          await updateDailySummary(
            user.uid,
            inPunch.timestamp.toDate(),
            outPunch.timestamp.toDate()
          );
          await refreshDailySummary();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPunching(false);
    }
  };

  const todayLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome, {user.email}</h1>
          <p className="dashboard-date">Today, {todayLabel}</p>
        </div>
        <div className="dashboard-actions">
          <button
            className="btn-primary"
            onClick={handlePunch}
            disabled={punching || completedToday}
          >
            {label}
          </button>
          <button className="btn-secondary" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-tile">
          <p className="kpi-label">Regular</p>
          <p className="kpi-value">
            {loading ? <span>-</span> : formatHours(todaySummary?.regularHours)} <span className="kpi-unit">hrs</span>
          </p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-label">Overtime</p>
          <p className="kpi-value">
            {loading ? <span>-</span> : formatHours(todaySummary?.overtimeHours)}<span className="kpi-unit">hrs</span>
          </p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-label">Night diff</p>
          <p className="kpi-value">
            {loading ? <span>-</span> : formatHours(todaySummary?.nightDiffHours)}<span className="kpi-unit">hrs</span>
          </p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-label">Late</p>
          <p className={`kpi-value ${todaySummary?.lateMinutes > 0 ? "is-flagged" : ""}`}>
            {loading ? <span>-</span> : todaySummary?.lateMinutes ?? 0}<span className="kpi-unit">min</span>
          </p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-label">Undertime</p>
          <p className="kpi-value">
            {loading ? <span>-</span> : todaySummary?.undertimeMinutes ?? 0}<span className="kpi-unit">min</span>
          </p>
        </div>
      </div>

      <div className="history">
        <h2>History</h2>
        {history.length === 0 ? (
          <p className="empty-history">No summaries yet.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reg</th>
                <th>OT</th>
                <th>ND</th>
                <th>Late</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((day) => (
                <tr key={day.date}>
                  <td>{formatShortDate(day.date)}</td>
                  <td>{formatHours(day.regularHours)}</td>
                  <td>{formatHours(day.overtimeHours)}</td>
                  <td>{formatHours(day.nightDiffHours)}</td>
                  <td>{day.lateMinutes ?? "–"}</td>
                  <td>
                    {day.status === "complete" ? (
                      <span className="status-badge">
                        <span className="status-dot complete" />
                        Complete
                      </span>
                    ) : (
                      <span className="status-badge">
                        <span className="status-dot missing" />
                        Missing out
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

import "./Dashboard.css";
import { useState, useEffect } from "react";
import { getAllEmployees } from "./auth";
import { getDailySummary, getDailySummaryRange, updateDailySummary, toDateString } from "./dailySummary";
import { getAttendanceForDate, updatePunchTime } from "./attendance";

function formatHours(value) {
  return value === null || value === undefined ? "–" : value.toFixed(1);
}

function formatShortDate(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Monday of the week containing `date`.
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toTimeInputValue(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function combineDateAndTime(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

function sumWeek(history) {
  return history.reduce(
    (acc, day) => ({
      regularHours: acc.regularHours + (day.regularHours ?? 0),
      overtimeHours: acc.overtimeHours + (day.overtimeHours ?? 0),
      nightDiffHours: acc.nightDiffHours + (day.nightDiffHours ?? 0),
      lateMinutes: acc.lateMinutes + (day.lateMinutes ?? 0),
      undertimeMinutes: acc.undertimeMinutes + (day.undertimeMinutes ?? 0),
    }),
    { regularHours: 0, overtimeHours: 0, nightDiffHours: 0, lateMinutes: 0, undertimeMinutes: 0 }
  );
}

export const AdminDashboard = ({ user, name, onLogout }) => {
  const [view, setView] = useState("daily"); // "daily" | "weekly"
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [employees, setEmployees] = useState([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [summaries, setSummaries] = useState({}); // { [uid]: summary | null }
  const [loading, setLoading] = useState(true);
  const [weeklyTotals, setWeeklyTotals] = useState({}); // { [uid]: summed metrics }
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekEnd = addDays(weekStart, 6);

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editPunches, setEditPunches] = useState(null); // { inDoc, outDoc } | "incomplete" | null (loading)
  const [editInTime, setEditInTime] = useState("");
  const [editOutTime, setEditOutTime] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    getAllEmployees()
      .then(setEmployees)
      .finally(() => setEmployeesLoaded(true));
  }, []);

  const refreshDaily = () => {
    if (employees.length === 0) return;
    setLoading(true);
    return Promise.all(
      employees.map((emp) =>
        getDailySummary(emp.uid, selectedDate).then((summary) => [emp.uid, summary])
      )
    )
      .then((pairs) => setSummaries(Object.fromEntries(pairs)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (view !== "daily") return;
    refreshDaily();
  }, [view, employees, selectedDate]);

  useEffect(() => {
    if (view !== "weekly" || employees.length === 0) return;
    setWeeklyLoading(true);
    const startStr = toDateString(weekStart);
    const endStr = toDateString(weekEnd);
    Promise.all(
      employees.map((emp) =>
        getDailySummaryRange(emp.uid, startStr, endStr).then((history) => [emp.uid, sumWeek(history)])
      )
    )
      .then((pairs) => setWeeklyTotals(Object.fromEntries(pairs)))
      .finally(() => setWeeklyLoading(false));
  }, [view, employees, weekStart]);

  const openEditPanel = async (emp) => {
    setEditingEmployee(emp);
    setEditPunches(null);
    setEditError("");

    const punches = await getAttendanceForDate(emp.uid, selectedDate);
    const inDoc = punches.findLast((p) => p.type === "in");
    const outDoc = punches.findLast((p) => p.type === "out");

    if (!inDoc || !outDoc) {
      setEditPunches("incomplete");
      return;
    }

    setEditPunches({ inDoc, outDoc });
    setEditInTime(toTimeInputValue(inDoc.timestamp.toDate()));
    setEditOutTime(toTimeInputValue(outDoc.timestamp.toDate()));
  };

  const closeEditPanel = () => {
    setEditingEmployee(null);
    setEditPunches(null);
    setEditError("");
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    setEditError("");
    try {
      const newInDate = combineDateAndTime(selectedDate, editInTime);
      const newOutDate = combineDateAndTime(selectedDate, editOutTime);

      if (newOutDate <= newInDate) {
        throw new Error("Punch Out must be after Punch In.");
      }

      await updatePunchTime(editPunches.inDoc.id, newInDate);
      await updatePunchTime(editPunches.outDoc.id, newOutDate);
      await updateDailySummary(editingEmployee.uid, newInDate, newOutDate);
      await refreshDaily();
      closeEditPanel();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="dashboard admin">
      <div className="dashboard-header">
        <div>
          <h1>Welcome, {name ?? user.email.split("@")[0]}</h1>
          <p className="dashboard-date">Admin · All employees</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn-secondary" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="view-toggle">
          <button
            className={view === "daily" ? "active" : ""}
            onClick={() => setView("daily")}
          >
            Daily
          </button>
          <button
            className={view === "weekly" ? "active" : ""}
            onClick={() => setView("weekly")}
          >
            Weekly
          </button>
        </div>

        {view === "daily" && (
          <input
            type="date"
            className="date-picker"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        )}

        {view === "weekly" && (
          <div className="week-nav">
            <button
              className="week-nav-arrow"
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
              aria-label="Previous week"
            >
              ◄
            </button>
            <span className="week-nav-label">
              {formatShortDate(toDateString(weekStart))} – {formatShortDate(toDateString(weekEnd))}
            </span>
            <button
              className="week-nav-arrow"
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
              aria-label="Next week"
            >
              ►
            </button>
          </div>
        )}
      </div>

      {!employeesLoaded ? (
        <p className="empty-history">Loading employees…</p>
      ) : employees.length === 0 ? (
        <p className="empty-history">No employees yet.</p>
      ) : view === "weekly" ? (
        <table className="history-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Reg</th>
              <th>OT</th>
              <th>ND</th>
              <th>Late</th>
              <th>UT</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const totals = weeklyTotals[emp.uid];
              return (
                <tr key={emp.uid}>
                  <td className="employee-cell">
                    <span className="employee-name">{emp.email}</span>
                    <span className="employee-role">{emp.role}</span>
                  </td>
                  <td>{weeklyLoading ? "–" : formatHours(totals?.regularHours)}</td>
                  <td>{weeklyLoading ? "–" : formatHours(totals?.overtimeHours)}</td>
                  <td>{weeklyLoading ? "–" : formatHours(totals?.nightDiffHours)}</td>
                  <td>{weeklyLoading ? "–" : totals?.lateMinutes ?? 0}</td>
                  <td>{weeklyLoading ? "–" : totals?.undertimeMinutes ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Reg</th>
              <th>OT</th>
              <th>ND</th>
              <th>Late</th>
              <th>UT</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const summary = summaries[emp.uid];
              return (
                <tr key={emp.uid}>
                  <td className="employee-cell">
                    <span className="employee-name">{emp.email}</span>
                    <span className="employee-role">{emp.role}</span>
                  </td>
                  <td>{loading ? "–" : formatHours(summary?.regularHours)}</td>
                  <td>{loading ? "–" : formatHours(summary?.overtimeHours)}</td>
                  <td>{loading ? "–" : formatHours(summary?.nightDiffHours)}</td>
                  <td>{loading ? "–" : summary?.lateMinutes ?? 0}</td>
                  <td>{loading ? "–" : summary?.undertimeMinutes ?? "–"}</td>
                  <td>
                    <button className="edit-btn" onClick={() => openEditPanel(emp)}>
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="admin-note">
        ⓘ Edit opens a panel to adjust punch times that recomputes metrics on save.
      </div>

      {editingEmployee && (
        <div className="modal-backdrop" onClick={closeEditPanel}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Edit punches — {editingEmployee.email}</h2>
            <p className="dashboard-date">{formatShortDate(selectedDate)}</p>

            {editPunches === null && <p>Loading…</p>}

            {editPunches === "incomplete" && (
              <p className="edit-error">
                No complete in/out pair found for this day — can't edit yet.
              </p>
            )}

            {editPunches && editPunches !== "incomplete" && (
              <>
                <label className="modal-field">
                  Punch In
                  <input
                    type="time"
                    value={editInTime}
                    onChange={(e) => setEditInTime(e.target.value)}
                  />
                </label>
                <label className="modal-field">
                  Punch Out
                  <input
                    type="time"
                    value={editOutTime}
                    onChange={(e) => setEditOutTime(e.target.value)}
                  />
                </label>

                {editError && <p className="edit-error">{editError}</p>}

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeEditPanel}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={saveEdit} disabled={savingEdit}>
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

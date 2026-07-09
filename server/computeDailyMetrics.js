// Core HCM time computation. This is the single source of truth for metrics —
// it runs here on the server (Node/Express), not in the browser, so the client
// only ever submits raw punch times and receives computed numbers back.
export function computeDailyMetrics(punchIn, punchOut, schedule) {
  // schedule: { start: "09:00", end: "18:00" }
  // punchIn, punchOut: Date objects (punchOut may be null)

  // --- Build schedule.start/end as Date objects on punchIn's day ---
  const [startH, startM] = schedule.start.split(":").map(Number);
  const [endH, endM] = schedule.end.split(":").map(Number);

  const scheduleStart = new Date(punchIn);
  scheduleStart.setHours(startH, startM, 0, 0);

  const scheduleEnd = new Date(punchIn);
  scheduleEnd.setHours(endH, endM, 0, 0);

  // --- Late (computable even without punchOut) ---
  const lateMinutes = punchIn > scheduleStart
    ? Math.floor((punchIn - scheduleStart) / 60000)
    : 0;

  // --- Missing punch-out: bail out early ---
  if (!punchOut) {
    return {
      regularHours: null,
      overtimeHours: null,
      nightDiffHours: null,
      lateMinutes,
      undertimeMinutes: null,
      status: "missing_punch_out",
    };
  }

  // --- Undertime ---
  const undertimeMinutes = punchOut < scheduleEnd
    ? Math.floor((scheduleEnd - punchOut) / 60000)
    : 0;

  // --- Regular hours (capped at scheduled duration) ---
  const scheduledDuration = (scheduleEnd - scheduleStart) / 3600000;
  const actualWorkedHours = (punchOut - punchIn) / 3600000;
  const regularHours = Math.min(actualWorkedHours, scheduledDuration);

  // --- Overtime (only time worked after schedule.end) ---
  const overtimeHours = punchOut > scheduleEnd
    ? (punchOut - scheduleEnd) / 3600000
    : 0;

  // --- Night differential (22:00–06:00, split into two non-wrapping pieces) ---
  const nd1Start = new Date(punchIn);
  nd1Start.setHours(22, 0, 0, 0);

  const nd1End = new Date(punchIn);
  nd1End.setHours(24, 0, 0, 0);

  const nd2Start = new Date(nd1End);

  const nd2End = new Date(nd1End);
  nd2End.setHours(6, 0, 0, 0);

  const overlap1Ms = Math.max(0, Math.min(punchOut, nd1End) - Math.max(punchIn, nd1Start));
  const overlap2Ms = Math.max(0, Math.min(punchOut, nd2End) - Math.max(punchIn, nd2Start));
  const nightDiffHours = (overlap1Ms + overlap2Ms) / 3600000;

  return {
    regularHours,
    overtimeHours,
    nightDiffHours,
    lateMinutes,
    undertimeMinutes,
    status: "complete",
  };
}

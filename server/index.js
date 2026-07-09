// IMPORTANT: pin the process timezone before anything creates a Date.
// computeDailyMetrics uses setHours() to build the schedule/night-diff windows,
// which are interpreted in the process's local timezone. The app assumes
// Asia/Manila, so we force it here — otherwise a UTC server (e.g. Render) would
// compute "09:00" as 9am UTC instead of 9am Manila.
process.env.TZ = "Asia/Manila";

import express from "express";
import cors from "cors";
import { computeDailyMetrics } from "./computeDailyMetrics.js";

const app = express();
app.use(cors());          // allow the React app (different origin) to call this
app.use(express.json());  // parse JSON request bodies

// Health check — handy for uptime pings and confirming a deploy is live.
app.get("/", (req, res) => {
  res.send("Mini HCM compute server is running.");
});

// POST /compute
// Body: { punchIn: ISO string, punchOut: ISO string | null, schedule: {start,end} }
// Returns: { regularHours, overtimeHours, nightDiffHours, lateMinutes, undertimeMinutes, status }
app.post("/compute", (req, res) => {
  const { punchIn, punchOut, schedule } = req.body;

  if (!punchIn || !schedule) {
    return res.status(400).json({ error: "punchIn and schedule are required." });
  }

  const metrics = computeDailyMetrics(
    new Date(punchIn),
    punchOut ? new Date(punchOut) : null,
    schedule
  );

  res.json(metrics);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mini HCM compute server listening on port ${PORT}`);
});

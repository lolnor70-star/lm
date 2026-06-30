const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const LOGS_FILE = path.join(__dirname, "logs_data.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── helpers ──
function readLogs() {
  try { return JSON.parse(fs.readFileSync(LOGS_FILE, "utf8")); }
  catch { return []; }
}
function writeLogs(data) {
  fs.writeFileSync(LOGS_FILE, JSON.stringify(data, null, 2));
}

// ── POST /api/log  — tracker sends events here ──
app.post("/api/log", (req, res) => {
  const event = {
    ...req.body,
    serverIp: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    serverTime: new Date().toISOString(),
  };
  const logs = readLogs();
  // upsert by sessionId
  const idx = logs.findIndex(l => l.sessionId === event.sessionId);
  if (idx >= 0) logs[idx] = event; else logs.unshift(event);
  writeLogs(logs.slice(0, 500)); // keep last 500 sessions
  res.json({ ok: true });
});

// ── GET /api/logs  — dashboard reads here ──
app.get("/api/logs", (req, res) => {
  const logs = readLogs();
  // optional filter
  const { q, device } = req.query;
  let result = logs;
  if (device) result = result.filter(l => l.device?.deviceType === device);
  if (q) {
    const lq = q.toLowerCase();
    result = result.filter(l => JSON.stringify(l).toLowerCase().includes(lq));
  }
  res.json(result);
});

// ── DELETE /api/logs  — clear all ──
app.delete("/api/logs", (req, res) => {
  writeLogs([]);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/logs.html`);
});

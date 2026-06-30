const express        = require("express");
const fs             = require("fs");
const path           = require("path");
const DeviceDetector = require("device-detector-js");

const app      = express();
const PORT     = process.env.PORT || 3000;
const LOGS_FILE = path.join(__dirname, "logs_data.json");
const detector = new DeviceDetector();

// ── CORS ──
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── parse device name server-side using device-detector-js ──
function enrichDevice(session) {
  try {
    const ua = session.device?.userAgent || session.userAgent || "";
    if (!ua) return session;

    const parsed = detector.parse(ua);
    const dev    = parsed.device  || {};
    const os     = parsed.os      || {};
    const client = parsed.client  || {};

    // build a clean device name
    let name = "";
    if (dev.brand && dev.model && dev.model !== "") {
      name = dev.brand + " " + dev.model;
    } else if (dev.brand) {
      name = dev.brand;
    }

    // for iPhone — keep our resolution-based detection if library returns generic
    const isIphone = /iPhone/.test(ua);
    if (isIphone && (!name || name.toLowerCase().includes("apple iphone"))) {
      // library gives "Apple iPhone" generically — keep existing name from client
      // but still fill os/browser from library
    } else if (name) {
      if (session.device) session.device.name = name;
    }

    // always enrich with library's OS + browser (more accurate)
    if (session.device) {
      if (os.name)     session.device.osLib      = os.name + (os.version ? " " + os.version : "");
      if (client.name) session.device.browserLib = client.name + (client.version ? " " + client.version : "");
      if (dev.type)    session.device.deviceTypeLib = dev.type; // smartphone/tablet/desktop
      if (dev.brand)   session.device.brand       = dev.brand;
      if (dev.model && dev.model !== "")   session.device.model = dev.model;
    }
  } catch (e) { /* ignore parse errors */ }
  return session;
}

// ── helpers ──
function readLogs() {
  try { return JSON.parse(fs.readFileSync(LOGS_FILE, "utf8")); }
  catch { return []; }
}
function writeLogs(data) {
  fs.writeFileSync(LOGS_FILE, JSON.stringify(data, null, 2));
}

// ── POST /api/log ──
app.post("/api/log", (req, res) => {
  let session = {
    ...req.body,
    serverIp:   req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    serverTime: new Date().toISOString(),
  };

  session = enrichDevice(session);

  const logs = readLogs();
  const idx  = logs.findIndex(l => l.sessionId === session.sessionId);
  if (idx >= 0) logs[idx] = session; else logs.unshift(session);
  writeLogs(logs.slice(0, 500));
  res.json({ ok: true });
});

// ── GET /api/logs ──
app.get("/api/logs", (req, res) => {
  const logs = readLogs();
  const { q, device } = req.query;
  let result = logs;
  if (device) result = result.filter(l => l.device?.deviceType === device);
  if (q) {
    const lq = q.toLowerCase();
    result = result.filter(l => JSON.stringify(l).toLowerCase().includes(lq));
  }
  res.json(result);
});

// ── DELETE /api/logs ──
app.delete("/api/logs", (req, res) => {
  writeLogs([]);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

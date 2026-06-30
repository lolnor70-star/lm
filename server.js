const express        = require("express");
const fs             = require("fs");
const path           = require("path");
const https          = require("https");
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

    // extract raw model string from UA (Android format): (Linux; Android X; MODEL Build/...)
    let uaModel = "";
    const uaMatch = ua.match(/\(Linux;\s*Android[^;]*;\s*([^)]+?)\s*(?:Build\/[^)]+)?\)/);
    if (uaMatch) uaModel = uaMatch[1].trim();

    // build a clean device name from library
    let name = "";
    if (dev.brand && dev.model && dev.model.trim().length > 1) {
      // library resolved to a meaningful model name
      name = dev.brand + " " + dev.model;
    } else if (dev.brand && dev.brand !== "Apple") {
      // model missing or too short (e.g. "K") — use raw UA model ID instead
      if (uaModel) name = dev.brand + " " + uaModel;
      else name = dev.brand;
    } else if (!dev.brand && uaModel) {
      // no brand from library — use raw UA model string as-is
      name = uaModel;
    }

    // iPhone: library returns generic "Apple iPhone" — keep resolution-based name
    const isIphone = /iPhone/.test(ua);
    if (!isIphone && name) {
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

// ── server-side IP geolocation (no CORS issues) ──
function fetchGeo(ip, cb) {
  // strip port / IPv6 prefix
  const clean = (ip || "").replace(/^::ffff:/, "").split(",")[0].trim();
  if (!clean || clean === "::1" || clean.startsWith("127.") || clean.startsWith("192.168.") || clean.startsWith("10.")) {
    return cb(null); // local/private — skip
  }
  const url = "https://ipinfo.io/" + clean + "/json";
  https.get(url, r => {
    let d = "";
    r.on("data", c => d += c);
    r.on("end", () => {
      try { cb(JSON.parse(d)); } catch { cb(null); }
    });
  }).on("error", () => {
    // fallback: ip-api.com (server-side HTTP is fine)
    const http2 = require("http");
    http2.get("http://ip-api.com/json/" + clean + "?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query", r2 => {
      let d2 = "";
      r2.on("data", c => d2 += c);
      r2.on("end", () => {
        try {
          const j = JSON.parse(d2);
          if (j.status === "success") cb({ ip: j.query, city: j.city, region: j.regionName, country: j.countryCode, countryName: j.country, org: j.isp, timezone: j.timezone, loc: j.lat + "," + j.lon, postal: j.zip, isp: j.isp, asn: j.as, source: "ip-api" });
          else cb(null);
        } catch { cb(null); }
      });
    }).on("error", () => cb(null));
  });
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
  const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  let session = {
    ...req.body,
    serverIp:   rawIp,
    serverTime: new Date().toISOString(),
  };

  session = enrichDevice(session);

  // save immediately so client doesn't wait on geo fetch
  const logs = readLogs();
  const idx  = logs.findIndex(l => l.sessionId === session.sessionId);
  if (idx >= 0) logs[idx] = session; else logs.unshift(session);
  writeLogs(logs.slice(0, 500));
  res.json({ ok: true });

  // enrich geo server-side async — if geoIP fields missing or city is null
  const geo = session.geoIP || {};
  if (!geo.city) {
    const ip = rawIp.split(",")[0].trim();
    fetchGeo(ip, d => {
      if (!d) return;
      const logs2 = readLogs();
      const i2 = logs2.findIndex(l => l.sessionId === session.sessionId);
      if (i2 < 0) return;
      logs2[i2].geoIP = {
        ip:          d.ip || ip,
        city:        d.city        || null,
        region:      d.region      || null,
        country:     d.country     || null,
        countryName: d.countryName || null,
        org:         d.org         || null,
        isp:         d.isp         || null,
        asn:         d.asn         || null,
        timezone:    d.timezone    || null,
        loc:         d.loc         || null,
        postal:      d.postal      || null,
        source:      d.source      || "ipinfo",
      };
      writeLogs(logs2.slice(0, 500));
    });
  }
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

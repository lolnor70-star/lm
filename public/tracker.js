(function () {
  "use strict";

  const SESSION_ID = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const PAGE_LOAD  = Date.now();
  const API        = "/api/log";

  function ts()      { return new Date().toISOString(); }
  function elapsed() { return Math.round((Date.now() - PAGE_LOAD) / 1000) + "s"; }

  /* ─────────────────────────────────────────────
     DEVICE NAME from User-Agent
  ───────────────────────────────────────────── */
  function parseDeviceName(ua) {
    // iPhone model
    let m;
    if ((m = ua.match(/iPhone OS ([\d_]+)/))) {
      const ver = m[1].replace(/_/g,".");
      const models = {
        "18":"iPhone 16","17":"iPhone 15","16":"iPhone 14",
        "15":"iPhone 13","14":"iPhone 12","13":"iPhone 11",
        "12":"iPhone X/XS/XR","11":"iPhone 8/X"
      };
      const major = ver.split(".")[0];
      return "Apple " + (models[major] || "iPhone (iOS " + ver + ")");
    }
    // iPad
    if ((m = ua.match(/iPad.*OS ([\d_]+)/)))
      return "Apple iPad (iPadOS " + m[1].replace(/_/g,".") + ")";
    // Samsung
    if ((m = ua.match(/Samsung|SM-[A-Z0-9]+/i))) {
      const model = (ua.match(/SM-([A-Z0-9]+)/i) || [])[1];
      return "Samsung" + (model ? " SM-" + model : "");
    }
    // Xiaomi / Redmi / POCO
    if ((m = ua.match(/Xiaomi|Redmi|POCO\s*([\w\s]+)?/i)))
      return "Xiaomi / " + (m[1] || "Redmi");
    // Huawei
    if ((m = ua.match(/Huawei[_ ]([\w-]+)/i))) return "Huawei " + m[1];
    // OnePlus
    if ((m = ua.match(/OnePlus([\w ]+)/i))) return "OnePlus " + (m[1]||"").trim();
    // OPPO
    if ((m = ua.match(/OPPO ([\w-]+)/i))) return "OPPO " + m[1];
    // Vivo
    if ((m = ua.match(/vivo ([\w-]+)/i))) return "Vivo " + m[1];
    // Google Pixel
    if ((m = ua.match(/Pixel\s?([\w]+)/i))) return "Google Pixel " + m[1];
    // Android generic
    if ((m = ua.match(/Android[\s\d.]+;\s*([^)]+)\)/))) return m[1].trim();
    // Windows PC
    if (/Windows NT 10/.test(ua)) return "Windows 10/11 PC";
    if (/Windows NT 6\.3/.test(ua)) return "Windows 8.1 PC";
    if (/Windows NT 6\.1/.test(ua)) return "Windows 7 PC";
    // Mac
    if ((m = ua.match(/Mac OS X ([\d_]+)/))) return "Apple Mac (macOS " + m[1].replace(/_/g,".") + ")";
    // Linux
    if (/Linux/.test(ua)) return "Linux PC";
    return "Unknown Device";
  }

  function parseOS(ua) {
    if (/Windows NT 10/.test(ua))      return "Windows 10/11";
    if (/Windows NT 6\.3/.test(ua))    return "Windows 8.1";
    if (/Windows NT 6\.1/.test(ua))    return "Windows 7";
    if (/Mac OS X ([\d_]+)/.test(ua))  return "macOS " + ua.match(/Mac OS X ([\d_]+)/)[1].replace(/_/g,".");
    if (/Android ([\d.]+)/.test(ua))   return "Android " + ua.match(/Android ([\d.]+)/)[1];
    if (/iPhone OS ([\d_]+)/.test(ua)) return "iOS " + ua.match(/iPhone OS ([\d_]+)/)[1].replace(/_/g,".");
    if (/iPad.*OS ([\d_]+)/.test(ua))  return "iPadOS " + ua.match(/iPad.*OS ([\d_]+)/)[1].replace(/_/g,".");
    if (/Linux/.test(ua))              return "Linux";
    return "Unknown OS";
  }

  function parseBrowser(ua) {
    if (/Edg\//.test(ua))     return "Microsoft Edge";
    if (/OPR\//.test(ua))     return "Opera";
    if (/YaBrowser/.test(ua)) return "Yandex Browser";
    if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
    if (/MIUI Browser/.test(ua))  return "Xiaomi Browser";
    if (/UCBrowser/.test(ua))     return "UC Browser";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Chrome\//.test(ua))  return "Chrome";
    if (/Safari\//.test(ua))  return "Safari";
    return "Unknown Browser";
  }

  function parseBrowserVersion(ua) {
    let m;
    if ((m = ua.match(/Edg\/([\d.]+)/)))          return m[1];
    if ((m = ua.match(/OPR\/([\d.]+)/)))           return m[1];
    if ((m = ua.match(/Firefox\/([\d.]+)/)))       return m[1];
    if ((m = ua.match(/SamsungBrowser\/([\d.]+)/)))return m[1];
    if ((m = ua.match(/Chrome\/([\d.]+)/)))        return m[1];
    if ((m = ua.match(/Version\/([\d.]+).*Safari/)))return m[1];
    return "?";
  }

  /* ─────────────────────────────────────────────
     GPU via WebGL
  ───────────────────────────────────────────── */
  function getGPU() {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return { vendor: "N/A", renderer: "N/A" };
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext
        ? { vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
            renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) }
        : { vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER) };
    } catch { return { vendor: "error", renderer: "error" }; }
  }

  /* ─────────────────────────────────────────────
     Canvas fingerprint (unique per device/browser)
  ───────────────────────────────────────────── */
  function canvasFingerprint() {
    try {
      const c = document.createElement("canvas");
      c.width = 200; c.height = 50;
      const ctx = c.getContext("2d");
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Fingerprint 🔍", 2, 15);
      ctx.fillStyle = "rgba(102,204,0,0.7)";
      ctx.fillText("Fingerprint 🔍", 4, 17);
      return c.toDataURL().slice(-50); // last 50 chars enough as ID
    } catch { return "N/A"; }
  }

  /* ─────────────────────────────────────────────
     Audio context fingerprint
  ───────────────────────────────────────────── */
  function audioFingerprint(cb) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return cb("N/A");
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const anal = ctx.createAnalyser();
      const gain = ctx.createGain();
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      gain.gain.value = 0;
      osc.connect(anal); anal.connect(proc); proc.connect(gain); gain.connect(ctx.destination);
      proc.onaudioprocess = function(e) {
        const data = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);
        cb(sum.toString().slice(0, 16));
        osc.stop(); ctx.close().catch(()=>{});
        proc.disconnect(); osc.disconnect();
      };
      osc.start(0);
    } catch { cb("N/A"); }
  }

  /* ─────────────────────────────────────────────
     WebRTC local IP leak
  ───────────────────────────────────────────── */
  function getLocalIP(cb) {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("");
      pc.createOffer().then(o => pc.setLocalDescription(o));
      const ips = [];
      pc.onicecandidate = e => {
        if (!e || !e.candidate) { cb([...new Set(ips)]); pc.close(); return; }
        const m = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/g);
        if (m) m.forEach(ip => { if (ip !== "0.0.0.0") ips.push(ip); });
      };
      setTimeout(() => { cb([...new Set(ips)]); try { pc.close(); } catch {} }, 1500);
    } catch { cb([]); }
  }

  /* ─────────────────────────────────────────────
     Media devices (camera / mic count)
  ───────────────────────────────────────────── */
  function getMediaDevices(cb) {
    if (!navigator.mediaDevices?.enumerateDevices)
      return cb({ cameras: "N/A", microphones: "N/A", speakers: "N/A" });
    navigator.mediaDevices.enumerateDevices().then(devs => {
      cb({
        cameras:      devs.filter(d => d.kind === "videoinput").length,
        microphones:  devs.filter(d => d.kind === "audioinput").length,
        speakers:     devs.filter(d => d.kind === "audiooutput").length,
      });
    }).catch(() => cb({ cameras:"err", microphones:"err", speakers:"err" }));
  }

  /* ─────────────────────────────────────────────
     Network info
  ───────────────────────────────────────────── */
  function getNetwork() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return { type: "N/A", effectiveType: "N/A", downlink: "N/A", rtt: "N/A", saveData: "N/A" };
    return {
      type:          conn.type          || "N/A",
      effectiveType: conn.effectiveType || "N/A",
      downlink:      conn.downlink      != null ? conn.downlink + " Mbps" : "N/A",
      rtt:           conn.rtt           != null ? conn.rtt + " ms"        : "N/A",
      saveData:      conn.saveData      || false,
    };
  }

  /* ─────────────────────────────────────────────
     Build full device object
  ───────────────────────────────────────────── */
  const ua  = navigator.userAgent;
  const gpu = getGPU();

  const device = {
    // Identity
    name:           parseDeviceName(ua),
    os:             parseOS(ua),
    browser:        parseBrowser(ua),
    browserVersion: parseBrowserVersion(ua),
    deviceType:     /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
    platform:       navigator.platform || "N/A",
    userAgent:      ua,

    // Screen & Display
    screenWidth:    screen.width,
    screenHeight:   screen.height,
    screenRes:      screen.width + "x" + screen.height,
    viewportWidth:  window.innerWidth,
    viewportHeight: window.innerHeight,
    colorDepth:     screen.colorDepth + " bit",
    pixelRatio:     window.devicePixelRatio || 1,
    orientation:    screen.orientation?.type || (window.innerWidth > window.innerHeight ? "landscape" : "portrait"),

    // Hardware
    cpuCores:       navigator.hardwareConcurrency || "N/A",
    ramGB:          navigator.deviceMemory        || "N/A",
    maxTouchPoints: navigator.maxTouchPoints      || 0,
    touchSupport:   "ontouchstart" in window,

    // GPU
    gpuVendor:      gpu.vendor,
    gpuRenderer:    gpu.renderer,

    // Language & Region
    language:       navigator.language,
    languages:      (navigator.languages || []).join(", "),
    timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset() + " min",

    // Features
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack:     navigator.doNotTrack || "N/A",
    onLine:         navigator.onLine,
    javaEnabled:    navigator.javaEnabled?.() || false,
    pdfViewerEnabled: navigator.pdfViewerEnabled || "N/A",

    // Fingerprints (filled async below)
    canvasFingerprint: canvasFingerprint(),
    audioFingerprint:  "pending",
    localIPs:          [],

    // Media
    cameras:        "pending",
    microphones:    "pending",
    speakers:       "pending",

    // Network
    network: getNetwork(),

    // Battery (filled async)
    battery: { level: "N/A", charging: "N/A", chargingTime: "N/A", dischargingTime: "N/A" },
  };

  /* ─────────────────────────────────────────────
     Session object
  ───────────────────────────────────────────── */
  const session = {
    sessionId:   SESSION_ID,
    startedAt:   ts(),
    page:        location.href,
    referrer:    document.referrer || "direct",
    device,
    geoIP:       { ip: null, city: null, country: null, region: null, org: null, timezone: null, loc: null },
    gps:         { granted: null, lat: null, lon: null, accuracy: null, altitude: null, mapsLink: null },
    scrollDepth: 0,
    timeOnPage:  0,
    interests:   {},
    events:      [],
  };

  /* ─────────────────────────────────────────────
     Push to backend
  ───────────────────────────────────────────── */
  function push() {
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
      keepalive: true,
    }).catch(() => {});
  }

  function logEvent(type, data) {
    session.events.push({ type, time: ts(), elapsed: elapsed(), ...data });
    push();
  }

  /* ─────────────────────────────────────────────
     Async enrichments
  ───────────────────────────────────────────── */

  // Battery
  if (navigator.getBattery) {
    navigator.getBattery().then(b => {
      session.device.battery = {
        level:           Math.round(b.level * 100) + "%",
        charging:        b.charging,
        chargingTime:    b.chargingTime    === Infinity ? "N/A" : b.chargingTime + "s",
        dischargingTime: b.dischargingTime === Infinity ? "N/A" : b.dischargingTime + "s",
      };
      logEvent("battery", session.device.battery);
    }).catch(() => {});
  }

  // Audio fingerprint
  audioFingerprint(fp => {
    session.device.audioFingerprint = fp;
    push();
  });

  // Local IPs via WebRTC
  getLocalIP(ips => {
    session.device.localIPs = ips;
    if (ips.length) logEvent("local_ips", { ips });
    else push();
  });

  // Media devices
  getMediaDevices(info => {
    session.device.cameras      = info.cameras;
    session.device.microphones  = info.microphones;
    session.device.speakers     = info.speakers;
    push();
  });

  // IP + geo
  fetch("https://ipinfo.io/json")
    .then(r => r.json())
    .then(d => {
      Object.assign(session.geoIP, {
        ip: d.ip, city: d.city, country: d.country,
        region: d.region, org: d.org,
        timezone: d.timezone, loc: d.loc,
      });
      logEvent("ip_resolved", {
        ip: d.ip, city: d.city, country: d.country,
        region: d.region, org: d.org, loc: d.loc,
      });
    })
    .catch(() => {
      fetch("https://cloudflare.com/cdn-cgi/trace")
        .then(r => r.text())
        .then(t => {
          const ip = (t.match(/ip=(.+)/) || [])[1] || null;
          session.geoIP.ip = ip;
          logEvent("ip_resolved", { ip });
        }).catch(() => {});
    });

  // GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      p => {
        Object.assign(session.gps, {
          granted: true,
          lat:      p.coords.latitude,
          lon:      p.coords.longitude,
          accuracy: Math.round(p.coords.accuracy) + "m",
          altitude: p.coords.altitude ? Math.round(p.coords.altitude) + "m" : "N/A",
          mapsLink: `https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}`,
        });
        logEvent("gps_granted", session.gps);
      },
      e => { session.gps.granted = false; logEvent("gps_denied", { reason: e.message }); },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  /* ─────────────────────────────────────────────
     Event tracking
  ───────────────────────────────────────────── */

  // Clicks
  document.addEventListener("click", e => {
    const el = e.target;
    const tracked = el.closest("[data-track]");
    const trackId = tracked?.getAttribute("data-track") || null;
    if (trackId) session.interests[trackId] = (session.interests[trackId] || 0) + 1;
    logEvent("click", {
      trackId,
      tag:  el.tagName,
      text: (el.innerText || "").trim().slice(0, 60),
      x: e.clientX, y: e.clientY,
      xPct: Math.round(e.clientX / window.innerWidth  * 100) + "%",
      yPct: Math.round(e.clientY / window.innerHeight * 100) + "%",
      href:    el.closest("a")?.href || null,
      section: (function(el){
        if (el.closest("header"))        return "header";
        if (el.closest(".breaking-bar")) return "breaking";
        if (el.closest(".article-body")) return "article";
        if (el.closest(".sidebar"))      return "sidebar";
        if (el.closest("footer"))        return "footer";
        return "other";
      })(el),
    });
  });

  // Scroll milestones
  let maxScroll = 0;
  window.addEventListener("scroll", () => {
    const d   = document.documentElement;
    const pct = Math.round((d.scrollTop + window.innerHeight) / d.scrollHeight * 100);
    if (pct > maxScroll) {
      maxScroll = pct;
      session.scrollDepth = pct;
      if ([25, 50, 75, 90, 100].includes(pct))
        logEvent("scroll", { depth: pct + "%" });
    }
  }, { passive: true });

  // Heartbeat
  setInterval(() => {
    session.timeOnPage = Math.round((Date.now() - PAGE_LOAD) / 1000);
    push();
  }, 20000);

  // Text selected
  document.addEventListener("mouseup", () => {
    const txt = (window.getSelection()?.toString() || "").trim();
    if (txt.length > 10) logEvent("text_selected", { text: txt.slice(0, 120) });
  });

  // Tab visibility
  document.addEventListener("visibilitychange", () =>
    logEvent("visibility", { state: document.visibilityState })
  );

  // Idle
  let idleT;
  const resetIdle = () => {
    clearTimeout(idleT);
    idleT = setTimeout(() => logEvent("idle", {}), 30000);
  };
  ["mousemove","keydown","scroll","touchstart"].forEach(ev =>
    window.addEventListener(ev, resetIdle, { passive: true })
  );

  // Page leave
  window.addEventListener("beforeunload", () => {
    session.timeOnPage = Math.round((Date.now() - PAGE_LOAD) / 1000);
    logEvent("page_leave", {
      timeOnPage:  session.timeOnPage + "s",
      scrollDepth: session.scrollDepth + "%",
    });
  });

  // Orientation change
  window.addEventListener("orientationchange", () => {
    session.device.orientation = screen.orientation?.type || "changed";
    logEvent("orientation_change", { orientation: session.device.orientation });
  });

  // Initial page view
  logEvent("page_view", {
    title:      document.title,
    deviceName: device.name,
    os:         device.os,
    browser:    device.browser + " " + device.browserVersion,
    deviceType: device.deviceType,
    screen:     device.screenRes,
    cpu:        device.cpuCores + " cores",
    ram:        device.ramGB + " GB",
    gpu:        device.gpuRenderer,
  });

})();

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
  function parseDeviceName(ua, w, h, ratio) {
    let m;
    if ((m = ua.match(/iPhone OS ([\d_]+)/))) {
      const ios    = m[1].replace(/_/g, ".");
      const iosMaj = parseInt(ios.split(".")[0]);
      const r      = Math.round(ratio || 1);
      const key    = w + "x" + h + "@" + r;

      /*  key = logicalW x logicalH @ pixelRatio
          Multiple models can share the same key — we narrow by iOS version when possible.
          Format: [mostLikely, fallback]  */
      const map = {
        /* ── SE / small ── */
        "320x568@2": "iPhone SE (1st gen) / 5S",
        "375x667@2": iosMaj >= 15 ? "iPhone SE (3rd gen) / 8 / 7"
                   : iosMaj >= 13 ? "iPhone SE (2nd gen) / 8 / 7"
                   : "iPhone 8 / 7 / 6S / 6",

        /* ── X family (375x812 @3) ── */
        "375x812@3": iosMaj >= 15 ? "iPhone 13 mini / 12 mini"
                   : iosMaj >= 14 ? "iPhone 12 mini / 11 Pro / XS"
                   : "iPhone 11 Pro / XS / X",

        /* ── iPhone 11 / XR (414x896 @2) ── */
        "414x896@2": "iPhone 11 / XR",

        /* ── XS Max / 11 Pro Max (414x896 @3) ── */
        "414x896@3": iosMaj >= 14 ? "iPhone 11 Pro Max"
                   : "iPhone XS Max / 11 Pro Max",

        /* ── Plus old (414x736 @3) ── */
        "414x736@3": "iPhone 8 Plus / 7 Plus / 6S Plus",

        /* ── iPhone 12/13/14 standard (390x844 @3) ── */
        "390x844@3": iosMaj >= 16 ? "iPhone 14 / 13 / 12"
                   : iosMaj >= 15 ? "iPhone 13 / 12"
                   : "iPhone 12",

        /* ── Pro 12/13/14 share same logical size as standard — can't distinguish ── */

        /* ── 12 PM / 13 PM / 14 Plus (428x926 @3) ── */
        "428x926@3": iosMaj >= 16 ? "iPhone 14 Plus / 13 Pro Max"
                   : iosMaj >= 15 ? "iPhone 13 Pro Max / 12 Pro Max"
                   : "iPhone 12 Pro Max",

        /* ── iPhone 15 / 15 Pro / 16 (393x852 @3) ── */
        "393x852@3": iosMaj >= 18 ? "iPhone 16 / 15 Pro / 15"
                   : "iPhone 15 Pro / 15",

        /* ── iPhone 15 Plus / 16 Plus (430x932 @3) ── */
        "430x932@3": iosMaj >= 18 ? "iPhone 16 Plus / 15 Plus"
                   : "iPhone 15 Plus",

        /* ── iPhone 16 Pro (402x874 @3) ── */
        "402x874@3": "iPhone 16 Pro",

        /* ── iPhone 16 Pro Max (440x956 @3) ── */
        "440x956@3": "iPhone 16 Pro Max",
      };

      const model = map[key] || ("iPhone (iOS " + ios + ", " + w + "x" + h + ")");
      return "Apple " + model + " (iOS " + ios + ")";
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
    name:           parseDeviceName(ua, screen.width, screen.height, window.devicePixelRatio),
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

  // ── IP geolocation — client-side (server also enriches server-side as backup) ──
  function resolveIP() {
    // Service 1: ipinfo.io (HTTPS, free)
    fetch("https://ipinfo.io/json")
      .then(r => r.json())
      .then(d => {
        Object.assign(session.geoIP, {
          ip: d.ip, city: d.city, country: d.country,
          region: d.region, org: d.org,
          timezone: d.timezone, loc: d.loc,
          postal: d.postal || null,
          source: "ipinfo",
        });
        logEvent("ip_resolved", session.geoIP);
      })
      .catch(() => {
        // Service 2: ipapi.co (HTTPS, free, no mixed-content issue)
        fetch("https://ipapi.co/json/")
          .then(r => r.json())
          .then(d => {
            if (d.ip) {
              Object.assign(session.geoIP, {
                ip: d.ip, city: d.city, country: d.country_code,
                countryName: d.country_name, region: d.region,
                org: d.org, timezone: d.timezone,
                loc: d.latitude + "," + d.longitude,
                postal: d.postal || null,
                isp: d.org, asn: d.asn,
                source: "ipapi.co",
              });
              logEvent("ip_resolved", session.geoIP);
            }
          })
          .catch(() => {
            // Service 3: Cloudflare trace (HTTPS, minimal fallback)
            fetch("https://cloudflare.com/cdn-cgi/trace")
              .then(r => r.text())
              .then(t => {
                const get = k => (t.match(new RegExp(k + "=(.+)")) || [])[1] || null;
                Object.assign(session.geoIP, {
                  ip: get("ip"), country: get("loc"), source: "cloudflare",
                });
                logEvent("ip_resolved", session.geoIP);
              }).catch(() => {});
          });
      });
  }
  resolveIP();

  // ── Reverse geocoding: coords → human address ──
  function reverseGeocode(lat, lon) {
    fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lon + "&zoom=18&addressdetails=1")
      .then(r => r.json())
      .then(d => {
        if (d && d.address) {
          const a = d.address;
          session.gps.address = {
            road:         a.road || a.pedestrian || a.footway || null,
            suburb:       a.suburb || a.neighbourhood || null,
            city:         a.city || a.town || a.village || null,
            state:        a.state || null,
            country:      a.country || null,
            countryCode:  a.country_code ? a.country_code.toUpperCase() : null,
            postcode:     a.postcode || null,
            displayName:  d.display_name || null,
          };
          logEvent("gps_address", session.gps.address);
        }
      }).catch(() => {});
  }

  // ── GPS — full handler ──
  var _gpsWatchId = null;

  function handleGPSPosition(p) {
    const c = p.coords;
    Object.assign(session.gps, {
      granted:           true,
      lat:               c.latitude,
      lon:               c.longitude,
      accuracy:          Math.round(c.accuracy) + "m",
      altitude:          c.altitude != null ? Math.round(c.altitude) + "m" : "N/A",
      altitudeAccuracy:  c.altitudeAccuracy != null ? Math.round(c.altitudeAccuracy) + "m" : "N/A",
      heading:           c.heading != null ? Math.round(c.heading) + "°" : "N/A",
      speed:             c.speed != null ? (c.speed * 3.6).toFixed(1) + " km/h" : "N/A",
      timestamp:         new Date(p.timestamp).toISOString(),
      mapsLink:          "https://maps.google.com/?q=" + c.latitude + "," + c.longitude,
    });
    logEvent("gps_granted", session.gps);
    reverseGeocode(c.latitude, c.longitude);

    // start watching for position changes (movement tracking)
    if (!_gpsWatchId && navigator.geolocation) {
      _gpsWatchId = navigator.geolocation.watchPosition(
        function(wp) {
          const wc = wp.coords;
          session.gps.lat      = wc.latitude;
          session.gps.lon      = wc.longitude;
          session.gps.accuracy = Math.round(wc.accuracy) + "m";
          session.gps.heading  = wc.heading != null ? Math.round(wc.heading) + "°" : session.gps.heading;
          session.gps.speed    = wc.speed != null ? (wc.speed * 3.6).toFixed(1) + " km/h" : session.gps.speed;
          session.gps.mapsLink = "https://maps.google.com/?q=" + wc.latitude + "," + wc.longitude;
          logEvent("gps_updated", { lat: wc.latitude, lon: wc.longitude, accuracy: session.gps.accuracy, speed: session.gps.speed });
          reverseGeocode(wc.latitude, wc.longitude);
        },
        function() {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    }
  }

  // expose so banner button can call it after permission granted
  window.__tracker_gps_cb = handleGPSPosition;

  // try silently on load (works if already granted)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      handleGPSPosition,
      function(e) { session.gps.granted = false; logEvent("gps_denied", { reason: e.message }); },
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

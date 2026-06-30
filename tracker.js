/*  tracker.js — full user analytics logger
    Stores everything in localStorage under key "news_logs"
    Each session = one entry with: session info, events array, summary
*/

(function () {
  "use strict";

  const STORAGE_KEY = "news_logs";
  const SESSION_ID = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const PAGE_LOAD_TIME = Date.now();

  /* ── helpers ── */
  function ts() { return new Date().toISOString(); }
  function sinceLoad() { return Math.round((Date.now() - PAGE_LOAD_TIME) / 1000) + "s"; }

  function saveSession(session) {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const idx = all.findIndex(s => s.sessionId === session.sessionId);
      if (idx >= 0) all[idx] = session; else all.unshift(session);
      // keep last 100 sessions only
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 100)));
    } catch (e) { /* storage full — ignore */ }
  }

  /* ── build session object ── */
  const session = {
    sessionId: SESSION_ID,
    startedAt: ts(),
    page: location.href,
    referrer: document.referrer || "direct",
    device: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screen: screen.width + "x" + screen.height,
      viewport: window.innerWidth + "x" + window.innerHeight,
      deviceType: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop",
      os: (function () {
        const ua = navigator.userAgent;
        if (/Windows NT 10/.test(ua)) return "Windows 10/11";
        if (/Windows NT 6/.test(ua)) return "Windows 7/8";
        if (/Mac OS X/.test(ua)) return "macOS";
        if (/Android/.test(ua)) return "Android";
        if (/iPhone|iPad/.test(ua)) return "iOS";
        if (/Linux/.test(ua)) return "Linux";
        return "Unknown";
      })(),
      browser: (function () {
        const ua = navigator.userAgent;
        if (/Edg\//.test(ua)) return "Edge";
        if (/OPR\//.test(ua)) return "Opera";
        if (/Chrome\//.test(ua)) return "Chrome";
        if (/Firefox\//.test(ua)) return "Firefox";
        if (/Safari\//.test(ua)) return "Safari";
        return "Unknown";
      })(),
      touchSupport: "ontouchstart" in window,
      cookiesEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    },
    network: { ip: null, city: null, country: null, org: null, timezone: null },
    location: { granted: false, lat: null, lon: null, accuracy: null },
    scrollDepth: 0,
    timeOnPage: 0,
    events: [],
    interests: {},
    summary: {}
  };

  /* ── log event ── */
  function logEvent(type, data) {
    session.events.push({ type, time: ts(), sinceLoad: sinceLoad(), ...data });
    saveSession(session);
  }

  /* ── IP + geo (via ipinfo.io free tier) ── */
  fetch("https://ipinfo.io/json?token=")
    .then(r => r.json())
    .then(d => {
      session.network.ip       = d.ip       || null;
      session.network.city     = d.city     || null;
      session.network.country  = d.country  || null;
      session.network.org      = d.org      || null;
      session.network.timezone = d.timezone || null;
      logEvent("ip_resolved", { ip: d.ip, city: d.city, country: d.country, org: d.org });
    })
    .catch(() => {
      // fallback: try cloudflare trace
      fetch("https://cloudflare.com/cdn-cgi/trace")
        .then(r => r.text())
        .then(txt => {
          const ip = (txt.match(/ip=(.+)/) || [])[1] || "unknown";
          session.network.ip = ip;
          logEvent("ip_resolved_cf", { ip });
        }).catch(() => {});
    });

  /* ── GPS location (asks user permission) ── */
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        session.location.granted  = true;
        session.location.lat      = pos.coords.latitude;
        session.location.lon      = pos.coords.longitude;
        session.location.accuracy = Math.round(pos.coords.accuracy) + "m";
        logEvent("gps_location", {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: session.location.accuracy,
          mapsLink: `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`
        });
      },
      err => {
        session.location.granted = false;
        logEvent("gps_denied", { reason: err.message });
      },
      { timeout: 8000 }
    );
  }

  /* ── click tracking ── */
  document.addEventListener("click", function (e) {
    const target = e.target;
    const trackId = target.closest("[data-track]")
      ? target.closest("[data-track]").getAttribute("data-track")
      : null;

    const tag = trackId || target.tagName.toLowerCase();

    // count interest by category
    if (trackId) {
      session.interests[trackId] = (session.interests[trackId] || 0) + 1;
    }

    logEvent("click", {
      trackId,
      tag: target.tagName,
      text: (target.innerText || target.textContent || "").trim().slice(0, 60),
      x: e.clientX,
      y: e.clientY,
      xPercent: Math.round((e.clientX / window.innerWidth) * 100) + "%",
      yPercent: Math.round((e.clientY / window.innerHeight) * 100) + "%",
      href: target.closest("a") ? target.closest("a").href : null,
      section: getSection(target)
    });
  });

  /* find which section was clicked */
  function getSection(el) {
    if (el.closest("header")) return "header";
    if (el.closest(".breaking-bar")) return "breaking";
    if (el.closest(".article-body")) return "article";
    if (el.closest(".sidebar")) return "sidebar";
    if (el.closest("footer")) return "footer";
    return "other";
  }

  /* ── scroll depth ── */
  let maxScroll = 0;
  window.addEventListener("scroll", function () {
    const doc = document.documentElement;
    const scrolled = doc.scrollTop + window.innerHeight;
    const total = doc.scrollHeight;
    const pct = Math.round((scrolled / total) * 100);
    if (pct > maxScroll) {
      maxScroll = pct;
      session.scrollDepth = pct;
      // log milestones
      if ([25, 50, 75, 90, 100].includes(pct)) {
        logEvent("scroll_milestone", { depth: pct + "%" });
      }
    }
  });

  /* ── time on page (update every 15s) ── */
  setInterval(function () {
    session.timeOnPage = Math.round((Date.now() - PAGE_LOAD_TIME) / 1000);
    saveSession(session);
  }, 15000);

  /* ── visibility change (tab switch / minimize) ── */
  document.addEventListener("visibilitychange", function () {
    logEvent("visibility", { state: document.visibilityState });
  });

  /* ── copy event (user copied text) ── */
  document.addEventListener("copy", function () {
    const sel = window.getSelection();
    logEvent("text_copied", {
      text: sel ? sel.toString().slice(0, 120) : ""
    });
  });

  /* ── mouse idle detection ── */
  let idleTimer;
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => logEvent("idle", { after: "30s" }), 30000);
  }
  ["mousemove", "keydown", "touchstart", "scroll"].forEach(ev =>
    window.addEventListener(ev, resetIdle, { passive: true })
  );

  /* ── text selection ── */
  document.addEventListener("mouseup", function () {
    const sel = window.getSelection();
    const txt = sel ? sel.toString().trim() : "";
    if (txt.length > 10) {
      logEvent("text_selected", { text: txt.slice(0, 120) });
    }
  });

  /* ── page leave ── */
  window.addEventListener("beforeunload", function () {
    session.timeOnPage = Math.round((Date.now() - PAGE_LOAD_TIME) / 1000);
    session.summary = {
      totalClicks: session.events.filter(e => e.type === "click").length,
      scrollDepth: session.scrollDepth + "%",
      timeOnPage: session.timeOnPage + "s",
      topInterests: Object.entries(session.interests)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([k, v]) => k + " (" + v + "x)").join(", "),
      deviceType: session.device.deviceType,
      browser: session.device.browser,
      os: session.device.os
    };
    saveSession(session);
  });

  /* ── initial page load event ── */
  logEvent("page_view", {
    title: document.title,
    referrer: document.referrer || "direct",
    deviceType: session.device.deviceType,
    browser: session.device.browser,
    os: session.device.os,
    screen: session.device.screen
  });

})();

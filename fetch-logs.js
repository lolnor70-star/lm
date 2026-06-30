const https  = require("https");
const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const { exec } = require("child_process");

const RAILWAY = "https://lm-production-b297.up.railway.app";
const PORT    = 4000;

/* ── fix iPhone model using screen size ── */
function fixDeviceName(dev) {
  if (!dev?.userAgent) return dev;
  const m = dev.userAgent.match(/iPhone OS ([\d_]+)/);
  if (!m) return dev;
  const ios    = m[1].replace(/_/g, ".");
  const iosMaj = parseInt(ios.split(".")[0]);
  const w = dev.screenWidth, h = dev.screenHeight;
  const r = Math.round(dev.pixelRatio || 1);
  const key = w + "x" + h + "@" + r;
  const map = {
    "320x568@2": "iPhone SE (1st gen) / 5S",
    "375x667@2": iosMaj >= 15 ? "iPhone SE (3rd gen) / 8 / 7"
               : iosMaj >= 13 ? "iPhone SE (2nd gen) / 8 / 7"
               : "iPhone 8 / 7 / 6S / 6",
    "375x812@3": iosMaj >= 15 ? "iPhone 13 mini / 12 mini"
               : iosMaj >= 14 ? "iPhone 12 mini / 11 Pro / XS"
               : "iPhone 11 Pro / XS / X",
    "414x896@2": "iPhone 11 / XR",
    "414x896@3": iosMaj >= 14 ? "iPhone 11 Pro Max" : "iPhone XS Max / 11 Pro Max",
    "414x736@3": "iPhone 8 Plus / 7 Plus / 6S Plus",
    "390x844@3": iosMaj >= 16 ? "iPhone 14 / 13 / 12" : iosMaj >= 15 ? "iPhone 13 / 12" : "iPhone 12",
    "428x926@3": iosMaj >= 16 ? "iPhone 14 Plus / 13 Pro Max"
               : iosMaj >= 15 ? "iPhone 13 Pro Max / 12 Pro Max" : "iPhone 12 Pro Max",
    "393x852@3": iosMaj >= 18 ? "iPhone 16 / 15 Pro / 15" : "iPhone 15 Pro / 15",
    "430x932@3": iosMaj >= 18 ? "iPhone 16 Plus / 15 Plus" : "iPhone 15 Plus",
    "402x874@3": "iPhone 16 Pro",
    "440x956@3": "iPhone 16 Pro Max",
  };
  dev.name = "Apple " + (map[key] || ("iPhone " + w + "x" + h)) + " (iOS " + ios + ")";
  return dev;
}

/* ── fetch from Railway ── */
function fetchRailway(path, method = "GET", cb) {
  const url = new URL(RAILWAY + path);
  const opts = { hostname: url.hostname, path: url.pathname + url.search, method };
  https.request(opts, r => {
    let d = "";
    r.on("data", c => d += c);
    r.on("end", () => cb(null, d, r.statusCode));
  }).on("error", e => cb(e)).end();
}

/* ── local proxy server ── */
const server = http.createServer((req, res) => {
  const url = req.url;

  // ── serve the dashboard HTML ──
  if (url === "/" || url === "/index.html") {
    fetchRailway("/api/logs", "GET", (err, data) => {
      if (err) { res.writeHead(502); res.end("Railway unreachable: " + err.message); return; }
      try {
        const logs = JSON.parse(data).map(s => { s.device = fixDeviceName(s.device); return s; });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(buildHTML(logs));
      } catch(e) { res.writeHead(500); res.end(e.message); }
    });
    return;
  }

  // ── proxy GET /api/logs ──
  if (url.startsWith("/api/logs") && req.method === "GET") {
    fetchRailway("/api/logs", "GET", (err, data, status) => {
      if (err) { res.writeHead(502); res.end("{}"); return; }
      try {
        const logs = JSON.parse(data).map(s => { s.device = fixDeviceName(s.device); return s; });
        res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(logs));
      } catch(e) { res.writeHead(500); res.end("[]"); }
    });
    return;
  }

  // ── proxy DELETE /api/logs ──
  if (url === "/api/logs" && req.method === "DELETE") {
    fetchRailway("/api/logs", "DELETE", (err, data, status) => {
      res.writeHead(err ? 502 : status, { "Content-Type": "application/json" });
      res.end(err ? '{"ok":false}' : data);
    });
    return;
  }

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n✓ Logs viewer running at ${url}`);
  console.log("  Press Ctrl+C to stop.\n");
  exec(`start "" "${url}"`);
});

/* ── build full dashboard HTML ── */
function buildHTML(logs) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Tracker Logs</title>
  <style>
    :root{--bg:#0f0f1a;--card:#1a1a2e;--acc:#e74c3c;--green:#2ecc71;--blue:#3498db;--txt:#e0e0e0;--muted:#777;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:var(--bg);color:var(--txt);font-family:"Consolas","Courier New",monospace;font-size:13px;}
    header{background:var(--card);border-bottom:2px solid var(--acc);padding:13px 20px;
           display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}
    header h1{font-size:17px;color:var(--acc);}
    .hbtns{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
    button{background:var(--card);color:var(--txt);border:1px solid rgba(255,255,255,.12);
           padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;}
    button:hover{opacity:.85;}
    .btn-green{background:#27ae60;color:#fff;border:none;font-weight:bold;}
    .btn-red{background:#c0392b;color:#fff;border:none;}
    .toolbar{padding:10px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
             background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.05);}
    .toolbar input,.toolbar select{background:#111827;color:var(--txt);border:1px solid rgba(255,255,255,.1);
      padding:6px 10px;border-radius:6px;font-size:12px;font-family:inherit;}
    .toolbar input{width:200px;}
    #ev-count{margin-right:auto;color:var(--muted);font-size:12px;}
    .layout{display:grid;grid-template-columns:300px 1fr;height:calc(100vh - 108px);}
    @media(max-width:680px){.layout{grid-template-columns:1fr;height:auto;}}
    .sess-list{border-left:1px solid rgba(255,255,255,.05);overflow-y:auto;padding:10px;}
    .sess-card{background:var(--card);border-radius:8px;padding:11px 13px;margin-bottom:7px;
               cursor:pointer;border:1px solid transparent;transition:.1s;}
    .sess-card:hover{border-color:rgba(231,76,60,.4);}
    .sess-card.active{border-color:var(--acc);}
    .sid{font-size:10px;color:var(--muted);margin-bottom:3px;}
    .stime{font-size:11px;color:var(--blue);margin-bottom:4px;}
    .sloc{font-size:11px;color:var(--green);margin-bottom:4px;}
    .sdev{font-size:11px;color:#bbb;margin-bottom:5px;}
    .pills{display:flex;gap:5px;flex-wrap:wrap;}
    .pill{font-size:10px;padding:2px 7px;border-radius:10px;}
    .p-dev{background:#1e3a5f;color:#7ab8f5;}.p-os{background:#1a3a1a;color:#7af57a;}.p-cl{background:#3a1a1a;color:#f57a7a;}
    .detail{overflow-y:auto;padding:18px;}
    .empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);}
    .sec{margin-bottom:22px;}
    .sec-title{font-size:10px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;
               margin-bottom:9px;padding-bottom:5px;border-bottom:1px solid rgba(255,255,255,.05);}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:8px;}
    .ic{background:var(--card);border-radius:7px;padding:10px;}
    .ic .lbl{font-size:10px;color:var(--muted);margin-bottom:3px;}
    .ic .val{font-size:13px;word-break:break-all;}
    .vg{color:var(--green);}.vr{color:var(--acc);}.vb{color:var(--blue);}
    table{width:100%;border-collapse:collapse;}
    th{text-align:left;font-size:10px;color:var(--muted);letter-spacing:1px;padding:5px 9px;border-bottom:1px solid rgba(255,255,255,.05);}
    td{padding:6px 9px;border-bottom:1px solid rgba(255,255,255,.03);font-size:12px;vertical-align:top;max-width:260px;word-break:break-word;}
    tr:hover td{background:rgba(255,255,255,.02);}
    .et{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;}
    .et-page_view{background:#1a3a5a;color:#7ab8f5;}.et-click{background:#3a1a1a;color:#f57a7a;}
    .et-scroll{background:#1a3a1a;color:#7af57a;}.et-ip_resolved{background:#2a2a1a;color:#f5e27a;}
    .et-gps_granted{background:#1a2a3a;color:#7af5e2;}.et-gps_denied{background:#3a2a1a;color:#f5b07a;}
    .et-visibility{background:#2a1a3a;color:#c87af5;}.et-text_selected{background:#1a3a2a;color:#7af5b0;}
    .et-idle{background:#222;color:#888;}.et-page_leave{background:#3a1a2a;color:#f57ab0;}
    .et-battery{background:#2a3a1a;color:#c8f57a;}.et-local_ips{background:#1a2a2a;color:#7ae2f5;}
    .det{color:var(--muted);font-size:11px;}.det b{color:var(--txt);}
    .int-row{display:flex;align-items:center;gap:9px;margin-bottom:7px;}
    .int-lbl{min-width:140px;font-size:12px;}
    .int-wrap{flex:1;background:rgba(255,255,255,.05);border-radius:3px;height:10px;}
    .int-bar{height:100%;background:var(--acc);border-radius:3px;}
    .int-n{font-size:11px;color:var(--muted);min-width:28px;}
    a.map{color:var(--blue);font-size:12px;}
    .nodata{color:var(--muted);font-style:italic;font-size:12px;padding:8px 0;}
    #dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-left:5px;animation:pulse 2s infinite;}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
    #status{font-size:11px;color:var(--muted);}
  </style>
</head>
<body>
<header>
  <h1>📊 Tracker Logs <span id="dot"></span></h1>
  <div class="hbtns">
    <span id="status">Loaded: ${new Date().toLocaleString()} — <strong id="cnt" style="color:var(--acc)">${logs.length} sessions</strong></span>
    <button class="btn-green" onclick="doRefresh()">⟳ Refresh</button>
    <button onclick="exportJSON()">⬇ Export JSON</button>
    <button class="btn-red" onclick="doClear()">🗑 Clear All</button>
  </div>
</header>
<div class="toolbar">
  <input id="q" type="text" placeholder="Search IP, city, device…" oninput="renderList()"/>
  <select id="fdev" onchange="renderList()">
    <option value="">All devices</option>
    <option value="mobile">Mobile</option>
    <option value="desktop">Desktop</option>
  </select>
  <select id="fev" onchange="renderDetail()">
    <option value="">All events</option>
    <option value="click">Clicks</option>
    <option value="scroll">Scroll</option>
    <option value="ip_resolved">IP resolved</option>
    <option value="gps_granted">GPS</option>
    <option value="text_selected">Text selected</option>
    <option value="page_leave">Page leave</option>
  </select>
  <span id="ev-count"></span>
</div>
<div class="layout">
  <div class="sess-list" id="sess-list"></div>
  <div class="detail"  id="detail"><div class="empty">← Select a session</div></div>
</div>

<script>
let SESSIONS = ${JSON.stringify(logs)};
let activeId  = null;

function ic(l,v,c=""){return \`<div class="ic"><div class="lbl">\${l}</div><div class="val \${c}">\${v??'N/A'}</div></div>\`;}

function filteredSess(){
  const q=document.getElementById("q").value.toLowerCase();
  const dv=document.getElementById("fdev").value;
  return SESSIONS.filter(s=>{
    if(dv&&s.device?.deviceType!==dv)return false;
    if(q&&!JSON.stringify(s).toLowerCase().includes(q))return false;
    return true;
  });
}

function renderList(){
  const data=filteredSess();
  document.getElementById("cnt").textContent=SESSIONS.length+" sessions";
  const el=document.getElementById("sess-list");
  if(!data.length){el.innerHTML='<div class="nodata" style="padding:16px">No sessions.</div>';return;}
  el.innerHTML=data.map(s=>{
    const clicks=(s.events||[]).filter(e=>e.type==="click").length;
    const dev=s.device||{},geo=s.geoIP||{},gps=s.gps||{};
    const active=s.sessionId===activeId?" active":"";
    const locLink=gps.granted&&gps.mapsLink
      ? '<a href="'+gps.mapsLink+'" target="_blank" style="font-size:11px;color:#2ecc71;display:block;margin-bottom:4px">📍 GPS دقيق</a>'
      : geo.loc
        ? '<a href="https://maps.google.com/?q='+geo.loc+'" target="_blank" style="font-size:11px;color:#f39c12;display:block;margin-bottom:4px">🗺 موقع تقريبي (IP)</a>'
        : '';
    return \`<div class="sess-card\${active}" onclick="sel('\${s.sessionId}')">
      <div class="sid">\${s.sessionId}</div>
      <div class="stime">🕐 \${new Date(s.startedAt).toLocaleString()}</div>
      <div class="sloc">📍 \${geo.city||"??"}, \${geo.country||"??"} — \${geo.ip||s.serverIp||"no IP"}</div>
      <div class="sdev">📱 \${dev.name||"Unknown"}</div>
      \${locLink}
      <div class="pills">
        <span class="pill p-dev">\${dev.deviceType||"?"} · \${dev.browser||"?"}</span>
        <span class="pill p-os">\${dev.os||"?"}</span>
        <span class="pill p-cl">🖱 \${clicks}</span>
      </div>
    </div>\`;
  }).join("");
}

function sel(id){activeId=id;renderList();renderDetail();}

function renderDetail(){
  const panel=document.getElementById("detail");
  const s=filteredSess().find(x=>x.sessionId===activeId);
  if(!s){panel.innerHTML='<div class="empty">← Select a session</div>';return;}
  const dev=s.device||{},geo=s.geoIP||{},gps=s.gps||{},bat=dev.battery||{},net=dev.network||{};
  const fev=document.getElementById("fev").value;
  const evs=(s.events||[]).filter(e=>!fev||e.type===fev);
  document.getElementById("ev-count").textContent=evs.length+" events";
  const ints=Object.entries(s.interests||{}).sort((a,b)=>b[1]-a[1]);
  const mx=ints[0]?ints[0][1]:1;
  panel.innerHTML=\`
  <div class="sec"><div class="sec-title">Session</div><div class="grid">
    \${ic("Session ID","<span style='font-size:10px'>"+s.sessionId+"</span>","vb")}
    \${ic("Started",new Date(s.startedAt).toLocaleString())}
    \${ic("Time on Page",(s.timeOnPage||0)+"s","vg")}
    \${ic("Scroll Depth",(s.scrollDepth||0)+"%","vg")}
    \${ic("Total Events",(s.events||[]).length)}
    \${ic("Referrer",s.referrer||"direct")}
  </div></div>
  <div class="sec"><div class="sec-title">Device</div><div class="grid">
    \${ic("Device Name", dev.model&&dev.brand ? dev.brand+" "+dev.model : dev.name, "vb")}
    \${dev.brand&&dev.model ? ic("Brand / Model", dev.brand+" — "+dev.model, "vg") : ""}
    \${ic("Type",dev.deviceType)}
    \${ic("OS",dev.os)}
    \${ic("Browser",dev.browser+" "+(dev.browserVersion||""))}
    \${ic("Language",dev.language)}
    \${ic("Timezone",dev.timezone)}
    \${ic("Platform",dev.platform)}
  </div></div>
  <div class="sec"><div class="sec-title">Screen & Hardware</div><div class="grid">
    \${ic("Screen",dev.screenRes)}
    \${ic("Viewport",(dev.viewportWidth||"?")+"x"+(dev.viewportHeight||"?"))}
    \${ic("Pixel Ratio",(dev.pixelRatio||"?")+"x")}
    \${ic("Orientation",dev.orientation)}
    \${ic("CPU Cores",dev.cpuCores)}
    \${ic("RAM",dev.ramGB+" GB")}
    \${ic("GPU",dev.gpuRenderer,"vg")}
    \${ic("Cameras",dev.cameras)}
    \${ic("Microphones",dev.microphones)}
    \${ic("Touch",dev.touchSupport?"Yes":"No")}
  </div></div>
  <div class="sec"><div class="sec-title">Battery & Connection</div><div class="grid">
    \${ic("Battery",bat.level,"vg")}
    \${ic("Charging",bat.charging===true?"⚡ Yes":bat.charging===false?"No":"N/A")}
    \${ic("Connection",net.effectiveType,"vb")}
    \${ic("Downlink",net.downlink)}
    \${ic("RTT",net.rtt)}
  </div></div>
  <div class="sec"><div class="sec-title">IP & Location</div><div class="grid">
    \${ic("Public IP",geo.ip||s.serverIp||"N/A","vr")}
    \${ic("Server IP",s.serverIp,"vr")}
    \${ic("Local IPs (WebRTC)",(dev.localIPs||[]).join(", ")||"N/A","vr")}
    \${ic("City",geo.city)} \${ic("Region",geo.region)} \${ic("Country",geo.country)}
    \${ic("ISP",geo.org)} \${ic("Timezone",geo.timezone)}
    \${geo.loc?'<div class="ic"><div class="lbl">خريطة IP</div><a class="map" href="https://maps.google.com/?q='+geo.loc+'" target="_blank">🗺 موقع تقريبي</a></div>':""}
  </div></div>
  <div class="sec"><div class="sec-title">GPS (دقيق)</div>
    \${gps.granted
      ?'<div class="grid">'+ic("Lat",gps.lat,"vg")+ic("Lon",gps.lon,"vg")+ic("Accuracy",gps.accuracy)
        +'<div class="ic"><div class="lbl">خريطة GPS</div><a class="map" href="'+gps.mapsLink+'" target="_blank" style="color:#2ecc71">📍 موقع دقيق</a></div></div>'
      :'<div class="nodata">GPS '+(gps.granted===false?"رفض المستخدم الإذن":"لم يُطلب بعد")+'.</div>'}
  </div>
  <div class="sec"><div class="sec-title">Fingerprints</div><div class="grid">
    \${ic("Canvas FP",dev.canvasFingerprint,"vb")}
    \${ic("Audio FP",dev.audioFingerprint,"vb")}
  </div></div>
  \${ints.length?'<div class="sec"><div class="sec-title">Interests</div>'
    +ints.map(([k,v])=>'<div class="int-row"><div class="int-lbl">'+k+'</div>'
      +'<div class="int-wrap"><div class="int-bar" style="width:'+Math.round(v/mx*100)+'%"></div></div>'
      +'<div class="int-n">'+v+'x</div></div>').join("")+'</div>':""}
  <div class="sec"><div class="sec-title">User-Agent</div>
    <div class="ic" style="font-size:11px;color:var(--muted);word-break:break-all">\${dev.userAgent||"?"}</div>
  </div>
  <div class="sec"><div class="sec-title">Events (\${evs.length})</div>
  <table><thead><tr><th>#</th><th>Type</th><th>Time</th><th>Elapsed</th><th>Details</th></tr></thead><tbody>
    \${evs.map((e,i)=>{
      const det=Object.entries(e).filter(([k])=>!["type","time","elapsed"].includes(k))
        .map(([k,v])=>'<b>'+k+':</b> '+String(v).slice(0,100)+' ').join("&nbsp; ");
      return '<tr><td style="color:var(--muted)">'+(i+1)+'</td>'
        +'<td><span class="et et-'+e.type+'">'+e.type+'</span></td>'
        +'<td style="white-space:nowrap;color:var(--muted)">'+new Date(e.time).toLocaleTimeString()+'</td>'
        +'<td style="color:var(--muted)">'+(e.elapsed||"")+'</td>'
        +'<td class="det">'+det+'</td></tr>';
    }).join("")}
  </tbody></table></div>\`;
}

async function doRefresh(){
  const btn=event.target;
  btn.textContent="⏳..."; btn.disabled=true;
  try{
    const fresh=await fetch("/api/logs").then(r=>r.json());
    SESSIONS=fresh;
    document.getElementById("status").innerHTML=
      'Refreshed: '+new Date().toLocaleString()+' — <strong id="cnt" style="color:var(--acc)">'+SESSIONS.length+' sessions</strong>';
    renderList(); renderDetail();
    btn.textContent="✓ Done";
  }catch(e){btn.textContent="❌ Error";}
  setTimeout(()=>{btn.textContent="⟳ Refresh";btn.disabled=false;},1500);
}

async function doClear(){
  if(!confirm("Delete ALL logs on Railway?"))return;
  await fetch("/api/logs",{method:"DELETE"});
  SESSIONS=[];
  document.getElementById("cnt").textContent="0 sessions";
  renderList(); renderDetail();
}

function exportJSON(){
  const b=new Blob([JSON.stringify(SESSIONS,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(b);
  a.download="logs_"+Date.now()+".json";a.click();
}

// auto-refresh every 15 seconds
setInterval(()=>{ fetch("/api/logs").then(r=>r.json()).then(d=>{
  SESSIONS=d;
  document.getElementById("cnt").textContent=SESSIONS.length+" sessions";
  renderList();
}).catch(()=>{}); }, 15000);

renderList();
if(SESSIONS.length) sel(SESSIONS[0].sessionId);
</script>
</body>
</html>`;
}

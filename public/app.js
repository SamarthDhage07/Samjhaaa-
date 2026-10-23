if (location.protocol === 'file:') document.body.innerHTML = '<p style="padding:32px;font:16px sans-serif">Start the server with npm start, then open http://localhost:3000. This app cannot run from a file.</p>';
'use strict';
const BRAND = 'Surplus Relay';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
let lastH = null, lastSig = '', TOK = localStorage.getItem('tok'), S = null, PUB = null, off = 0, es = null, sel = null, sel2 = null, sound = false, aud = null, dirty = false, primed = false;
const seen = new Set(), flt = { sort: 'distance', cat: '', ok: false };
const T = () => Date.now() + off;
const usr = id => S.users.find(u => u.id === id) || { name: 'Unknown' };
const cd = t => { const s = Math.max(0, Math.round((t - T()) / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const timer = t => `<span class="timer" data-exp="${t}">${cd(t)}</span>`;
const tone = s => /Expired|Cancelled|Rejected|Failed|Timed/.test(s) ? 'bad' : /pending|Delayed|Reserved|Awaiting|Reallocated|Reassigned/i.test(s) ? 'warn' : /Delivered|onfirmed|Completed|Dispatched|transit|Assigned|Accepted/.test(s) ? 'ok' : '';
const chip = s => `<span class="chip ${tone(s)}">${esc(s)}</span>`;
const tl = e => `<ol class="tl">${(e.tl || []).map(x => `<li><b>${esc(x.s)}</b> ${new Date(x.t).toLocaleTimeString()} ${esc(x.why)}</li>`).join('')}</ol>`;

async function api(p, m = 'GET', b) {
  const r = await fetch('/api' + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: TOK || '' }, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) { if (r.status === 401 && TOK) logout(); throw new Error(j.error || 'Request failed'); } return j;
}
function toast(m, k) { const d = document.createElement('div'); d.textContent = m; if (k) d.className = k; $('#toast').append(d); setTimeout(() => d.remove(), 4200); }
function siren() { if (!sound) return; try { aud = aud || new AudioContext(); const o = aud.createOscillator(), g = aud.createGain(); o.connect(g); g.connect(aud.destination); g.gain.value = .07; o.type = 'sawtooth'; const t = aud.currentTime; for (let i = 0; i < 6; i++)o.frequency.setValueAtTime(i % 2 ? 660 : 880, t + i * .4); o.start(t); o.stop(t + 2.4); } catch { } }
async function refresh() {
  if (!TOK) return; S = await api('/state'); off = S.now - Date.now();
  const fresh = S.notes.filter(n => n.level === 'urgent' && !seen.has(n.id)); S.notes.forEach(n => seen.add(n.id));
  if (primed && fresh.length) { siren(); toast(fresh[fresh.length - 1].msg, 'bad'); } primed = true; const { now: _n, ...rest } = S; const sig = JSON.stringify(rest); if (sig === lastSig) return; lastSig = sig; render();
}
function connect() { if (es) es.close(); if (!TOK) return; es = new EventSource('/api/stream?token=' + TOK); es.onmessage = () => refresh().catch(() => { }); }
function countUp() { const red = matchMedia('(prefers-reduced-motion: reduce)').matches; window.__c = window.__c || {}; document.querySelectorAll('[data-count]').forEach(el => { const to = +el.dataset.count, from = window.__c[el.dataset.key] || 0; window.__c[el.dataset.key] = to; if (red || from === to) { el.textContent = to; return; } const t0 = performance.now(); (function f(t) { const k = Math.min(1, (t - t0) / 700); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0); }); }
function logout() { TOK = null; localStorage.removeItem('tok'); S = null; if (es) es.close(); primed = false; location.hash = '#/login'; render(true); }

const F = {
  donor: [['name', 'Facility or restaurant name'], ['manager', 'Owner or manager name'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['password', 'Password (8 or more characters)', 'password'], ['ftype', 'Facility type', 'select', ['Restaurant', 'Caterer', 'Hostel mess', 'Grocery', 'Bakery']], ['address', 'Complete location'], ['lat', 'Latitude', 'number'], ['lng', 'Longitude', 'number'], ['ophours', 'Operating hours'], ['cats', 'Donation categories, comma separated'], ['safety', 'Safety and packaging requirements'], ['handling', 'Food handling information']],
  rider: [['name', 'Full name'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['password', 'Password (8 or more characters)', 'password'], ['donorId', 'Associated donor facility', 'select', 'donors'], ['vehicle', 'Vehicle or transport type', 'select', ['Bicycle', 'Scooter', 'Motorbike', 'Car', 'Van']], ['cap', 'Maximum carrying capacity (units)', 'number'], ['lat', 'Current latitude', 'number'], ['lng', 'Current longitude', 'number'], ['available', 'Availability', 'select', ['yes', 'no']], ['radius', 'Service radius (km)', 'number']],
  receiver: [['name', 'Organization name'], ['manager', 'Contact person'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['password', 'Password (8 or more characters)', 'password'], ['address', 'Complete location'], ['lat', 'Latitude', 'number'], ['lng', 'Longitude', 'number'], ['capacity', 'Total capacity (people)', 'number'], ['occupancy', 'Current occupancy', 'number'], ['ages', 'Required age groups'], ['cats', 'Required supply categories, comma separated'], ['needs', 'Current demand, for example Cooked meals:40, Dry rations:20'], ['water', 'Clean water available', 'select', ['yes', 'no']], ['fuel', 'Cooking fuel available', 'select', ['yes', 'no']], ['storage', 'Storage capacity (units)', 'number'], ['hours', 'Receiving hours, for example 08-22']]
};
const field = ([k, l, t, o], v = '', req) => `<label>${l}${t === 'select' ? `<select name="${k}">${(o === 'donors' ? (PUB?.donors || []).map(d => [d.id, d.name]) : o.map(x => [x, x])).map(([a, b]) => `<option value="${esc(a)}" ${a == v ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>` : `<input name="${k}" type="${t || 'text'}" step="any" value="${esc(v)}" ${req ? 'required' : ''} autocomplete="off">`}</label>`;

/* ---------- public pages ---------- */
function topPub() { 
  return `
    <header class="top">
      <div class="wrap">
        <a class="logo" href="#/">${BRAND}</a>
        <button class="l" data-scroll="how-it-works">How it works</button>
        <button class="l" data-scroll="roles">Roles</button>
        <a class="btn d s" href="#/app/emergency" style="gap:5px">${ic('alert')}Emergency Radar</a>
        ${TOK ? `<a class="l" href="#/app">Dashboard</a>` : `<a class="l" href="#/login">Log in</a>`}
        <a class="btn p s" href="#/register/donor">Donate surplus</a>
      </div>
    </header>
  `; 
}
function footer() { 
  return `
    <footer class="foot">
      <div class="wrap">
        <div class="row" style="margin-bottom:12px;gap:18px;flex-wrap:wrap">
          <a href="#/">Home</a>
          <a href="#/app/emergency">Emergency Radar</a>
          ${TOK ? `<a href="#/app">Dashboard</a>` : `<a href="#/login">Log in</a>`}
          <a href="#/register/donor">Donate Surplus</a>
          <a href="#/privacy">Privacy Policy</a>
          <a href="#/terms">Terms and Conditions</a>
          <a href="mailto:contact@surplusrelay.example">contact@surplusrelay.example</a>
        </div>
        <p>${BRAND} is a real-time surplus delivery platform. Real-time expiry monitoring, volunteer courier dispatch, and emergency shelter routing.</p>
      </div>
    </footer>
  `; 
}
const STEPS = ['Donor posts a surplus donation', 'Receiver requests or is matched with the donation', 'Donor approves the request', 'Rider is assigned', 'Receiver confirms rider assistance', 'Donation is delivered', 'Delivery is confirmed and remaining help is reallocated'];
function landing() {
  const p = PUB || { items: [], events: [] };
  return `
  ${topPub()}
  <div id="story-loader">
    <div class="loader-box">
      <div class="loader-brand">${BRAND}</div>
      <p class="mut" style="margin-bottom:12px">Connecting surplus meals to local shelters</p>
      <div class="loader-track"><div id="loader-fill" class="loader-fill"></div></div>
      <div id="loader-text" class="loader-text">Preloading story frames: 0%</div>
    </div>
  </div>

  <div id="story-scroll-wrapper" class="story-scroll-wrapper">
    <div id="story-stage" class="story-stage-pinned">
      <div id="seam-center-line" class="seam-center-line"></div>
      <div class="seam-layer seam-layer-left">
        <canvas id="seam-canvas-left" class="seam-canvas seam-canvas-left"></canvas>
      </div>
      <div class="seam-layer seam-layer-right">
        <canvas id="seam-canvas-right" class="seam-canvas seam-canvas-right"></canvas>
      </div>
      <div class="story-captions-container">
        <div id="caption-1" class="story-card">
          <div class="story-num">01</div>
          <p class="story-text">A restaurant has food it cannot sell tonight.</p>
        </div>
        <div id="caption-2" class="story-card">
          <div class="story-num">02</div>
          <p class="story-text">The platform finds a volunteer rider on the closest route.</p>
        </div>
        <div id="caption-3" class="story-card">
          <div class="story-num">03</div>
          <p class="story-text">The rider picks up the donation before it expires.</p>
        </div>
      </div>
      <div id="story-closing-card" class="story-closing-card">
        A shelter confirms delivery. Nothing goes to waste.
      </div>
      <div class="story-progress-bar">
        <div id="story-progress-fill" class="story-progress-fill"></div>
      </div>
      <div id="scroll-hint" class="scroll-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        <span>Scroll</span>
      </div>
    </div>
  </div>

  <div class="site-content-layer">
    <section id="hero-section" class="hero-under-stage">
      <div class="wrap">
        <div class="hero-grid">
          <div>
            <h1 class="hero-title">
              <span class="hero-title-line"><span>Surplus food,</span></span>
              <span class="hero-title-line"><span>delivered before it expires.</span></span>
            </h1>
            <p class="hero-subtext">Connecting local kitchens, volunteer riders and shelters in real time with automatic expiry protection.</p>
            <div class="row" style="gap:10px;margin-bottom:20px;flex-wrap:wrap">
              <a class="btn p" href="#/register/donor">Donate surplus</a>
              <button class="btn" data-scroll="how-it-works">See how it works</button>
              <a class="btn d" href="#/app/emergency" style="gap:8px">${ic('alert')}Emergency Radar</a>
              <button class="btn s" id="btn-replay-story" type="button" style="border-color:var(--line);color:var(--mut)">Replay intro</button>
            </div>
            
            <div class="role-tabs-wrap">
              <div class="role-tab-buttons">
                <button class="role-tab-btn active" data-role="donor">Donor</button>
                <button class="role-tab-btn" data-role="rider">Rider</button>
                <button class="role-tab-btn" data-role="shelter">Shelter</button>
              </div>
              <div class="role-tab-panel active" data-panel="donor">
                <p class="mut" style="margin:0">List surplus in seconds with automatic safety, packaging and expiry tracking.</p>
                <div class="role-panel-card">
                  <h4><span>Shree Kitchen</span><span class="chip ok">Available</span></h4>
                  <p style="margin:0;font-size:0.88rem">45 portions Cooked meals. Expires in <span class="timer">2h 45m</span>. Safety: Keep hot.</p>
                </div>
              </div>
              <div class="role-tab-panel" data-panel="rider">
                <p class="mut" style="margin:0">Receive reserved assignments sized to your vehicle capacity with zero ghost bookings.</p>
                <div class="role-panel-card">
                  <h4><span>Scooter Route #12</span><span class="chip">Reserved</span></h4>
                  <p style="margin:0;font-size:0.88rem">Pickup: Shree Kitchen (4.5 km) - Deliver: Asha Shelter (12 min).</p>
                </div>
              </div>
              <div class="role-tab-panel" data-panel="shelter">
                <p class="mut" style="margin:0">Publish current demand and receive verified deliveries matched to your storage and fuel capabilities.</p>
                <div class="role-panel-card">
                  <h4><span>Asha Shelter</span><span class="chip ok">Demand Matched</span></h4>
                  <p style="margin:0;font-size:0.88rem">Occupancy 72/90. Incoming: 45 portions hot meals arriving via Rider Arjun.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="hero-map-stage">
            <div class="hero-map-box" id="hero-map-box">
              <div class="hero-map-header">
                <span>ORBITAL CORRIDOR RECON &bull; 3D SATELLITE MODEL</span>
                <span class="sim-badge">Live simulation</span>
              </div>
              <svg id="hero-map-svg" class="hero-map-svg" viewBox="0 0 560 420">
                <defs>
                  <!-- Satellite Water & Depth Gradient -->
                  <linearGradient id="sat-river-grad" x1="0%" y1="0%" x2="100%" y2="80%">
                    <stop offset="0%" stop-color="#023E8A" />
                    <stop offset="35%" stop-color="#0077B6" />
                    <stop offset="70%" stop-color="#0096C7" />
                    <stop offset="100%" stop-color="#48CAE4" />
                  </linearGradient>

                  <!-- Photovoltaic Solar Rooftop Gradient -->
                  <linearGradient id="sat-solar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0F172A" />
                    <stop offset="40%" stop-color="#1E3A8A" />
                    <stop offset="100%" stop-color="#0284C7" />
                  </linearGradient>

                  <!-- Dynamic Courier Neon Vector -->
                  <linearGradient id="route-neon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FF5722" />
                    <stop offset="50%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#10B981" />
                  </linearGradient>

                  <filter id="sat-glow" x="-20%" y="-20%" width="150%" height="160%">
                    <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#FF5722" flood-opacity="0.5" />
                  </filter>

                  <pattern id="satellite-grid-pat" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.7" />
                  </pattern>
                </defs>

                <!-- Layer 1: Multi-Zone Satellite Ortho Terrain Base -->
                <rect width="560" height="420" fill="#141C24" />
                
                <!-- Patchwork Agricultural & Urban District Plots -->
                <rect x="0" y="0" width="160" height="150" fill="#203324" opacity="0.9" />
                <polygon points="0,0 160,0 120,70 0,60" fill="#2A422F" opacity="0.8" />
                <polygon points="120,0 260,0 230,80 140,75" fill="#3B3828" opacity="0.75" />
                <polygon points="260,0 420,0 390,95 240,80" fill="#253A2A" opacity="0.85" />
                <polygon points="420,0 560,0 560,110 390,95" fill="#3E3426" opacity="0.8" />
                
                <!-- Mid & Lower Terrain Parcels -->
                <polygon points="0,170 230,170 230,310 0,310" fill="#1B2430" />
                <polygon points="250,170 420,170 420,310 250,310" fill="#212C3A" />
                <polygon points="440,170 560,170 560,310 440,310" fill="#28352A" />
                <polygon points="0,330 230,330 230,420 0,420" fill="#2C382A" />
                <polygon points="250,330 420,330 420,420 250,420" fill="#3A3327" />
                <polygon points="440,330 560,330 560,420 440,420" fill="#1D2633" />
                
                <rect width="560" height="420" fill="url(#satellite-grid-pat)" />

                <!-- Layer 2: Sports Turf Stadium (Vibrant Emerald with Field Markings) -->
                <g id="sat-stadium" transform="translate(18, 14)">
                  <polygon points="0,0 90,0 96,6 96,56 90,62 0,62 -6,56 -6,6" fill="#1E293B" stroke="#334155" stroke-width="1.5" />
                  <rect x="2" y="4" width="86" height="54" rx="4" fill="#15803D" />
                  <rect x="7" y="9" width="76" height="44" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.85" />
                  <line x1="45" y1="9" x2="45" y2="53" stroke="#FFFFFF" stroke-width="1" opacity="0.85" />
                  <circle cx="45" cy="31" r="9" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.85" />
                  <rect x="7" y="21" width="10" height="20" fill="none" stroke="#FFFFFF" stroke-width="0.8" opacity="0.85" />
                  <rect x="73" y="21" width="10" height="20" fill="none" stroke="#FFFFFF" stroke-width="0.8" opacity="0.85" />
                </g>

                <!-- Layer 3: Winding Satellite River Canal with Sandbanks & Marina -->
                <path d="M -20 85 Q 140 140 240 85 T 440 60 T 580 95" fill="none" stroke="#D4A373" stroke-width="44" stroke-linecap="round" opacity="0.5" />
                <path d="M -20 85 Q 140 140 240 85 T 440 60 T 580 95" fill="none" stroke="url(#sat-river-grad)" stroke-width="36" stroke-linecap="round" />
                <path d="M -20 85 Q 140 140 240 85 T 440 60 T 580 95" fill="none" stroke="#E0F2FE" stroke-width="2.5" stroke-dasharray="28 22" opacity="0.65" />
                <g id="sat-marina" opacity="0.85">
                  <line x1="220" y1="98" x2="220" y2="114" stroke="#64748B" stroke-width="3" />
                  <rect x="216" y="112" width="8" height="3" rx="1" fill="#FFFFFF" />
                  <line x1="234" y1="94" x2="234" y2="110" stroke="#64748B" stroke-width="3" />
                  <rect x="230" y="108" width="8" height="3" rx="1" fill="#38BDF8" />
                  <line x1="365" y1="52" x2="365" y2="68" stroke="#64748B" stroke-width="3" />
                  <rect x="361" y="66" width="8" height="3" rx="1" fill="#FFFFFF" />
                </g>

                <!-- Layer 4: Dense Urban Park Foliage & Tree Canopies -->
                <g id="sat-parks">
                  <path d="M 35 185 Q 95 168 145 208 Q 155 285 85 295 Q 25 275 35 185 Z" fill="#14532D" stroke="#166534" stroke-width="1.5" />
                  <path d="M 50 200 Q 100 190 125 220 Q 130 270 75 278 Z" fill="#166534" />
                  <circle cx="65" cy="225" r="11" fill="#22C55E" opacity="0.85" />
                  <circle cx="98" cy="218" r="15" fill="#15803D" opacity="0.9" />
                  <circle cx="82" cy="250" r="13" fill="#4ADE80" opacity="0.75" />
                  <circle cx="118" cy="250" r="12" fill="#166534" opacity="0.9" />
                  <circle cx="55" cy="260" r="10" fill="#65A30D" opacity="0.85" />
                  <path d="M 45 210 Q 80 235 100 230 T 135 255" fill="none" stroke="#E2E8F0" stroke-width="2" stroke-linecap="round" opacity="0.5" />

                  <polygon points="285,18 425,18 415,105 295,105" fill="#14532D" stroke="#166534" stroke-width="1" />
                  <circle cx="320" cy="45" r="13" fill="#15803D" opacity="0.85" />
                  <circle cx="355" cy="38" r="16" fill="#22C55E" opacity="0.85" />
                  <circle cx="385" cy="55" r="14" fill="#4ADE80" opacity="0.75" />
                  <circle cx="340" cy="72" r="12" fill="#65A30D" opacity="0.85" />
                  <circle cx="380" cy="85" r="11" fill="#15803D" opacity="0.9" />
                </g>

                <!-- Layer 5: Highway System & Multi-Lane Arterials -->
                <g id="map-grid-layer">
                  <path d="M -20 160 L 580 160 M 240 -20 L 240 440 M -20 320 L 580 320 M 430 -20 L 430 440" stroke="#0F172A" stroke-width="18" stroke-linecap="square" />
                  <path class="map-road" d="M -20 160 L 580 160 M 240 -20 L 240 440 M -20 320 L 580 320 M 430 -20 L 430 440" stroke="#1E242E" stroke-width="14" stroke-linecap="square" />
                  <path class="map-road-center" d="M -20 160 L 580 160 M 240 -20 L 240 440 M -20 320 L 580 320 M 430 -20 L 430 440" stroke="#F59E0B" stroke-width="1.4" stroke-dasharray="6 5" />
                  
                  <!-- River Highway Bridge Piers & Shadow -->
                  <rect x="230" y="70" width="20" height="30" fill="#0A0E17" opacity="0.5" />
                  <rect x="232" y="72" width="16" height="26" fill="#334155" stroke="#64748B" stroke-width="1" />
                  <line x1="232" y1="72" x2="232" y2="98" stroke="#94A3B8" stroke-width="1.5" />
                  <line x1="248" y1="72" x2="248" y2="98" stroke="#94A3B8" stroke-width="1.5" />

                  <!-- Pedestrian Crosswalks -->
                  <g stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.8">
                    <line x1="218" y1="154" x2="218" y2="166" />
                    <line x1="262" y1="154" x2="262" y2="166" />
                    <line x1="234" y1="140" x2="246" y2="140" />
                    <line x1="234" y1="180" x2="246" y2="180" />
                    <line x1="218" y1="314" x2="218" y2="326" />
                    <line x1="262" y1="314" x2="262" y2="326" />
                    <line x1="234" y1="300" x2="246" y2="300" />
                    <line x1="234" y1="340" x2="246" y2="340" />
                    <line x1="408" y1="154" x2="408" y2="166" />
                    <line x1="452" y1="154" x2="452" y2="166" />
                  </g>

                  <!-- Small Ambient City Traffic -->
                  <rect x="180" y="156" width="7" height="4" rx="1" fill="#FFFFFF" />
                  <rect x="290" y="161" width="8" height="4" rx="1" fill="#38BDF8" />
                  <rect x="237" y="210" width="4" height="8" rx="1" fill="#EF4444" />
                  <rect x="242" y="270" width="4" height="7" rx="1" fill="#FEF08A" />
                  <rect x="427" y="230" width="4" height="8" rx="1" fill="#FFFFFF" />
                  <rect x="480" y="316" width="7" height="4" rx="1" fill="#10B981" />
                </g>

                <!-- Layer 6: 3D Isometric Satellite Architecture -->
                <g id="map-3d-buildings">
                  <!-- Building 1: Skyscraper Glass Tower with Helipad -->
                  <polygon points="145,115 185,115 220,150 180,150" class="sat-shadow-45" />
                  <polygon points="145,45 185,45 185,115 145,115" class="sat-bldg-glass-front" />
                  <polygon points="185,45 200,30 200,100 185,115" class="sat-bldg-glass-side" />
                  <polygon points="145,45 160,30 200,30 185,45" class="sat-bldg-glass-top" />
                  <circle cx="172" cy="38" r="6.5" fill="none" stroke="#FBBF24" stroke-width="1.3" />
                  <circle cx="172" cy="38" r="5" fill="none" stroke="#FFFFFF" stroke-width="0.7" stroke-dasharray="2 1" />
                  <text x="172" y="41" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="6.5" fill="#FBBF24">H</text>

                  <!-- Building 2: Commercial Solar Complex -->
                  <polygon points="280,118 330,118 360,148 310,148" class="sat-shadow-45" />
                  <polygon points="280,68 330,68 330,118 280,118" class="sat-bldg-comm-front" />
                  <polygon points="330,68 348,50 348,100 330,118" class="sat-bldg-comm-side" />
                  <polygon points="280,68 298,50 348,50 330,68" class="sat-bldg-comm-top" />
                  <polygon points="287,63 301,49 339,49 325,63" fill="url(#sat-solar-grad)" stroke="#38BDF8" stroke-width="0.8" />
                  <line x1="294" y1="56" x2="332" y2="56" stroke="#38BDF8" stroke-width="0.6" stroke-dasharray="2 2" />
                  <rect x="290" y="58" width="8" height="4" fill="#94A3B8" rx="0.5" />

                  <!-- Building 3: Civic Center & Plaza with Fountain -->
                  <polygon points="285,280 345,280 375,310 315,310" class="sat-shadow-45" />
                  <polygon points="285,235 345,235 345,280 285,280" fill="#134E4A" stroke="#2DD4BF" stroke-width="0.8" />
                  <polygon points="345,235 362,218 362,263 345,280" fill="#042F2E" stroke="#115E59" stroke-width="0.8" />
                  <polygon points="285,235 302,218 362,218 345,235" fill="#0D9488" stroke="#5EEAD4" stroke-width="1.2" />
                  <polygon points="280,282 350,282 355,302 275,302" fill="#334155" opacity="0.6" />
                  <circle cx="315" cy="292" r="5" fill="#06B6D4" stroke="#A5F3FC" stroke-width="0.8" />
                  <circle cx="315" cy="292" r="2" fill="#FFFFFF" />

                  <!-- Building 4: Residential Terracotta Tile Quads -->
                  <polygon points="375,275 410,275 425,290 390,290" class="sat-shadow-45" />
                  <polygon points="375,245 410,245 410,275 375,275" fill="#9A3412" stroke="#EA580C" stroke-width="0.8" />
                  <polygon points="410,245 420,235 420,265 410,275" fill="#431407" stroke="#7C2D12" stroke-width="0.8" />
                  <polygon points="375,245 392,230 420,235 410,245" fill="#EA580C" stroke="#FDBA74" stroke-width="1" />
                  <polygon points="435,275 470,275 485,290 450,290" class="sat-shadow-45" />
                  <polygon points="435,245 470,245 470,275 435,275" fill="#9A3412" stroke="#EA580C" stroke-width="0.8" />
                  <polygon points="470,245 480,235 480,265 470,275" fill="#431407" stroke="#7C2D12" stroke-width="0.8" />
                  <polygon points="435,245 452,230 480,235 470,245" fill="#C2410C" stroke="#FDBA74" stroke-width="1" />

                  <!-- Building 5: Shree Kitchen (Donor Hub) Facility Complex -->
                  <polygon points="60,280 115,280 135,300 80,300" class="sat-shadow-45" />
                  <polygon points="60,235 110,235 110,280 60,280" class="sat-bldg-donor-front" />
                  <polygon points="110,235 125,220 125,265 110,280" class="sat-bldg-donor-side" />
                  <polygon points="60,235 75,220 125,220 110,235" class="sat-bldg-donor-top" />
                  <rect x="75" y="224" width="12" height="6" fill="#7C2D12" rx="1" />
                  <circle cx="100" cy="227" r="3" fill="#FED7AA" stroke="#EA580C" stroke-width="0.7" />
                  <rect x="70" y="270" width="18" height="10" fill="#1E293B" rx="1" />
                  <rect x="73" y="272" width="12" height="6" fill="#F97316" rx="0.5" />
                </g>

                <!-- Layer 7: 3D Neon Active Delivery Corridor Vector -->
                <path id="map-route-line" class="map-route-line" d="M 120 320 L 240 320 L 240 160 L 430 160" filter="url(#sat-glow)" stroke="url(#route-neon-grad)" stroke-width="5" />

                <!-- Layer 8: Asha Shelter Receiving Compound -->
                <g transform="translate(430, 160)">
                  <circle r="34" class="map-shelter-pulse" stroke="#10B981" />
                  <ellipse cx="0" cy="14" rx="26" ry="10" fill="rgba(10,16,26,0.65)" />
                  <polygon points="-18,-6 18,-6 18,10 -18,10" class="sat-bldg-shelter-front" />
                  <polygon points="18,-6 28,-16 28,0 18,10" class="sat-bldg-shelter-side" />
                  <polygon points="-18,-6 0,-20 18,-6" class="sat-bldg-shelter-top" />
                  <rect x="-5" y="0" width="10" height="10" fill="#FEF08A" rx="1" />
                  <rect x="-50" y="26" width="100" height="22" rx="6" fill="#0F172A" stroke="#10B981" stroke-width="1.5" />
                  <circle cx="-38" cy="37" r="3.5" fill="#10B981" />
                  <text x="3" y="41" text-anchor="middle" font-family="var(--fb)" font-weight="800" font-size="11" fill="#4ADE80">Asha Shelter</text>
                </g>

                <!-- Layer 9: 3D Elevated Pin for Donation Facility -->
                <g id="map-dynamic-pin">
                  <g class="map-donor-pin">
                    <ellipse cx="120" cy="326" rx="10" ry="4.5" fill="rgba(10,16,26,0.7)"/>
                    <line x1="120" y1="320" x2="120" y2="302" stroke="#FF5722" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="120" cy="302" r="10" fill="#FF5722" stroke="#FFFFFF" stroke-width="2.5" />
                    <circle cx="120" cy="302" r="3.5" fill="#FFFFFF" />
                    <rect x="82" y="266" width="76" height="20" rx="5" fill="#0F172A" stroke="#FF5722" stroke-width="1.5"/>
                    <circle cx="92" cy="276" r="3.5" fill="#FF5722" />
                    <text x="124" y="280" text-anchor="middle" font-family="var(--fb)" font-weight="800" font-size="10.5" fill="#FFA56E">Donation</text>
                  </g>
                </g>

                <!-- Layer 10: 3D Elevated Courier Scooter with Headlight & Shadow -->
                <g id="map-truck" class="map-truck-icon" transform="translate(108, 308)">
                  <ellipse cx="12" cy="20" rx="16" ry="5" fill="rgba(10,16,26,0.7)" />
                  <rect width="24" height="15" rx="3.5" fill="#C2571A" stroke="#FFA56E" stroke-width="1.2" />
                  <circle cx="6" cy="15" r="3.5" fill="#0F172A" stroke="#94A3B8" stroke-width="0.9" />
                  <circle cx="18" cy="15" r="3.5" fill="#0F172A" stroke="#94A3B8" stroke-width="0.9" />
                  <rect x="14" y="2" width="7" height="6" rx="1" fill="#FEF08A" />
                  <polygon points="24,3 40,0 40,12 24,8" fill="#FEF08A" opacity="0.4" />
                </g>

                <g id="map-check" class="map-check-icon" transform="translate(416, 146)" opacity="0">
                  <ellipse cx="14" cy="27" rx="15" ry="5.5" fill="rgba(10,16,26,0.7)" />
                  <circle cx="14" cy="14" r="15" fill="#059669" stroke="#34D399" stroke-width="2" />
                  <path d="M 8 14 L 12 18 L 20 10" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                </g>

                <!-- Layer 11: High-Tech Satellite Telemetry & HUD Overlay -->
                <!-- North Compass Rose in Top Right -->
                <g transform="translate(530, 28)" opacity="0.85">
                  <circle r="14" fill="#0F172A" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
                  <polygon points="0,-10 -4,0 0,-2 4,0" fill="#FF5722" />
                  <polygon points="0,10 -4,0 0,2 4,0" fill="#94A3B8" />
                  <text y="-3" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="7" fill="#FFFFFF">N</text>
                </g>

                <!-- Sensor Telemetry Bar at Bottom -->
                <g transform="translate(18, 404)">
                  <rect x="-6" y="-12" width="370" height="18" rx="4" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.12)" stroke-width="0.8" />
                  <circle cx="2" cy="-3" r="2.5" fill="#10B981" />
                  <text x="12" y="0" font-family="monospace" font-size="9" font-weight="600" fill="#38BDF8" letter-spacing="0.5">18°31'49"N 73°51'11"E &bull; SATELLITE 3D EO-OPTICAL &bull; 0.15M/PX</text>
                </g>

                <!-- Scale Bar in Bottom Right -->
                <g transform="translate(460, 404)">
                  <rect x="-8" y="-12" width="90" height="18" rx="4" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.12)" stroke-width="0.8" />
                  <line x1="0" y1="-3" x2="40" y2="-3" stroke="#FFFFFF" stroke-width="1.8" />
                  <line x1="0" y1="-7" x2="0" y2="1" stroke="#FFFFFF" stroke-width="1.8" />
                  <line x1="40" y1="-7" x2="40" y2="1" stroke="#FFFFFF" stroke-width="1.8" />
                  <text x="48" y="0" font-family="monospace" font-size="8.5" font-weight="700" fill="#FFFFFF">250m</text>
                </g>
              </svg>
              <div id="map-instruction" class="map-instruction-tag">Click anywhere on the satellite grid to test live dispatch</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="how-it-works" class="how-it-works-wrap">
      <div id="how-pinned-container" class="how-pinned-container">
        <div id="how-sticky-track" class="how-sticky-track">
          <div id="how-panels-flex" class="how-panels-flex">
            <div class="how-panel-card in-view">
              <div class="n">01</div>
              <h3>Donor lists surplus</h3>
              <p>Kitchens and caterers post excess portions with safe handling requirements, storage temperatures and strict expiry windows.</p>
              <svg class="how-svg-illustration" viewBox="0 0 320 140">
                <rect class="draw-path" x="40" y="30" width="100" height="80" rx="6" />
                <path class="draw-path" d="M 40 60 L 140 60 M 90 30 L 90 110" />
                <rect class="draw-path" x="170" y="45" width="110" height="65" rx="6" />
                <path class="draw-path" d="M 170 70 L 280 70 M 200 45 L 200 110" />
                <circle class="draw-path" cx="250" cy="58" r="4" fill="#C2571A" />
              </svg>
            </div>
            <div class="how-panel-card">
              <div class="n">02</div>
              <h3>Rider is matched</h3>
              <p>The routing engine calculates travel duration and vehicle capacity to reserve the nearest available courier on the corridor.</p>
              <svg class="how-svg-illustration" viewBox="0 0 320 140">
                <path class="draw-path" d="M 30 100 Q 120 20 220 80 T 290 50" />
                <circle class="draw-path" cx="30" cy="100" r="8" fill="#C2571A" />
                <circle class="draw-path" cx="290" cy="50" r="8" fill="#1E1B18" />
                <rect class="draw-path" x="145" y="45" width="30" height="18" rx="4" />
                <circle class="draw-path" cx="152" cy="63" r="5" />
                <circle class="draw-path" cx="168" cy="63" r="5" />
              </svg>
            </div>
            <div class="how-panel-card">
              <div class="n">03</div>
              <h3>Direct courier pickup</h3>
              <p>The courier verifies packaging, collects the batch before expiration buffers, and begins GPS guided transit.</p>
              <svg class="how-svg-illustration" viewBox="0 0 320 140">
                <path class="draw-path" d="M 50 110 L 110 50 L 160 80 L 240 30" />
                <rect class="draw-path" x="195" y="55" width="80" height="55" rx="6" />
                <path class="draw-path" d="M 215 55 L 215 40 Q 235 25 255 40 L 255 55" />
                <circle class="draw-path" cx="235" cy="82" r="10" />
                <path class="draw-path" d="M 231 82 L 234 85 L 240 79" />
              </svg>
            </div>
            <div class="how-panel-card">
              <div class="n">04</div>
              <h3>Shelter confirms delivery</h3>
              <p>The shelter inspects temperature, logs receipt, and immediately updates live occupancy demand so nothing goes to waste.</p>
              <svg class="how-svg-illustration" viewBox="0 0 320 140">
                <path class="draw-path" d="M 40 110 L 40 55 L 120 20 L 200 55 L 200 110 Z" />
                <rect class="draw-path" x="100" y="70" width="40" height="40" rx="3" />
                <circle class="draw-path" cx="250" cy="70" r="28" />
                <path class="draw-path" d="M 238 70 L 246 78 L 264 60" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="roles" class="sec">
      <div class="wrap">
        <div class="scroll-reveal">
          <h2>Built for every participant</h2>
          <p class="mut">Purpose built workflows for kitchens, volunteer dispatchers, and receiving communities.</p>
        </div>
        <div class="roles-grid scroll-reveal">
          <div class="tilt-card">
            ${ic('box')}
            <h3>Donors</h3>
            <p>Post food surplus with packaging and expiry constraints. Review route travel feasibility before accepting requests.</p>
            <a class="card-arrow-link" href="#/register/donor">Register kitchen <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
          </div>
          <div class="tilt-card">
            ${ic('truck')}
            <h3>Riders</h3>
            <p>Accept reserved deliveries sized to your carrying capacity. Get automated delay and timeout protection on every route.</p>
            <a class="card-arrow-link" href="#/register/rider">Join as rider <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
          </div>
          <div class="tilt-card">
            ${ic('home')}
            <h3>Receivers</h3>
            <p>Publish current demand, discover verified nearby donors, and track courier approach in real time.</p>
            <a class="card-arrow-link" href="#/register/receiver">Register shelter <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
          </div>
          <div class="tilt-card">
            ${ic('shield')}
            <h3>Admins</h3>
            <p>Oversee urgent donations, resolve bottlenecks, monitor audit logs, and trigger contingency reallocations.</p>
            <a class="card-arrow-link" href="#/login">Admin console <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
          </div>
        </div>
      </div>
    </section>

    <section class="sec alt">
      <div class="wrap">
        <div class="scroll-reveal">
          <h2>Live contingency controls</h2>
          <p class="mut">Test how the automated dispatch engine responds to unpredictable field conditions in real time.</p>
        </div>
        <div class="sim-controls-card scroll-reveal">
          <div class="sim-toggles-grid">
            <div class="sim-toggle-item" data-sim="rider">
              <div class="sim-toggle-header">
                <span>Rider drops out</span>
                <div class="sim-toggle-switch"></div>
              </div>
              <div class="sim-toggle-desc">Simulate a courier breakdown or flat tire during transit.</div>
            </div>
            <div class="sim-toggle-item" data-sim="expiry">
              <div class="sim-toggle-header">
                <span>Nears expiry</span>
                <div class="sim-toggle-switch"></div>
              </div>
              <div class="sim-toggle-desc">Drop safe window to under 30 minutes to trigger buffer priority.</div>
            </div>
            <div class="sim-toggle-item" data-sim="demand">
              <div class="sim-toggle-header">
                <span>Demand spike</span>
                <div class="sim-toggle-switch"></div>
              </div>
              <div class="sim-toggle-desc">Increase shelter occupant demand and trigger split delivery.</div>
            </div>
          </div>
          
          <div class="sim-output-box">
            <div class="row" style="justify-content:space-between;margin-bottom:14px;border-bottom:1px solid var(--line-light);padding-bottom:12px">
              <div>
                <b id="sim-rider-text">Rider #4 (Scooter) - Active on route</b>
                <div class="mut" style="font-size:0.85rem"><span id="sim-demand-text">Demand: 40 portions</span> - Expiry: <span id="sim-timer-text" class="timer">2h 45m</span></div>
              </div>
              <div id="sim-status-chip" class="chip ok">In transit</div>
            </div>
            <div id="sim-interactive-log">
              <div class="sim-log-row">
                <span class="chip ok">System Ready</span>
                <span>Simulation engine initialized with live rule constraints.</span>
                <span class="mut" style="margin-left:auto;font-size:0.8rem">12:00:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
  ` + footer();
}
const ALL = [['Donor: Shree Kitchen', 'donor@demo.test'], ['Donor: Annapurna Caterers', 'donor2@demo.test'], ['Rider: Arjun Patil', 'rider@demo.test'], ['Rider: Meera Shah', 'rider2@demo.test'], ['Rider: Neha Rao', 'rider3@demo.test'], ['Receiver: Asha Shelter', 'receiver@demo.test'], ['Receiver: Seva Student Hostel', 'receiver2@demo.test'], ['Receiver: Wakad Relief Center', 'receiver3@demo.test'], ['Admin', 'admin@demo.test']];

function loginPage() {
  return topPub() + `<main id="main" class="wrap pg">
  <div class="auth-grid">
    <div class="auth-card">
      <div class="auth-header">
        <span class="auth-badge">Security Gateway</span>
        <h1 style="font-size:2.2rem;margin:10px 0 6px">Log in to ${BRAND}</h1>
        <p class="auth-sub">Manage donations, dispatch volunteer couriers, or coordinate emergency shelter deliveries across the city corridor.</p>
      </div>
      <form class="f auth-form" data-form="login">
        <label>
          <span>Email Address</span>
          <input name="email" type="email" placeholder="name@organization.org" required>
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" placeholder="••••••••" required>
        </label>
        <button class="btn p full" style="font-size:1.02rem;padding:14px;font-weight:700">Enter Platform</button>
      </form>
      <div class="auth-footer-links">
        <p class="mut" style="font-size:0.85rem;margin:0 0 10px">By signing in, you agree to our <a href="#/terms">Terms and Conditions</a> and <a href="#/privacy">Privacy Policy</a>.</p>
        <p style="margin:0;font-size:0.92rem;font-weight:600">Need an account? Register as <a href="#/register/donor">Donor</a>, <a href="#/register/rider">Courier</a>, or <a href="#/register/receiver">Shelter</a>.</p>
      </div>
    </div>

    <div class="auth-demo-card">
      <div class="auth-demo-header">
        <div>
          <span class="auth-badge" style="background:var(--ivory);border:1px solid var(--line);color:var(--ink)">Instant Sandbox</span>
          <h2 style="font-size:1.35rem;margin:6px 0 2px">Switch Role Profile</h2>
          <p class="mut" style="margin:0;font-size:0.85rem">One-click test authentication (demo password: demo1234)</p>
        </div>
      </div>
      <div class="persona-grid">
        <div class="persona-item" data-act="demo" data-e="donor@demo.test">
          <div class="persona-icon-box">${ic('box')}</div>
          <div class="persona-info">
            <div class="persona-meta"><span class="persona-role">Donor Facility</span><span class="persona-action">Enter &rarr;</span></div>
            <div class="persona-name">Shree Kitchen</div>
            <div class="persona-desc">Post surplus batches, track pickup timelines & expiry buffers</div>
          </div>
        </div>
        <div class="persona-item" data-act="demo" data-e="rider@demo.test">
          <div class="persona-icon-box">${ic('truck')}</div>
          <div class="persona-info">
            <div class="persona-meta"><span class="persona-role">Volunteer Courier</span><span class="persona-action">Enter &rarr;</span></div>
            <div class="persona-name">Arjun Patil</div>
            <div class="persona-desc">Two-wheeler courier, reserved capacity routes, live updates</div>
          </div>
        </div>
        <div class="persona-item" data-act="demo" data-e="receiver@demo.test">
          <div class="persona-icon-box">${ic('home')}</div>
          <div class="persona-info">
            <div class="persona-meta"><span class="persona-role">Receiving Shelter</span><span class="persona-action">Enter &rarr;</span></div>
            <div class="persona-name">Asha Shelter</div>
            <div class="persona-desc">Publish real-time demand, accept incoming deliveries</div>
          </div>
        </div>
        <div class="persona-item" data-act="demo" data-e="admin@demo.test">
          <div class="persona-icon-box">${ic('shield')}</div>
          <div class="persona-info">
            <div class="persona-meta"><span class="persona-role">Network Admin</span><span class="persona-action">Enter &rarr;</span></div>
            <div class="persona-name">System Control</div>
            <div class="persona-desc">Corridor oversight, live simulator lab, full audit logs</div>
          </div>
        </div>
      </div>
      <div class="auth-others-section">
        <span style="font-size:0.8rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:10px">Other Participating Facilities</span>
        <div class="persona-chips-row">
          <button class="persona-chip-btn" data-act="demo" data-e="donor2@demo.test">Annapurna Caterers (Donor)</button>
          <button class="persona-chip-btn" data-act="demo" data-e="rider2@demo.test">Meera Shah (Van)</button>
          <button class="persona-chip-btn" data-act="demo" data-e="rider3@demo.test">Neha Rao (Cycle)</button>
          <button class="persona-chip-btn" data-act="demo" data-e="receiver2@demo.test">Seva Student Hostel</button>
          <button class="persona-chip-btn" data-act="demo" data-e="receiver3@demo.test">Wakad Relief Center</button>
        </div>
      </div>
    </div>
  </div>
</main>` + footer();
}

function registerPage(role) {
  return topPub() + `<main id="main" class="wrap pg"><h1 style="font-size:2.2rem">Register as ${role}</h1><div class="row" style="margin-bottom:16px">${['donor', 'rider', 'receiver'].map(r => `<a class="btn s ${r === role ? 'p' : ''}" href="#/register/${r}">${r}</a>`).join('')}</div><form class="f" data-form="register" data-role="${role}">${F[role].map(f => field(f, '', true)).join('')}${role === 'rider' ? '<p class="full mut">Verification status: new riders are pending until an admin verifies them.</p>' : ''}<p class="full mut">Categories: ${(PUB?.cats || ['Cooked meals', 'Packaged food', 'Dry rations', 'Bakery', 'Produce', 'Drinking water']).join(', ')}. Registering means you accept the <a href="#/terms">Terms and Conditions</a> and <a href="#/privacy">Privacy Policy</a>.</p><button class="btn p full" style="justify-self:start">Create account</button></form></main>` + footer();
}
const LEGAL = {
  privacy: ['Privacy Policy', [['Scope', 'This policy covers the prototype version of ' + BRAND + '. It is a demonstration service, and you should not enter real personal data unless the operator running it has told you how it is handled.'], ['What we store', 'Account details you enter at registration (name, email, phone, address, coordinates, and role specific profile fields), donations, requests, assignments, notifications and an event log of status changes.'], ['How it is used', 'Data is used only to run the donation workflow: matching, safety checks, notifications, and audit history. Counterparties in a delivery can see the contact details needed to complete it.'], ['Sharing', 'Contact details are shown only to users who share an active request or assignment with you, and to admins. Nothing is sold or used for advertising.'], ['Location', 'Coordinates are used to compute distance and travel time. Riders and organizations choose what location they enter.'], ['Retention and deletion', 'Data stays in the local data file of the running instance. Operators can delete it by resetting the demo or removing the data folder. Ask the operator to remove an individual account.'], ['Security', 'Passwords are stored as salted hashes. This prototype has not had a security audit, so treat it as non production.'], ['Contact', 'Questions go to contact@surplusrelay.example.']]],
  terms: ['Terms and Conditions', [['Prototype status', BRAND + ' is a prototype provided as is, without warranties of availability or fitness for a particular purpose.'], ['Accounts', 'Keep your credentials private and give accurate profile information, including location, capacity and resources.'], ['Donor responsibilities', 'Donors state truthfully the category, quantity, expiry time, packaging and handling of what they offer. The platform helps check timing and compatibility but does not inspect food.'], ['Receiver responsibilities', 'Receivers keep demand, resources and receiving hours current, and confirm or decline help within the time shown.'], ['Rider responsibilities', 'Riders accept only deliveries they can complete safely, follow local traffic laws and report delays or failures promptly.'], ['Timers and releases', 'If a pending step times out, reservations are released automatically and the system may reassign the donation.'], ['Food safety', 'Final responsibility for safe handling stays with donors, riders and receivers under applicable food safety rules.'], ['Limits of liability', 'To the extent allowed by law, the operator is not liable for losses arising from use of the prototype.'], ['Changes', 'Terms may change as the prototype changes. Continued use means you accept the current version.']]]
};
function legal(k) { const [t, s] = LEGAL[k]; return topPub() + `<main id="main" class="wrap pg legal"><h1 style="font-size:2.4rem">${t}</h1>${s.map(([h, b]) => `<h2>${h}</h2><p>${b}</p>`).join('')}</main>` + footer(); }

/* ---------- expansive interactive proximity radar ---------- */
function ring(items, center, small) {
  const W = 720, c = W / 2, max = Math.max(5, Math.ceil(Math.max(...items.map(i => i.km || 0), 1) / 5) * 5);
  const rings = [.25, .5, .75, 1].map(f => {
    const r = f * c * .82;
    return `<circle cx="${c}" cy="${c}" r="${r}" class="radar-grid-ring"/><rect x="${c + r - 26}" y="${c - 10}" width="52" height="18" rx="4" class="radar-tag-bg"/><text x="${c + r}" y="${c + 3}" text-anchor="middle" font-family="var(--fb)" font-weight="700" font-size="10" fill="var(--mut)">${+(f * max).toFixed(1)} km</text>`;
  }).join('');

  const sweep = `
    <defs>
      <radialGradient id="radarSweepGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#C2571A" stop-opacity="0.28" />
        <stop offset="70%" stop-color="#C2571A" stop-opacity="0.06" />
        <stop offset="100%" stop-color="#C2571A" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="sweepLineGrad" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#C2571A" stop-opacity="0.1" />
        <stop offset="100%" stop-color="#C2571A" stop-opacity="0.8" />
      </linearGradient>
    </defs>
    <g class="radar-sweep-pivot" style="transform-origin:${c}px ${c}px">
      <path d="M ${c} ${c} L ${c} ${c - c * 0.85} A ${c * 0.85} ${c * 0.85} 0 0 1 ${c + c * 0.6} ${c - c * 0.6} Z" fill="url(#radarSweepGrad)" />
      <line x1="${c}" y1="${c}" x2="${c}" y2="${c - c * 0.85}" stroke="url(#sweepLineGrad)" stroke-width="2" />
    </g>
  `;

  const crosshairs = `
    <line x1="${c - c * 0.85}" y1="${c}" x2="${c + c * 0.85}" y2="${c}" class="radar-crosshair" />
    <line x1="${c}" y1="${c - c * 0.85}" x2="${c}" y2="${c + c * 0.85}" class="radar-crosshair" />
  `;

  const dots = items.map((it, i) => {
    const a = i / items.length * Math.PI * 2 - Math.PI / 2 + .35;
    const r = Math.max(.14, (it.km || 0) / max) * c * .82;
    const x = c + r * Math.cos(a);
    const y = c + r * Math.sin(a);
    const s = 11 + Math.min(20, Math.sqrt(it.qty) * 2.2);
    const isSel = sel === it.id;
    const badgeW = Math.max(90, it.name.length * 6.5 + 24);

    return `
      <g class="radar-node ${it.cls}${isSel ? ' sel' : ''}" ${small ? '' : `tabindex="0" role="button" data-sel="${it.id}"`} aria-label="${esc(it.name)}, ${it.km} km, ${it.qty} units">
        <line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="var(--line)" stroke-width="1.2" stroke-dasharray="3 4" opacity="0.6" />
        <circle cx="${x}" cy="${y}" r="${s + 9}" class="radar-halo" />
        <circle cx="${x}" cy="${y}" r="${s}" class="radar-core" />
        <circle cx="${x}" cy="${y}" r="${Math.max(4, s * 0.38)}" fill="#FAF6EF" opacity="0.9" />
        <g transform="translate(${x}, ${y + s + 10})">
          <rect x="${-badgeW / 2}" y="0" width="${badgeW}" height="28" rx="6" class="radar-label-badge" />
          <text x="0" y="13" text-anchor="middle" class="node-title">${esc(it.name)}</text>
          <text x="0" y="23" text-anchor="middle" class="node-sub">${it.km} km • ${it.qty} ${esc(it.unit || 'units')}</text>
        </g>
      </g>
    `;
  }).join('');

  return `
    <div class="ringsvg-container">
      <svg viewBox="0 0 ${W} ${W}" class="ringsvg" role="group" aria-label="Distance proximity radar around ${esc(center)}">
        <circle cx="${c}" cy="${c}" r="${c * 0.85}" fill="#FAF6EF" />
        ${crosshairs}
        ${rings}
        ${sweep}
        <circle cx="${c}" cy="${c}" r="16" class="radar-center-pulse" />
        <circle cx="${c}" cy="${c}" r="10" class="radar-center-dot" />
        <rect x="${c - 75}" y="${c + 18}" width="150" height="24" rx="6" fill="var(--ink)" />
        <text x="${c}" y="${c + 34}" text-anchor="middle" font-family="var(--fb)" font-weight="800" font-size="11" fill="#FAF6EF">${esc(center)}</text>
        ${dots}
      </svg>
    </div>
  `;
}

const legendHtml = `<div class="row" style="gap:24px;margin:12px 0 20px;font-size:0.88rem;font-weight:600"><span><i class="sw" style="background:var(--g)"></i>Compatible</span><span><i class="sw" style="background:var(--a)"></i>Compatible (expires &lt; 2h)</span><span><i class="sw" style="background:#E7E1D3;border:2px solid var(--r)"></i>Incompatible / Capacity block</span></div>`;

function sortFilter(items) {
  let l = items.filter(i => (!flt.cat || i.cat === flt.cat) && (!flt.ok || i.ok));
  const k = { distance: (a, b) => a.km - b.km, urgency: (a, b) => a.exp - b.exp, quantity: (a, b) => b.qty - a.qty, compatibility: (a, b) => (b.ok - a.ok) || a.km - b.km }[flt.sort];
  return l.sort(k);
}

const controls = () => `<div class="row" style="margin:14px 0 10px;gap:18px"><label>Sort<select data-flt="sort">${['distance', 'urgency', 'quantity', 'compatibility'].map(x => `<option ${flt.sort === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label>Category<select data-flt="cat"><option value="">All Categories</option>${S.cats.map(x => `<option ${flt.cat === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label style="grid-auto-flow:column;align-items:center;font-weight:700"><input type="checkbox" data-flt="ok" ${flt.ok ? 'checked' : ''}> Compatible only</label></div>`;

let routeMapCounter = 0;
function routeMap3D(fromName, toName, km, mins, ok) {
  const uid = ++routeMapCounter;
  const dist = km != null ? km : '2.4';
  const duration = mins != null ? mins : (Math.round(parseFloat(dist) * 3.5) || '8');
  return `
    <div class="route-3d-stage">
      <div class="route-3d-box">
        <div class="route-3d-header">
          <span>3D SATELLITE DISPATCH CORRIDOR</span>
          <span class="route-3d-badge">Live Courier Path</span>
        </div>
        <svg class="route-3d-svg" viewBox="0 0 460 210">
          <defs>
            <linearGradient id="route-path-grad-${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#FF5722" />
              <stop offset="50%" stop-color="#F59E0B" />
              <stop offset="100%" stop-color="#10B981" />
            </linearGradient>
            <filter id="route-line-glow-${uid}" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#FF5722" flood-opacity="0.6" />
            </filter>
            <pattern id="route-grid-pat-${uid}" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.6" />
            </pattern>
          </defs>

          <!-- Satellite Ground Plane -->
          <rect width="460" height="210" fill="#0B1320" />
          <rect width="460" height="210" fill="url(#route-grid-pat-${uid})" />

          <!-- Urban Green Zones -->
          <path d="M 10 10 Q 70 20 60 70 Q 20 80 10 10 Z" fill="#14532D" opacity="0.6" />
          <circle cx="35" cy="40" r="12" fill="#166534" opacity="0.8" />
          <circle cx="50" cy="50" r="10" fill="#22C55E" opacity="0.7" />

          <path d="M 230 130 Q 300 120 310 180 Q 240 190 230 130 Z" fill="#14532D" opacity="0.6" />
          <circle cx="265" cy="155" r="14" fill="#15803D" opacity="0.8" />
          <circle cx="285" cy="165" r="11" fill="#4ADE80" opacity="0.7" />

          <!-- Asphalt Roadways -->
          <g stroke="#1E293B" stroke-width="12" stroke-linecap="round">
            <path d="M 20 120 L 440 120" />
            <path d="M 120 20 L 120 190" />
            <path d="M 330 20 L 330 190" />
            <path d="M 20 50 L 440 50" />
          </g>
          <g stroke="#F59E0B" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.65">
            <path d="M 20 120 L 440 120" />
            <path d="M 120 20 L 120 190" />
            <path d="M 330 20 L 330 190" />
            <path d="M 20 50 L 440 50" />
          </g>

          <!-- 3D City Buildings -->
          <polygon points="50,110 90,110 105,125 65,125" fill="rgba(0,0,0,0.5)" />
          <polygon points="50,80 90,80 90,110 50,110" fill="#1E293B" stroke="#334155" stroke-width="0.8" />
          <polygon points="90,80 100,70 100,100 90,110" fill="#0F172A" />
          <polygon points="50,80 60,70 100,70 90,80" fill="#334155" stroke="#475569" stroke-width="0.8" />

          <polygon points="170,110 220,110 238,128 188,128" fill="rgba(0,0,0,0.5)" />
          <polygon points="170,65 220,65 220,110 170,110" fill="#1E3A8A" stroke="#38BDF8" stroke-width="0.8" />
          <polygon points="220,65 232,53 232,98 220,110" fill="#0F172A" />
          <polygon points="170,65 182,53 232,53 220,65" fill="#2563EB" stroke="#60A5FA" stroke-width="0.8" />
          <circle cx="206" cy="59" r="4" fill="none" stroke="#FBBF24" stroke-width="1" />

          <polygon points="360,110 400,110 415,125 375,125" fill="rgba(0,0,0,0.5)" />
          <polygon points="360,82 400,82 400,110 360,110" fill="#1E293B" stroke="#334155" stroke-width="0.8" />
          <polygon points="400,82 410,72 410,100 400,110" fill="#0F172A" />
          <polygon points="360,82 370,72 410,72 400,82" fill="#334155" />

          <!-- Dispatch Route Path -->
          <path id="transit-route-track-${uid}" d="M 70 120 L 120 120 L 120 50 L 330 50 L 330 120 L 390 120" fill="none" stroke="url(#route-path-grad-${uid})" stroke-width="4.5" filter="url(#route-line-glow-${uid})" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Donor Pin (Origin) -->
          <g transform="translate(70, 120)">
            <ellipse cx="0" cy="8" rx="10" ry="4" fill="rgba(0,0,0,0.6)" />
            <circle r="16" fill="none" stroke="#FF5722" stroke-width="1.2" opacity="0.7">
              <animate attributeName="r" values="8;22" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="7" fill="#FF5722" stroke="#FFFFFF" stroke-width="2" />
            <rect x="-42" y="-28" width="84" height="18" rx="4" fill="#0F172A" stroke="#FF5722" stroke-width="1" />
            <text y="-16" text-anchor="middle" font-family="var(--fb)" font-weight="800" font-size="8.5" fill="#FFA56E">PICKUP: ${esc(fromName).slice(0, 13)}</text>
          </g>

          <!-- Receiver Pin (Destination) -->
          <g transform="translate(390, 120)">
            <ellipse cx="0" cy="8" rx="10" ry="4" fill="rgba(0,0,0,0.6)" />
            <circle r="16" fill="none" stroke="#10B981" stroke-width="1.2" opacity="0.7">
              <animate attributeName="r" values="8;22" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="7" fill="#10B981" stroke="#FFFFFF" stroke-width="2" />
            <rect x="-44" y="-28" width="88" height="18" rx="4" fill="#0F172A" stroke="#10B981" stroke-width="1" />
            <text y="-16" text-anchor="middle" font-family="var(--fb)" font-weight="800" font-size="8.5" fill="#4ADE80">DROP-OFF: ${esc(toName).slice(0, 13)}</text>
          </g>

          <!-- Animated Rider Scooter Following Path via SVG animateMotion -->
          <g>
            <animateMotion dur="4.5s" repeatCount="indefinite" rotate="auto">
              <mpath href="#transit-route-track-${uid}" />
            </animateMotion>
            <ellipse cx="0" cy="5" rx="7" ry="2.5" fill="rgba(0,0,0,0.7)" />
            <rect x="-7" y="-5" width="14" height="10" rx="2.5" fill="#C2571A" stroke="#FFA56E" stroke-width="1" />
            <circle cx="-3" cy="5" r="2.5" fill="#0F172A" stroke="#94A3B8" stroke-width="0.7" />
            <circle cx="3" cy="5" r="2.5" fill="#0F172A" stroke="#94A3B8" stroke-width="0.7" />
            <polygon points="7,-2 14,-5 14,3 7,1" fill="#FEF08A" opacity="0.6" />
          </g>

          <!-- Telemetry Footer Overlay -->
          <text x="14" y="198" font-family="monospace" font-size="8.5" fill="rgba(255,255,255,0.45)" letter-spacing="0.5">EST. TRANSIT: ~${duration} MIN &bull; ACTIVE CORRIDOR VECTOR &bull; DISPATCH READY</text>
        </svg>
        <div class="route-metric-pill-row" style="padding:0 14px">
          <div class="route-metric-pill"><span>Direct Distance:</span> <b class="accent" style="color:var(--orange)">${dist} km</b></div>
          <div class="route-metric-pill"><span>Rider Transit:</span> <b class="accent" style="color:#0284C7">~${duration} min</b></div>
          <div class="route-metric-pill"><span>Safety Clearance:</span> <b class="accent" style="color:#10B981">${ok ? 'Feasible' : 'Tight Buffer'}</b></div>
        </div>
      </div>
    </div>
  `;
}

function emergency() {
  const me = S.me;
  if (me.role === 'receiver' || me.role === 'rider' || me.role === 'admin') {
    const receiverId = me.role === 'receiver' ? me.id : (S.users.find(u => u.role === 'receiver')?.id || 'u6');
    const receiverObj = usr(receiverId) || { name: 'Asha Shelter', needs: { 'Cooked meals': 40 } };
    const items = S.donations.filter(d => d.status === 'Available').map(d => {
      const f = S.fits[d.id + ':' + receiverId] || {}, dn = usr(d.donorId) || { name: 'Donor Kitchen' };
      return { 
        id: d.id, 
        name: dn.name, 
        km: f.km || 2.4, 
        qty: d.remaining, 
        unit: d.unit, 
        cat: d.category, 
        exp: d.expiresAt, 
        mins: f.mins || 8, 
        safety: d.safety || [], 
        ok: f.ok != null ? f.ok : true, 
        why: f.why || [], 
        need: Math.min(d.remaining, (receiverObj.needs || {})[d.category] || 30), 
        cls: (f.ok !== false) ? (d.expiresAt - T() < 72e5 ? 'amber' : 'green') : 'bad' 
      };
    });
    const list = sortFilter(items);
    const cur = list.find(i => i.id === sel) || list[0];

    return `
      <div class="radar-command-deck">
        <div class="radar-hud-bar">
          <div>
            <span style="font-size:0.75rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--orange)">Live Corridor Telemetry</span>
            <div style="font-family:var(--fd);font-weight:700;font-size:1.25rem">${esc(receiverObj.name)} &bull; Nearby Donors Radar</div>
          </div>
          <div class="radar-hud-pills">
            <span class="radar-hud-pill active">&bull; 360&deg; Live Radar Active</span>
            <span class="radar-hud-pill">${list.length} Donors In Range</span>
            <span class="radar-hud-pill" style="color:#6BCB77">&bull; ${list.filter(i => i.ok).length} Compatible</span>
            <span class="radar-hud-pill" style="color:#FFA56E">&bull; ${list.filter(i => i.cls === 'amber').length} Urgent</span>
          </div>
        </div>

        ${controls()}
        ${legendHtml}

        <div class="ringwrap">
          ${list.length ? ring(list, receiverObj.name) : '<div class="card"><p class="mut">No donors match these filters in the immediate corridor.</p></div>'}
          <div>
            ${cur ? detailR(cur) : `
              <div class="radar-inspect-hud">
                <span class="auth-badge">Inspection HUD</span>
                <h3 style="font-size:1.35rem;margin:8px 0 6px">Proximity Inspector</h3>
                <p class="mut" style="line-height:1.5">Click any circular radar node or table row to inspect food safety, travel duration, remaining shelf-life, and dispatch couriers directly to your shelter.</p>
                <div class="radar-kpi-row">
                  <div class="radar-kpi-box"><div class="val">${list.length}</div><div class="lbl">Total In Range</div></div>
                  <div class="radar-kpi-box"><div class="val">${list.filter(i => i.ok).length}</div><div class="lbl">Instant Matches</div></div>
                </div>
              </div>
            `}
          </div>
        </div>

        <h2 style="font-size:1.6rem;margin-top:40px">All Available Donors on Corridor</h2>
        <div class="scroll">
          <table>
            <caption class="mut" style="text-align:left;margin-bottom:8px">Live sensor feeds aligned with radar targets. Click Inspect on any row to lock on.</caption>
            <thead><tr><th>Donor Facility</th><th>Distance</th><th>Batch Surplus</th><th>Category</th><th>Expires in</th><th>Transit Est.</th><th>Safety Specs</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${list.map(i => `<tr><td><b>${esc(i.name)}</b></td><td>${i.km} km</td><td><b>${i.qty}</b> ${esc(i.unit)}</td><td>${esc(i.cat)}</td><td>${timer(i.exp)}</td><td>${i.mins} min</td><td>${esc(i.safety.join(', ') || 'Standard')}</td><td>${i.ok ? chip('Compatible') : chip('Blocked')}${i.ok ? '' : `<br><small class="mut">${esc(i.why.join('; '))}</small>`}</td><td><button class="btn s ${cur && cur.id === i.id ? 'p' : ''}" data-sel="${i.id}">Inspect</button></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  const mine = S.donations.filter(d => d.donorId === me.id && d.status === 'Available');
  const d = mine.length ? (mine.find(x => x.id === sel2) || mine[0]) : (S.donations.find(x => x.status === 'Available') || S.donations[0] || { id: 'd1', category: 'Cooked meals', remaining: 45, unit: 'portions' });
  const items = S.users.filter(u => u.role === 'receiver').map(r => {
    const f = S.fits[(d?.id || '') + ':' + r.id] || {}, need = (r.needs || {})[d?.category || 'Cooked meals'] || 0;
    return { id: r.id, name: r.name, km: f.km || 2.4, qty: need, cat: d?.category || 'Cooked meals', exp: d?.expiresAt || (T() + 72e5), ok: f.ok != null ? f.ok : true, why: f.why || [], r, cls: (f.ok !== false) ? 'green' : 'bad', demand: Object.values(r.needs || {}).reduce((a, b) => a + b, 0) };
  });
  const list = sortFilter(items);
  const cur = list.find(i => i.id === sel) || list[0];

  return `
    <div class="radar-command-deck">
      <div class="radar-hud-bar">
        <div>
          <span style="font-size:0.75rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--orange)">Live Corridor Telemetry</span>
          <div style="font-family:var(--fd);font-weight:700;font-size:1.25rem">${esc(me.name)} &bull; Receiving Shelters Radar</div>
        </div>
        <div class="radar-hud-pills">
          <span class="radar-hud-pill active">&bull; 360&deg; Radar Scanning</span>
          <span class="radar-hud-pill">${list.length} Shelters Monitored</span>
          <span class="radar-hud-pill" style="color:#6BCB77">&bull; ${list.filter(i => i.ok).length} Compatible</span>
        </div>
      </div>

      <div style="margin:16px 0">
        <label style="max-width:440px;font-weight:700">Donation batch to target<select data-sel2>${mine.map(x => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(x.category)}, ${x.remaining} ${esc(x.unit)}</option>`).join('')}</select></label>
      </div>

      ${controls()}
      ${legendHtml}

      <div class="ringwrap">
        ${ring(list, S.me.name)}
        <div>
          ${cur ? `
            <div class="radar-inspect-hud">
              <span class="auth-badge">Shelter Target Locked</span>
              <h3 style="font-size:1.4rem;margin:8px 0 4px">${esc(cur.name)}</h3>
              <p class="mut" style="margin:0 0 16px">${cur.km} km away &bull; Receiving hours ${cur.r.hours?.join(' to ')}h</p>
              <div class="radar-kpi-row">
                <div class="radar-kpi-box"><div class="val">${cur.qty}</div><div class="lbl">Category Need</div></div>
                <div class="radar-kpi-box"><div class="val">${cur.r.occupancy}/${cur.r.capacity}</div><div class="lbl">Occupancy</div></div>
              </div>
              <p style="margin:12px 0">${cur.ok ? chip('Compatible Match') : chip('Blocked: ' + cur.why.join('; '))}</p>
              ${routeMap3D(S.me.name, cur.name, cur.km, Math.round(cur.km * 3.5), cur.ok)}
              <button class="btn p full" data-act="offer" data-id="${d.id}" data-to="${cur.id}" ${cur.ok ? '' : 'disabled'} style="font-size:1.02rem;padding:12px">Offer Batch to Shelter</button>
            </div>
          ` : `
            <div class="radar-inspect-hud">
              <span class="auth-badge">Inspection HUD</span>
              <h3 style="font-size:1.35rem;margin:8px 0 6px">Target Shelter Inspector</h3>
              <p class="mut" style="line-height:1.5">Click any circular shelter node on the radar to inspect storage compatibility, current bed occupancy, and directly dispatch an allocation offer.</p>
              <div class="radar-kpi-row">
                <div class="radar-kpi-box"><div class="val">${list.length}</div><div class="lbl">Shelters in Radius</div></div>
                <div class="radar-kpi-box"><div class="val">${list.filter(i => i.ok).length}</div><div class="lbl">Ready for Dropoff</div></div>
              </div>
            </div>
          `}
        </div>
      </div>

      <h2 style="font-size:1.6rem;margin-top:40px">Nearby Receiving Shelters</h2>
      <div class="scroll">
        <table>
          <thead><tr><th>Shelter Facility</th><th>Distance</th><th>Needs This Cat</th><th>Occupancy / Cap</th><th>Total Demand</th><th>Compatibility</th><th>Action</th></tr></thead>
          <tbody>${list.map(i => `<tr><td><b>${esc(i.name)}</b></td><td>${i.km} km</td><td><b>${i.qty}</b> ${esc(d.unit)}</td><td>${i.r.occupancy}/${i.r.capacity}</td><td>${i.demand}</td><td>${i.ok ? chip('Compatible') : chip('Blocked')}</td><td><button class="btn s ${sel === i.id ? 'p' : ''}" data-sel="${i.id}">Inspect</button></td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

const detailR = i => `
  <div class="radar-inspect-hud">
    <span class="auth-badge">Facility Target Locked</span>
    <h3 style="font-size:1.4rem;margin:8px 0 4px">${esc(i.name)}</h3>
    <p class="mut" style="margin:0 0 16px">${i.km} km away &bull; ~${i.mins} min transit time</p>
    <div class="radar-kpi-row">
      <div class="radar-kpi-box"><div class="val">${i.qty}</div><div class="lbl">${esc(i.unit)} Available</div></div>
      <div class="radar-kpi-box"><div class="val">${timer(i.exp)}</div><div class="lbl">Safe Window</div></div>
    </div>
    <p style="margin:10px 0;font-size:0.88rem"><b>Safety:</b> ${esc(i.safety.join(', ') || 'Standard Packaging')}</p>
    <p style="margin:10px 0">${i.ok ? chip('Compatible') : chip('Blocked: ' + i.why.join('; '))}</p>
    ${routeMap3D(i.name, S.me.name, i.km, i.mins, i.ok)}
    ${i.ok ? `
      <form class="f" data-form="request" data-id="${i.id}" style="grid-template-columns:1fr auto;align-items:end;margin-top:16px;gap:12px">
        <label><span>Request Portions (max ${i.need})</span><input name="qty" type="number" min="1" max="${i.need}" value="${i.need}" required></label>
        <button class="btn p" style="padding:12px 18px">Request Batch</button>
      </form>
    ` : ''}
  </div>
`;

/* ---------- dashboards with bold clean hierarchy ---------- */
const notesBox = () => `<section class="card" aria-label="Notifications"><h3 style="font-family:var(--fd);font-size:1.2rem">${ic('bell')}Notifications</h3>${S.notes.length ? S.notes.slice(-6).reverse().map(n => `<div class="note ${n.level}">${esc(n.msg)}<br><small class="mut">${new Date(n.t).toLocaleTimeString()}</small></div>`).join('') : '<p class="mut">No notifications yet.</p>'}</section>`;
const tbl = (h, rows, empty) => rows.length ? `<div class="scroll"><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="mut">${empty}</p>`;

function donorView() {
  const me = S.me, ds = S.donations.filter(d => d.donorId === me.id).sort((a, b) => b.expiresAt - a.expiresAt), pend = S.requests.filter(q => q.status === 'Pending donor approval');
  const alerts = pend.map(q => {
    const d = ds.find(x => x.id === q.donationId), r = usr(q.receiverId);
    return `<div class="alert" role="alert"><b style="font-size:1.05rem;font-family:var(--fd)">${ic('alert')}Urgent request from ${esc(r.name)}</b><p style="margin:8px 0">${q.qty} ${esc(d.unit)} of ${esc(d.category)}. Distance ${q.info.km} km, about ${q.info.mins} min delivery, ${q.info.slack >= 0 ? q.info.slack + ' min spare before safety buffer' : 'expiry not feasible'}. Contact: ${esc(r.manager || '')} (${esc(r.phone || '')}). Decision buffer: ${timer(q.expiresAt)}</p><div class="row"><button class="btn p" data-act="respond" data-id="${q.id}" data-v="1">Accept Request</button><button class="btn d" data-act="respond" data-id="${q.id}" data-v="0">Reject</button></div></div>`;
  }).join('');
  const riders = S.users.filter(u => u.role === 'rider' && u.donorId === me.id);

  return `
    ${alerts}
    <div class="dash-kpi-row">
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${ds.filter(d => d.status === 'Available').length}</div>
        <div class="dash-kpi-lbl">Active Available Batches</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${pend.length}</div>
        <div class="dash-kpi-lbl">Awaiting Your Approval</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${riders.filter(r => r.verified).length}</div>
        <div class="dash-kpi-lbl">Verified Facility Riders</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${ds.reduce((acc, d) => acc + (d.qty || 0), 0)}</div>
        <div class="dash-kpi-lbl">Total Portions Posted</div>
      </div>
    </div>

    <div class="dash">
      <div>
        <h2 style="font-size:1.6rem">Your Donations</h2>
        ${tbl(['Donation Batch', 'Remaining / Total', 'Status', 'Expiry Buffer', 'Action'], ds.map(d => [`<b>${esc(d.category)}</b><br><small class="mut">${esc(d.safety.join(', '))}</small>${S.requests.filter(q => q.donationId === d.id).map(q => `<details><summary>Request from ${esc(usr(q.receiverId).name)}: ${esc(q.status)}</summary>${tl(q)}</details>`).join('')}<details><summary>Timeline</summary>${tl(d)}</details>`, `<b>${d.remaining}</b> / ${d.qty} ${esc(d.unit)}`, chip(d.status), ['Delivered', 'Receiver confirmed', 'Expired', 'Cancelled'].includes(d.status) ? '' : timer(d.expiresAt), ['Available', 'Request pending', 'Accepted', 'Rider assignment pending', 'Rider assigned', 'Receiver confirmation pending'].includes(d.status) ? `<button class="btn s d" data-act="cancelDon" data-id="${d.id}" data-confirm="Cancel this donation?">Cancel</button>` : '']), 'No donations posted yet. Use the form below.')}
        
        <h2 style="margin-top:36px;font-size:1.6rem">Post a New Surplus Donation</h2>
        <form class="f card" data-form="donation">
          <label>Category<select name="category">${S.cats.map(c => `<option>${c}</option>`).join('')}</select></label>
          <label>Quantity<input name="qty" type="number" min="1" required></label>
          <label>Unit<input name="unit" value="portions" required></label>
          <label>Safe Shelf Life (minutes)<input name="expiresInMin" type="number" min="1" value="180" required></label>
          <label class="full">Pickup Location Address<input name="pickup" value="${esc(me.address || '')}"></label>
          <label class="full">Packaging Specifications<input name="packaging" placeholder="Sealed thermal boxes, containers..."></label>
          <fieldset class="full" style="border:1.5px solid var(--line);border-radius:8px;padding:14px">
            <legend style="font-weight:700;font-size:0.9rem">Safety Requirements</legend>
            ${['Keep hot', 'Refrigerated', 'Needs cooking', 'Sealed packaging', 'Allergen labelled'].map(s => `<label style="display:inline-flex;grid-auto-flow:column;gap:6px;margin-right:16px;font-weight:600"><input type="checkbox" name="safety" value="${s}"> ${s}</label>`).join('')}
          </fieldset>
          <button class="btn p full" style="justify-self:start;font-size:1.02rem;padding:12px 24px;font-weight:700">Post Surplus Batch</button>
        </form>
      </div>
      <aside style="display:grid;gap:20px;align-content:start">
        ${notesBox()}
        <section class="card">
          <h3 style="font-family:var(--fd);font-size:1.2rem">${ic('truck')}Associated Couriers</h3>
          ${riders.length ? riders.map(r => `<p style="margin:0 0 10px"><b>${esc(r.name)}</b> &bull; ${esc(r.vehicle)}, capacity ${r.cap}<br>${chip(r.verified ? r.status : 'Pending verification')}</p>`).join('') : '<p class="mut">No couriers have registered with your facility yet.</p>'}
        </section>
      </aside>
    </div>
  `;
}

function receiverView() {
  const me = S.me, rq = S.requests.slice().reverse();

  return `
    <div class="dash-kpi-row">
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${Object.values(me.needs || {}).reduce((a, b) => a + b, 0)}</div>
        <div class="dash-kpi-lbl">Total Demand (Portions)</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${rq.filter(q => ['Confirmed', 'Pending donor approval', 'Receiver confirmation pending'].includes(q.status)).length}</div>
        <div class="dash-kpi-lbl">In-Flight Relays</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${me.occupancy} / ${me.capacity}</div>
        <div class="dash-kpi-lbl">Shelter Bed Occupancy</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${rq.filter(q => q.status === 'Completed').length}</div>
        <div class="dash-kpi-lbl">Completed Relays</div>
      </div>
    </div>

    <div class="dash">
      <div>
        <h2 style="font-size:1.6rem">Active Requests & Deliveries</h2>
        ${rq.length ? rq.map(q => {
          const d = S.donations.find(x => x.id === q.donationId), as = S.asgs.filter(a => a.requestId === q.id);
          return `
            <div class="card" style="margin-bottom:16px">
              <div class="row" style="justify-content:space-between;align-items:flex-start">
                <div>
                  <b style="font-size:1.15rem;font-family:var(--fd)">${q.qty} ${esc(d.unit)} of ${esc(d.category)}</b>
                  <div class="mut" style="font-size:0.85rem">From: ${esc(usr(d.donorId).name)}</div>
                </div>
                <div class="row" style="gap:6px">${chip(q.status)} ${chip(d.status)}</div>
              </div>
              ${['Pending donor approval', 'Receiver confirmation pending'].includes(q.status) ? `<p style="margin:8px 0;font-weight:700">Approval Timer: ${timer(q.expiresAt)}</p>` : ''}
              ${as.map(a => {
                const r = usr(a.riderId);
                return `<p style="margin:8px 0;background:var(--bg);padding:8px 12px;border-radius:6px;border:1px solid var(--line)">${ic('truck')}<b>${esc(r.name)}</b> (${esc(r.vehicle || 'Vehicle')} - ${esc(r.phone || '')}): Carrying ${a.qty} ${esc(d.unit)} &bull; ${chip(a.status)} <small class="mut">(pickup ${a.route.pm}m, delivery ${a.route.dm}m)</small></p>`;
              }).join('')}
              <div class="row" style="margin-top:12px">
                ${q.status === 'Receiver confirmation pending' ? `<button class="btn p" data-act="confirm" data-id="${q.id}">Confirm Courier Assistance</button>` : ''}
                ${q.status === 'Confirmed' && d.status === 'Delivered' ? `<button class="btn p" data-act="receipt" data-id="${q.id}">Confirm Delivery Receipt</button>` : ''}
              </div>
              <details style="margin-top:10px"><summary>View Route & Handshake Timeline</summary>${tl(q)}</details>
            </div>
          `;
        }).join('') : '<div class="card"><p class="mut">No active requests. Open the Proximity Radar to find donors nearby.</p></div>'}

        <h2 style="margin-top:36px;font-size:1.6rem">Publish Demand & Shelter Capacity</h2>
        <form class="f card" data-form="needs">
          <label class="full">Current Category Needs (format: Category:Portions)<input name="needs" value="${esc(Object.entries(me.needs || {}).map(([k, v]) => k + ':' + v).join(', '))}" placeholder="Cooked meals:40, Dry rations:20"></label>
          <label>Current Bed Occupancy<input name="occupancy" type="number" min="0" value="${me.occupancy}"></label>
          <button class="btn p" style="align-self:end;font-weight:700">Update Demand Feeds</button>
        </form>
      </div>
      <aside style="display:grid;gap:20px;align-content:start">
        <section class="card">
          <h3 style="font-family:var(--fd);font-size:1.2rem">Shelter Readiness</h3>
          ${Object.entries(me.needs || {}).map(([k, v]) => `<p style="margin:4px 0"><b>${esc(k)}:</b> ${v} portions</p>`).join('') || '<p class="mut">No demand configured.</p>'}
          <p style="margin:12px 0 0;font-size:0.88rem"><b>Occupancy:</b> ${me.occupancy} of ${me.capacity} residents<br><b>Storage:</b> ${me.storage} &bull; <b>Water:</b> ${me.water ? 'Yes' : 'No'} &bull; <b>Fuel:</b> ${me.fuel ? 'Yes' : 'No'}</p>
        </section>
        ${notesBox()}
      </aside>
    </div>
  `;
}

function riderView() {
  const me = S.me, as = S.asgs.slice().reverse();
  const btn = (a, act, l, c = '') => `<button class="btn s ${c}" data-act="ride" data-id="${a.id}" data-a="${act}">${l}</button>`;

  return `
    <div class="dash-kpi-row">
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${as.filter(a => ['Reserved', 'Assigned', 'Dispatched', 'In transit'].includes(a.status)).length}</div>
        <div class="dash-kpi-lbl">Active Assignments</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${me.cap}</div>
        <div class="dash-kpi-lbl">Max Carrying Capacity</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${me.radius} km</div>
        <div class="dash-kpi-lbl">Dispatch Radius</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val" style="font-size:1.5rem;color:${me.available ? 'var(--success)' : 'var(--mut)'}">${me.available ? 'ONLINE' : 'OFFLINE'}</div>
        <div class="dash-kpi-lbl">Courier Availability</div>
      </div>
    </div>

    <div class="dash">
      <div>
        <h2 style="font-size:1.6rem">Your Route Assignments</h2>
        ${as.length ? as.map(a => {
          const d = S.donations.find(x => x.id === a.donationId), q = S.requests.find(x => x.id === a.requestId), dn = usr(d.donorId), r = usr(q.receiverId);
          return `
            <div class="card" style="margin-bottom:16px">
              <div class="row" style="justify-content:space-between;align-items:flex-start">
                <b style="font-size:1.15rem;font-family:var(--fd)">Carry ${a.qty} ${esc(d.unit)} of ${esc(d.category)}</b>
                ${chip(a.status)}
              </div>
              <p style="margin:10px 0;line-height:1.6">
                ${ic('pin')}<b>Pickup:</b> ${esc(dn.name)}, ${esc(dn.address || '')}<br>
                ${ic('home')}<b>Deliver:</b> ${esc(r.name)}, ${esc(r.address || '')} (Contact: ${esc(r.manager || '')} ${esc(r.phone || '')})<br>
                ${ic('route')}<b>Route:</b> Pickup ${a.route.pk} km (${a.route.pm}m) &bull; Delivery ${a.route.dk} km (${a.route.dm}m)<br>
                ${ic('clock')}<b>Expiry:</b> ${timer(d.expiresAt)}${a.status === 'Reserved' ? `<br><b>Accept within:</b> ${timer(a.expiresAt)}` : ''}
              </p>
              <div class="row" style="gap:8px">
                ${a.status === 'Reserved' ? `<button class="btn p s" data-act="accept" data-id="${a.id}">Accept Assignment</button>` : ''}
                ${a.status === 'Dispatched' ? btn(a, 'start', 'Start Delivery Run', 'p') : ''}
                ${a.status === 'In transit' ? btn(a, 'deliver', 'Confirm Delivery', 'p') + btn(a, 'delay', 'Report Traffic Delay') : ''}
                ${a.status === 'Delayed' ? btn(a, 'resume', 'Resume Transit') : ''}
                ${['Dispatched', 'In transit', 'Delayed', 'Assigned', 'Awaiting receiver confirmation'].includes(a.status) ? btn(a, 'fail', 'Unable to Complete', 'd') : ''}
              </div>
              <details style="margin-top:10px"><summary>Assignment Audit Timeline</summary>${tl(a)}</details>
            </div>
          `;
        }).join('') : '<div class="card"><p class="mut">No active delivery assignments. Keep your status Online to receive automated route matches.</p></div>'}
      </div>
      <aside style="display:grid;gap:20px;align-content:start">
        <section class="card">
          <h3 style="font-family:var(--fd);font-size:1.2rem">Courier Profile</h3>
          <p>${chip(me.verified ? me.status : 'Pending verification')} ${me.available ? chip('Available') : chip('Unavailable')}</p>
          <p style="margin:8px 0;line-height:1.5"><b>Vehicle:</b> ${esc(me.vehicle || 'Standard')}<br><b>Capacity:</b> ${me.cap} units<br><b>GPS Base:</b> ${(+me.lat).toFixed(4)}, ${(+me.lng).toFixed(4)}</p>
          <button class="btn p s full" data-act="toggle">${me.available ? 'Set Status: Offline' : 'Set Status: Available'}</button>
        </section>
        ${notesBox()}
      </aside>
    </div>
  `;
}

function adminView() {
  const ds = S.donations, rq = S.requests, as = S.asgs, now = T();
  const urgent = ds.filter(d => ['Available', 'Request pending', 'Accepted', 'Rider assignment pending', 'Rider assigned', 'Receiver confirmation pending'].includes(d.status) && d.expiresAt - now < 72e5);
  const closed = rq.filter(q => ['Completed', 'Cancelled', 'Timed out', 'Rejected', 'Reassigned'].includes(q.status)), done = rq.filter(q => q.status === 'Completed');
  const rate = closed.length ? Math.round(done.length / closed.length * 100) + '%' : '100%';
  const dtab = list => tbl(['Donation', 'Donor', 'Status', 'Expiry Buffer', 'Admin Action'], list.map(d => [esc(d.category) + ' ' + d.remaining + '/' + d.qty, esc(usr(d.donorId).name), chip(d.status), timer(d.expiresAt), `<button class="btn s" data-act="ov" data-a="expire" data-id="${d.id}" data-confirm="Force expire this donation?">Expire</button> <button class="btn s d" data-act="ov" data-a="cancel" data-id="${d.id}" data-confirm="Cancel this donation?">Cancel</button>`]), 'No items currently.');

  return `
    <div class="dash-kpi-row">
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${ds.length}</div>
        <div class="dash-kpi-lbl">Total Surplus Batches</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${rq.filter(q => ['Pending donor approval', 'Receiver confirmation pending'].includes(q.status)).length}</div>
        <div class="dash-kpi-lbl">Active Decision Holds</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${done.length}</div>
        <div class="dash-kpi-lbl">Completed Relays</div>
      </div>
      <div class="dash-kpi-card">
        <div class="dash-kpi-val">${rate}</div>
        <div class="dash-kpi-lbl">Network Success Rate</div>
      </div>
    </div>

    <h2 style="font-size:1.6rem">Urgent &amp; Near-Expiry Batches</h2>${dtab(urgent)}
    <h2 style="margin-top:36px;font-size:1.6rem">Pending Donor Requests</h2>${tbl(['Shelter', 'Requested Qty', 'Decision Buffer'], rq.filter(q => q.status === 'Pending donor approval').map(q => [esc(usr(q.receiverId).name), q.qty, timer(q.expiresAt)]), 'None right now.')}
    <h2 style="margin-top:36px;font-size:1.6rem">Active Courier Deliveries</h2>${tbl(['Courier', 'Carried Qty', 'Transit Status', 'Target Shelter'], as.filter(a => ['Dispatched', 'In transit', 'Delayed'].includes(a.status)).map(a => [esc(usr(a.riderId).name), a.qty, chip(a.status), esc(usr(rq.find(q => q.id === a.requestId).receiverId).name)]), 'No deliveries in progress.')}
    <h2 style="margin-top:36px;font-size:1.6rem">Participating Facilities &amp; Couriers</h2>${tbl(['Name', 'Corridor Role', 'Operational Status', 'Administrative Control'], S.users.filter(u => u.role !== 'admin').map(u => [esc(u.name), u.role, chip(u.role === 'rider' ? (u.verified ? u.status : 'Pending verification') : u.active === false ? 'Unavailable' : 'Active'), (u.role === 'rider' && !u.verified ? `<button class="btn s p" data-act="ov" data-a="verify" data-id="${u.id}">Verify</button> ` : '') + (u.role !== 'donor' ? `<button class="btn s" data-act="ov" data-a="toggle" data-id="${u.id}" data-confirm="Change availability for ${esc(u.name)}?">Toggle Status</button>` : '')]), '')}
    <h2 style="margin-top:36px;font-size:1.6rem">Live System Audit Log</h2>${tbl(['Timestamp', 'Entity', 'Status Handshake', 'Reason / Trigger'], S.events.slice(0, 40).map(e => [new Date(e.t).toLocaleTimeString(), e.k, chip(e.s), esc(e.why)]), 'No events recorded.')}
  `;
}

function lab() {
  const dn = ds => ds.map(d => `<option value="${d.id}">${esc(d.category)} ${d.id} (${d.status})</option>`).join('');
  const sim = (type, label, opts, extra = '') => `<form class="card f" data-form="sim" data-type="${type}" style="grid-template-columns:1fr auto;align-items:end"><label>${label}<select name="id">${opts || '<option value="">Nothing to target</option>'}${extra}</select></label><button class="btn">Run</button></form>`;
  const rAs = S.asgs.filter(a => !['Released', 'Completed', 'Failed'].includes(a.status)), ao = st => rAs.filter(a => st.includes(a.status)).map(a => `<option value="${a.id}">${esc(usr(a.riderId).name)}, ${a.qty} units (${a.status})</option>`).join('');
  const recv = S.users.filter(u => u.role === 'receiver').map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  return `<h1 style="font-size:2.2rem">Simulation Lab</h1><p class="mut">Each action runs through the same rules as real events. Open other dashboards in other tabs to watch them update.</p><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
${sim('riderFail', 'Rider failure', ao(['Reserved', 'Assigned', 'Awaiting receiver confirmation', 'Dispatched', 'In transit', 'Delayed']))}${sim('riderDelay', 'Rider delay', ao(['Dispatched', 'In transit']))}${sim('riderUnresponsive', 'Rider unresponsive', ao(['Reserved']))}${sim('nearExpiry', 'Donation approaching expiry', dn(S.donations.filter(d => !['Expired', 'Cancelled', 'Receiver confirmed', 'Delivered'].includes(d.status))))}${sim('expire', 'Donation expiry', dn(S.donations.filter(d => !['Expired', 'Cancelled', 'Receiver confirmed', 'Delivered'].includes(d.status))))}${sim('receiverUnavailable', 'Receiver becomes unavailable', recv)}${sim('donorReject', 'Donor rejects a request', S.requests.filter(q => q.status === 'Pending donor approval').map(q => `<option value="${q.id}">${esc(usr(q.receiverId).name)} (${q.qty})</option>`).join(''))}${sim('receiverNoConfirm', 'Receiver fails to confirm', S.requests.filter(q => q.status === 'Receiver confirmation pending').map(q => `<option value="${q.id}">${esc(usr(q.receiverId).name)} (${q.qty})</option>`).join(''))}${sim('otherRider', 'Delivery taken to another receiver', ao(['Dispatched', 'In transit']))}
<form class="card f" data-form="sim" data-type="demand" style="grid-template-columns:1fr 1fr"><label>Receiver<select name="id">${recv}</select></label><label>Category<select name="cat">${S.cats.map(c => `<option>${c}</option>`).join('')}</select></label><label>Change (negative to reduce)<input name="delta" type="number" value="20"></label><button class="btn" style="align-self:end">Change demand</button></form>
<div class="card"><h3>Notification delay</h3><p>Delays delivery of new notifications by 10 seconds (toggle).</p><button class="btn" data-act="notifyDelay">${S.cfg.notifyDelay ? 'Turn off delay' : 'Turn on delay'}</button></div></div>
<h2 style="margin-top:32px">Timers and rules</h2><form class="f card" data-form="cfg">${[['donorApproval', 'Donor approval (s)'], ['receiverConfirm', 'Receiver confirmation (s)'], ['riderReserve', 'Rider reservation (s)'], ['delayTimeout', 'Delay timeout (s)'], ['safetyBufferMin', 'Safety buffer (min)'], ['speedKmh', 'Average speed (km/h)'], ['traffic', 'Traffic multiplier']].map(([k, l]) => `<label>${l}<input name="${k}" type="number" step="any" min="0" value="${S.cfg[k]}"></label>`).join('')}<button class="btn p" style="align-self:end">Save settings</button></form>
<h2 style="margin-top:32px">Reset</h2><button class="btn d" data-act="reset" data-confirm="Reset all demo data? This removes every record.">Reset demo data</button>`;
}
function profile() {
  const me = S.me, rows = Object.entries(me).filter(([k, v]) => !['id', 'role', 'status', 'tl'].includes(k) && v !== '' && v != null).map(([k, v]) => [k, typeof v === 'object' ? (Array.isArray(v) ? v.join(', ') : Object.entries(v).map(([a, b]) => a + ':' + b).join(', ')) : v === true ? 'yes' : v === false ? 'no' : v]);
  return `<h1 style="font-size:2.2rem">Profile</h1><div class="card">${tbl(['Field', 'Value'], rows.map(([k, v]) => [esc(k), esc(v)]), '')}</div>`;
}
function shell(h) {
  const r = S.me.role, bell = S.notes.filter(n => n.level === 'urgent').length;
  const nav = `
    <header class="top">
      <div class="wrap">
        <a class="logo" href="#/">${BRAND}</a>
        <a class="l ${!h || h === '' ? 'active' : ''}" href="#/">Home</a>
        <a class="l ${h === 'app' ? 'active' : ''}" href="#/app">Dashboard</a>
        <a class="btn d s ${h === 'app/emergency' ? 'active' : ''}" href="#/app/emergency" style="gap:6px">${ic('alert')}Emergency Radar</a>
        ${r === 'admin' ? `<a class="l ${h === 'app/lab' ? 'active' : ''}" href="#/app/lab">Simulation Lab</a>` : ''}
        <a class="l ${h === 'app/profile' ? 'active' : ''}" href="#/app/profile">Profile</a>
        <button class="l" data-act="sound" aria-pressed="${sound}">${sound ? 'Sound alerts on' : 'Enable sound alerts'}</button>
        <span class="chip" title="Urgent notifications">${ic('bell')}${bell}</span>
        <span class="mut" style="font-weight:700">${esc(S.me.name)}</span>
        <button class="btn s" data-act="logout">Log out</button>
      </div>
    </header>
  `;
  let body = h === 'app/emergency' ? emergency() : h === 'app/profile' ? profile() : h === 'app/lab' && r === 'admin' ? lab() : { donor: donorView, receiver: receiverView, rider: riderView, admin: adminView }[r]();
  const title = { donor: 'Donor Dispatch Dashboard', receiver: 'Receiver Shelter Dashboard', rider: 'Courier Logistics Dashboard', admin: 'Platform Administration Console' }[r];
  return nav + `<main id="main" class="wrap pg">${h === 'app' ? `<h1 style="font-size:2.4rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:24px">${title}</h1>` : ''}${body}</main>`;
}
function render(force) {
  const a = document.activeElement;
  if (!force && a && a.closest && a.closest('#app') && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && !a.dataset.flt) { dirty = true; return; }
  dirty = false; const h = location.hash.slice(2).split('?')[0]; let html;
  if (h.startsWith('app')) {
    if (!TOK) {
      if (h === 'app/emergency') {
        ACT.demo({ e: 'receiver@demo.test' }).then(() => {
          location.hash = '#/app/emergency';
        });
        return;
      }
      location.hash = '#/login';
      return;
    }
    if (!S) return;
    html = shell(h);
  }
  else if (h === 'login') html = loginPage(); 
  else if (h.startsWith('register')) html = registerPage(h.split('/')[1] || 'donor'); 
  else if (h === 'privacy' || h === 'terms') html = legal(h); 
  else html = landing();
  const app = $('#app'); app.className = h !== lastH ? 'enter' : ''; lastH = h; app.innerHTML = html; countUp();
  if (!h || h === '/') {
    if (window.initLandingPage) setTimeout(() => window.initLandingPage(), 10);
  } else {
    if (window.cleanupLandingPage) window.cleanupLandingPage();
  }
}
addEventListener('hashchange', () => {
  sel = null;
  render(true);
  scrollTo(0, 0);
  if (location.hash.startsWith('#/app') && TOK && !S) refresh();
});
document.addEventListener('focusout', () => setTimeout(() => { if (dirty && !document.activeElement.closest?.('form')) render(); }, 50));
setInterval(() => document.querySelectorAll('[data-exp]').forEach(e => { const v = +e.dataset.exp; e.textContent = cd(v); e.classList.toggle('low', v - T() < 60000); }), 500);
setInterval(() => { if (TOK) refresh().catch(() => { }); }, 6000);

const go = async (p, b) => { await api(p, 'POST', b || {}); await refresh(); };
const ACT = {
  demo: async d => { const j = await api('/login', 'POST', { email: d.e, password: 'demo1234' }); TOK = j.token; localStorage.setItem('tok', TOK); connect(); await refresh(); location.hash = '#/app'; },
  respond: d => go(`/requests/${d.id}/respond`, { accept: d.v === '1' }), confirm: d => go(`/requests/${d.id}/confirm`), receipt: d => go(`/requests/${d.id}/receipt`),
  accept: d => go(`/asgs/${d.id}/accept`), ride: d => go(`/asgs/${d.id}/act`, { act: d.a }), toggle: () => go('/rider/toggle'),
  cancelDon: d => go(`/donations/${d.id}/cancel`), offer: async d => { await go(`/donations/${d.id}/offer`, { receiverId: d.to }); toast('Offer sent'); },
  ov: d => go('/admin/override', { action: d.a, id: d.id }), reset: async () => { await go('/admin/reset'); toast('Demo data reset'); },
  notifyDelay: async () => { const j = await api('/admin/sim', 'POST', { type: 'notifyDelay' }); toast(j.message); await refresh(); },
  sound: () => { sound = !sound; if (sound) { aud = aud || new AudioContext(); siren(); } render(true); },
  logout: () => { TOK = null; localStorage.removeItem('tok'); location.hash = '#/'; }
};
document.addEventListener('click', async e => {
  const s = e.target.closest('[data-scroll]');
  if (s) {
    const targetId = s.dataset.scroll;
    const el = document.getElementById(targetId);
    if (el) {
      if (window.completeStoryStage) window.completeStoryStage();
      if (window.lenisInstance) window.lenisInstance.scrollTo(el, { offset: -70 });
      else el.scrollIntoView({ behavior: 'smooth' });
    } else {
      location.hash = '#/';
      setTimeout(() => {
        if (window.completeStoryStage) window.completeStoryStage();
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          if (window.lenisInstance) window.lenisInstance.scrollTo(targetEl, { offset: -70 });
          else targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    }
    return;
  }
  const sl = e.target.closest('[data-sel]'); if (sl) { sel = sl.dataset.sel; render(true); return; }
  const b = e.target.closest('[data-act]'); if (!b) return; e.preventDefault();
  try { if (b.dataset.confirm && !confirm(b.dataset.confirm)) return; await ACT[b.dataset.act](b.dataset); } catch (x) { toast(x.message, 'bad'); }
});
document.addEventListener('keydown', e => { const g = e.target.closest?.('g[data-sel]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sel = g.dataset.sel; render(true); } });
document.addEventListener('change', e => { const f = e.target.dataset; if (f.flt) { flt[f.flt] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; render(true); } if ('sel2' in f) { sel2 = e.target.value; sel = null; render(true); } });
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
  const fd = new FormData(f), b = Object.fromEntries(fd.entries()); b.safety = fd.getAll('safety').join(','); const k = f.dataset.form;
  try {
    if (k === 'login') { const j = await api('/login', 'POST', b); TOK = j.token; localStorage.setItem('tok', TOK); connect(); await refresh(); location.hash = '#/app'; }
    else if (k === 'register') { const j = await api('/register/' + f.dataset.role, 'POST', b); TOK = j.token; localStorage.setItem('tok', TOK); connect(); await refresh(); location.hash = '#/app'; toast('Account created'); }
    else if (k === 'donation') { b.safety = fd.getAll('safety'); await go('/donations', b); toast('Donation posted'); }
    else if (k === 'request') { await go('/requests', { donationId: f.dataset.id, qty: b.qty }); toast('Request sent to donor'); location.hash = '#/app'; }
    else if (k === 'needs') { await go('/profile', b); toast('Needs saved'); }
    else if (k === 'sim') { const j = await api('/admin/sim', 'POST', { ...b, type: f.dataset.type }); toast(j.message); await refresh(); }
    else if (k === 'cfg') { for (const [key, value] of Object.entries(b)) if (key in S.cfg) await api('/admin/config', 'POST', { key, value }); toast('Settings saved'); await refresh(); }
  } catch (x) { toast(x.message, 'bad'); }
});
(async () => { try { PUB = await api('/public'); PUB.cats = null; } catch { } if (TOK) { connect(); try { await refresh(); } catch { } } render(true); setInterval(() => api('/public').then(p => { if (JSON.stringify(p.items) === JSON.stringify(PUB?.items)) return; PUB = p; if (!location.hash.startsWith('#/app') && !/login|register|privacy|terms/.test(location.hash)) render(); }).catch(() => { }), 8000); })();

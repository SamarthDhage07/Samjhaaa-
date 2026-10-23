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
function topPub() { return `<header class="top"><div class="wrap"><a class="logo" href="#/">${BRAND}</a><button class="l" data-scroll="how">How it works</button><button class="l" data-scroll="roles">Roles</button><a class="l" href="#/login">Log in</a><a class="btn p s" href="#/register/donor">Register</a></div></header>`; }
function footer() { return `<footer class="foot"><div class="wrap"><div class="row" style="margin-bottom:12px"><a href="#/">Home</a><a href="#/login">Log in</a><a href="#/register/donor">Register</a><a href="#/privacy">Privacy Policy</a><a href="#/terms">Terms and Conditions</a><a href="mailto:contact@surplusrelay.example">contact@surplusrelay.example</a></div><p>${BRAND} is a working prototype. Demo accounts and sample organizations are fictional.</p></div></footer>`; }
const STEPS = ['Donor posts a surplus donation', 'Receiver requests or is matched with the donation', 'Donor approves the request', 'Rider is assigned', 'Receiver confirms rider assistance', 'Donation is delivered', 'Delivery is confirmed and remaining help is reallocated'];
function landing() {
  const p = PUB || { items: [], events: [] };
  return `
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
        <canvas id="seam-canvas-left" class="seam-canvas"></canvas>
      </div>
      <div class="seam-layer seam-layer-right">
        <canvas id="seam-canvas-right" class="seam-canvas"></canvas>
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
    ${topPub()}
    <section id="hero-section" class="hero-under-stage">
      <div class="wrap">
        <div class="hero-grid">
          <div>
            <h1 class="hero-title">
              <span class="hero-title-line"><span>Surplus food,</span></span>
              <span class="hero-title-line"><span>delivered before it expires.</span></span>
            </h1>
            <p class="hero-subtext">Connecting local kitchens, volunteer riders and shelters in real time with automatic expiry protection.</p>
            <div class="row">
              <a class="btn p" href="#/register/donor">Donate surplus</a>
              <a class="btn" href="#how-it-works">See how it works</a>
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
          
          <div class="hero-map-box">
            <div class="hero-map-header">
              <span>CITY RELAY CORRIDOR</span>
              <span class="sim-badge">Live simulation</span>
            </div>
            <svg id="hero-map-svg" class="hero-map-svg" viewBox="0 0 560 420">
              <defs>
                <pattern id="street-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" class="map-bg-grid" />
                </pattern>
              </defs>
              <rect width="560" height="420" fill="#EAE7E0" />
              <rect width="560" height="420" fill="url(#street-grid)" />
              <g id="map-grid-layer">
                <path class="map-road" d="M -20 160 L 580 160 M 240 -20 L 240 440 M -20 320 L 580 320 M 430 -20 L 430 440" />
                <path class="map-road-center" d="M -20 160 L 580 160 M 240 -20 L 240 440 M -20 320 L 580 320 M 430 -20 L 430 440" />
              </g>
              <path id="map-route-line" class="map-route-line" d="M 120 320 L 240 320 L 240 160 L 430 160" />
              <g transform="translate(430, 160)">
                <circle r="22" class="map-shelter-pulse" />
                <circle r="12" class="map-shelter-marker" />
                <rect x="-6" y="-6" width="12" height="12" fill="#FAF6EF" rx="2" />
                <text y="28" text-anchor="middle" font-family="var(--fb)" font-weight="700" font-size="11" fill="var(--ink)">Asha Shelter</text>
              </g>
              <g id="map-dynamic-pin">
                <g class="map-donor-pin">
                  <circle cx="120" cy="320" r="9" fill="#C2571A" stroke="#FAF6EF" stroke-width="2.5" />
                  <circle cx="120" cy="320" r="3" fill="#FAF6EF" />
                  <text x="120" y="342" text-anchor="middle" font-family="var(--fb)" font-weight="700" font-size="11" fill="var(--ink)">Donation</text>
                </g>
              </g>
              <g id="map-truck" class="map-truck-icon" transform="translate(108, 308)">
                <rect width="24" height="14" rx="3" fill="#C2571A" />
                <circle cx="6" cy="14" r="3.5" fill="#1E1B18" />
                <circle cx="18" cy="14" r="3.5" fill="#1E1B18" />
                <rect x="14" y="2" width="7" height="6" rx="1" fill="#FAF6EF" />
              </g>
              <g id="map-check" class="map-check-icon" transform="translate(416, 146)" opacity="0">
                <circle cx="14" cy="14" r="14" fill="#2F7A52" />
                <path d="M 8 14 L 12 18 L 20 10" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </g>
            </svg>
            <div id="map-instruction" class="map-instruction-tag">Click anywhere on the map to test a dispatch</div>
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
  const demo = [['Donor', 'donor@demo.test'], ['Rider', 'rider@demo.test'], ['Receiver', 'receiver@demo.test'], ['Admin', 'admin@demo.test']];
  return topPub() + `<main id="main" class="wrap pg"><div class="narrow"><h1 style="font-size:2.2rem">Log in</h1><form class="f" data-form="login" style="grid-template-columns:1fr"><label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" required></label><button class="btn p">Log in</button></form><p class="mut" style="margin-top:12px">By logging in you agree to the <a href="#/terms">Terms and Conditions</a> and <a href="#/privacy">Privacy Policy</a>.</p><h2 style="font-size:1.3rem;margin-top:28px">Demo accounts</h2><p class="mut">Password for every demo account: demo1234</p><div class="scroll"><table><thead><tr><th>Account</th><th>Email</th><th></th></tr></thead><tbody>${ALL.map(d => `<tr><td>${d[0]}</td><td>${d[1]}</td><td><button class="btn s p" data-act="demo" data-e="${d[1]}">Sign in</button></td></tr>`).join('')}</tbody></table></div><p style="margin-top:20px">No account? Register as <a href="#/register/donor">donor</a>, <a href="#/register/rider">rider</a> or <a href="#/register/receiver">receiver</a>.</p></div></main>` + footer();
}
function registerPage(role) {
  return topPub() + `<main id="main" class="wrap pg"><h1 style="font-size:2.2rem">Register as ${role}</h1><div class="row" style="margin-bottom:16px">${['donor', 'rider', 'receiver'].map(r => `<a class="btn s ${r === role ? 'p' : ''}" href="#/register/${r}">${r}</a>`).join('')}</div><form class="f" data-form="register" data-role="${role}">${F[role].map(f => field(f, '', true)).join('')}${role === 'rider' ? '<p class="full mut">Verification status: new riders are pending until an admin verifies them.</p>' : ''}<p class="full mut">Categories: ${(PUB?.cats || ['Cooked meals', 'Packaged food', 'Dry rations', 'Bakery', 'Produce', 'Drinking water']).join(', ')}. Registering means you accept the <a href="#/terms">Terms and Conditions</a> and <a href="#/privacy">Privacy Policy</a>.</p><button class="btn p full" style="justify-self:start">Create account</button></form></main>` + footer();
}
const LEGAL = {
  privacy: ['Privacy Policy', [['Scope', 'This policy covers the prototype version of ' + BRAND + '. It is a demonstration service, and you should not enter real personal data unless the operator running it has told you how it is handled.'], ['What we store', 'Account details you enter at registration (name, email, phone, address, coordinates, and role specific profile fields), donations, requests, assignments, notifications and an event log of status changes.'], ['How it is used', 'Data is used only to run the donation workflow: matching, safety checks, notifications, and audit history. Counterparties in a delivery can see the contact details needed to complete it.'], ['Sharing', 'Contact details are shown only to users who share an active request or assignment with you, and to admins. Nothing is sold or used for advertising.'], ['Location', 'Coordinates are used to compute distance and travel time. Riders and organizations choose what location they enter.'], ['Retention and deletion', 'Data stays in the local data file of the running instance. Operators can delete it by resetting the demo or removing the data folder. Ask the operator to remove an individual account.'], ['Security', 'Passwords are stored as salted hashes. This prototype has not had a security audit, so treat it as non production.'], ['Contact', 'Questions go to contact@surplusrelay.example.']]],
  terms: ['Terms and Conditions', [['Prototype status', BRAND + ' is a prototype provided as is, without warranties of availability or fitness for a particular purpose.'], ['Accounts', 'Keep your credentials private and give accurate profile information, including location, capacity and resources.'], ['Donor responsibilities', 'Donors state truthfully the category, quantity, expiry time, packaging and handling of what they offer. The platform helps check timing and compatibility but does not inspect food.'], ['Receiver responsibilities', 'Receivers keep demand, resources and receiving hours current, and confirm or decline help within the time shown.'], ['Rider responsibilities', 'Riders accept only deliveries they can complete safely, follow local traffic laws and report delays or failures promptly.'], ['Timers and releases', 'If a pending step times out, reservations are released automatically and the system may reassign the donation.'], ['Food safety', 'Final responsibility for safe handling stays with donors, riders and receivers under applicable food safety rules.'], ['Limits of liability', 'To the extent allowed by law, the operator is not liable for losses arising from use of the prototype.'], ['Changes', 'Terms may change as the prototype changes. Continued use means you accept the current version.']]]
};
function legal(k) { const [t, s] = LEGAL[k]; return topPub() + `<main id="main" class="wrap pg legal"><h1 style="font-size:2.4rem">${t}</h1>${s.map(([h, b]) => `<h2>${h}</h2><p>${b}</p>`).join('')}</main>` + footer(); }

/* ---------- ring ---------- */
function ring(items, center, small) {
  const W = 640, c = W / 2, max = Math.max(5, Math.ceil(Math.max(...items.map(i => i.km || 0), 1) / 5) * 5);
  const rings = [.25, .5, .75, 1].map(f => `<circle cx="${c}" cy="${c}" r="${f * c * .82}" class="rg"/><text x="${c + f * c * .82 + 3}" y="${c - 3}" class="rl">${+(f * max).toFixed(1)} km</text>`).join('');
  const dots = items.map((it, i) => { const a = i / items.length * Math.PI * 2 - Math.PI / 2 + .4, r = Math.max(.12, (it.km || 0) / max) * c * .82, x = c + r * Math.cos(a), y = c + r * Math.sin(a), s = 9 + Math.min(22, Math.sqrt(it.qty) * 2.2); return `<g class="dot ${it.cls}${sel === it.id ? ' sel' : ''}" ${small ? '' : `tabindex="0" role="button" data-sel="${it.id}"`} aria-label="${esc(it.name)}, ${it.km} km, ${it.qty} units"><circle cx="${x}" cy="${y}" r="${s}"/><text x="${x}" y="${y + s + 12}" text-anchor="middle">${esc(it.name)}</text><text x="${x}" y="${y + s + 23}" text-anchor="middle" class="sub">${it.km} km, ${it.qty}</text></g>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${W}" class="ringsvg" role="group" aria-label="Distance rings around ${esc(center)}">${rings}<circle cx="${c}" cy="${c}" r="14" class="pulse"/><circle cx="${c}" cy="${c}" r="14" class="ctr"/><text x="${c}" y="${c + 30}" text-anchor="middle" class="ctl">${esc(center)}</text>${dots}</svg>`;
}
const legendHtml = `<p class="legend"><span><i class="sw" style="background:var(--g)"></i>Compatible</span><span><i class="sw" style="background:var(--a)"></i>Compatible, expires within 2 hours</span><span><i class="sw" style="background:#E7E1D3;border:2px solid var(--r)"></i>Not compatible</span></p>`;
function sortFilter(items) {
  let l = items.filter(i => (!flt.cat || i.cat === flt.cat) && (!flt.ok || i.ok));
  const k = { distance: (a, b) => a.km - b.km, urgency: (a, b) => a.exp - b.exp, quantity: (a, b) => b.qty - a.qty, compatibility: (a, b) => (b.ok - a.ok) || a.km - b.km }[flt.sort]; return l.sort(k);
}
const controls = () => `<div class="row" style="margin:10px 0"><label>Sort<select data-flt="sort">${['distance', 'urgency', 'quantity', 'compatibility'].map(x => `<option ${flt.sort === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label>Category<select data-flt="cat"><option value="">All</option>${S.cats.map(x => `<option ${flt.cat === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label style="grid-auto-flow:column;align-items:center"><input type="checkbox" data-flt="ok" ${flt.ok ? 'checked' : ''}> Compatible only</label></div>`;
function emergency() {
  const me = S.me; if (me.role === 'receiver') {
    const items = S.donations.filter(d => d.status === 'Available').map(d => { const f = S.fits[d.id + ':' + me.id] || {}, dn = usr(d.donorId); return { id: d.id, name: dn.name, km: f.km, qty: d.remaining, unit: d.unit, cat: d.category, exp: d.expiresAt, mins: f.mins, safety: d.safety, ok: f.ok, why: f.why || [], need: Math.min(d.remaining, (me.needs || {})[d.category] || 0), cls: f.ok ? (d.expiresAt - T() < 72e5 ? 'amber' : 'green') : 'bad' }; });
    const list = sortFilter(items), cur = list.find(i => i.id === sel);
    return `<h1 style="font-size:2.2rem">Emergency: nearby donors</h1>${controls()}${legendHtml}<div class="ringwrap">${list.length ? ring(list, me.name) : '<p>No donors match these filters.</p>'}<div>${cur ? detailR(cur) : '<p class="mut">Select a donor on the rings or in the table to see details and request it.</p>'}</div></div><h2 style="font-size:1.4rem;margin-top:28px">All donors</h2><div class="scroll"><table><caption class="mut" style="text-align:left">Same data as the rings, with a button for each donor.</caption><thead><tr><th>Donor</th><th>Distance</th><th>Available</th><th>Category</th><th>Expires in</th><th>Travel</th><th>Safety</th><th>Compatibility</th><th></th></tr></thead><tbody>${list.map(i => `<tr><td>${esc(i.name)}</td><td>${i.km} km</td><td>${i.qty} ${esc(i.unit)}</td><td>${esc(i.cat)}</td><td>${timer(i.exp)}</td><td>${i.mins} min</td><td>${esc(i.safety.join(', ') || 'None')}</td><td>${i.ok ? chip('Compatible') : chip('Blocked')}${i.ok ? '' : `<br><small>${esc(i.why.join('; '))}</small>`}</td><td><button class="btn s" data-sel="${i.id}">Inspect</button></td></tr>`).join('')}</tbody></table></div>${list.length ? '' : '<p class="mut">Nothing to show. New donations appear here live.</p>'}`;
  }
  const mine = S.donations.filter(d => d.donorId === me.id && d.status === 'Available'); if (!mine.length) return '<h1 style="font-size:2.2rem">Emergency: nearby receivers</h1><p>Post an available donation first, then inspect which receivers can take it.</p>';
  const d = mine.find(x => x.id === sel2) || mine[0];
  const items = S.users.filter(u => u.role === 'receiver').map(r => { const f = S.fits[d.id + ':' + r.id] || {}, need = (r.needs || {})[d.category] || 0; return { id: r.id, name: r.name, km: f.km, qty: need, cat: d.category, exp: d.expiresAt, ok: f.ok, why: f.why || [], r, cls: f.ok ? 'green' : 'bad', demand: Object.values(r.needs || {}).reduce((a, b) => a + b, 0) }; });
  const list = sortFilter(items), cur = list.find(i => i.id === sel);
  return `<h1 style="font-size:2.2rem">Emergency: nearby receivers</h1><label style="max-width:420px">Donation to offer<select data-sel2>${mine.map(x => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(x.category)}, ${x.remaining} ${esc(x.unit)}</option>`).join('')}</select></label>${controls()}${legendHtml}<div class="ringwrap">${ring(list, S.me.name)}<div>${cur ? `<div class="card"><h3>${esc(cur.name)}</h3><p>${cur.km} km away. Needs ${cur.qty} ${esc(d.unit)} of ${esc(d.category)}. Total demand ${cur.demand}. Capacity ${cur.r.capacity}, occupancy ${cur.r.occupancy}. Receiving ${cur.r.hours?.join(' to ')}h. ${cur.ok ? chip('Compatible') : chip('Blocked: ' + cur.why.join('; '))}</p><button class="btn p" data-act="offer" data-id="${d.id}" data-to="${cur.id}" ${cur.ok ? '' : 'disabled'}>Offer this donation</button></div>` : '<p class="mut">Select a receiver to inspect it.</p>'}</div></div><div class="scroll"><table><thead><tr><th>Receiver</th><th>Distance</th><th>Needs</th><th>Capacity</th><th>Demand</th><th>Compatibility</th><th></th></tr></thead><tbody>${list.map(i => `<tr><td>${esc(i.name)}</td><td>${i.km} km</td><td>${i.qty} ${esc(d.unit)}</td><td>${i.r.occupancy}/${i.r.capacity}</td><td>${i.demand}</td><td>${i.ok ? chip('Compatible') : chip('Blocked')}</td><td><button class="btn s" data-sel="${i.id}">Inspect</button></td></tr>`).join('')}</tbody></table></div>`;
}
const detailR = i => `<div class="card"><h3>${esc(i.name)}</h3><p>${i.km} km, about ${i.mins} min travel. ${i.qty} ${esc(i.unit)} of ${esc(i.cat)}. Expires in ${timer(i.exp)}.<br>Safety: ${esc(i.safety.join(', ') || 'None')}.<br>${i.ok ? chip('Compatible') : chip('Blocked: ' + i.why.join('; '))}</p>${i.ok ? `<form class="f" data-form="request" data-id="${i.id}" style="grid-template-columns:1fr auto;align-items:end"><label>Quantity (max ${i.need})<input name="qty" type="number" min="1" max="${i.need}" value="${i.need}" required></label><button class="btn p">Request donation</button></form>` : ''}</div>`;

/* ---------- dashboards ---------- */
const notesBox = () => `<section class="card" aria-label="Notifications"><h3>${ic('bell')}Notifications</h3>${S.notes.length ? S.notes.slice(-6).reverse().map(n => `<div class="note ${n.level}">${esc(n.msg)}<br><small class="mut">${new Date(n.t).toLocaleTimeString()}</small></div>`).join('') : '<p class="mut">No notifications yet.</p>'}</section>`;
const tbl = (h, rows, empty) => rows.length ? `<div class="scroll"><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="mut">${empty}</p>`;
function donorView() {
  const me = S.me, ds = S.donations.filter(d => d.donorId === me.id).sort((a, b) => b.expiresAt - a.expiresAt), pend = S.requests.filter(q => q.status === 'Pending donor approval');
  const alerts = pend.map(q => { const d = ds.find(x => x.id === q.donationId), r = usr(q.receiverId); return `<div class="alert" role="alert"><b>${ic('alert')}Urgent request from ${esc(r.name)}</b><p>${q.qty} ${esc(d.unit)} of ${esc(d.category)}. Distance ${q.info.km} km, about ${q.info.mins} min delivery, ${q.info.slack >= 0 ? q.info.slack + ' min spare before the safety buffer' : 'expiry not feasible'}. Contact ${esc(r.manager || '')} ${esc(r.phone || '')}. Decide in ${timer(q.expiresAt)}</p><div class="row"><button class="btn p" data-act="respond" data-id="${q.id}" data-v="1">Accept</button><button class="btn d" data-act="respond" data-id="${q.id}" data-v="0">Reject</button></div></div>`; }).join('');
  const riders = S.users.filter(u => u.role === 'rider' && u.donorId === me.id);
  return `${alerts}<div class="dash"><div><h2>Your donations</h2>${tbl(['Donation', 'Left / total', 'Status', 'Expires in', ''], ds.map(d => [`${esc(d.category)}<br><small class="mut">${esc(d.safety.join(', '))}</small>${S.requests.filter(q => q.donationId === d.id).map(q => `<details><summary>Request from ${esc(usr(q.receiverId).name)}: ${esc(q.status)}</summary>${tl(q)}</details>`).join('')}<details><summary>Timeline</summary>${tl(d)}</details>`, `${d.remaining} / ${d.qty} ${esc(d.unit)}`, chip(d.status), ['Delivered', 'Receiver confirmed', 'Expired', 'Cancelled'].includes(d.status) ? '' : timer(d.expiresAt), ['Available', 'Request pending', 'Accepted', 'Rider assignment pending', 'Rider assigned', 'Receiver confirmation pending'].includes(d.status) ? `<button class="btn s d" data-act="cancelDon" data-id="${d.id}" data-confirm="Cancel this donation?">Cancel</button>` : '']), 'No donations yet. Use the form to post one.')}
<h2 style="margin-top:32px">Post a donation</h2><form class="f card" data-form="donation"><label>Category<select name="category">${S.cats.map(c => `<option>${c}</option>`).join('')}</select></label><label>Quantity<input name="qty" type="number" min="1" required></label><label>Unit<input name="unit" value="portions" required></label><label>Expires in (minutes)<input name="expiresInMin" type="number" min="1" value="180" required></label><label class="full">Pickup location<input name="pickup" value="${esc(me.address || '')}"></label><label class="full">Packaging information<input name="packaging"></label><fieldset class="full" style="border:1px solid var(--line);border-radius:4px"><legend>Safety requirements</legend>${['Keep hot', 'Refrigerated', 'Needs cooking', 'Sealed packaging', 'Allergen labelled'].map(s => `<label style="display:inline-flex;grid-auto-flow:column;gap:6px;margin-right:14px"><input type="checkbox" name="safety" value="${s}"> ${s}</label>`).join('')}</fieldset><button class="btn p full" style="justify-self:start">Post donation</button></form></div>
<aside style="display:grid;gap:16px;align-content:start">${notesBox()}<section class="card"><h3>${ic('truck')}Associated riders</h3>${riders.length ? riders.map(r => `<p style="margin:0 0 8px">${esc(r.name)}, ${esc(r.vehicle)}, capacity ${r.cap}<br>${chip(r.verified ? r.status : 'Pending verification')}</p>`).join('') : '<p class="mut">No riders have joined your facility yet.</p>'}</section></aside></div>`;
}
function receiverView() {
  const me = S.me, rq = S.requests.slice().reverse();
  return `<div class="dash"><div><h2>Active requests and deliveries</h2>${rq.length ? rq.map(q => { const d = S.donations.find(x => x.id === q.donationId), as = S.asgs.filter(a => a.requestId === q.id); return `<div class="card" style="margin-bottom:14px"><b>${q.qty} ${esc(d.unit)} of ${esc(d.category)}</b> from ${esc(usr(d.donorId).name)} ${chip(q.status)} ${chip(d.status)}${['Pending donor approval', 'Receiver confirmation pending'].includes(q.status) ? `<p>Time left: ${timer(q.expiresAt)}</p>` : ''}${as.map(a => { const r = usr(a.riderId); return `<p style="margin:6px 0">${ic('truck')}${esc(r.name)}, ${esc(r.vehicle || '')}, ${esc(r.phone || '')}: ${a.qty} ${esc(d.unit)} ${chip(a.status)} <small class="mut">pickup ${a.route.pm} min, delivery ${a.route.dm} min</small></p>`; }).join('')}<div class="row">${q.status === 'Receiver confirmation pending' ? `<button class="btn p" data-act="confirm" data-id="${q.id}">Confirm rider assistance</button>` : ''}${q.status === 'Confirmed' && d.status === 'Delivered' ? `<button class="btn p" data-act="receipt" data-id="${q.id}">Confirm receipt</button>` : ''}</div><details><summary>Timeline</summary>${tl(q)}</details></div>`; }).join('') : '<p class="mut">No requests yet. Open Emergency to find nearby donors.</p>'}
<h2 style="margin-top:28px">Update current needs</h2><form class="f card" data-form="needs"><label class="full">Demand, for example Cooked meals:40, Dry rations:20<input name="needs" value="${esc(Object.entries(me.needs || {}).map(([k, v]) => k + ':' + v).join(', '))}"></label><label>Occupancy<input name="occupancy" type="number" min="0" value="${me.occupancy}"></label><button class="btn p" style="align-self:end">Save needs</button></form></div>
<aside style="display:grid;gap:16px;align-content:start"><section class="card"><h3>Needs and capacity</h3>${Object.entries(me.needs || {}).map(([k, v]) => `<p style="margin:0">${esc(k)}: <b>${v}</b></p>`).join('') || '<p class="mut">No current demand.</p>'}<p style="margin:10px 0 0">Occupancy ${me.occupancy} of ${me.capacity}. Water: ${me.water ? 'yes' : 'no'}. Fuel: ${me.fuel ? 'yes' : 'no'}. Storage: ${me.storage}.</p></section>${notesBox()}</aside></div>`;
}
function riderView() {
  const me = S.me, as = S.asgs.slice().reverse();
  const btn = (a, act, l, c = '') => `<button class="btn s ${c}" data-act="ride" data-id="${a.id}" data-a="${act}">${l}</button>`;
  return `<div class="dash"><div><h2>Assignments</h2>${as.length ? as.map(a => { const d = S.donations.find(x => x.id === a.donationId), q = S.requests.find(x => x.id === a.requestId), dn = usr(d.donorId), r = usr(q.receiverId); return `<div class="card" style="margin-bottom:14px"><b>Carry ${a.qty} ${esc(d.unit)} of ${esc(d.category)}</b> ${chip(a.status)}<p style="margin:.5em 0">${ic('pin')}Pickup: ${esc(dn.name)}, ${esc(dn.address || '')}<br>${ic('home')}Deliver: ${esc(r.name)}, ${esc(r.address || '')}, ${esc(r.manager || '')} ${esc(r.phone || '')}<br>${ic('route')}Pickup ${a.route.pk} km (${a.route.pm} min), delivery ${a.route.dk} km (${a.route.dm} min)<br>${ic('clock')}Donation expires in ${timer(d.expiresAt)}${a.status === 'Reserved' ? `<br>Accept within ${timer(a.expiresAt)}` : ''}</p><div class="row">${a.status === 'Reserved' ? `<button class="btn p s" data-act="accept" data-id="${a.id}">Accept assignment</button>` : ''}${a.status === 'Dispatched' ? btn(a, 'start', 'Start delivery', 'p') : ''}${a.status === 'In transit' ? btn(a, 'deliver', 'Mark delivered', 'p') + btn(a, 'delay', 'Report delay') : ''}${a.status === 'Delayed' ? btn(a, 'resume', 'Resume') : ''}${['Dispatched', 'In transit', 'Delayed', 'Assigned', 'Awaiting receiver confirmation'].includes(a.status) ? btn(a, 'fail', 'Unable to complete', 'd') : ''}</div><details><summary>Timeline</summary>${tl(a)}</details></div>`; }).join('') : '<p class="mut">No assignments. Stay available to receive one.</p>'}</div>
<aside style="display:grid;gap:16px;align-content:start"><section class="card"><h3>Your status</h3><p>${chip(me.verified ? me.status : 'Pending verification')} ${me.available ? chip('Available for work') : chip('Unavailable')}</p><p>Capacity ${me.cap} units. Service radius ${me.radius} km. ${esc(me.vehicle || '')}.<br>Location ${(+me.lat).toFixed(4)}, ${(+me.lng).toFixed(4)}</p><button class="btn p s" data-act="toggle">${me.available ? 'Go unavailable' : 'Go available'}</button></section>${notesBox()}</aside></div>`;
}
function adminView() {
  const ds = S.donations, rq = S.requests, as = S.asgs, now = T();
  const urgent = ds.filter(d => ['Available', 'Request pending', 'Accepted', 'Rider assignment pending', 'Rider assigned', 'Receiver confirmation pending'].includes(d.status) && d.expiresAt - now < 72e5);
  const closed = rq.filter(q => ['Completed', 'Cancelled', 'Timed out', 'Rejected', 'Reassigned'].includes(q.status)), done = rq.filter(q => q.status === 'Completed');
  const rate = closed.length ? Math.round(done.length / closed.length * 100) + '%' : 'No closed requests yet';
  const dtab = list => tbl(['Donation', 'Donor', 'Status', 'Expires in', ''], list.map(d => [esc(d.category) + ' ' + d.remaining + '/' + d.qty, esc(usr(d.donorId).name), chip(d.status), timer(d.expiresAt), `<button class="btn s" data-act="ov" data-a="expire" data-id="${d.id}" data-confirm="Force expire this donation?">Expire</button> <button class="btn s d" data-act="ov" data-a="cancel" data-id="${d.id}" data-confirm="Cancel this donation?">Cancel</button>`]), 'None right now.');
  return `<div class="grid" style="margin-bottom:24px">${[['Donations', ds.length], ['Open requests', rq.filter(q => ['Pending donor approval', 'Receiver confirmation pending'].includes(q.status)).length], ['Completed deliveries', done.length], ['Completion rate', rate]].map(([l, v]) => `<div class="card">${typeof v === 'number' ? `<div class="stat" data-count="${v}" data-key="${l}">0</div>` : `<div class="stat">${v}</div>`}${l}</div>`).join('')}</div>
<h2>Urgent and near expiry</h2>${dtab(urgent)}<h2 style="margin-top:28px">Pending donor requests</h2>${tbl(['Receiver', 'Qty', 'Time left'], rq.filter(q => q.status === 'Pending donor approval').map(q => [esc(usr(q.receiverId).name), q.qty, timer(q.expiresAt)]), 'None right now.')}
<h2 style="margin-top:28px">Pending receiver confirmations</h2>${tbl(['Receiver', 'Qty', 'Time left'], rq.filter(q => q.status === 'Receiver confirmation pending').map(q => [esc(usr(q.receiverId).name), q.qty, timer(q.expiresAt)]), 'None right now.')}
<h2 style="margin-top:28px">Active deliveries</h2>${tbl(['Rider', 'Qty', 'Status', 'To'], as.filter(a => ['Dispatched', 'In transit', 'Delayed'].includes(a.status)).map(a => [esc(usr(a.riderId).name), a.qty, chip(a.status), esc(usr(rq.find(q => q.id === a.requestId).receiverId).name)]), 'No deliveries in progress.')}
<h2 style="margin-top:28px">Failed or delayed riders</h2>${tbl(['Rider', 'Status'], S.users.filter(u => u.role === 'rider' && (['Failed', 'Delayed'].includes(u.status) || !u.available)).map(u => [esc(u.name), chip(u.status)]), 'None right now.')}
<h2 style="margin-top:28px">Reassignments</h2>${tbl(['Request', 'Reason', 'When'], rq.filter(q => q.status === 'Reassigned').map(q => [q.id, esc(q.tl[q.tl.length - 1].why), new Date(q.tl[q.tl.length - 1].t).toLocaleTimeString()]), 'None yet.')}
<h2 style="margin-top:28px">Users and facilities</h2>${tbl(['Name', 'Role', 'Status', ''], S.users.filter(u => u.role !== 'admin').map(u => [esc(u.name), u.role, chip(u.role === 'rider' ? (u.verified ? u.status : 'Pending verification') : u.active === false ? 'Unavailable' : 'Active'), (u.role === 'rider' && !u.verified ? `<button class="btn s p" data-act="ov" data-a="verify" data-id="${u.id}">Verify</button> ` : '') + (u.role !== 'donor' ? `<button class="btn s" data-act="ov" data-a="toggle" data-id="${u.id}" data-confirm="Change availability for ${esc(u.name)}?">Toggle availability</button>` : '')]), '')}
<h2 style="margin-top:28px">Event and audit log</h2>${tbl(['Time', 'Record', 'Status', 'Reason'], S.events.slice(0, 40).map(e => [new Date(e.t).toLocaleTimeString(), e.k, chip(e.s), esc(e.why)]), 'No events.')}`;
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
  const nav = `<header class="top"><div class="wrap"><a class="logo" href="#/app">${BRAND}</a><a class="l" href="#/app">Dashboard</a>${r === 'receiver' ? `<a class="btn d s" href="#/app/emergency">${ic('alert')}Emergency</a>` : r === 'donor' ? '<a class="l" href="#/app/emergency">Emergency</a>' : ''}${r === 'admin' ? '<a class="l" href="#/app/lab">Simulation Lab</a>' : ''}${r !== 'admin' ? '<a class="l" href="#/app/profile">Profile</a>' : ''}<button class="l" data-act="sound" aria-pressed="${sound}">${sound ? 'Sound alerts on' : 'Enable sound alerts'}</button><span class="chip" title="Urgent notifications">${ic('bell')}${bell}</span><span class="mut">${esc(S.me.name)}</span><button class="btn s" data-act="logout">Log out</button></div></header>`;
  let body = h === 'app/emergency' && r !== 'rider' && r !== 'admin' ? emergency() : h === 'app/profile' && r !== 'admin' ? profile() : h === 'app/lab' && r === 'admin' ? lab() : { donor: donorView, receiver: receiverView, rider: riderView, admin: adminView }[r]();
  const title = { donor: 'Donor dashboard', receiver: 'Receiver dashboard', rider: 'Rider dashboard', admin: 'Admin dashboard' }[r];
  return nav + `<main id="main" class="wrap pg">${h === 'app' ? `<h1 style="font-size:2.2rem">${title}</h1>` : ''}${body}</main>`;
}
function render(force) {
  const a = document.activeElement;
  if (!force && a && a.closest && a.closest('#app') && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && !a.dataset.flt) { dirty = true; return; }
  dirty = false; const h = location.hash.slice(2).split('?')[0]; let html;
  if (h.startsWith('app')) { if (!TOK) { location.hash = '#/login'; return; } if (!S) return; html = shell(h); }
  else if (h === 'login') html = loginPage(); else if (h.startsWith('register')) html = registerPage(h.split('/')[1] || 'donor'); else if (h === 'privacy' || h === 'terms') html = legal(h); else html = landing();
  const app = $('#app'); app.className = h !== lastH ? 'enter' : ''; lastH = h; app.innerHTML = html; countUp();
  if (!h || h === '/') {
    if (window.initLandingPage) setTimeout(() => window.initLandingPage(), 10);
  } else {
    if (window.cleanupLandingPage) window.cleanupLandingPage();
  }
}
addEventListener('hashchange', () => {
  const wipe = document.getElementById('page-transition-wipe');
  if (wipe) {
    wipe.className = 'wiping-in';
    setTimeout(() => {
      sel = null;
      render(true);
      scrollTo(0, 0);
      if (location.hash.startsWith('#/app') && TOK && !S) refresh();
      wipe.className = 'wiping-out';
      setTimeout(() => { wipe.className = ''; }, 250);
    }, 200);
  } else {
    sel = null; render(true); scrollTo(0, 0); if (location.hash.startsWith('#/app') && TOK && !S) refresh();
  }
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
  sound: () => { sound = !sound; if (sound) { aud = aud || new AudioContext(); siren(); } render(true); }, logout
};
document.addEventListener('click', async e => {
  const s = e.target.closest('[data-scroll]'); if (s) { $('#' + s.dataset.scroll)?.scrollIntoView(); return; }
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

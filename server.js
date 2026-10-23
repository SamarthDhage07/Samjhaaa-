'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { create } = require('./engine');
const PORT = process.env.PORT || 3000, DB = path.join(__dirname, 'data', 'db.json'), PUB = path.join(__dirname, 'public');
const E = create();
if (process.env.KEEP_DATA) { try { E.load(JSON.parse(fs.readFileSync(DB, 'utf8'))); } catch { E.seed(); } } else E.seed();
const clients = new Set(); let lastV = -1, saveT = null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const R = [];
const route = (m, p, roles, fn) => R.push([m, new RegExp('^/api' + p + '$'), roles, fn]);
const pubInfo = () => {
  const r = E.S.users.find(u => u.role === 'receiver'), items = E.S.donations.filter(d => d.status === 'Available').map(d => ({ d, f: E.fit(d, r) }));
  return { donors: E.S.users.filter(u => u.role === 'donor').map(u => ({ id: u.id, name: u.name })), center: r && r.name, items: items.map(x => ({ id: x.d.id, name: E.U(x.d.donorId).name, km: x.f.km, qty: x.d.remaining, ok: x.f.ok, urgent: x.d.expiresAt - Date.now() < 72e5 })), events: E.S.events.slice(0, 6).map(e => ({ s: e.s, t: e.t })) };
};
route('GET', '/public', null, () => pubInfo());
route('POST', '/login', null, c => { const tok = E.login(c.body.email, c.body.password); return { token: tok, role: E.U(E.S.sessions[tok]).role }; });
route('POST', '/register/(donor|rider|receiver)', null, c => { const u = E.register(c.m[1], c.body); return { token: E.login(u.email, c.body.password) }; });
route('GET', '/state', ['donor', 'rider', 'receiver', 'admin'], c => E.view(c.u.id));
route('POST', '/profile', ['donor', 'rider', 'receiver'], c => { const { lat, lng, name, ...rest } = c.body; E.apply(c.u, { ...rest, name, lat, lng }); E.S.v++; return {}; });
route('POST', '/rider/toggle', ['rider'], c => { c.u.available = !c.u.available; E.S.v++; return {}; });
route('POST', '/donations', ['donor'], c => ({ id: E.addDonation(c.u.id, c.body).id }));
route('POST', '/donations/(\\w+)/cancel', ['donor'], c => { E.cancelDonation(c.u.id, c.m[1]); return {}; });
route('POST', '/donations/(\\w+)/offer', ['donor'], c => { const d = E.D(c.m[1]), r = E.U(c.body.receiverId); if (!d || d.donorId !== c.u.id || !r) { const e = new Error('Not found'); e.status = 404; throw e; } E.S.notes.push({ id: E.id('n'), to: r.id, msg: `${c.u.name} offers ${d.remaining} ${d.unit} of ${d.category}. Open Emergency to request it.`, level: 'info', t: Date.now(), at: Date.now() }); E.S.v++; return {}; });
route('POST', '/requests', ['receiver'], c => ({ id: E.request(c.u.id, c.body.donationId, c.body.qty).id }));
route('POST', '/requests/(\\w+)/respond', ['donor'], c => { E.respond(c.u.id, c.m[1], !!c.body.accept); return {}; });
route('POST', '/requests/(\\w+)/confirm', ['receiver'], c => { E.confirm(c.u.id, c.m[1]); return {}; });
route('POST', '/requests/(\\w+)/receipt', ['receiver'], c => { E.receipt(c.u.id, c.m[1]); return {}; });
route('POST', '/asgs/(\\w+)/accept', ['rider'], c => { E.riderAccept(c.u.id, c.m[1]); return {}; });
route('POST', '/asgs/(\\w+)/act', ['rider'], c => { E.ride(c.u.id, c.m[1], c.body.act); return {}; });
route('POST', '/admin/sim', ['admin'], c => ({ message: E.sim(c.body.type, c.body.id, c.body) }));
route('POST', '/admin/override', ['admin'], c => { E.override(c.body.action, c.body.id); return {}; });
route('POST', '/admin/config', ['admin'], c => { E.config(c.body.key, c.body.value); return {}; });
route('POST', '/admin/reset', ['admin'], () => { E.seed(); return {}; });

function flush() {
  if (E.S.v === lastV) return; lastV = E.S.v;
  clients.forEach(r => r.write(`data: ${lastV}\n\n`));
  clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(DB, JSON.stringify(E.S)); } catch { } }, 300);
}
setInterval(() => { try { E.tick(); } catch (e) { console.error(e.message); } flush(); }, 1000);

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), send = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/stream') {
    if (!E.S.sessions[url.searchParams.get('token')]) return send(401, { error: 'Sign in required' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.write('retry: 2000\n\n');
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (url.pathname.startsWith('/api/')) {
    let raw = ''; req.on('data', d => { raw += d; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { return send(400, { error: 'Invalid JSON' }); }
      for (const [m, re, roles, fn] of R) {
        const mt = url.pathname.match(re); if (m !== req.method || !mt) continue;
        let u = null;
        if (roles) { u = E.U(E.S.sessions[req.headers.authorization]); if (!u) return send(401, { error: 'Sign in required' }); if (!roles.includes(u.role)) return send(403, { error: 'Your role cannot do this' }); }
        try { const out = fn({ u, body, m: mt }); flush(); return send(200, out || {}); } catch (e) { flush(); return send(e.status || 500, { error: e.message }); }
      }
      send(404, { error: 'Not found' });
    }); return;
  }
  let f = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUB, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('Surplus Relay running at http://localhost:' + PORT + '\nDemo logins: donor@demo.test, rider@demo.test, receiver@demo.test, admin@demo.test (password demo1234)'));

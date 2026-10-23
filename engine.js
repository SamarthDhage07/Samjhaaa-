'use strict';
const crypto = require('crypto');
const CATS = ['Cooked meals', 'Packaged food', 'Dry rations', 'Bakery', 'Produce', 'Drinking water'];
const CFG0 = { donorApproval: 120, receiverConfirm: 90, riderReserve: 60, delayTimeout: 120, safetyBufferMin: 15, speedKmh: 25, traffic: 1, notifyDelay: 0 };
const T = {
  d: { Draft: ['Available', 'Cancelled'], Available: ['Request pending', 'Expired', 'Cancelled'], 'Request pending': ['Accepted', 'Available', 'Rejected', 'Expired', 'Cancelled'], Accepted: ['Rider assignment pending', 'Available', 'Expired', 'Cancelled'], 'Rider assignment pending': ['Rider assigned', 'Available', 'Expired', 'Cancelled'], 'Rider assigned': ['Receiver confirmation pending', 'Available', 'Expired', 'Cancelled'], 'Receiver confirmation pending': ['Dispatched', 'Reallocated', 'Available', 'Expired', 'Cancelled'], Dispatched: ['In transit', 'Reallocated', 'Available', 'Delivered'], 'In transit': ['Delivered', 'Reallocated', 'Available'], Delivered: ['Receiver confirmed', 'Available'], Reallocated: ['Rider assignment pending', 'Receiver confirmation pending', 'Available', 'Expired', 'Cancelled'], 'Receiver confirmed': [], Rejected: [], Expired: [], Cancelled: [] },
  q: { 'Pending donor approval': ['Accepted', 'Rejected', 'Timed out', 'Cancelled'], Accepted: ['Receiver confirmation pending', 'Cancelled'], 'Receiver confirmation pending': ['Confirmed', 'Reassigned', 'Cancelled'], Confirmed: ['Completed', 'Reassigned', 'Cancelled'], Rejected: [], 'Timed out': [], Reassigned: [], Completed: [], Cancelled: [] },
  a: { Reserved: ['Assigned', 'Released', 'Failed'], Assigned: ['Awaiting receiver confirmation', 'Dispatched', 'Released', 'Failed'], 'Awaiting receiver confirmation': ['Dispatched', 'Released', 'Failed'], Dispatched: ['In transit', 'Released', 'Failed'], 'In transit': ['Delayed', 'Completed', 'Failed', 'Released'], Delayed: ['In transit', 'Failed', 'Released'], Failed: [], Completed: [], Released: [] }
};
const PRE = ['Available', 'Request pending', 'Accepted', 'Rider assignment pending', 'Rider assigned', 'Receiver confirmation pending', 'Reallocated'];
const hash = p => crypto.createHash('sha256').update('sr:' + p).digest('hex');
const csv = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

function create() {
  const S = { users: [], donations: [], requests: [], asgs: [], events: [], notes: [], sessions: {}, seq: 1, v: 0, cfg: { ...CFG0 } };
  let clock = Date.now;
  const now = () => clock();
  const id = p => p + (S.seq++);
  const U = i => S.users.find(u => u.id === i), D = i => S.donations.find(d => d.id === i), Q = i => S.requests.find(q => q.id === i), A = i => S.asgs.find(a => a.id === i);
  const err = (m, s = 400) => { const e = new Error(m); e.status = s; throw e; };
  const own = (a, b) => { if (a !== b) err('Not allowed for this account', 403); };
  const live = a => !['Released', 'Completed', 'Failed'].includes(a.status);

  function to(e, tbl, s, why) {
    if (!(tbl[e.status] || []).includes(s)) err(`Invalid transition: ${e.status} to ${s}`);
    e.status = s; (e.tl = e.tl || []).push({ t: now(), s, why: why || '' });
    S.events.unshift({ t: now(), k: e.id, s, why: why || '' }); S.events.length = Math.min(S.events.length, 300); S.v++;
  }
  function sa(a, s, why) {
    to(a, T.a, s, why); const r = U(a.riderId); if (!r) return;
    if (['Released', 'Completed'].includes(s)) { if (!S.asgs.some(x => x !== a && x.riderId === r.id && live(x))) r.status = 'Available'; }
    else r.status = s;
  }
  function note(ids, msg, level) { [].concat(ids).filter(Boolean).forEach(u => S.notes.push({ id: id('n'), to: u, msg, level: level || 'info', t: now(), at: now() + S.cfg.notifyDelay * 1000 })); S.notes = S.notes.slice(-400); S.v++; }

  const km = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dg = r(b.lng - a.lng), x = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const mins = k => k / S.cfg.speedKmh * 60 * S.cfg.traffic;

  function compat(d, r) {
    const x = [], need = (r.needs || {})[d.category] || 0;
    if (r.active === false) x.push('Receiver unavailable');
    if (!(r.cats || []).includes(d.category)) x.push('Category not accepted');
    if (need <= 0) x.push('No current demand for this category');
    if (d.safety.includes('Needs cooking') && !(r.water && r.fuel)) x.push('Needs clean water and cooking fuel');
    if (d.safety.includes('Refrigerated') && !(r.storage > 0)) x.push('No cold storage');
    return x;
  }
  function feas(d, r, rider) {
    const dn = U(d.donorId), pick = rider ? mins(km(rider, dn)) : 0, ride = mins(km(dn, r));
    const arr = now() + (pick + ride) * 6e4, h = new Date(arr).getHours(), [a, b] = r.hours || [0, 24];
    const slack = (d.expiresAt - arr) / 6e4 - S.cfg.safetyBufferMin, why = [];
    if (slack < 0) why.push('Cannot arrive before expiry with the safety buffer');
    if (h < a || h >= b) why.push('Outside receiving hours at arrival');
    return { ok: !why.length, why, slack: Math.round(slack), pick, ride, total: pick + ride };
  }
  function plan(d, r, qty, ex = []) {
    const dn = U(d.donorId);
    const el = S.users.filter(u => u.role === 'rider' && u.donorId === d.donorId && u.verified === true && u.available && u.status === 'Available' && !ex.includes(u.id) && km(u, dn) <= (u.radius || 15) && feas(d, r, u).ok)
      .sort((a, b) => feas(d, r, a).total - feas(d, r, b).total || b.cap - a.cap);
    const one = el.find(u => u.cap >= qty); if (one) return [{ rider: one, qty }];
    let left = qty; const out = [];
    for (const u of [...el].sort((a, b) => b.cap - a.cap)) { if (left <= 0) break; const q = Math.min(u.cap, left); out.push({ rider: u, qty: q }); left -= q; }
    return left > 0 ? null : out;
  }
  function fit(d, r) {
    const q = Math.min(d.remaining, (r.needs || {})[d.category] || 0), f = feas(d, r, null), why = [...compat(d, r), ...f.why];
    if (q > 0 && !why.length && !plan(d, r, q)) why.push('No available rider can carry this safely');
    return { ok: !why.length, why, km: +km(U(d.donorId), r).toFixed(1), mins: Math.round(f.ride), slack: f.slack, qty: q };
  }
  function options(d, ex = []) {
    return S.users.filter(u => u.role === 'receiver' && !ex.includes(u.id)).map(r => ({ r, f: fit(d, r) })).filter(o => o.f.ok)
      .map(o => ({ ...o, score: Math.min(1, o.f.qty / Math.max(1, d.remaining)) * 40 + 30 / (1 + o.f.km) + (o.f.slack < 60 ? 25 : 10) + Math.min(10, (o.r.occupancy / Math.max(1, o.r.capacity)) * 10) }))
      .sort((a, b) => b.score - a.score || a.f.km - b.f.km);
  }

  function apply(u, b) {
    const set = (k, f) => { if (b[k] !== undefined && b[k] !== '') u[k] = f ? f(b[k]) : b[k]; };
    ['name', 'phone', 'address', 'manager', 'ftype', 'handling', 'vehicle', 'ages', 'ophours', 'donorId'].forEach(k => set(k));
    ['lat', 'lng', 'cap', 'radius', 'capacity', 'occupancy', 'storage'].forEach(k => set(k, v => Math.max(0, Number(v)) || (k === 'lat' || k === 'lng' ? Number(v) : 0)));
    set('cats', csv); set('safety', csv);
    ['water', 'fuel', 'available'].forEach(k => set(k, v => v === 'yes' || v === true));
    if (b.needs !== undefined && b.needs !== '') u.needs = Object.fromEntries(csv(b.needs).map(p => p.split(':')).map(([k, v]) => [k.trim(), Math.max(0, Math.floor(+v) || 0)]));
    if (b.hours !== undefined && b.hours !== '') { const m = String(b.hours).match(/(\d{1,2})\D+(\d{1,2})/); u.hours = m ? [+m[1], +m[2]] : [0, 24]; }
    if (u.role === 'receiver' && u.occupancy > u.capacity) u.occupancy = u.capacity;
  }
  function register(role, b) {
    if (!['donor', 'rider', 'receiver'].includes(role)) err('Invalid role');
    const em = String(b.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) err('Enter a valid email address');
    if (S.users.some(u => u.email === em)) err('That email is already registered');
    if (String(b.password || '').length < 8) err('Password needs at least 8 characters');
    if (!String(b.name || '').trim()) err('Name is required');
    if (b.lat === '' || b.lng === '' || !isFinite(+b.lat) || !isFinite(+b.lng)) err('Enter valid map coordinates');
    if (role === 'rider' && !S.users.find(u => u.id === b.donorId && u.role === 'donor')) err('Choose an associated donor facility');
    const u = { id: id('u'), role, email: em, pw: hash(b.password), name: '', phone: '', lat: 0, lng: 0, cats: [], safety: [], needs: {} };
    if (role === 'rider') Object.assign(u, { verified: false, status: 'Available', available: true, cap: 10, radius: 10 });
    if (role === 'receiver') Object.assign(u, { active: true, hours: [0, 24], capacity: 0, occupancy: 0, storage: 0 });
    apply(u, b); S.users.push(u); S.v++; return u;
  }
  function login(email, pw) {
    const u = S.users.find(x => x.email === String(email || '').trim().toLowerCase());
    if (!u || u.pw !== hash(pw || '')) err('Email or password is incorrect', 401);
    const tok = crypto.randomBytes(16).toString('hex'); S.sessions[tok] = u.id; return tok;
  }

  function addDonation(uid, b) {
    const u = U(uid), qty = Math.floor(+b.qty), m = +b.expiresInMin;
    if (!(qty > 0)) err('Quantity must be a positive number');
    if (!CATS.includes(b.category)) err('Choose a category');
    if (!(m > 0)) err('Expiry must be in the future');
    const d = { id: id('d'), donorId: uid, category: b.category, unit: b.unit || 'portions', qty, remaining: qty, expiresAt: now() + m * 6e4, safety: [].concat(b.safety || []), packaging: b.packaging || '', pickup: b.pickup || u.address, status: 'Draft', tl: [{ t: now(), s: 'Draft', why: 'Created' }] };
    S.donations.push(d); to(d, T.d, 'Available', 'Posted by donor'); return d;
  }
  function mkReq(d, r, qty, status, exp, tried) {
    const q = { id: id('q'), donationId: d.id, receiverId: r.id, qty, status, expiresAt: exp, tried: tried || [], tl: [{ t: now(), s: status, why: 'Created' }] };
    if (qty > d.remaining) err('Quantity exceeds what is available');
    S.requests.push(q); d.remaining -= qty; return q;
  }
  function sugg(d, r) {
    const o = options(d, [r.id])[0]; const alt = S.donations.filter(x => x.status === 'Available' && x.id !== d.id).map(x => ({ x, f: fit(x, r) })).filter(z => z.f.ok).sort((a, b) => a.f.km - b.f.km)[0];
    return { donor: o ? `Next best receiver: ${o.r.name}, ${o.f.km} km away.` : 'No other receiver can safely take it right now.', receiver: alt ? `Next best donation: ${alt.x.category} from ${U(alt.x.donorId).name}, ${alt.f.km} km away.` : 'No other compatible donation is available right now.' };
  }
  function freeReq(q, why) {
    const d = D(q.donationId); if (q.freed) return;
    S.asgs.filter(a => a.requestId === q.id && live(a)).forEach(a => { sa(a, 'Released', why); note(a.riderId, 'Assignment released: ' + why, 'warn'); });
    const done = S.asgs.filter(a => a.requestId === q.id && a.status === 'Completed').reduce((s, a) => s + a.qty, 0);
    d.remaining += Math.max(0, q.qty - done); q.freed = true;
    const nx = d.expiresAt <= now() ? 'Expired' : 'Available';
    if (d.status !== nx && T.d[d.status].includes(nx)) to(d, T.d, nx, why);
  }
  function request(uid, did, qty) {
    const r = U(uid), d = D(did); if (!d) err('Donation not found', 404);
    if (d.status !== 'Available') err('This donation is not available');
    qty = Math.floor(+qty); if (!(qty > 0) || qty > d.remaining) err('Quantity must be between 1 and ' + d.remaining);
    if (qty > ((r.needs || {})[d.category] || 0)) err('Quantity exceeds your current demand');
    const f = fit(d, r); if (!f.ok) err('Not eligible: ' + f.why.join('; '));
    if (!plan(d, r, qty)) err('No rider can carry this quantity safely');
    const q = mkReq(d, r, qty, 'Pending donor approval', now() + S.cfg.donorApproval * 1e3);
    to(d, T.d, 'Request pending', 'Requested by ' + r.name);
    note(d.donorId, `Urgent request: ${r.name} wants ${qty} ${d.unit} of ${d.category}`, 'urgent'); return q;
  }
  function respond(uid, qid, ok) {
    const q = Q(qid); if (!q) err('Request not found', 404);
    const d = D(q.donationId), r = U(q.receiverId); own(d.donorId, uid);
    if (q.status !== 'Pending donor approval') err('This request is no longer pending');
    if (d.expiresAt <= now()) err('Donation has expired');
    if (!ok) { to(q, T.q, 'Rejected', 'Donor rejected'); freeReq(q, 'Donor rejected'); const s = sugg(d, r); note(r.id, `${U(d.donorId).name} rejected your request. ${s.receiver}`, 'warn'); note(d.donorId, s.donor); return q; }
    to(q, T.q, 'Accepted', 'Donor accepted'); to(d, T.d, 'Accepted', 'Donor accepted');
    note(r.id, `${U(d.donorId).name} accepted your request. Selecting riders.`); assign(q); return q;
  }
  function mkAsg(q, rider, qty, status) {
    const a = { id: id('a'), requestId: q.id, donationId: q.donationId, riderId: rider.id, qty, status, expiresAt: now() + S.cfg.riderReserve * 1e3, tl: [{ t: now(), s: status, why: 'Created' }] };
    S.asgs.push(a); rider.status = status; note(rider.id, `New assignment: carry ${qty} ${D(q.donationId).unit}. Accept within ${S.cfg.riderReserve} seconds.`, 'urgent'); return a;
  }
  function assign(q, ex = []) {
    const d = D(q.donationId), r = U(q.receiverId);
    to(d, T.d, 'Rider assignment pending', 'Selecting riders');
    const p = plan(d, r, q.qty, ex);
    if (!p) { to(q, T.q, 'Cancelled', 'No rider can deliver safely'); freeReq(q, 'No eligible rider'); note([d.donorId, r.id], 'No rider can deliver this safely before expiry. Request cancelled.', 'warn'); return; }
    p.forEach(x => mkAsg(q, x.rider, x.qty, 'Reserved')); to(d, T.d, 'Rider assigned', p.length + ' rider(s) reserved');
    if (q.status === 'Accepted') to(q, T.q, 'Receiver confirmation pending', 'Awaiting receiver');
    q.expiresAt = now() + S.cfg.receiverConfirm * 1e3; to(d, T.d, 'Receiver confirmation pending', 'Awaiting receiver confirmation');
    note(r.id, 'Riders assigned: ' + p.map(x => `${x.rider.name} (${x.qty})`).join(', ') + '. Confirm to dispatch.', 'urgent'); note(d.donorId, 'Riders reserved for ' + r.name);
  }
  function riderAccept(uid, aid) {
    const a = A(aid); if (!a) err('Not found', 404); own(a.riderId, uid); const q = Q(a.requestId), d = D(a.donationId);
    if (a.status !== 'Reserved') err('Assignment is no longer reserved');
    if (d.expiresAt <= now()) err('Donation has expired');
    sa(a, 'Assigned', 'Rider accepted'); a.expiresAt = null;
    if (q.status === 'Receiver confirmation pending') sa(a, 'Awaiting receiver confirmation', 'Waiting for receiver'); else if (q.status === 'Confirmed') sa(a, 'Dispatched', 'Replacement dispatched');
    note([d.donorId, q.receiverId], `${U(uid).name} accepted the delivery`);
  }
  function confirm(uid, qid) {
    const q = Q(qid); if (!q) err('Request not found', 404); own(q.receiverId, uid); const d = D(q.donationId);
    if (q.status !== 'Receiver confirmation pending') err('Nothing to confirm');
    const as = S.asgs.filter(a => a.requestId === q.id && live(a));
    if (!as.length || as.some(a => a.status !== 'Awaiting receiver confirmation')) err('Waiting for every rider to accept');
    if (d.expiresAt - now() < S.cfg.safetyBufferMin * 6e4) { to(q, T.q, 'Cancelled', 'Too close to expiry'); freeReq(q, 'Too close to expiry'); err('Donation is too close to expiry to dispatch'); }
    to(q, T.q, 'Confirmed', 'Receiver confirmed'); to(d, T.d, 'Dispatched', 'Dispatched');
    as.forEach(a => { sa(a, 'Dispatched', 'Receiver confirmed'); note(a.riderId, 'Receiver confirmed. Pick up and deliver.', 'urgent'); }); note(d.donorId, 'Receiver confirmed. Riders dispatched.');
  }
  function chk(q) {
    const d = D(q.donationId), all = S.asgs.filter(a => a.requestId === q.id);
    if (all.length && all.every(a => !live(a)) && all.some(a => a.status === 'Completed') && ['Dispatched', 'In transit'].includes(d.status)) {
      to(d, T.d, 'Delivered', 'All riders delivered'); note(q.receiverId, 'Delivery arrived. Confirm receipt.', 'urgent'); note(d.donorId, 'Delivered. Waiting for receiver confirmation.');
    }
  }
  function replace(a, q, d, r, ex) {
    const exs = ex.concat(S.asgs.filter(x => x.requestId === q.id && ['Failed', 'Released'].includes(x.status)).map(x => x.riderId));
    const p = d.expiresAt > now() && plan(d, r, a.qty, exs);
    if (p) { p.forEach(x => mkAsg(q, x.rider, x.qty, 'Reserved')); note([d.donorId, r.id], `Reassigned ${a.qty} to ${p.map(x => x.rider.name).join(', ')}`); }
    else {
      d.remaining += a.qty; q.qty -= a.qty; note([d.donorId, r.id], 'No safe replacement rider. Quantity returned to the donor.', 'warn');
      if (q.qty <= 0 && !S.asgs.some(x => x.requestId === q.id && live(x)) && T.q[q.status].includes('Cancelled')) { to(q, T.q, 'Cancelled', 'No safe replacement'); q.freed = true; if (T.d[d.status].includes('Available')) to(d, T.d, 'Available', 'No safe replacement'); }
    }
    chk(q);
  }
  function fail(a, why) {
    const q = Q(a.requestId), d = D(a.donationId), r = U(q.receiverId), rd = U(a.riderId);
    sa(a, 'Failed', why); rd.available = false; note([d.donorId, r.id, rd.id], `Rider ${rd.name} cannot complete: ${why}`, 'warn'); replace(a, q, d, r, [rd.id]);
  }
  function ride(uid, aid, act) {
    const a = A(aid); if (!a) err('Not found', 404); own(a.riderId, uid); const q = Q(a.requestId), d = D(a.donationId);
    if (act === 'start') { if (d.expiresAt <= now()) err('Donation expired, dispatch is blocked'); sa(a, 'In transit', 'Rider departed'); if (d.status === 'Dispatched') to(d, T.d, 'In transit', 'Rider departed'); }
    else if (act === 'deliver') { sa(a, 'Completed', 'Delivered'); chk(q); }
    else if (act === 'delay') { sa(a, 'Delayed', 'Rider reported delay'); a.delayedAt = now(); note([d.donorId, q.receiverId], `${U(uid).name} reported a delay`, 'warn'); }
    else if (act === 'resume') sa(a, 'In transit', 'Delay cleared');
    else if (act === 'fail') fail(a, 'Rider cannot complete delivery');
    else err('Unknown action');
  }
  function receipt(uid, qid) {
    const q = Q(qid); if (!q) err('Request not found', 404); own(q.receiverId, uid); const d = D(q.donationId), r = U(q.receiverId);
    if (q.status !== 'Confirmed' || d.status !== 'Delivered') err('Delivery has not arrived yet');
    to(q, T.q, 'Completed', 'Receipt confirmed'); r.needs[d.category] = Math.max(0, (r.needs[d.category] || 0) - q.qty);
    to(d, T.d, d.remaining > 0 ? 'Available' : 'Receiver confirmed', 'Receipt confirmed');
    note(d.donorId, `${r.name} confirmed receipt of ${q.qty} ${d.unit}`); S.asgs.filter(a => a.requestId === q.id).forEach(a => note(a.riderId, 'Receipt confirmed. Thank you.'));
  }
  function reassign(q, why, keep) {
    const d = D(q.donationId), r = U(q.receiverId), riders = S.asgs.filter(a => a.requestId === q.id && live(a));
    if (!keep) riders.forEach(a => { sa(a, 'Released', why); note(a.riderId, 'Assignment released: ' + why, 'warn'); });
    d.remaining += q.qty;
    const o = options(d, [...q.tried, r.id]).find(x => !keep || x.f.qty >= q.qty);
    if (!o && keep) { d.remaining -= q.qty; return null; }
    q.freed = true; to(q, T.q, 'Reassigned', why);
    if (!o) { const nx = d.expiresAt <= now() ? 'Expired' : 'Available'; if (T.d[d.status].includes(nx)) to(d, T.d, nx, 'No safe alternative'); note([d.donorId, r.id], `${why}. No other receiver can take it safely, so it returned to the pool.`, 'warn'); return null; }
    const qty = Math.min(q.qty, o.f.qty), q2 = mkReq(d, o.r, qty, 'Accepted', null, [...q.tried, r.id]);
    to(d, T.d, 'Reallocated', why);
    if (keep) { riders.forEach(a => { a.requestId = q2.id; }); to(q2, T.q, 'Receiver confirmation pending', why); to(q2, T.q, 'Confirmed', why); to(d, T.d, 'Receiver confirmation pending', why); to(d, T.d, 'Dispatched', why); to(d, T.d, 'In transit', why); }
    else assign(q2);
    note([d.donorId, r.id, ...riders.map(a => a.riderId)], `Reassigned from ${r.name} to ${o.r.name}. Reason: ${why}`, 'warn');
    note(o.r.id, `Incoming from ${U(d.donorId).name}: ${qty} ${d.unit} of ${d.category}, about ${o.f.mins} min away. ${keep ? 'Rider already on the way.' : 'Confirm rider assistance.'}`, 'urgent'); return q2;
  }
  function expire(d, why) {
    S.requests.filter(q => q.donationId === d.id && T.q[q.status].includes('Cancelled')).forEach(q => { to(q, T.q, 'Cancelled', 'Donation expired'); freeReq(q, 'Donation expired'); note(q.receiverId, 'The donation expired before delivery. Request closed.', 'warn'); });
    if (d.status !== 'Expired' && T.d[d.status].includes('Expired')) to(d, T.d, 'Expired', why || 'Reached expiry');
    note(d.donorId, `Your ${d.category} donation expired`, 'warn');
  }
  function cancelDonation(uid, did, admin) {
    const d = D(did); if (!d) err('Not found', 404); if (!admin) own(d.donorId, uid);
    if (!T.d[d.status].includes('Cancelled')) err('This donation can no longer be cancelled');
    S.requests.filter(q => q.donationId === d.id && T.q[q.status].includes('Cancelled')).forEach(q => { to(q, T.q, 'Cancelled', 'Donation cancelled'); freeReq(q, 'Donation cancelled'); note(q.receiverId, 'Donation was cancelled', 'warn'); });
    if (d.status !== 'Cancelled') to(d, T.d, 'Cancelled', 'Cancelled');
  }
  function tick() {
    const t = now();
    S.donations.filter(d => PRE.includes(d.status) && d.expiresAt <= t).forEach(d => expire(d));
    S.requests.filter(q => q.status === 'Pending donor approval' && q.expiresAt <= t).forEach(q => { const d = D(q.donationId), r = U(q.receiverId); to(q, T.q, 'Timed out', 'Donor did not respond'); freeReq(q, 'Donor did not respond'); const s = sugg(d, r); note([r.id], 'Request timed out. ' + s.receiver, 'warn'); note(d.donorId, 'A request timed out. ' + s.donor, 'warn'); });
    S.requests.filter(q => q.status === 'Receiver confirmation pending' && q.expiresAt <= t).forEach(q => reassign(q, 'Receiver did not confirm rider assistance in time'));
    S.asgs.filter(a => a.status === 'Reserved' && a.expiresAt <= t).forEach(a => { const q = Q(a.requestId), d = D(a.donationId); sa(a, 'Released', 'Rider did not respond in time'); note(a.riderId, 'Reservation expired', 'warn'); replace(a, q, d, U(q.receiverId), [a.riderId]); });
    S.asgs.filter(a => a.status === 'Delayed' && t - a.delayedAt > S.cfg.delayTimeout * 1e3).forEach(a => fail(a, 'Delay exceeded the allowed limit'));
  }

  function sim(type, tid, b = {}) {
    const act = x => S.asgs.find(a => a.riderId === x && live(a)), pickA = x => A(x) || act(x);
    if (type === 'riderFail') { const a = pickA(tid); if (!a) err('Pick an active assignment'); fail(a, 'Simulated rider failure'); return 'Rider failure applied'; }
    if (type === 'riderDelay') { const a = pickA(tid); if (!a || !['Dispatched', 'In transit'].includes(a.status)) err('Pick a dispatched assignment'); if (a.status === 'Dispatched') sa(a, 'In transit'); sa(a, 'Delayed', 'Simulated delay'); a.delayedAt = now(); note([D(a.donationId).donorId, Q(a.requestId).receiverId], 'Rider reported a delay', 'warn'); return 'Rider delayed. Auto reassignment after ' + S.cfg.delayTimeout + 's'; }
    if (type === 'riderUnresponsive') { const a = pickA(tid); if (!a || a.status !== 'Reserved') err('Pick a reserved assignment'); a.expiresAt = now() - 1; tick(); return 'Rider reservation lapsed'; }
    if (type === 'nearExpiry') { const d = D(tid); d.expiresAt = now() + (S.cfg.safetyBufferMin + 5) * 6e4; note(d.donorId, 'Donation is close to expiry', 'warn'); return 'Expiry moved close'; }
    if (type === 'expire') { const d = D(tid); d.expiresAt = now() - 1; tick(); return 'Donation expired'; }
    if (type === 'demand') { const r = U(tid); r.needs[b.cat] = Math.max(0, (r.needs[b.cat] || 0) + Math.floor(+b.delta || 0)); note(r.id, `Demand for ${b.cat} is now ${r.needs[b.cat]}`); return 'Demand updated'; }
    if (type === 'receiverUnavailable') { const r = U(tid); r.active = false; S.requests.filter(q => q.receiverId === r.id).forEach(q => { if (q.status === 'Pending donor approval') { to(q, T.q, 'Cancelled', 'Receiver unavailable'); freeReq(q, 'Receiver unavailable'); note(D(q.donationId).donorId, 'Receiver became unavailable', 'warn'); } else if (['Receiver confirmation pending', 'Confirmed'].includes(q.status) && D(q.donationId).status !== 'Delivered') reassign(q, 'Receiver became unavailable'); }); return 'Receiver marked unavailable'; }
    if (type === 'donorReject') { const q = Q(tid); respond(D(q.donationId).donorId, q.id, false); return 'Donor rejected'; }
    if (type === 'receiverNoConfirm') { const q = Q(tid); if (q.status !== 'Receiver confirmation pending') err('Pick a request awaiting confirmation'); q.expiresAt = now() - 1; tick(); return 'Confirmation window lapsed'; }
    if (type === 'otherRider') { const a = pickA(tid); if (!a || !['Dispatched', 'In transit'].includes(a.status)) err('Pick a dispatched assignment'); if (a.status === 'Dispatched') sa(a, 'In transit'); if (!reassign(Q(a.requestId), 'Rider delivered to another eligible receiver', true)) err('No other eligible receiver can take it'); return 'Redirected to another receiver'; }
    if (type === 'notifyDelay') { S.cfg.notifyDelay = S.cfg.notifyDelay ? 0 : 10; return 'Notification delay ' + (S.cfg.notifyDelay ? 'on (10s)' : 'off'); }
    err('Unknown simulation');
  }
  function override(action, tid) {
    if (action === 'expire') { const d = D(tid); d.expiresAt = now() - 1; tick(); }
    else if (action === 'cancel') cancelDonation(null, tid, true);
    else if (action === 'verify') { U(tid).verified = true; note(tid, 'You are verified. You can receive assignments.'); }
    else if (action === 'toggle') { const u = U(tid); if (u.role === 'receiver') u.active = u.active === false; else if (u.role === 'rider') u.available = !u.available; }
    else err('Unknown override'); S.v++;
  }
  function config(k, v) { if (!(k in CFG0) || !(+v >= 0)) err('Invalid setting'); S.cfg[k] = +v; S.v++; }

  function info(q) { const d = D(q.donationId), r = U(q.receiverId), f = feas(d, r, null); return { km: +km(U(d.donorId), r).toFixed(1), mins: Math.round(f.ride), slack: f.slack }; }
  function view(uid) {
    const me = U(uid), ad = me.role === 'admin', t = now();
    let reqs = S.requests.filter(q => ad || q.receiverId === uid || D(q.donationId).donorId === uid);
    const asgs = S.asgs.filter(a => ad || a.riderId === uid || reqs.some(q => q.id === a.requestId));
    if (me.role === 'rider') reqs = S.requests.filter(q => asgs.some(a => a.requestId === q.id));
    const dids = new Set([...reqs.map(q => q.donationId), ...asgs.map(a => a.donationId)]);
    const dons = S.donations.filter(d => ad || d.donorId === uid || dids.has(d.id) || (me.role === 'receiver' && d.status === 'Available'));
    const rel = new Set([uid]); reqs.forEach(q => { rel.add(q.receiverId); rel.add(D(q.donationId).donorId); }); asgs.forEach(a => rel.add(a.riderId));
    const users = S.users.filter(u => ad || u.role === 'donor' || u.role === 'receiver' || rel.has(u.id) || (me.role === 'donor' && u.donorId === uid)).map(u => { const { pw, ...o } = u; if (!ad && u.id !== uid) delete o.email; if (!ad && !rel.has(u.id)) delete o.phone; return o; });
    const fits = {};
    if (me.role === 'receiver') dons.filter(d => d.status === 'Available').forEach(d => { fits[d.id + ':' + uid] = fit(d, me); });
    if (me.role === 'donor') dons.filter(d => d.donorId === uid && d.status === 'Available').forEach(d => S.users.filter(u => u.role === 'receiver').forEach(r => { fits[d.id + ':' + r.id] = fit(d, r); }));
    const ids = new Set([...dids, ...reqs.map(q => q.id), ...asgs.map(a => a.id)]);
    const { pw, ...self } = me;
    return { now: t, cfg: S.cfg, cats: CATS, me: self, users, donations: dons, requests: reqs.map(q => ({ ...q, info: info(q) })), asgs: asgs.map(a => { const d = D(a.donationId), q = Q(a.requestId), rd = U(a.riderId); return { ...a, route: { pk: +km(rd, U(d.donorId)).toFixed(1), pm: Math.round(mins(km(rd, U(d.donorId)))), dk: +km(U(d.donorId), U(q.receiverId)).toFixed(1), dm: Math.round(mins(km(U(d.donorId), U(q.receiverId)))) } }; }), notes: S.notes.filter(n => n.to === uid && n.at <= t).slice(-30), events: (ad ? S.events : S.events.filter(e => ids.has(e.k))).slice(0, 60), fits };
  }
  function seed() {
    Object.assign(S, { users: [], donations: [], requests: [], asgs: [], events: [], notes: [], sessions: {}, seq: 1, cfg: { ...CFG0 } });
    const mk = (role, email, name, lat, lng, x) => { const u = { id: id('u'), role, email, pw: hash('demo1234'), name, phone: '+91 90000 000' + S.seq, lat, lng, address: 'Pune, Maharashtra', cats: [], safety: [], needs: {}, ...x }; S.users.push(u); return u; };
    mk('admin', 'admin@demo.test', 'Operations Admin', 18.52, 73.855, {});
    const d1 = mk('donor', 'donor@demo.test', 'Shree Kitchen', 18.5362, 73.894, { manager: 'R. Kulkarni', ftype: 'Restaurant', ophours: '09:00 to 23:00', cats: ['Cooked meals', 'Bakery'], handling: 'Hot hold above 60 C, packed within 20 minutes' });
    const d2 = mk('donor', 'donor2@demo.test', 'Annapurna Caterers', 18.5074, 73.8077, { manager: 'S. Joshi', ftype: 'Caterer', ophours: '08:00 to 20:00', cats: ['Packaged food', 'Dry rations'], handling: 'Sealed trays, labelled with batch time' });
    const rd = (e, n, d, lat, lng, vehicle, cap) => mk('rider', e, n, lat, lng, { donorId: d.id, vehicle, cap, available: true, radius: 15, verified: true, status: 'Available' });
    rd('rider@demo.test', 'Arjun Patil', d1, 18.53, 73.89, 'Motorbike', 25); rd('rider2@demo.test', 'Meera Shah', d1, 18.54, 73.9, 'Scooter', 15); rd('rider3@demo.test', 'Neha Rao', d1, 18.52, 73.88, 'Bicycle', 10); rd('rider4@demo.test', 'Sanjay More', d2, 18.51, 73.82, 'Van', 60);
    const rc = (e, n, lat, lng, x) => mk('receiver', e, n, lat, lng, { active: true, ...x });
    rc('receiver@demo.test', 'Asha Shelter', 18.5089, 73.926, { manager: 'P. Deshmukh', capacity: 120, occupancy: 96, ages: 'All ages', cats: ['Cooked meals', 'Packaged food'], needs: { 'Cooked meals': 40, 'Packaged food': 20 }, water: true, fuel: true, storage: 20, hours: [0, 24] });
    rc('receiver2@demo.test', 'Seva Student Hostel', 18.5308, 73.8475, { manager: 'A. Iyer', capacity: 200, occupancy: 150, ages: '17 to 25', cats: ['Cooked meals', 'Dry rations'], needs: { 'Cooked meals': 30, 'Dry rations': 50 }, water: true, fuel: false, storage: 0, hours: [0, 24] });
    rc('receiver3@demo.test', 'Wakad Relief Center', 18.599, 73.76, { manager: 'K. Pawar', capacity: 300, occupancy: 220, ages: 'Families', cats: ['Packaged food', 'Drinking water', 'Dry rations'], needs: { 'Packaged food': 60, 'Drinking water': 80 }, water: true, fuel: true, storage: 100, hours: [0, 24] });
    addDonation(d1.id, { category: 'Cooked meals', unit: 'portions', qty: 45, expiresInMin: 240, safety: ['Keep hot'], packaging: 'Insulated boxes' });
    addDonation(d2.id, { category: 'Packaged food', unit: 'packs', qty: 80, expiresInMin: 600, safety: ['Sealed packaging'], packaging: 'Sealed trays' });
    addDonation(d1.id, { category: 'Cooked meals', unit: 'portions', qty: 20, expiresInMin: 90, safety: ['Keep hot', 'Needs cooking'], packaging: 'Steel containers' });
    S.v++;
  }
  function load(o) { Object.assign(S, o); }
  return { S, T, CATS, seed, load, view, tick, to, setClock: f => { clock = f; }, register, login, apply, addDonation, request, respond, riderAccept, confirm, ride, receipt, cancelDonation, sim, override, config, fit, options, compat, plan, id, U, D, Q, A };
}
module.exports = { create, CATS };

'use strict';
const test = require('node:test'), assert = require('node:assert');
const { create } = require('../engine');
function setup() { const e = create(); let t = Date.now(); e.setClock(() => t); e.seed(); const adv = s => { t += s * 1000; e.tick(); }; const u = em => e.S.users.find(x => x.email === em); return { e, adv, u }; }
const donorDon = (e, u) => e.S.donations.find(d => d.donorId === u('donor@demo.test').id && d.category === 'Cooked meals' && d.qty === 45);

test('compatibility blocks cooking items without fuel', () => {
  const { e, u } = setup(), d = e.S.donations.find(x => x.safety.includes('Needs cooking'));
  assert.ok(e.compat(d, u('receiver2@demo.test')).some(m => /fuel/.test(m)));
  assert.deepEqual(e.compat(d, u('receiver@demo.test')), []);
});
test('request splits across riders when one lacks capacity', () => {
  const { e, u } = setup(), d = donorDon(e, u), r = u('receiver@demo.test');
  const q = e.request(r.id, d.id, 40); e.respond(u('donor@demo.test').id, q.id, true);
  const as = e.S.asgs.filter(a => a.requestId === q.id);
  assert.ok(as.length >= 2); assert.equal(as.reduce((s, a) => s + a.qty, 0), 40); assert.equal(q.status, 'Receiver confirmation pending');
});
test('full workflow reaches receiver confirmed and updates demand', () => {
  const { e, u } = setup(), d = donorDon(e, u), r = u('receiver@demo.test'), dn = u('donor@demo.test');
  const q = e.request(r.id, d.id, 20); e.respond(dn.id, q.id, true);
  e.S.asgs.filter(a => a.requestId === q.id).forEach(a => e.riderAccept(a.riderId, a.id)); e.confirm(r.id, q.id);
  e.S.asgs.filter(a => a.requestId === q.id).forEach(a => { e.ride(a.riderId, a.id, 'start'); e.ride(a.riderId, a.id, 'deliver'); });
  assert.equal(d.status, 'Delivered'); e.receipt(r.id, q.id);
  assert.equal(q.status, 'Completed'); assert.equal(r.needs['Cooked meals'], 20); assert.equal(d.status, 'Available'); assert.equal(d.remaining, 25);
});
test('donation too close to expiry cannot be requested, and expires on timer', () => {
  const { e, adv, u } = setup(), d = donorDon(e, u), r = u('receiver@demo.test');
  d.expiresAt = Date.now() + 5 * 6e4; assert.throws(() => e.request(r.id, d.id, 10), /Not eligible/);
  adv(600); assert.equal(d.status, 'Expired');
});
test('donor approval timeout releases quantity', () => {
  const { e, adv, u } = setup(), d = donorDon(e, u), r = u('receiver@demo.test');
  const q = e.request(r.id, d.id, 30); assert.equal(d.remaining, 15); adv(e.S.cfg.donorApproval + 1);
  assert.equal(q.status, 'Timed out'); assert.equal(d.remaining, 45); assert.equal(d.status, 'Available');
});
test('unconfirmed receiver triggers reassignment with reason', () => {
  const { e, adv, u } = setup(), d = donorDon(e, u), r = u('receiver@demo.test');
  const q = e.request(r.id, d.id, 20); e.respond(u('donor@demo.test').id, q.id, true); adv(e.S.cfg.receiverConfirm + 1);
  assert.equal(q.status, 'Reassigned'); const q2 = e.S.requests.find(x => x.tried.includes(r.id));
  assert.ok(q2); assert.notEqual(q2.receiverId, r.id); assert.match(q.tl.at(-1).why, /did not confirm/);
});
test('rider failure reassigns to another rider', () => {
  const { e, u } = setup(), d = donorDon(e, u), r = u('receiver@demo.test');
  const q = e.request(r.id, d.id, 10); e.respond(u('donor@demo.test').id, q.id, true);
  const a = e.S.asgs.find(x => x.requestId === q.id); e.riderAccept(a.riderId, a.id); e.confirm(r.id, q.id);
  e.sim('riderFail', a.id); assert.equal(a.status, 'Failed');
  const rep = e.S.asgs.find(x => x.requestId === q.id && x.status === 'Reserved'); assert.ok(rep); assert.notEqual(rep.riderId, a.riderId);
});
test('invalid transitions throw and quantities never go negative', () => {
  const { e, u } = setup(), d = donorDon(e, u), r = u('receiver@demo.test');
  assert.throws(() => e.to(d, e.T.d, 'Delivered', 'x'), /Invalid transition/);
  assert.throws(() => e.request(r.id, d.id, 999), /Quantity/);
  e.request(r.id, d.id, 40); assert.ok(d.remaining >= 0);
  assert.throws(() => e.request(r.id, d.id, 1), /not available/);
});
test('role checks block wrong accounts', () => {
  const { e, u } = setup(), d = donorDon(e, u), r = u('receiver@demo.test');
  const q = e.request(r.id, d.id, 10);
  assert.throws(() => e.respond(u('donor2@demo.test').id, q.id, true), /Not allowed/);
});

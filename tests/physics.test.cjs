'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
function boot() {
  const elements = new Map();
  const canvas = { width: 500, height: 500, getContext: () => ({}) };
  const document = {
    getElementById(id) {
      if (id === 'arena') return canvas;
      if (!elements.has(id)) elements.set(id, { style: {}, classList: { add() {}, remove() {} } });
      return elements.get(id);
    }
  };
  const context = vm.createContext({ document, Math, console });
  for (const file of ['js/core/state.js', 'js/core/engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}
const fighter = (n, x, y, vx, vy) =>
  ({ playerNum: n, id: 'test', name: 'Test', x, y, vx, vy, radius: 34,
    hp: 250, maxHp: 250, invincible: 0, slowTimer: 0, slowMultiplier: 1,
    getTag() { return null; } });

test('head-on collision pushes fighters apart symmetrically', () => {
  const c = boot();
  c.a = fighter(1, 250, 220, 0, 2);
  c.b = fighter(2, 250, 275, 0, -2);
  vm.runInContext('handleCombat(a,b)', c);
  assert.ok(c.a.vy < 2);
  assert.ok(c.b.vy > -2);
  assert.ok(Math.abs(c.a.vy + c.b.vy) < 1e-9);
  assert.ok(c.b.y - c.a.y >= 68);
});
test('exact coordinate overlap never produces non-finite velocity', () => {
  const c = boot();
  c.a = fighter(1, 250, 250, 2, 0);
  c.b = fighter(2, 250, 250, -2, 0);
  vm.runInContext('handleCombat(a,b)', c);
  for (const p of [c.a, c.b]) {
    assert.ok([p.x, p.y, p.vx, p.vy].every(Number.isFinite));
  }
  assert.ok(c.a.x < c.b.x);
});
test('arena step caps runaway speed without removing ordinary motion', () => {
  const c = boot();
  c.a = fighter(1, 100, 100, 80, 0);
  c.b = fighter(2, 400, 400, -1, 0);
  vm.runInContext('players=[a,b];isPlaying=true;update()', c);
  assert.ok(Math.hypot(c.a.vx, c.a.vy) <= 12.000001);
  assert.ok(c.a.x > 100);
});
test('visual text pauses with the simulation', () => {
  const c = boot();
  c.a = fighter(1, 100, 100, 1, 0);
  c.b = fighter(2, 400, 400, -1, 0);
  vm.runInContext("players=[a,b];floatingTexts=[{x:100,y:100,vy:-0.7,alpha:1}];update()", c);
  assert.equal(vm.runInContext('floatingTexts[0].y', c), 100);
  vm.runInContext('isPlaying=true;update()', c);
  assert.ok(vm.runInContext('floatingTexts[0].y', c) < 100);
});

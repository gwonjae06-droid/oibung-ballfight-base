'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const main = read('js/main.js');
const forge = read('js/features/skill-forge.js');
const engine = read('js/core/engine.js');
const economy = read('js/features/economy.js');
const style = read('css/style.css');
const render = read('js/core/render.js');
function panelHtml() {
  // Match the static HTML string declared in main.js, never evaluate application JS.
  const match = main.match(/panel\.innerHTML = ("(?:\\.|[^"\\])*");/);
  assert.ok(match, 'match setup markup not found');
  return JSON.parse(match[1]);
}
const ids = text => [...text.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);

test('all required game and optional feature controls still exist', () => {
  const all = [...ids(html), ...ids(panelHtml()), ...ids(forge)];
  const required = [
    'arena', 'container', 'title-text', 'ui-container', 'sec-p1', 'sec-p2', 'sec-p3',
    'btn-start', 'btn-reset', 'btn-mode', 'coin-balance', 'economy-message',
    'wager-input', 'odds-text', 'bet-players', 'reserved-list', 'btn-max-bet',
    'targets-skillRush', 'targets-vitality', 'targets-speed',
    'bf-picks', 'bf-speed', 'bf-apply', 'bf-photo', 'bf-face', 'bf-photo-target',
    'bf-photo-apply', 'bf-photo-clear', 'bf-name', 'bf-text',
    'bf-analyze', 'bf-create', 'bf-result', 'bf-status', 'bf-custom-list'
  ];
  for(const id of required)assert.ok(all.includes(id), 'missing DOM id: ' + id);
  assert.equal(new Set(all).size, all.length, 'duplicate DOM id');
});

test('only one random-match control exists and advanced tools are collapsed', () => {
  assert.ok(html.includes('id="btn-reset"'));
  assert.ok(!main.includes('bf-random'), 'duplicate random button still exists');
  assert.ok(panelHtml().includes('<details class="bf-details">'));
  assert.equal((panelHtml().match(/<details class="bf-details">/g) || []).length, 2);
  assert.ok(main.includes("document.querySelector('.battle-screen').after(panel)"));
  assert.ok(!main.includes('function parse('), 'old keyword parser remains');
  assert.ok(forge.includes('const TRIGGER='));
  assert.ok(html.includes('<details class="roster-card">'));
  assert.ok(main.includes("fold.className = 'bf-fold'"));
});

test('control wording is short and start state is managed by CSS', () => {
  assert.ok(!engine.includes('.style.background='));
  assert.ok(engine.includes("dataset.state='playing'") || engine.includes("b.dataset.state=isPlaying?'playing':'paused'"));
  assert.ok(!render.includes('하단의 [▶ 경기 시작]'));
  assert.ok(style.includes('#btn-start[data-state="playing"]'));
  assert.ok(economy.includes('e.dataset.tone=tone'));
});

test('responsive HUD and input accessibility are preserved', () => {
  assert.ok(style.includes('.ui-container.mode-3p #sec-p3'));
  assert.ok(style.includes('@media (max-width: 560px)'));
  assert.ok(style.includes('background:#fff!important'), 'white arena theme missing');
  assert.ok(style.includes('color-scheme: dark'), 'black UI shell missing');
  assert.ok(read('js/features/natural-forge.js').includes('forge-natural-text'));
  assert.ok(read('js/features/community-forge.js').includes('community-items'));
  assert.ok(read('js/features/skill-forge.js').includes('function remove(id)'));
  assert.ok(style.includes(':focus-visible'));
  assert.ok(html.includes('aria-label="경기 조작"'));
  assert.ok(html.includes('aria-label="경기 배속"'));
});

test('game scripts are loaded in dependency order', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
  assert.ok(scripts.indexOf('js/core/state.js') < scripts.indexOf('js/core/engine.js'));
  assert.ok(scripts.indexOf('js/core/engine.js') < scripts.indexOf('js/main.js'));
  assert.ok(scripts.indexOf('js/main.js') < scripts.indexOf('js/features/skill-forge.js'));
  assert.ok(scripts.indexOf('js/features/ability-atlas.js') < scripts.indexOf('js/features/skill-forge.js'));
  assert.ok(scripts.indexOf('js/features/skill-forge.js') < scripts.indexOf('js/features/natural-forge.js'));
  assert.ok(scripts.indexOf('js/features/natural-forge.js') < scripts.indexOf('js/features/community-forge.js'));
  assert.ok(scripts.indexOf('js/features/community-forge.js') < scripts.indexOf('js/features/battle-effects.js'));
  assert.ok(scripts.indexOf('js/features/vfx-audio.js') < scripts.indexOf('js/features/character-remix.js'));
  assert.ok(scripts.indexOf('js/features/character-remix.js') < scripts.indexOf('js/main.js'));
});

test('expanded atlas is offered only inside collapsible advanced creator controls',()=>{
  const natural=read('js/features/natural-forge.js');
  const atlas=read('js/features/ability-atlas.js');
  assert.ok(natural.includes('공격 동작 도감'));
  assert.ok(natural.includes('catalogDetail'));
  assert.ok(natural.includes('atlas-query'));
  assert.ok(atlas.includes('catalog=Object.freeze'));
  assert.ok(atlas.includes('function choose('));
  assert.ok(atlas.includes('function layout('));
  assert.ok(atlas.includes('function execute('));
});

test('one translucent speed selector overlays the upper-right corner of the game canvas', () => {
  assert.equal(ids(html).filter(id => id === 'bf-speed').length, 1);
  assert.equal(ids(panelHtml()).filter(id => id === 'bf-speed').length, 0);
  assert.match(html, /<div class="canvas-wrapper">[\s\S]*<label class="arena-speed-control" for="bf-speed">[\s\S]*<select id="bf-speed"/);
  assert.match(style, /\.canvas-wrapper \.arena-speed-control\s*\{[^}]*position:\s*absolute;[^}]*top:/);
  assert.match(style, /\.canvas-wrapper \.arena-speed-control\s*\{[^}]*right:/);
  assert.match(style, /\.canvas-wrapper \.arena-speed-control\s*\{[^}]*background:\s*rgba\(/);
  assert.match(read('js/features/battle-effects.js'), /getElementById\('bf-speed'\)/);
});

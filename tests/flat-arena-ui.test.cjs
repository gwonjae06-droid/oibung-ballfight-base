'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const txt=p=>fs.readFileSync(__dirname+'/../'+p,'utf8');
test('overtime begins later and draw requires longer active combat',()=>{
 const g={};vm.createContext(g);vm.runInContext(txt('js/features/arena-stalemate.js'),g);
 const s=g.ArenaStalemate,l=s.LIMITS;
 assert.ok(l.regular>=300*60&&l.tower>=l.regular);
 assert.ok(l.stagnant>=150*60&&l.towerStagnant>=l.stagnant);
 assert.ok(l.deadline>=300*60);
 const fighters=[{hp:200,maxHp:200},{hp:200,maxHp:200}];
 for(let i=0;i<38*60;i++)s.tick(fighters);assert.equal(s.state.active,false);
});
test('all six tower platforms, stairs and bridges have identical zero elevation',()=>{
 const g={};vm.createContext(g);vm.runInContext(txt('js/features/tower-map-architecture.js'),g);
 const a=g.ArenaTowerArchitecture;
 for(const realm of ['time','space','fire','storm','ice','forest']){
  for(const tick of [0,220,460]){
   const m=a.getMap(realm,8,500,500,tick);
   assert.ok(m.surfaces.length>=6,realm);
   assert.ok(m.surfaces.every(s=>s.z===0 && (!s.from||(s.z0===0&&s.z1===0))),realm);
   assert.ok(m.surfaces.some(s=>s.from),realm);
   assert.equal(a.heightAt(realm,8,250,250,500,500,tick),0);
  }
 }
});
test('commentary uses four distinct user-supplied expressions and points are absent from navigation',()=>{
 const html=txt('index.html'),css=txt('css/streamlined-arena.css'),js=txt('js/features/battle-director.js');
 assert.doesNotMatch(html,/<script src="js\/features\/cosmetic-arcade\.js"/);
 assert.doesNotMatch(html,/data-category="cosmetics"/);
 assert.doesNotMatch(html,/data-category="economy"/);
 assert.match(css,/#skin-editor/);assert.match(js,/assets\/commentator-/);
 for(const mood of ['neutral','talk','surprise','grim'])assert.match(txt('assets/commentator-'+mood+'.svg'),/<svg/);
});
test('tower floor picker protects locked floors and allows previous ones between rounds',()=>{
 const s=txt('js/features/tower-challenge.js');
 assert.match(s,/tower-floor-picker/);assert.match(s,/function moveToFloor\(target\)/);
 assert.match(s,/best\+1/);assert.match(s,/stage!==\'between\'/);
 assert.match(s,/data-floor/);
});
test('major skill families draw separate upright 2.5D columns without changing combat damage',()=>{
 const s=txt('js/features/skill-visuals.js');
 for(const type of ['erupt','nova','meteor','starfall','blackhole','orbit','bolt','chain','beam','summon','wall'])assert.ok(s.includes("'"+type+"'"));
 assert.match(s,/fx\.column\(ctx/);assert.match(s,/fx\.ground\(ctx/);
});
test('floor 10 remains harder than floor 1, without the old extreme resistance',()=>{
 const g={};vm.createContext(g);vm.runInContext(txt('js/features/tower-realms.js'),g);
 for(const r of g.ArenaTowerRealms.REALMS){const low=g.ArenaTowerRealms.floor({number:1,boss:false},r.id),high=g.ArenaTowerRealms.floor({number:10,boss:true},r.id);
  assert.ok(high.hp>low.hp*4);assert.ok(high.towerDefense>=.7);assert.ok(high.towerDefense<1);
 }
});

test('retired economy does not spend, earn, bet or modify inventory',()=>{
 const g={activeBet:{wager:90},roundSettled:false,coins:100,SHOP_ITEMS:{},itemInventory:{},reservedItems:{}};vm.createContext(g);
 vm.runInContext(txt('js/features/economy.js'),g);
 assert.equal(g.beginRoundEconomy(),true);assert.equal(g.activeBet,null);
 assert.equal(g.buyItem('any'),false);g.settleRound({playerNum:1},'won');
 assert.equal(g.coins,100);assert.equal(g.roundSettled,true);
});

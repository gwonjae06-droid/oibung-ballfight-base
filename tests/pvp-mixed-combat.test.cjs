'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=async()=>import(pathToFileURL(path.join(__dirname,'../workers/pvp-rules.mjs')).href);
test('PvP preserves only the actual authored 1–4 skills without fabricated buttons',async()=>{
 const {normalizeProfile}=await load();
 const one=normalizeProfile({id:'forge_user',name:'한 개 스킬',
  skills:[{name:'번개 베기',actions:[{type:'slash'},{type:'bolt'}]}]});
 assert.equal(one.skills.length,1);
 assert.equal(one.skills[0].name,'번개 베기');
 assert.deepEqual(one.skills[0].actions.map(a=>a.type),['slash','bolt']);
 assert.ok(one.skills[0].cooldown>=3.6);
 const three=normalizeProfile({id:'forge_user',skills:[{type:'shot'},{type:'shield'},{type:'dash'}]});
 assert.equal(three.skills.length,3);
 const built=normalizeProfile({id:'park',name:'기본 캐릭터'});
 assert.equal(built.skills.length,4,'built-in kit is explicitly defined');
 const empty=normalizeProfile({id:'forge_empty',skills:[]});
 assert.equal(empty.skills.length,0);
});
test('manual VS auto controls each fighter independently, including same-mode pairing',async()=>{
 const r=await load();
 const p=r.normalizeProfile({skills:[{type:'shot'}]});
 const q=r.normalizeProfile({skills:[{type:'shot'}]});
 const room=r.createRoom(p,q,'manual',1000,['manual','auto']);
 assert.deepEqual(room.modes,['manual','auto']);
 assert.equal(room.players[0].mode,'manual');
 assert.equal(room.players[1].mode,'auto');
 assert.equal(r.setInput(room,0,{x:1,y:0},1010),true);
 assert.equal(r.setInput(room,1,{x:1,y:0},1010),false,'cannot remotely steer an auto fighter');
 r.step(room,.05,1050);
 assert.ok(room.players[0].x>110);
 assert.ok(room.players[1].ready[0]>0,'auto fighter autonomously casts');
 assert.equal(room.players[0].ready[0],0,'manual fighter only casts on input');
 assert.equal(r.cast(room,0,0,1100),true);
 const snapshot=r.snapshot(room,1100);
 assert.deepEqual(snapshot.players.map(f=>f.mode),['manual','auto']);
 assert.equal(snapshot.players[0].skills.length,1);
 assert.ok(snapshot.events.some(e=>e.type==='cast'&&e.caster===0));
 const opposite=r.createRoom(p,q,'manual',1000,['auto','manual']);
 assert.equal(r.setInput(opposite,0,{x:1,y:0}),false);
 assert.equal(r.setInput(opposite,1,{x:-1,y:0}),true);
 const bothAuto=r.createRoom(p,q,'auto',1000);
 assert.deepEqual(bothAuto.modes,['auto','auto']);
});
test('authored multi-action skills execute chained attacks with visual events and no dummy slots',async()=>{
 const r=await load();
 const p=r.normalizeProfile({skills:[
  {name:'베기와 충격파',actions:[{type:'slash'},{type:'wave'},{type:'bolt'}]}]});
 const room=r.createRoom(p,p,'manual',1000);
 room.players[0].x=310;room.players[1].x=360;
 assert.equal(r.cast(room,0,0,1000),true);
 assert.equal(r.cast(room,0,1,1000),false,'missing slot is not castable');
 assert.equal(room.pending.length,2);
 assert.equal(room.players[1].hp,218);
 r.step(room,.05,1166);
 assert.ok(room.players[1].hp<218);
 r.step(room,.05,1331);
 assert.ok(room.players[1].hp<198);
 const state=r.snapshot(room,1331);
 assert.equal(state.players[0].skills.length,1);
 const casts=state.events.filter(e=>e.type==='cast');
 assert.equal(casts.length,3);
 assert.deepEqual(casts.map(e=>e.style),['slash','wave','bolt']);
 assert.ok(state.events.some(e=>e.type==='hit'&&Number.isFinite(e.x)));
 assert.ok(casts.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.targetX)));
});

test('browser rulebook exactly mirrors Node PvP rules and is loaded before matchmaking',()=>{
 const fs=require('node:fs');
 const file=fs.readFileSync(path.join(__dirname,'../js/features/pvp-rulebook.js'),'utf8').replace(/\r/g,'');
 const original=fs.readFileSync(path.join(__dirname,'../workers/pvp-rules.mjs'),'utf8').replace(/\r/g,'');
 assert.ok(file.includes(original.replace(/^export /gm,'')),'browser and Node must run identical combat rules');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(html.indexOf('pvp-rulebook.js')<html.indexOf('pvp-supabase.js'));
 assert.ok(html.indexOf('pvp-supabase.js')<html.indexOf('pvp-online.js'));
});

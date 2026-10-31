'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
function clock(){
 let now=1000;
 const context={Math,Date,performance:{now:()=>now}};
 context.globalThis=context;vm.createContext(context);
 vm.runInContext(read('js/features/arena-countdown.js'),context);
 return {c:context.ArenaCountdown,set(value){now=value;}};
}
test('every new battle displays a full 3-2-1-FIGHT sequence at wall-clock speed',()=>{
 const {c}=clock();
 c.start(null,1000);
 assert.equal(c.active,true);
 assert.equal(c.state.remaining,3600);
 assert.equal(c.tick(1990),true);assert.equal(c.state.remaining,2610);
 assert.equal(c.tick(2010),true);assert.equal(c.state.remaining,2590);
 assert.equal(c.tick(3010),true);assert.equal(c.state.remaining,1590);
 assert.equal(c.tick(4010),true);assert.equal(c.state.remaining,590);
 assert.equal(c.tick(4599),true);
 assert.equal(c.tick(4600),false);
 assert.equal(c.active,false);
});
test('pause freezes the countdown and resume preserves the remaining time',()=>{
 const {c}=clock();
 c.start(null,1000);
 c.pause(1700);
 assert.equal(c.state.phase,'paused');
 assert.equal(c.state.remaining,2900);
 assert.equal(c.tick(170000),true);
 assert.equal(c.state.remaining,2900);
 c.resume(200000);
 c.tick(200500);
 assert.equal(c.state.remaining,2400);
 c.cancel();
 assert.equal(c.active,false);
 c.start(null,220000);
 assert.equal(c.state.remaining,3600,'the next match starts fresh');
});
test('remote PvP countdown does not freeze local game simulation or double-tick',()=>{
 const {c}=clock();
 c.syncRemote(null,3200,1000);
 assert.equal(c.state.phase,'remote');
 assert.equal(c.tick(2000),false,'main physics clock never consumes spectator time');
 assert.equal(c.state.remaining,3200);
 c.progressRemote(1500);
 assert.equal(c.state.remaining,2700);
 c.syncRemote(null,2520,1700);
 assert.equal(c.state.remaining,2500,'small packet jitter is ignored');
 c.progressRemote(4200);
 assert.equal(c.isVisible,false);
});
test('arena countdown is mounted by the main screen and controls all fixed-step physics',()=>{
 const html=read('index.html'),engine=read('js/core/engine.js'),
  effects=read('js/features/battle-effects.js'),style=read('css/arena-countdown.css'),
  tower=read('js/features/tower-challenge.js');
 assert.match(html,/arena-countdown\.js\?v=fight-countdown1/);
 assert.match(html,/arena-countdown\.css\?v=fight-countdown1/);
 assert.ok(html.indexOf('arena-countdown.js')<html.indexOf('core/engine.js'));
 assert.match(engine,/ArenaCountdown\?\.start/);
 assert.match(engine,/ArenaCountdown\?\.pause/);
 assert.match(engine,/ArenaCountdown\?\.resume/);
 assert.match(engine,/ArenaCountdown\?\.cancel/);
 assert.match(effects,/countdownBlocked/);
 assert.match(effects,/if\(isPlaying&&!isGameOver&&!countdownBlocked\)/);
 assert.match(tower,/togglePlay\(\{towerBattle:true\}\)/);
 assert.match(style,/prefers-reduced-motion:reduce/);
 assert.match(style,/\.arena-countdown\[hidden\]/);
});
test('online PvP applies the same freeze to BOTH peers with a host-controlled ready timestamp',()=>{
 const html=read('index.html'),runtime=read('js/features/pvp-runtime.js'),
  transport=read('js/features/pvp-supabase.js'),online=read('js/features/pvp-online.js');
 assert.match(transport,/this\.current\.startAt=this\.lastStep\+3600/);
 assert.match(runtime,/room\.startAt>now\)return/);
 assert.match(runtime,/startInMs:/);
 assert.match(online,/ArenaCountdown\?\.syncRemote/);
 assert.match(online,/ArenaCountdown\?\.progressRemote/);
 assert.match(html,/pvp-online\.js\?v=cinema1/);
});

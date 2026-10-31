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
test('1.3x faster 3-2-1-FIGHT countdown uses the same simulation pause semantics',()=>{
 const {c}=clock();c.start(null,1000);
 assert.equal(c.active,true);assert.equal(c.state.remaining,2769);
 c.tick(1700);assert.equal(c.state.remaining,2069);
 c.tick(1980);assert.equal(c.state.remaining,1789);
 c.tick(2780);assert.equal(c.state.remaining,989);
 assert.equal(c.tick(3768),true);assert.equal(c.tick(3769),false);
 assert.equal(c.active,false);
});
test('pause freezes the faster countdown and resume preserves its state',()=>{
 const {c}=clock();c.start(null,1000);c.pause(1700);
 assert.equal(c.state.phase,'paused');assert.equal(c.state.remaining,2069);
 assert.equal(c.tick(170000),true);assert.equal(c.state.remaining,2069);
 c.resume(200000);c.tick(200500);assert.equal(c.state.remaining,1569);
 c.cancel();assert.equal(c.active,false);
 c.start(null,220000);assert.equal(c.state.remaining,2769);
});
test('remote PvP follows faster host countdown and does not block local physics',()=>{
 const {c}=clock();c.syncRemote(null,2500,1000);
 assert.equal(c.state.phase,'remote');assert.equal(c.tick(2000),false);
 assert.equal(c.state.remaining,2500);c.progressRemote(1500);
 assert.equal(c.state.remaining,2000);
 c.syncRemote(null,1800,1700);assert.equal(c.state.remaining,1800);
 c.progressRemote(4000);assert.equal(c.isVisible,false);
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
 assert.match(transport,/this\.current\.startAt=this\.lastStep\+2769/);
 assert.match(runtime,/room\.startAt>now\)return/);
 assert.match(runtime,/startInMs:/);
 assert.match(online,/ArenaCountdown\?\.syncRemote/);
 assert.match(online,/ArenaCountdown\?\.progressRemote/);
 assert.match(html,/pvp-online\.js\?v=cinema1/);
});

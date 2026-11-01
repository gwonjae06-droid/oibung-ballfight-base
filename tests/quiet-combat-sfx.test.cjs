'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function FakeAudioContext(){
 this.currentTime=0;this.sampleRate=24000;this.state='running';
 this.destination={};this.gains=[];this.oscs=[];
 const value=()=>({value:0,setValueAtTime(v){this.value=v;},
   exponentialRampToValueAtTime(v){this.value=v;},
   setTargetAtTime(v){this.value=v;}});
 const node=()=>({connect(){}});
 this.createDynamicsCompressor=()=>({threshold:value(),knee:value(),ratio:value(),
   attack:value(),release:value(),...node()});
 this.createGain=()=>{const n={gain:value(),...node()};this.gains.push(n);return n;};
 this.createOscillator=()=>{const n={frequency:value(),type:'',start(){},
   stop(){},...node()};this.oscs.push(n);return n;};
 this.createBuffer=()=>({copyToChannel(){}});
 this.createBufferSource=()=>({buffer:null,start(){},stop(){},...node()});
 this.createBiquadFilter=()=>({type:'',frequency:value(),Q:value(),...node()});
 this.resume=()=>Promise.resolve();
}
function bootAudio(){
 const instances=[];
 const Mock=function(){const c=new FakeAudioContext();instances.push(c);return c;};
 const g={window:null,globalThis:null,Math,Date,Map,Set,Float32Array,console,
  AudioContext:Mock,ArenaSpeedControl:{multiplier:1}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 vm.runInContext(read('js/features/vfx-audio.js'),g);
 g.BattleFX.unlock();
 return {g,mixer:g.BattleFX,ctx:instances[0],instances};
}
function pass(g,n=8){for(let i=0;i<n;i++)g.BattleFX.tick();}
test('effects bus defaults to quiet 55% with separate adjustable 0-100% mute control',()=>{
 const {mixer,ctx}=bootAudio();
 assert.equal(mixer.volume,.55);
 assert.ok(Math.abs(ctx.gains[0].gain.value-.099)<1e-9);
 assert.equal(mixer.setVolume(.25),.25);
 assert.ok(Math.abs(ctx.gains[0].gain.value-.045)<1e-9);
 mixer.setMuted(true);assert.equal(ctx.gains[0].gain.value,0);
 assert.equal(mixer.sound('bounce-combo',.6),false);
 mixer.setMuted(false);mixer.setVolume(0);assert.equal(mixer.sound('heavy',1),false);
 assert.equal(ctx.gains[0].gain.value,0);
 mixer.setVolume(4);assert.equal(mixer.volume,1);
});
test('distinct quiet low-pitched cue families run through one AudioContext and crowding limit',()=>{
 const {g,mixer,ctx,instances}=bootAudio();
 assert.equal(mixer.sound('bounce-perfect',.55),true);
 assert.ok(ctx.oscs.length>=2);
 assert.ok(ctx.oscs[0].frequency.value<200);
 assert.equal(mixer.sound('bounce-perfect',.55),false);
 pass(g,8);ctx.currentTime=.15;
 assert.equal(mixer.sound('bounce-perfect',.55),false,'same cue suppressed within 340ms');
 assert.equal(mixer.sound('tactic-sling',.55),true);
 pass(g,8);ctx.currentTime=.18;
 assert.equal(mixer.sound('tactic-anchor',.55),false,'adjacent accents do not stack');
 pass(g,8);ctx.currentTime=.30;
 assert.equal(mixer.sound('bounce-combo',.55),true);
 pass(g,8);ctx.currentTime=.40;
 assert.equal(mixer.sound('tactic-evade',.55),true);
 pass(g,8);ctx.currentTime=.47;
 assert.equal(mixer.sound('signature-launch',.55),false,
  'a maximum of four accents may occur in any rolling 300ms interval');
 assert.equal(instances.length,1,'no extra audio contexts or assets for new sounds');
});
test('100x fast forward suppresses physical noise and preserves rare intentional controls',()=>{
 const {g,mixer,ctx}=bootAudio();
 g.ArenaSpeedControl.multiplier=100;
 assert.equal(mixer.sound('heavy',1),false);
 assert.equal(mixer.sound('hit',1),false);
 assert.equal(mixer.sound('bounce-combo',1),false);
 assert.equal(mixer.sound('signature-ready',1),false);
 assert.equal(mixer.sound('signature-launch',.6),true);
 pass(g,8);ctx.currentTime=.1;
 assert.equal(mixer.sound('signature-launch',.6),false);
 pass(g,8);ctx.currentTime=.51;
 assert.equal(mixer.sound('tactic-anchor',.5),true);
});
test('collision chain, charge milestone, cast and three tactical orders request distinct soft cues',()=>{
 const calls=[];
 const g={window:null,globalThis:null,Math,Date,Map,Set,WeakMap,console,
  players:[],BattleFX:{sound(...args){calls.push(args);}},
  ArenaScreenRouter:{active:'tower'},
  ArenaTower:{active:true,stage:'fighting',state:{realm:'fire'}}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const path of ['js/features/bounce-momentum.js','js/features/arena-combat-v2.js',
  'js/features/tower-tactics.js','js/features/arena-body-physics.js']){
  vm.runInContext(read(path),g,{filename:path});
 }
 const p={playerNum:1,hp:200,maxHp:200,forge:{signatureVersion:1,
   signatureTiming:'contact',effectColor:'#fed'},x:120,y:200,vx:2,vy:2,
  radius:28,towerHero:true,_forgeActionClock:1,_scratchEvents:{}};
 const q={playerNum:2,hp:200,maxHp:200,forge:{signatureVersion:0},
  x:250,y:200,vx:-2,vy:0,_forgeActionClock:1};
 g.players.push(p,q);
 const M=g.BounceMomentum,C=g.ArenaCombatV2,T=g.ArenaTowerTactics;
 M.wall(p,7,'wall');
 p._forgeActionClock=39;q._forgeActionClock=39;M.contact(p,q,-6);
 p._forgeActionClock=77;M.wall(p,8,'bumper');
 assert.ok(calls.some(x=>x[0]==='bounce-perfect'));
 assert.ok(calls.some(x=>x[0]==='bounce-combo'));
 M.add(p,100,'tactic');
 assert.ok(calls.some(x=>x[0]==='signature-ready'));
 C.onCast(p);assert.ok(calls.some(x=>x[0]==='signature-launch'));
 assert.equal(T.choose('attack'),true);
 assert.equal(T.choose('evade'),true);
 assert.ok(calls.some(x=>x[0]==='tactic-sling'));
 assert.ok(calls.some(x=>x[0]==='tactic-evade'));
 T.reset();assert.equal(T.choose('hold'),true);
 assert.ok(calls.some(x=>x[0]==='tactic-anchor'));
 assert.equal(p.hp,200);assert.equal(q.hp,200,'cues never damage fighters');
});
test('SFX is accessible from lobby settings and cached script version is refreshed',()=>{
 const sound=read('js/features/vfx-audio.js'),router=read('js/features/screen-router.js'),
  html=read('index.html'),css=read('css/style.css');
 assert.match(sound,/bf-sfx-volume/);
 assert.match(sound,/EFFECTS_KEY='oibung-sfx-settings-v2'/);
 assert.match(sound,/recentVoices\.length>=4/);
 assert.match(sound,/multiplier>=10&&!tactic/);
 assert.match(router,/const sfx=doc\.querySelector\('\.bf-audio'\)/);
 assert.match(router,/if\(area&&sfx\)area\.append\(sfx\)/);
 assert.match(html,/vfx-audio\.js\?v=soft-combat2-sfx1/);
 assert.match(css,/#bf-sfx-volume/);
});

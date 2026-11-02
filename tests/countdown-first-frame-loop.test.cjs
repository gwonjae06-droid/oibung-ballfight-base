'use strict';
/* Behavioral smoke test for the REAL RAF countdown gate.
 * Unlike static source tests, it runs the scheduled frames and confirms
 * that combat actually advances immediately after the ready clock expires. */
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness(){
 let now=1000,updates=0,draws=0,once=false;
 const scheduled=[];
 const root={
  hidden:true,dataset:{},classList:{remove(){},add(){}},offsetWidth:40,
  remove(){},setAttribute(){},querySelector(){return {textContent:''};}
 };
 const wrapper={appendChild(){},querySelector(){return null;}};
 const speed={value:'1'};
 const document={
  hidden:false,
  getElementById(id){return id==='bf-speed'?speed:null;},
  querySelector(sel){return sel==='.bf-tools'?{appendChild(){}}:
    sel==='.canvas-wrapper'?wrapper:null;},
  createElement(){return {append(){},appendChild(){},setAttribute(){},style:{},hidden:false,
    classList:{remove(){},add(){}},querySelector(){return {textContent:''};},
    innerHTML:'',dataset:{}};},
  createTextNode(){return {};},addEventListener(){}
 };
 const g={Math,Date,Number,console,document,ctx:{},players:[],
  canvas:{width:500,height:500},isPlaying:true,isGameOver:false,
  screenShake:0,update(){updates++;if(once){once=false;throw Error('synthetic one-off tick error');}},
  draw(){draws++;},drawCharacter(){},arenaEffectColor:c=>c,
  requestAnimationFrame(fn){scheduled.push(fn);},
  performance:{now:()=>now},matchMedia:()=>({matches:false})};
 g.window=g;g.globalThis=g;
 vm.createContext(g);
 for(const f of ['js/features/arena-countdown.js','js/features/battle-effects.js'])
  vm.runInContext(read(f),g,{filename:f});
 function frame(time){
  now=time;const task=scheduled.shift();
  assert.equal(typeof task,'function','game loop must schedule the next frame');
  task(time);
 }
 return {g,frame,start:time=>g.ArenaCountdown.start(null,time),
  failingOnce:()=>{once=true;},
  get updates(){return updates;},get draws(){return draws;},
  get scheduled(){return scheduled.length;}};
}
test('3,2,1 countdown yields to actual 60Hz combat physics without another Start click',()=>{
 const h=harness();h.start(1000);
 for(const ms of [1000,1300,1700,2100,2500,2900,3300])h.frame(ms);
 assert.equal(h.updates,0,'countdown must not perform attacks or move actors');
 h.frame(3850);
 assert.equal(h.g.ArenaCountdown.state.phase,'idle','countdown must release its gate');
 assert.ok(h.updates>=1,'first post-ready browser frame must advance physics');
 h.frame(3890);
 assert.ok(h.updates>=2);
 assert.equal(h.scheduled,1,'requestAnimationFrame must remain alive');
});
test('a single intermittent update exception cannot freeze future frames or countdown',()=>{
 const h=harness();h.start(1000);
 h.frame(1000);h.frame(3950);
 assert.ok(h.updates>=1);
 const before=h.updates;h.failingOnce();h.frame(3980);
 assert.equal(h.g.ArenaCountdown.state.phase,'idle');
 h.frame(4010);h.frame(4050);
 assert.ok(h.updates>before+1,'RAF and normal updates resume after a one-off error');
 assert.equal(h.scheduled,1);
});

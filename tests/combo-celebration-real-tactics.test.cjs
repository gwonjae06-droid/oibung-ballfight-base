'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const create=(props={})=>({hp:300,maxHp:300,x:160,y:225,vx:3,vy:1,
 radius:28,playerNum:1,towerHero:true,forge:{signatureVersion:1,
 signatureTiming:'instant'},_forgeActionClock:1,_scratchEvents:{},...props});
function boot(){
 const sound=[],nodes={},top={append(el){nodes[el.id]=el;}};
 const el=()=>({style:{},dataset:{},hidden:false,offsetWidth:42,
  classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v;},
  querySelector(q){return this[q]||=( {style:{},textContent:''} );}});
 const g={Math,console,Set,Map,WeakMap,Date,players:[],
  ArenaScreenRouter:{active:'tower'},
  BattleFX:{sound(...a){sound.push(a);}},
  addFloatingText(){},document:{createElement(){return el();},
   getElementById(id){return nodes[id]||null;},
   querySelector(q){return q==='.battle-screen .arena-heading'?top:null;}}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/bounce-momentum.js','js/features/arena-combat-v2.js',
  'js/features/tower-tactics.js','js/features/arena-body-physics.js'])
  vm.runInContext(read(file),g,{filename:file});
 return {g,sound,nodes};
}
test('increasing combo counts 1-12 animate immediately and become energetic in the heading, not over the arena',()=>{
 const {g,sound,nodes}=boot(),p=create(),q=create({playerNum:2,towerHero:false});
 const M=g.BounceMomentum,C=g.ArenaCombatV2;
 for(let n=1;n<=12;n++){
  p._forgeActionClock=n*40;q._forgeActionClock=n*40;
  const result=n%3===1?M.wall(p,7,'wall'):n%3===2?
    M.wall(p,7,'bumper'):M.contact(p,q,-7);
  assert.equal(result,true);
  assert.equal(p._combat2Combo.chain,n);
  const widget=nodes['arena-combo-status'];
  assert.equal(widget.dataset.combo,String(n));
  assert.equal(widget.hidden,false);
  assert.ok(widget.classList);
 }
 assert.equal(nodes['arena-combo-status'].dataset.tier,'legend');
 assert.equal(p._combat2NextBoost,1.10);
 assert.ok(M.meter(p)<=100);
 assert.ok(sound.some(c=>c[0]==='combo-step'));
 assert.ok(sound.some(c=>c[0]==='combo-streak'));
 assert.ok(sound.some(c=>c[0]==='bounce-combo'));
 const before=p._combat2Combo.chain;
 p._forgeActionClock+=1;
 assert.equal(M.wall(p,8,'bumper'),false);
 assert.equal(p._combat2Combo.chain,before);
 p._forgeActionClock+=200;M.wall(p,4,'wall');
 assert.equal(p._combat2Combo.chain,1);
 assert.equal(p.hp,300);assert.equal(q.hp,300);
});
test('real tower character is exposed from arena controller; commands fail safely when absent',()=>{
 const {g}=boot(),p=create(),enemy=create({playerNum:2,towerHero:false});
 g.ArenaTower={active:true,stage:'fighting',hero:p};
 const T=g.ArenaTowerTactics;
 const old=Math.hypot(p.vx,p.vy);
 assert.equal(T.choose('attack'),true);assert.ok(Math.hypot(p.vx,p.vy)>old);
 const velocity=[p.vx,p.vy];
 assert.equal(T.choose('hold'),true);assert.ok(p._tacticalAnchorUntil>p._forgeActionClock);
 assert.equal(T.state.remaining,0);
 T.reset();p.hp=0;assert.equal(T.choose('evade'),false);
 assert.equal(T.state.remaining,2,'invalid hero never wastes a command');
 p.hp=300;assert.equal(T.choose('evade'),true);
 assert.ok(p.invincible>=21);
 assert.ok(Math.abs(p.vx-velocity[0])+Math.abs(p.vy-velocity[1])>1);
 assert.equal(T.OPTIONS.attack.name,'강하게 튕기기');
 assert.equal(T.OPTIONS.hold.name,'단단하게 버티기');
 assert.equal(T.OPTIONS.evade.name,'옆으로 피하기');
 assert.match(read('js/features/tower-challenge.js'),/get hero\(\)\{return typeof players/);
});
test('reduced motion and small devices still show combo number without the animation',()=>{
 const css=read('css/combo-celebration.css'),html=read('index.html');
 for(const s of ['comboNumberWild','comboStageBounce','comboSparkPop','comboLetterKick'])assert.ok(css.includes(s),s);
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 assert.ok(css.includes('max-width:600px'));
 assert.ok(html.includes('css/combo-celebration.css'));
 assert.ok(html.indexOf('css/combo-celebration.css')>html.indexOf('css/bounce-momentum.css'));
 assert.ok(read('js/features/vfx-audio.js').includes("kind==='combo-streak'"));
 const src=read('js/features/arena-combat-v2.js');
 assert.match(src,/Math\.min\(99,prior\.chain\+1\)/);
 assert.match(src,/Math\.min\(4,prior\.chain\+1\)|chain%3===0/);
});

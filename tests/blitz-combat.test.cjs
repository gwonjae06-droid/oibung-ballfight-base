'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function runtime(){
 const ctx=new Proxy({},{get:(t,k)=>t[k]||(()=>({addColorStop(){}})),set:(t,k,v)=>(t[k]=v,true)});
 const canvas={width:500,height:500,getContext:()=>ctx};
 const w={console,Math,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null},
  document:{createElement:()=>({width:500,height:500,getContext:()=>ctx}),
  getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},querySelector:()=>null},requestAnimationFrame(){}};
 w.window=w;vm.createContext(w);
 for(const m of fs.readFileSync('pvp-runtime.html','utf8').matchAll(/src="([^"]+)"/g)){
  const path=m[1].split('?')[0];vm.runInContext(fs.readFileSync(path,'utf8'),w,{filename:path});
 }
 return w.PvpRuntime;
}
const fighter={name:'턴제 테스트',hp:300,speed:2.4,color:'#58aaff',skills:[
 {name:'순간탄',trigger:'auto',cooldown:1,actions:[{type:'shot',damage:12}]},
 {name:'방어',trigger:'auto',cooldown:1,actions:[{type:'shield',duration:1}]}
]};
test('Blitz accepts only the current side, then alternates and pauses simulation during planning',()=>{
 const r=runtime(),t=Date.now(),room=r.createRoom(fighter,fighter,'manual',t,['blitz','blitz']);
 assert.equal(room.blitz.turn,0);assert.equal(room.blitz.phase,'plan');
 const x=room.players[0].x,y=room.players[0].y;
 r.step(room,1/60,t+100);assert.equal(room.players[0].x,x);assert.equal(room.players[0].y,y);
 assert.equal(r.submitPlan(room,1,{round:1,move:'approach',slots:[0]},t+100),false,'out-of-turn plan rejected');
 assert.equal(r.submitPlan(room,0,{round:1,move:'approach',slots:[0,1]},t+100),true);
 assert.equal(r.submitPlan(room,0,{round:1,move:'retreat',slots:[]},t+101),false,'no double commands');
 r.step(room,1/60,t+120);
 assert.equal(room.blitz.phase,'execute');
 assert.equal(room.blitz.turn,0);
 assert.equal(room.players[0].forgeTicks[0],0,'first authored skill used');
 assert.ok(room.players[1].forgeTicks[0]>0,'opponent did not cast');
 for(let j=0;j<20;j++)r.step(room,1/60,t+140+j*17);
 assert.ok(Math.hypot(room.players[0].x-x,room.players[0].y-y)>1,'active character moves');
 r.step(room,1/60,t+1600);
 assert.equal(room.blitz.phase,'plan');assert.equal(room.blitz.turn,1);assert.equal(room.blitz.round,2);
 assert.equal(r.submitPlan(room,0,{round:2,move:'hold',slots:[]},t+1650),false);
 assert.equal(r.submitPlan(room,1,{round:1,move:'hold',slots:[]},t+1650),false,'stale round rejected');
 assert.equal(r.submitPlan(room,1,{round:2,move:'retreat',slots:[0]},t+1650),true);
 r.step(room,1/60,t+1680);assert.equal(room.blitz.turn,1);
 assert.equal(room.blitz.phase,'execute');
});
test('unsubmitted PvP turn ends in a safe defensive action after 10 seconds',()=>{
 const r=runtime(),t=Date.now(),room=r.createRoom(fighter,fighter,'manual',t,['blitz','blitz']);
 r.step(room,1/60,t+9999);assert.equal(room.blitz.phase,'plan');
 r.step(room,1/60,t+10001);assert.equal(room.blitz.phase,'execute');
 assert.equal(room.blitz.resolved.move,'hold');assert.equal(room.blitz.resolved.slots.length,0);
 assert.equal(r.submitPlan(room,0,{round:1,move:'approach',slots:[0]},t+10002),false);
});
test('automated fighter plays only on its own turn and respects same skill cooldowns',()=>{
 const r=runtime(),t=Date.now(),room=r.createRoom(fighter,fighter,'manual',t,['blitz','auto']);
 assert.equal(room.players[1].onlineManual,true);
 assert.equal(r.setInput(room,0,{x:1,y:0}),false,'WASD blocked in turn-based mode');
 assert.equal(r.cast(room,0,0),false,'direct skill casts blocked');
 assert.equal(r.submitPlan(room,0,{round:1,move:'hold',slots:[]},t+100),true);
 r.step(room,1/60,t+120);assert.equal(room.blitz.turn,0);
 r.step(room,1/60,t+1520);assert.equal(room.blitz.turn,1);
 r.step(room,1/60,t+1560);
 assert.equal(room.blitz.phase,'execute','automatic turn begins without network wait');
 assert.ok(room.blitz.resolved.slots.length>0);
 assert.equal(room.players[1].forgeTicks[0],0,'AI cast its authored skill');
});
test('planning validations sanitize unsafe inputs and respect turn/sequence',()=>{
 const r=runtime(),room=r.createRoom(fighter,fighter,'manual',Date.now(),['blitz','blitz']);
 assert.equal(r.submitPlan(room,0,{round:1,move:'teleportCheat',slots:[99,0,0]}),true);
 assert.equal(room.blitz.plans[0].move,'hold');
 assert.deepEqual(Array.from(room.blitz.plans[0].slots),[0]);
});
test('legacy modes stay untouched; Blitz snapshot publishes turn without private actions',()=>{
 const r=runtime(),t=Date.now();
 const legacy=r.createRoom(fighter,fighter,'manual',t,['manual','auto']);
 assert.equal(legacy.blitz,undefined);
 assert.equal(r.submitPlan(legacy,0,{round:1,move:'hold',slots:[]}),false);
 const auto=r.createRoom(fighter,fighter,'auto',t,['auto','auto']);
 assert.equal(auto.blitz,undefined);
 const room=r.createRoom(fighter,fighter,'manual',t,['blitz','blitz']);
 const state=r.snapshot(room,false);
 assert.equal(state.blitz.turn,0);assert.equal(state.blitz.maxTurns,24);
 assert.equal(state.blitz.round,1);
 assert.equal('resolved' in state.blitz,false,'opponent planned skills are not revealed');
});
test('network, lobby and tower expose alternating turns',()=>{
 const read=p=>fs.readFileSync(p,'utf8');
 assert.match(read('js/features/pvp-online.js'),/latest\.blitz\.turn!==side/);
 assert.match(read('js/features/pvp-online.js'),/내 턴/);
 assert.match(read('js/features/pvp-supabase.js'),/blitz\.deadline=this\.lastStep\+10000/);
 assert.match(read('js/features/tower-challenge.js'),/tower-play-mode" value="blitz"/);
 assert.match(read('pvp-runtime.html'),/pvp-runtime\.js\?v=pvp-turn1/);
});
function towerWorld(){
 const elements=new Map(),slot={append(){}},ui={hidden:false,setAttribute(){},innerHTML:''};
 const select=value=>({value,options:[],disabled:false,selectedIndex:0,
  replaceChildren(){this.options=[];},append(option){this.options.push(option);}});
 for(const id of ['tower-blitz-first','tower-blitz-second'])elements.set(id,select('-1'));
 elements.set('tower-blitz-move',select('approach'));
 for(const id of ['tower-blitz-lock','tower-blitz-clock','tower-blitz-message','tower-blitz-vitals'])
  elements.set(id,{textContent:'',disabled:false,addEventListener(){}});
 const doc={getElementById:id=>id==='tower-arena-slot'?slot:elements.get(id),
  createElement:tag=>tag==='section'?ui:{value:'',textContent:'',disabled:false}};
 const casts=[],w={window:null,document:doc,Date,Math,Number,console,
  SkillForge:{enableManual:p=>{p.manualTower=true;return true;},cooldownFrames:()=>30,
   manualCast:(p,index)=>{casts.push([p.name,index]);return true;},manualUpdate:()=>true},
  ArenaTower:{active:true,mode:'blitz',stage:'fighting'},
  ArenaScreenRouter:{active:'tower',activeTowerTab:'tower'},
  isPlaying:true,isGameOver:false};
 w.window=w;vm.createContext(w);vm.runInContext(fs.readFileSync('js/features/tower-blitz.js','utf8'),w);
 const make=name=>({name,hp:200,maxHp:200,x:name==='hero'?100:400,y:200,vx:0,vy:0,
  forge:{speed:2.4,skills:[{name:'A'},{name:'B'}]},forgeTicks:[30,30]});
 const hero=make('hero'),foe=make('foe');const api=w.ArenaBlitzTower;
 assert.equal(api.prepare(hero,foe),true);assert.equal(api.start(),true);
 return {api,casts,hero,foe,elements};
}
test('tower waits indefinitely for the player, then runs only player skills before enemy turn',()=>{
 const x=towerWorld(),a=x.api;
 assert.equal(a.activeSide,0);assert.equal(a.beforeStep(),false);
 const first=x.elements.get('tower-blitz-first'),second=x.elements.get('tower-blitz-second');
 first.value='0';second.value='1';
 assert.equal(a.choose(),true);assert.equal(a.beforeStep(),true);assert.equal(a.phase,'execute');
 a.update(x.hero,x.foe);a.update(x.foe,x.hero);
 assert.ok(x.hero.vx>0);assert.equal(x.foe.vx,0);
 assert.deepEqual(x.casts.map(v=>v[0]),['hero']);
 for(let i=0;i<83;i++)a.beforeStep();
 assert.equal(a.phase,'plan');assert.equal(a.activeSide,1);
 assert.ok(x.casts.some(c=>c[0]==='hero'&&c[1]===1),'chained skill fired');
 assert.equal(a.choose(),false,'cannot control the opponent');
 assert.equal(a.beforeStep(),true,'enemy turn begins automatically');
 assert.ok(x.casts.some(c=>c[0]==='foe'),'enemy uses its own authored skills');
 for(let i=0;i<83;i++)a.beforeStep();
 assert.equal(a.phase,'plan');assert.equal(a.activeSide,0);
 a.stop();assert.equal(a.phase,'idle');
});

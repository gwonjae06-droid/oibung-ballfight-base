'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function world(){
 const ctx=new Proxy({},{get:(t,k)=>t[k]||(()=>({addColorStop(){}})),set:(t,k,v)=>(t[k]=v,true)});
 const canvas={width:500,height:500,getContext:()=>ctx};
 const w={console,Math,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null},
  document:{createElement:()=>({width:500,height:500,getContext:()=>ctx}),getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},querySelector:()=>null},requestAnimationFrame(){}};
 w.window=w;vm.createContext(w);
 for(const m of fs.readFileSync('pvp-runtime.html','utf8').matchAll(/src="([^"]+)"/g)){
  const p=m[1].split('?')[0];vm.runInContext(fs.readFileSync(p,'utf8'),w,{filename:p});
 }
 return w.PvpRuntime;
}
const fighter={name:'Blitz Test',hp:300,speed:2.4,color:'#58aaff',skills:[
 {name:'순간탄',trigger:'auto',cooldown:1,actions:[{type:'shot',damage:12}]},
 {name:'방어',trigger:'auto',cooldown:1,actions:[{type:'shield',duration:1}]}
]};
test('both participants lock choices then execute simultaneously with authored skills',()=>{
 const r=world(),start=Date.now(),room=r.createRoom(fighter,fighter,'manual',start,['blitz','blitz']);
 assert.equal(room.blitz.phase,'plan');assert.equal(room.players[0].onlineManual,true);
 const x=room.players[0].x,y=room.players[0].y;r.step(room,1/60,start+1000);
 assert.equal(room.players[0].x,x,'planning freezes physics and cooldown clocks');
 assert.equal(room.players[0].y,y,'planning freezes vertical movement too');
 assert.equal(r.submitPlan(room,0,{round:1,move:'approach',slots:[0,1]},start+1100),true);
 assert.equal(r.submitPlan(room,0,{round:1,move:'retreat',slots:[1]},start+1100),false,'one decision per round');
 assert.equal(r.submitPlan(room,1,{round:1,move:'approach',slots:[0]},start+1200),true);
 r.step(room,1/60,start+1250);
 assert.equal(room.blitz.phase,'execute');
 assert.equal(room.blitz.resolved[0].slots.length,2);
 assert.ok(room.players[0].forgeTicks[0]<60,'first skill actually cast through Forge');
 for(let i=0;i<70;i++)r.step(room,1/60,start+1250+i*17);
 assert.ok(Math.hypot(room.players[0].x-x,room.players[0].y-y)>1,'character moves during execution');
 r.step(room,1/60,start+3000);
 assert.equal(room.blitz.phase,'plan');
 assert.equal(room.blitz.round,2);
 assert.equal(r.submitPlan(room,1,{round:1,move:'hold',slots:[]}),false,'old round replay rejected');
});
test('blitz auto opponent chooses and fires actual skills without continuous input',()=>{
 const r=world(),start=Date.now(),room=r.createRoom(fighter,fighter,'manual',start,['blitz','auto']);
 assert.equal(room.players[1].onlineManual,true,'auto is adapted to the same planned rules');
 assert.equal(r.submitPlan(room,0,{round:1,move:'hold',slots:[]}),true);
 r.step(room,1/60,start+100);
 assert.equal(room.blitz.phase,'execute');
 assert.equal(room.blitz.resolved[1].slots.length>0,true);
 assert.equal(room.blitz.resolved[0].move,'hold');
});
test('invalid skills and movement are sanitized and duplicate skills are deduplicated',()=>{
 const r=world(),room=r.createRoom(fighter,fighter,'manual',Date.now(),['blitz','blitz']);
 assert.equal(r.submitPlan(room,0,{round:1,move:'teleportCheat',slots:[99,0,0]}),true);
 assert.equal(room.blitz.plans[0].move,'hold');
 assert.deepEqual(Array.from(room.blitz.plans[0].slots),[0]);
});
test('blitz mode is isolated from legacy manual and automatic modes',()=>{
 const r=world(),start=Date.now();
 const legacy=r.createRoom(fighter,fighter,'manual',start,['manual','auto']);
 assert.equal(legacy.blitz,undefined);
 assert.equal(r.submitPlan(legacy,0,{round:1,move:'hold',slots:[]}),false);
 const auto=r.createRoom(fighter,fighter,'auto',start,['auto','auto']);
 assert.equal(auto.blitz,undefined);
});
test('frontend and SQL opt into the mode while legacy clients remain compatible',()=>{
 const ui=fs.readFileSync('js/features/pvp-online.js','utf8');
 const sql=fs.readFileSync('supabase/pvp_blitz_v1.sql','utf8');
 const tower=fs.readFileSync('js/features/tower-challenge.js','utf8');
 const network=fs.readFileSync('js/features/pvp-supabase.js','utf8');
 const iframe=fs.readFileSync('pvp-runtime.html','utf8');
 assert.match(ui,/value="blitz"/);
 assert.match(ui,/type:'plan'/);
 assert.match(network,/rule\.submitPlan\?\./);
 assert.match(sql,/mode in \('auto','manual','blitz'\)/);
 assert.match(sql,/p_fighter->>'bp'='1'/);
 assert.match(tower,/tower-play-mode" value="blitz"/);
 assert.match(iframe,/pvp-runtime\.js\?v=pvp-blitz2/);
});

test('tower blitz execution uses the Forge API, waits during planning, and keeps two-skill chain',()=>{
 const els=new Map(),slot={append(){}};
 const ui={hidden:false,setAttribute(){},className:'',innerHTML:''};
 const select=(value)=>({value,options:[],disabled:false,replaceChildren(){this.options=[];},
   append(option){this.options.push(option);}});
 for(const id of ['tower-blitz-first','tower-blitz-second'])els.set(id,select('-1'));
 els.set('tower-blitz-move',select('approach'));
 for(const id of ['tower-blitz-lock','tower-blitz-clock','tower-blitz-message','tower-blitz-vitals'])
  els.set(id,{textContent:'',disabled:false,addEventListener(){}});
 const doc={getElementById:id=>id==='tower-arena-slot'?slot:els.get(id),
  createElement:tag=>tag==='section'?ui:{value:'',textContent:'',disabled:false}};
 const casts=[];
 const world={window:null,document:doc,Date,Math,Number,console,
  SkillForge:{enableManual:p=>{p.manualTower=true;return true;},cooldownFrames:()=>30,
   manualCast:(p,index)=>{casts.push([p.name,index]);return true;},manualUpdate:()=>true},
  ArenaTower:{active:true,mode:'blitz',stage:'fighting'},
  ArenaScreenRouter:{active:'tower',activeTowerTab:'tower'},
  isPlaying:true,isGameOver:false};
 world.window=world;vm.createContext(world);
 vm.runInContext(fs.readFileSync('js/features/tower-blitz.js','utf8'),world);
 const api=world.ArenaBlitzTower;
 const make=name=>({name,hp:200,maxHp:200,x:name==='hero'?100:400,y:200,
   vx:0,vy:0,forge:{speed:2.4,skills:[{name:'A'},{name:'B'}]},forgeTicks:[30,30]});
 const hero=make('hero'),foe=make('foe');
 assert.equal(api.prepare(hero,foe),true);
 assert.equal(api.start(),true);
 assert.equal(api.beforeStep(),false,'planning does not advance gameplay');
 const first=els.get('tower-blitz-first'),second=els.get('tower-blitz-second');
 first.value='0';second.value='1';
 assert.equal(api.choose(),true);
 assert.equal(api.beforeStep(),true);
 assert.equal(api.phase,'execute');
 api.update(hero,foe);assert.ok(hero.vx>0);
 for(let i=0;i<95;i++)api.beforeStep();
 assert.equal(api.phase,'plan');
 assert.ok(casts.some(c=>c[0]==='hero'&&c[1]===0));
 assert.ok(casts.some(c=>c[0]==='hero'&&c[1]===1));
 api.stop();assert.equal(api.phase,'idle');
});

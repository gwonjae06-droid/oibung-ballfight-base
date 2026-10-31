'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
function world(){
 const ctx=new Proxy({},{get:(t,k)=>t[k]||(()=>({addColorStop(){}})),set:(t,k,v)=>(t[k]=v,true)});
 const canvas={width:500,height:500,getContext:()=>ctx};
 const w={console,Math,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null},document:{getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},querySelector:()=>null},requestAnimationFrame(){}};w.window=w;vm.createContext(w);
 const html=fs.readFileSync('pvp-runtime.html','utf8');
 for(const m of html.matchAll(/src="([^"]+)"/g)){
  const script=m[1].split('?')[0];
  vm.runInContext(fs.readFileSync(script,'utf8'),w,{filename:script});
 }return w;
}
const profile={name:'연계',hp:300,speed:2,color:'#4588aa',skills:[{name:'화염 연사',trigger:'auto',cooldown:.2,actions:[{type:'shot',damage:30,count:3,speed:10,radius:120,status:'fire',delay:0},{type:'bolt',damage:20,radius:300,delay:.1}]}]};
test('original online runtime runs authored combo damage and renders both peers',()=>{
 const a=world(),b=world(),ra=a.PvpRuntime,rb=b.PvpRuntime;
 const r=ra.createRoom(profile,profile,'auto',1000,['auto','auto']);rb.createRoom(profile,profile,'auto',1000,['auto','auto']);
 for(let i=0;i<600&&!r.ended;i++)ra.step(r,1/60,1000+i*1000/60);
 const s=JSON.parse(JSON.stringify(ra.snapshot(r)));assert.ok(s.players.some(p=>p.hp<300));
 rb.receive(s);assert.deepEqual(Array.from(rb.snapshot(r).players,p=>p.hp),s.players.map(p=>p.hp));
 ra.paint();rb.paint();
});
test('manual online fighter uses original cooldown and combo executor',()=>{
 const w=world(),r=w.PvpRuntime.createRoom(profile,profile,'manual',1000,['manual','auto']);
 assert.equal(w.PvpRuntime.cast(r,0,0),true);assert.equal(w.PvpRuntime.cast(r,0,0),false);
 for(let i=0;i<30;i++)w.PvpRuntime.step(r,1/60,1000+i*16.7);
 assert.equal(w.PvpRuntime.cast(r,0,0),true);
});

test('online PvP shares local overtime, has a longer match clock and resets each room',()=>{
 const w=world(),P=w.PvpRuntime,S=w.ArenaStalemate;
 assert.equal(P.MATCH_LIMIT_SECONDS,Math.ceil((S.LIMITS.regular+S.LIMITS.deadline)/60)+5);
 const room=P.createRoom(profile,profile,'auto',1000,['auto','auto']);
 for(let i=0;i<S.LIMITS.stagnant;i++)S.tick(room.players);
 assert.equal(S.state.active,true);
 const next=P.createRoom(profile,profile,'auto',2000,['auto','auto']);
 assert.equal(S.state.active,false,'stale overtime must not leak into another online match');
 assert.equal(P.snapshot(next).clock,P.MATCH_LIMIT_SECONDS);
});
test('online stalling after 120 seconds does not declare an HP-based winner',()=>{
 const w=world(),P=w.PvpRuntime,room=P.createRoom(profile,profile,'auto',1000,['auto','auto']);
 room.players[0].hp=100;room.players[1].hp=290;
 for(const p of room.players)p.invincible=99999;
 room.elapsed=120;
 P.step(room,1/60,121000);
 assert.equal(room.ended,false,'old 120-second cut-off must not remain');
 room.elapsed=P.MATCH_LIMIT_SECONDS-.05;
 P.step(room,.1,246000);
 assert.equal(room.ended,true);
 assert.equal(room.winner,-1,'unequal surviving HP is not an overtime tiebreaker');
});
test('online battle still awards a genuine last fighter standing',()=>{
 const w=world(),P=w.PvpRuntime,room=P.createRoom(profile,profile,'auto',1000,['auto','auto']);
 room.players[1].hp=0;
 P.step(room,1/60,1100);
 assert.equal(room.ended,true);
 assert.equal(room.winner,0);
});
test('Tower pattern boss stays stationary while its Forge defense can continue',()=>{
 const text=fs.readFileSync('js/core/engine.js','utf8');
 const a=text.indexOf('function updateCharacter(self)'),
       b=text.indexOf('function handleCombat(',a);
 assert.ok(a>=0&&b>a);
 const fighter={hp:300,forge:{skills:[]},towerPatternBoss:true,vx:4,vy:-6};
 let calls=0;
 const context={fighter,globalThis:{
   ArenaTower:{active:true},SkillForge:{autoUpdate(p){calls++;p.vx=9;p.vy=11;}}
 },getClosestAliveEnemy:()=>({hp:100})};
 vm.runInNewContext(text.slice(a,b)+';updateCharacter(fighter);',context);
 assert.equal(calls,1,'boss defensive ability clock must still update');
 assert.equal(fighter.vx,0);assert.equal(fighter.vy,0);
});

test('online host physically freezes both fighters before the shared FIGHT timestamp',()=>{
 const w=world(),P=w.PvpRuntime;
 const room=P.createRoom(profile,profile,'auto',Date.now(),['auto','auto']);
 const now=Date.now();room.startAt=now+3600;
 const before=room.players.map(p=>({hp:p.hp,x:p.x,y:p.y,forgeTicks:p.forgeTicks?.slice()}));
 P.step(room,4,now+3500);
 assert.equal(room.elapsed,0,'countdown must not consume game time');
 assert.equal(room.ended,false);
 assert.deepEqual(room.players.map(p=>({hp:p.hp,x:p.x,y:p.y,forgeTicks:p.forgeTicks?.slice()})),before);
 const snapshot=P.snapshot(room,false);
 assert.ok(snapshot.startInMs>0&&snapshot.startInMs<=3600,
  'guests receive the actual remaining ready time');
 room.startAt=now-100;
 P.step(room,.15,now+3600);
 assert.ok(room.elapsed>0,'physics begins only after FIGHT');
 assert.equal(P.snapshot(room,false).startInMs,undefined,
  'ready timer is omitted from normal low-bandwidth packets');
});

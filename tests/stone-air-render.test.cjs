'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const calls=[],stack=[];let m=[1,1,0,0];
 const ctx=new Proxy({save(){stack.push([...m]);},restore(){m=stack.pop();},
 translate(x,y){m[2]+=x*m[0];m[3]+=y*m[1];},scale(x,y){m[0]*=x;m[1]*=y;},
 arc(x,y,r){calls.push({kind:'arc',x:x*m[0]+m[2],y:y*m[1]+m[3],rx:r*m[0],ry:r*m[1]});},
 ellipse(x,y,rx,ry){calls.push({kind:'ellipse',x:x*m[0]+m[2],y:y*m[1]+m[3],rx,ry});},
 createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};},
 measureText(){return {width:40};}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const canvas={width:500,height:500,getContext:()=>ctx};
 const w={Math,console,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null},
 document:{getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},querySelector:()=>null,
 createElement:()=>({width:500,height:500,getContext:()=>ctx})},requestAnimationFrame(){}};
 w.window=w;vm.createContext(w);
 for(const match of fs.readFileSync('pvp-runtime.html','utf8').matchAll(/src="([^"]+)"/g)){
 const f=match[1].split('?')[0];vm.runInContext(fs.readFileSync(f,'utf8'),w,{filename:f});}
 return {w,ctx,calls,canvas,stack};
}
const profile={name:'Stone',hp:500,speed:2,color:'#5599bb',skills:[{name:'Shot',trigger:'auto',cooldown:1,actions:[{type:'shot',damage:15,radius:120,speed:7,count:1}]}]};
test('air painters project height vertically with uniform scale and a separate ground footprint',()=>{
 const {w,ctx,calls,canvas,stack}=setup(),d=w.ArenaDepth;
 const p=Object.freeze({x:130,y:320,z:90});
 d.beginAir(canvas);d.air(ctx,p,p.z,c=>c.arc(p.x,p.y-p.z,10),10);
 assert.equal(calls.length,1);assert.equal(calls[0].y,p.y,'shadow stays on logical floor');
 const items=d.finishAir();assert.equal(items.length,1);items[0].paint(ctx);
 const at=d.elevatedPoint(p,p.z,canvas),body=calls.at(-1);
 assert.ok(Math.abs(body.x-at.x)<1e-8);assert.ok(Math.abs(body.y-at.y)<1e-8);
 assert.equal(body.rx,body.ry);assert.equal(stack.length,0);
 assert.equal(d.finishAir().length,0,'frame queue is consumed');
});
test('all authored effects paint through ground/air passes without changing battle state',()=>{
 const {w,ctx,canvas,stack}=setup(),room=w.PvpRuntime.createRoom(profile,profile,'auto',1000,['auto','auto']);
 const p=room.players[0],e=room.players[1];p.z=75;e.z=90;
 const before=JSON.stringify(room.players.map(v=>({x:v.x,y:v.y,hp:v.hp,z:v.z,radius:v.radius})));
 for(const type of w.SkillVisuals.TYPES){
  w.SkillVisuals.clear();w.SkillVisuals.cast(p,{type,radius:90},e);
  w.SkillVisuals.impact(p,e,{type,radius:90});
  w.ArenaDepth.beginAir(canvas);w.SkillVisuals.draw(ctx);
  w.ArenaDepth.finishAir().forEach(v=>v.paint(ctx));
 }
 assert.ok(w.SkillVisuals.TYPES.length>=55);
 assert.equal(JSON.stringify(room.players.map(v=>({x:v.x,y:v.y,hp:v.hp,z:v.z,radius:v.radius}))),before);
 assert.equal(stack.length,0);
});
test('impact altitude survives immediate PvP replay and painted frame leaves snapshots unchanged',()=>{
 const {w,ctx,canvas}=setup(),room=w.PvpRuntime.createRoom(profile,profile,'auto',1000,['auto','auto']);
 const p=room.players[0],e=room.players[1];e.z=85;
 w.SkillVisuals.impact(p,e,{type:'shot',radius:80});
 const event=w.SkillVisuals.exportEffects().at(-1);
 assert.equal(event.y,e.y);assert.equal(event.z,85);
 w.SkillVisuals.clear();assert.ok(w.SkillVisuals.replay({...event,source:null},room.players));
 assert.equal(w.SkillVisuals.exportEffects()[0].z,85);
 const before=JSON.stringify(w.PvpRuntime.snapshot(room));
 w.PvpRuntime.paint();assert.equal(JSON.stringify(w.PvpRuntime.snapshot(room)),before);
});
test('photo and custom color stones preserve radius, charge, jump and HP through render',()=>{
 const {w}=setup(),room=w.PvpRuntime.createRoom(profile,profile,'auto',1000,['auto','auto']);
 const p=room.players[0];p.z=45;p.getImage=()=>({complete:true,naturalWidth:100});
 w.ArenaCharge.start(p,{duration:1});
 const before=JSON.stringify({radius:p.radius,hp:p.hp,z:p.z,charge:p.forgeCharge});
 assert.doesNotThrow(()=>w.PvpRuntime.paint());
 assert.equal(JSON.stringify({radius:p.radius,hp:p.hp,z:p.z,charge:p.forgeCharge}),before);
});

test('projectile bodies are deferred while zones stay on the floor, meteor detonation stays grounded',()=>{
 const {w,ctx,calls,canvas}=setup(),room=w.PvpRuntime.createRoom(profile,profile,'auto',1000,['auto','auto']);
 const p=room.players[0];p.z=80;
 p.forgeShots=[{x:200,y:300,z:60,prevX:200,prevY:300,vx:5,vy:0,a:{}}];
 p.forgeZones=[{type:'zone',x:230,y:320,r:45,a:{radius:45}}];
 w.ArenaDepth.beginAir(canvas);w.SkillForge.drawFighter(p,ctx);
 assert.ok(calls.some(v=>v.kind==='arc'&&v.x===230&&v.y===320&&v.rx===45));
 const queued=w.ArenaDepth.finishAir();assert.equal(queued.length,1);
 assert.equal(queued[0].depth,300-72*.28);
 w.SkillVisuals.detonate(p,'meteor',300,350,60);
 assert.equal(w.SkillVisuals.exportEffects().at(-1).z,0,'ground explosion does not inherit airborne caster height');
});

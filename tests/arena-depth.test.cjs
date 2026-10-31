'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
function depthWorld(override={}){
 const calls={saves:0,restores:0,shadows:[],fills:0,draws:0,gradient:0};
 const ctx=new Proxy({},{
  get:(o,k)=>{
   if(k in o)return o[k];
   if(k==='save')return()=>calls.saves++;
   if(k==='restore')return()=>calls.restores++;
   if(k==='ellipse')return(...a)=>calls.shadows.push(a);
   if(k==='fillRect')return()=>calls.fills++;
   if(k==='drawImage')return()=>calls.draws++;
   if(k==='createLinearGradient'||k==='createRadialGradient')
    return()=>{calls.gradient++;return{addColorStop(){}};};
   return()=>{};
  },
  set:(o,k,v)=>(o[k]=v,true)
 });
 const w={Math,Number,Set,console,...override};w.window=w;
 vm.createContext(w);vm.runInContext(read('js/features/arena-depth.js'),w,{filename:'arena-depth.js'});
 return {w,ctx,calls};
}
test('free and Tower floor have 2.5D rim and preserve cached Tower painting',()=>{
 const {w,ctx,calls}=depthWorld();
 const game={width:500,height:500};
 w.ArenaDepth.paintFloor(ctx,game,false);
 assert.ok(calls.fills>10,'tile shading is painted for white arena');
 const before=calls.fills;
 w.ArenaDepth.paintFloor(ctx,game,true);
 assert.ok(calls.fills>before,'Tower obtains a subtle plinth overlay');
 assert.equal(calls.saves,calls.restores,'graphics state restored');
});
test('offscreen floor cache is reused rather than repainted every frame',()=>{
 const {w,ctx,calls}=depthWorld();
 let created=0;
 const doc={createElement(){
   created++;
   return {width:0,height:0,getContext:()=>ctx};
 }};
 w.document=doc;
 w.ArenaDepth.paintFloor(ctx,{width:500,height:500},false);
 const once=created;
 w.ArenaDepth.paintFloor(ctx,{width:500,height:500},false);
 assert.equal(created,once);
 assert.ok(calls.draws>=2,'blit cached floor');
 w.ArenaDepth.paintFloor(ctx,{width:500,height:500},true);
 assert.ok(created>once,'Tower separate cached overlay');
});
test('fighter ground footprint stays fixed while drawn height alters shadow shape',()=>{
 const {w,ctx,calls}=depthWorld(),p={x:200,y:210,radius:26,hp:100,z:0};
 const original={x:p.x,y:p.y,z:p.z};
 w.ArenaDepth.shadow(ctx,p,0);
 const ground=calls.shadows.slice(-2);
 w.ArenaDepth.shadow(ctx,p,90);
 const airborne=calls.shadows.slice(-2);
 assert.ok(airborne[0][2]>ground[0][2],'high shadow spreads');
 assert.ok(airborne[1][2]>ground[1][2]);
 assert.deepEqual({x:p.x,y:p.y,z:p.z},original,'visual layer does not change physics');
 assert.equal(calls.saves,calls.restores);
});
test('photos and circles receive the same restrained 2.5D lighting',()=>{
 const {w,ctx,calls}=depthWorld(),p={hp:150,radius:24};
 w.ArenaDepth.underlay(ctx,p,24);
 w.ArenaDepth.lightSurface(ctx,24);
 assert.ok(calls.gradient>0);
 assert.equal(calls.saves,calls.restores);
});
test('shot spawned while airborne carries its height and hits only matching altitude',()=>{
 const w={console,Math,Number,Date,Map,Set,CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},
  BEHAVIORS:{},players:[],canvas:{width:500,height:500},
  createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){
    return w.players.find(e=>e!==p&&e.hp>0)||null;}};
 w.window=w;vm.createContext(w);
 vm.runInContext(read('js/features/advanced-combat.js'),w);
 vm.runInContext(read('js/features/skill-forge.js'),w);
 const profile={name:'공중 사격수',hp:240,speed:2,color:'#546677',
  skills:[{name:'높이별 총알',cooldown:3,trigger:'auto',
    actions:[{type:'shot',damage:30,radius:190,speed:8,count:1,delay:0}]}]};
 const id=w.SkillForge.register(profile),hero=w.CUSTOM_DEFS[0].createInstance(1);
 hero.x=100;hero.y=100;hero.z=74;hero.vz=0;hero.forgeTicks=[1000];
 const foe={playerNum:2,x:350,y:100,z:0,hp:240,maxHp:240,invincible:0,radius:24,vx:0,vy:0};
 w.players=[hero,foe];
 for(let i=0;i<16;i++)w.BEHAVIORS[id].update(hero,foe);
 assert.ok(hero.forgeShots.length>0);
 const bullet=hero.forgeShots[0];
 assert.ok(bullet.z>30&&bullet.z<74,'projectile gradually aims down toward the grounded foe');
 assert.equal(w.SkillForge.hit(hero,foe,bullet.a,1,bullet.z),false,
   'elevated shot cannot strike ground-level target');
 foe.z=bullet.z;
 assert.equal(w.SkillForge.hit(hero,foe,bullet.a,1,bullet.z),true,
   'same-height target is vulnerable');
 const oldHp=foe.hp;foe.z=0;foe.invincible=0;
 assert.equal(w.SkillForge.hit(hero,foe,bullet.a,1,0),true,'a ground shot can hit ground again');
 assert.ok(foe.hp<oldHp);
});
test('lightweight network snapshots only include height when airborne; remote uses it for render',()=>{
 const w={console,Math,Date,Set,Map,Image:class{},localStorage:{getItem:()=>null}};
 const ctx=new Proxy({}, {get:(o,k)=>o[k]||(()=>({addColorStop(){}})),set:(o,k,v)=>(o[k]=v,true)});
 const canvas={width:500,height:500,getContext:()=>ctx};
 w.document={getElementById:id=>id==='arena'?canvas:{style:{},dataset:{}},
  querySelector:()=>null};w.requestAnimationFrame=()=>{};w.window=w;
 vm.createContext(w);
 for(const m of read('pvp-runtime.html').matchAll(/src="([^"]+)"/g)){
  const file=m[1].split('?')[0];vm.runInContext(read(file),w,{filename:file});
 }
 const r=w.PvpRuntime,profile={name:'높이 전송',hp:240,speed:2,color:'#557799',
  skills:[{name:'파동',trigger:'auto',cooldown:2,actions:[{type:'wave',damage:11}]}]};
 const room=r.createRoom(profile,profile,'auto',Date.now(),['auto','auto']);
 assert.ok(!('h' in r.snapshot(room,false).players[0]));
 room.players[0].z=76;
 const state=r.snapshot(room,false);
 assert.equal(state.players[0].h,76);
 room.players[0].z=0;
 r.receive(JSON.parse(JSON.stringify(state)));
 // Guest height targets are included even when a full world snapshot is skipped.
 assert.equal(room.players[0].jumpState,'ground');
 assert.doesNotThrow(()=>r.paint());
 assert.ok(room.players[0].z>=0);
});
test('floor and VFX share projected ground coordinates before upright fighters',()=>{
 const render=read('js/core/render.js');
 const floor=render.indexOf('depth?.paintFloor?.(worldCtx,canvas,painted)'),objects=render.indexOf('AdvancedCombat?.draw(worldCtx)');
 const fx=render.indexOf('ArenaFXLayer?.draw?.(worldCtx)'),projection=render.indexOf('projectWorld?.(ctx,layer.canvas,canvas)');
 const actor=render.indexOf('ArenaMotion.drawFighter(ctx,p,drawCharacter)');
 assert.ok(floor>0&&floor<objects&&objects<fx&&fx<projection&&projection<actor);
 for(const html of [read('index.html'),read('pvp-runtime.html')])
  assert.ok(html.indexOf('arena-depth.js')<html.indexOf('core/render.js'));
});

test('shadow pass precedes height-aware stable painter sorting, without reordering player physics',()=>{
 const render=read('js/core/render.js');
 const shadow=render.indexOf('const paintShadow=');
 const sort=render.indexOf('const depthOrder=players.slice().sort(');
 const fighter=render.indexOf('depthOrder.forEach(p=>');
 assert.ok(shadow>0&&sort>shadow&&fighter>sort);
 assert.match(render,/const depthOrder=players\.slice\(\)\.sort/);
 assert.match(render,/visibleHeight\?\.\(a\)/);
});

test('perspective narrows far ground and widens near ground instead of squashing sprites',()=>{
 const {w}=depthWorld(),arena={width:600,height:600};
 const fl=w.ArenaDepth.screenPoint(0,0,arena),fr=w.ArenaDepth.screenPoint(600,0,arena);
 const nl=w.ArenaDepth.screenPoint(0,600,arena),nr=w.ArenaDepth.screenPoint(600,600,arena);
 assert.ok(fr.x-fl.x<470);
 assert.ok(nr.x-nl.x>=599,'foreground spans the whole playable width without clipping');
 assert.ok((nr.x-nl.x)/(fr.x-fl.x)>1.6);
 assert.ok(fl.y>60&&fl.y<95&&nl.y>480&&nl.y<535);
 assert.equal(w.ArenaDepth.VIEW_Y,1,'no global vertical canvas compression');
});

test('scanline projector maps the ground while maintaining upright billboard silhouettes',()=>{
 const {w}=depthWorld(),strips=[];
 const c=new Proxy({}, {get:(o,k)=>k==='drawImage'?((...args)=>strips.push(args)):
  k==='save'||k==='restore'?(()=>{}):k==='scale'?(()=>{throw Error('flat scale used');}):()=>{},
  set:(o,k,v)=>(o[k]=v,true)});
 const canvas={width:600,height:600};
 assert.equal(w.ArenaDepth.projectWorld(c,canvas,canvas),true);
 assert.ok(strips.length>45&&strips.length<110);
 assert.ok(strips[0][7]<strips.at(-1)[7],'near rows expand in x');
 const src=read('js/core/render.js');
 assert.match(src,/ctx\.translate\(projected\.x,projected\.y\)/);
 assert.match(src,/ctx\.scale\(size,size\)/);
 assert.match(src,/projectWorld\?\.\(ctx,layer\.canvas,canvas\)/);
});

test('nearer 2.5D sprites are a little larger, without altering collision size',()=>{
 const {w}=depthWorld();
 const a={x:120,y:55,radius:26},b={x:120,y:440,radius:26};
 const far=w.ArenaDepth.spriteScale(a,{height:500}),near=w.ArenaDepth.spriteScale(b,{height:500});
 assert.ok(far<.8&&near>.9&&near>far,'far fighters appear smaller without cropping near fighters');
 assert.ok(near-far>.25&&near-far<.55,'near-far perspective is pronounced, not extreme');
 assert.equal(a.radius,26);assert.equal(b.radius,26);
});
test('camera floor framing is lightweight and adapts to tower and default arena',()=>{
 const {w,ctx,calls}=depthWorld();
 const game={width:700,height:480};
 w.ArenaDepth.paintBackdrop(ctx,game,false);
 w.ArenaDepth.paintBackdrop(ctx,game,true);
 assert.ok(calls.gradient>=4);
 assert.equal(calls.saves,calls.restores);
});
test('PvP instant effects and health bars use matching perspective projection',()=>{
 const rt=read('js/features/pvp-runtime.js').replace(/\r/g,'');
 assert.match(rt,/ArenaFXLayer=\{draw\(painter\)/);
 assert.match(rt,/SkillVisuals.draw\(painter,\{skipForegroundTime:true\}\)/);
 assert.ok(!rt.includes("layer?.(canvas,'instantfx')"),'remote FX share fighter occlusion and screen shake');
 assert.match(rt,/ArenaDepth\?\.elevatedPoint\?\./);
 for(const html of [read('index.html'),read('pvp-runtime.html')])
  assert.match(html,/arena-depth\.js\?v=(?:stone25d1|six-decks1)/);
 assert.match(read('index.html'),/pvp-original-engine\.js\?v=realm-chaos1/);
});
test('airborne figures project vertically without moving their physics footprint',()=>{
 const {w}=depthWorld(),arena={width:500,height:500};
 const p={x:250,y:300,z:80},ground=w.ArenaDepth.screenPoint(p.x,p.y,arena);
 const upper=w.ArenaDepth.elevatedPoint(p,p.z,arena);
 assert.equal(ground.x,upper.x);
 assert.ok(ground.y-upper.y>60);
});

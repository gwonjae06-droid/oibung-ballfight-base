const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=path=>fs.readFileSync(require('node:path').join(root,path),'utf8');
function pen(){
 const calls=[],context=new Proxy({calls,canvas:{width:500,height:500}}, {
  get(target,k){if(k in target)return target[k];return (...args)=>{calls.push({method:k,args});return k==='createRadialGradient'||k==='createLinearGradient'?{addColorStop(){}}:undefined;};},
  set(target,k,v){target[k]=v;return true;}
 });
 return context;
}
function setup(){
 const s={Math,Map,Set,WeakMap,Object,Number,Array,console};
 s.globalThis=s;s.window=s;s.ArenaTower={active:true};s.ArenaScreenRouter={active:'tower'};
 s.ArenaTowerTerrain={worldHeight(x,y){return x>=0?35:0;}};
 vm.runInNewContext(source('js/features/arena-fx-depth.js'),s,{filename:'arena-fx-depth.js'});
 return s;
}
test('3D decals anchor to the real Tower terrain height and not canvas center',()=>{
 const s=setup(),c=pen();s.ArenaFXDepth.beginFrame();
 assert.equal(s.ArenaFXDepth.ground(c,100,300,42,'#bdf'),true);
 const e=c.calls.find(x=>x.method==='ellipse');
 assert.equal(e.args[0],100);assert.equal(e.args[1],265);
 assert.equal(e.args[2],42);assert.ok(e.args[3]<42);
 s.ArenaFXDepth.column(c,100,300,18,75,'#bdf');
 assert.ok(c.calls.some(x=>x.method==='moveTo'&&x.args[1]===265));
 assert.ok(c.calls.some(x=>x.method==='lineTo'&&x.args[1]===190));
 s.ArenaScreenRouter.active='pvp';const p=pen();s.ArenaFXDepth.beginFrame();s.ArenaFXDepth.ground(p,100,300,42,'#bdf');
 assert.equal(p.calls.find(x=>x.method==='ellipse').args[1],300);
});
test('dense projectiles reduce ornamental cost but never delete damage/projectiles',()=>{
 const s=setup(),c=pen();s.ArenaFXDepth.beginFrame(90);
 let drawn=0;for(let i=0;i<200;i++)if(s.ArenaFXDepth.ground(c,200,200,20,'#fff'))drawn++;
 assert.ok(drawn<=35);assert.equal(s.ArenaFXDepth.used,200);
 assert.equal(s.ArenaFXDepth.budget,35);
 s.ArenaFXDepth.beginFrame(0);assert.equal(s.ArenaFXDepth.budget,140);
 s.ArenaFXDepth.setReduced(true);const q=pen();s.ArenaFXDepth.beginFrame(0);
 assert.equal(s.ArenaFXDepth.column(q,200,200,20,90,'#fff'),false);
 assert.equal(s.ArenaFXDepth.ground(q,200,200,20,'#fff'),true);
 assert.equal(s.ArenaFXDepth.budget,18);
});
test('air billboards match the projected fighter position including altitude',()=>{
 const s=setup(),c=pen();let got=null;
 s.ArenaDepth={air(ctx,point,z,paint){got={point,z};paint(ctx);}};
 s.ArenaFXDepth.billboard(c,160,240,50,p=>p.arc(0,0,5,0,Math.PI*2));
 assert.equal(got.point.x,160);assert.equal(got.point.y,240);assert.equal(got.z,50);
 assert.deepEqual(c.calls.find(x=>x.method==='translate').args,[160,140]);
});
test('all authored action silhouettes now inherit 2.5D casts and real impact layers',()=>{
 const s=setup(),c=pen(),typeList=['wave','shot','beam','heal','shield','blackhole','meteor','flight','portal','timestop','lifebloom','summon','turret','slash','starfall'];
 const callCounts={ground:0,column:0,impact:0};
 const f=s.ArenaFXDepth;
 s.ArenaFXDepth={...f};for(const k of Object.keys(callCounts))s.ArenaFXDepth[k]=(...args)=>{callCounts[k]++;return f[k](...args);};
 vm.runInNewContext(source('js/features/skill-visuals.js'),s,{filename:'skill-visuals.js'});
 vm.runInNewContext(source('js/features/forge-combo-vfx.js'),s,{filename:'forge-combo-vfx.js'});
 const p={x:200,y:260,hp:400,radius:26,forge:{effectColor:'#88ccff'},playerNum:1};
 for(const type of typeList){
  s.ArenaFXDepth.beginFrame();
  assert.equal(s.SkillVisuals.cast(p,{type,radius:75,damage:15},{x:280,y:270}),true);
  assert.equal(s.ForgeComboFX.cast(p,{type,radius:75}, {steps:1,step:0,link:'start'},null),true);
  s.SkillVisuals.draw(c);s.ForgeComboFX.clear();s.SkillVisuals.clear();
 }
 assert.ok(callCounts.ground>=typeList.length,'each cast has a volume or grounded decal');
 s.SkillVisuals.impact(p,{x:275,y:275,hp:100},{type:'wave',radius:100});
 s.SkillVisuals.draw(c);
 assert.ok(callCounts.impact>=1,'real hit is represented as a raised impact');
});
test('renderer loads depth primitives before all effect families',()=>{
 for(const html of ['index.html','pvp-runtime.html']){
  const s=source(html);
  const depth=s.indexOf('arena-fx-depth.js');
  assert.ok(depth>0);
  for(const module of ['advanced-combat.js','skill-visuals.js','forge-combo-vfx.js'])
   assert.ok(s.indexOf(module)>depth,module+' must follow depth projection');
 }
 const s=source('js/features/battle-effects.js');
 assert.match(s,/ArenaFXDepth\?\.setReduced/);
 assert.match(source('js/core/render.js'),/ArenaFXDepth\?\.beginFrame/);
});

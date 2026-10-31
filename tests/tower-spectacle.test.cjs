const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(realm,level=10){
 const g={};vm.createContext(g);
 for(const f of ['tower-spectacle','tower-encounters'])vm.runInContext(fs.readFileSync('js/features/'+f+'.js','utf8'),g);
 const hero={x:30,y:30,hp:10000,maxHp:10000,radius:12},boss={x:300,y:300,hp:10000,maxHp:10000},hits=[];
 const s=g.ArenaTowerSpectacle.create({realm,level,width:500,height:500,hero,boss,damage(p,n,z){hits.push({n,z});return true;}});
 return {g,s,hero,boss,hits};
}
for(const realm of ['time','space','fire','storm','ice','forest'])test(realm+' spectacle: three variants, finite geometry, bounded zones and cleanup',()=>{
 const {s,hero}=setup(realm);const variants=new Set();
 for(let i=0;i<2200;i++){
  // QA puppet survives the fire finale only so all three rotation variants can be exercised.
  if(hero.hp<=0)hero.hp=hero.maxHp;
  s.step();if(s.event)variants.add(s.event.variant);
  assert.ok(s.zones.length<=7);
  for(const z of s.zones){assert.ok(Number.isFinite(z.x)&&Number.isFinite(z.y));assert.ok(z.fire>=z.born+120);}
 }
 assert.equal(variants.size,3);
});
test('ordinary monsters never create page ultimates',()=>{const {s}=setup('fire',4);for(let i=0;i<1500;i++)s.step();assert.equal(s.event,null);});
test('giant meteor is not a destructible enemy, and wipes only if fire boss survives deadline',()=>{
 const {s,hero,boss,hits}=setup('fire');
 for(let i=0;i<241;i++)s.step();
 assert.equal(s.event.title,'종말 운석');
 assert.equal(s.event.deadline-s.event.start,720);
 assert.equal(s.entities.length,0,'no fake targetable meteor monster');
 assert.equal(s.targets(hero).length,0);
 assert.equal(s.event.remaining,12);
 hero.invincible=100000;hero.z=900;hero.forge={skills:[{actions:[{type:'resurrect'}]}]};
 for(let i=0;i<720;i++)s.step();
 assert.equal(s.event.exploded,true);
 assert.ok(hero.hp>0,'the page-filling blast must be displayed before defeat');
 for(let i=0;i<48;i++)s.step();
 assert.equal(hero.hp,0,'extinction ignores shield, flight, and invincible frames');
 assert.equal(hero.forgeRevived,true,'no resurrect loop after wipe');
 assert.equal(hits.length,0,'normal hazard damage must not override the lethal rule');
});
test('defeating fire boss before meteor deadline cancels the world event',()=>{
 const {s,hero,boss}=setup('fire');
 for(let i=0;i<241;i++)s.step();
 for(let i=0;i<150;i++)s.step();
 boss.hp=0;s.step();
 assert.equal(s.event,null);assert.equal(hero.hp,10000);
 assert.equal(s.targets(hero).length,0);
});
test('meteor viewport art descends and grows while preserving reduced motion',()=>{
 const g={};g.globalThis=g;vm.createContext(g);
 vm.runInContext(fs.readFileSync('js/features/tower-meteor-art.js','utf8'),g);
 const motion=[];let trans=[];
 const gradient={addColorStop(){}};
 const c=new Proxy({}, {get(obj,k){if(k==='createRadialGradient')return ()=>gradient;if(k==='translate')return (x,y)=>trans.push({x,y});return obj[k]||(()=>{});},set(obj,k,v){obj[k]=v;return true;}});
 for(const p of [0,.25,.5,.75,.99]){
  trans=[];assert.doesNotThrow(()=>g.ArenaTowerMeteorArt.draw(c,{realm:'fire',deadline:900,start:180,impactTick:948,remaining:Math.ceil(12*(1-p)),progress:p},180+p*720,1360,850,false));
  motion.push(trans[0].y);
 }
 for(let i=1;i<motion.length;i++)assert.ok(motion[i]>motion[i-1],`meteor must descend at ${i}`);
 assert.doesNotThrow(()=>g.ArenaTowerMeteorArt.draw(c,{realm:'fire',deadline:900,impactTick:948,exploded:true,failed:true,remaining:0,progress:1},925,390,844,true));
});
test('rotating hands change collision geometry and death clears effects',()=>{const {s,hero}=setup('time');for(let i=0;i<241;i++)s.step();const a=s.zones[0].angle;s.step();assert.notEqual(s.zones[0].angle,a);hero.hp=0;s.step();assert.equal(s.event,null);assert.equal(s.zones.length,0);});
test('full-screen meteor does not inherit vanishing background alpha, and page cleanup hides it',()=>{
 const g={},c={globalAlpha:1,clearRect(){},getContext(){return this;}},canvas={width:0,height:0,hidden:false,style:{},getContext(){return c;},setAttribute(){}};
 const root={appendChild(el){this.child=el;}},doc={body:root,createElement(){return canvas;},querySelector(){return null;},getElementById(){return null;}};
 g.globalThis=g;g.document=doc;g.innerWidth=1366;g.innerHeight=900;
 const alpha=[];g.ArenaTowerMeteorArt={draw(){alpha.push(c.globalAlpha);}};
 vm.createContext(g);vm.runInContext(fs.readFileSync('js/features/tower-spectacle.js','utf8'),g);
 for(const progress of [0,.45,1])g.ArenaTowerSpectacle.page({realm:'fire',deadline:800,impactTick:848,progress,remaining:6,start:80},440);
 assert.deepEqual(alpha,[1,1,1]);
 g.ArenaTowerSpectacle.page(null);
 assert.equal(canvas.hidden,true);
});
test('boss cannot be defeated retroactively after the meteor reaches zero',()=>{
 const {s,hero,boss}=setup('fire');
 for(let i=0;i<961;i++)s.step();
 assert.equal(s.event.failed,true);
 assert.ok(boss.invincible>=48);
 boss.hp=0;s.step();
 assert.equal(s.event.failed,true);
 assert.equal(boss.hp,1);
 for(let i=1;i<48;i++)s.step();
 assert.equal(hero.hp,0);
});

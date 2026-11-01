'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={Math,Date,Set,Map,WeakMap,console,addFloatingText(){}};g.globalThis=g;g.window=g;
 vm.createContext(g);
 for(const file of ['ancient-six-seals','ancient-final-fx','ancient-one'])
  vm.runInContext(read('js/features/'+file+'.js'),g,{filename:file});
 return g;
}
function make(){
 const g=world(),hero={x:45,y:430,vx:0,vy:0,hp:5000,maxHp:5000,radius:20,forgeShots:[],bfShots:[],playerNum:1},
 boss={x:250,y:90,vx:0,vy:0,hp:3000,maxHp:3000,radius:28,playerNum:2,towerEnemy:true,towerDefense:1};
 const hits=[];
 const enemy=g.ArenaAncientOne.create({width:500,height:500,hero,boss,
  damage(p,n,z){hits.push({p,n,z});return true;}});
 return {g,hero,boss,hits,enemy,seals:enemy.seals};
}
function fakeCanvas(){
 const calls=[],gradient={addColorStop(){}};
 const c=new Proxy({createRadialGradient(){return gradient;},measureText(s){return {width:s.length*6};}},{
  get(o,k){return k in o?o[k]:(...args)=>calls.push([k,...args]);},
  set(o,k,v){o[k]=v;return true;}});
 return {c,calls};
}
test('Ancient One retains 3000HP and its original 16 huge telegraphed attacks',()=>{
 const {g,enemy,boss}=make();
 assert.equal(g.ArenaAncientOne.names.length,16);
 assert.equal(boss.hp,3000);
 for(let i=0;i<80;i++)enemy.step();
 assert.equal(enemy.zones.length,1);
 assert.equal(enemy.zones[0].power,200);
 assert.ok(enemy.zones[0].fire-enemy.zones[0].born>=100);
 assert.equal(enemy.seals.event.realm,'time');
});
test('each HP phase adds two tower powers and final phase creates six-seal convergence',()=>{
 for(const [hp,phase,first,second] of [[3000,1,'time','space'],[1750,2,'fire','storm'],[800,3,'ice','forest']]){
  const {enemy,boss}=make();boss.hp=hp;
  const seen=[];
  for(let i=0;i<1280;i++){
   enemy.step();const active=enemy.seals.event?.realm;
   if(active&&seen[seen.length-1]!==active)seen.push(active);
  }
  assert.equal(enemy.phase,phase);
  assert.equal(seen[0],first);assert.equal(seen[1],second);
  if(phase===3)assert.ok(seen.includes('convergence'),'phase 3 has six seal convergence');
 }
});
test('a disclosed time seal cannot strike before its telegraph, but its rotating clock has real hitbox',()=>{
 const {seals,hero,hits}=make();seals.begin('time',1);
 for(let i=0;i<147;i++)seals.step();
 assert.equal(hits.length,0);
 const h=seals.handAt(0,148);hero.x=(h.x1+h.x2)/2;hero.y=(h.y1+h.y2)/2;
 seals.step();assert.equal(hits.length,1);assert.equal(hits[0].n,33);
 const previous=hits.length;
 for(let i=0;i<30;i++){const l=seals.handAt(0,seals.age+1);
  hero.x=(l.x1+l.x2)/2;hero.y=(l.y1+l.y2)/2;seals.step();}
 assert.equal(hits.length,previous,'same moving hand must not inflict damage every frame');
});
test('space vortex actually curves pinball velocities and shots without any telegraph damage',()=>{
 const {seals,hero,hits}=make();seals.begin('space',1);
 hero.x=100;hero.y=250;hero.vx=0;hero.vy=0;
 const shot={x:102,y:248,vx:0,vy:0};hero.forgeShots.push(shot);
 for(let i=0;i<180;i++)seals.step();
 assert.ok(hero.vx>0,'real gravity draws hero inward');
 assert.ok(shot.vx>0,'projectile bends toward black hole');
 assert.equal(hits.length,0,'safe outskirts should not deal damage');
});
test('fire and storm use exact authored warning periods and visible danger geometry',()=>{
 const {seals,hero,hits}=make();
 seals.begin('fire',2);
 for(let i=0;i<179;i++)seals.step();
 const fire=seals.fireAt(0);hero.x=fire.x;hero.y=fire.y;
 seals.step();assert.equal(hits.length,1);
 assert.equal(hits[0].z.realm,'fire');assert.equal(hits[0].n,34);
 seals.clear();hits.length=0;hero.x=40;hero.y=420;
 seals.begin('storm',2);
 for(let i=0;i<181;i++)seals.step();
 const beam=seals.lightningAt(0);hero.x=beam.x1;hero.y=250;
 seals.step();assert.equal(hits.length,1);assert.equal(hits[0].z.realm,'storm');
});
test('ice mirrors and world-tree root capsules collide at their illustrated coordinates',()=>{
 const {seals,hero,hits}=make();
 seals.begin('ice',3);for(let i=0;i<170;i++)seals.step();
 const ice=seals.iceAt(0,171);hero.x=ice.x;hero.y=ice.y;
 seals.step();assert.equal(hits.length,1);assert.equal(hits[0].z.realm,'ice');
 seals.clear();hits.length=0;hero.x=60;hero.y=430;
 seals.begin('forest',3);for(let i=0;i<157;i++)seals.step();
 const root=seals.rootAt(0,158);
 hero.x=(root.x1+root.x2)/2;hero.y=(root.y1+root.y2)/2;
 seals.step();assert.equal(hits.length,1);assert.equal(hits[0].z.realm,'forest');
});
test('six-realm convergence keeps inner and outer safe corridors',()=>{
 const {seals,hero,hits}=make();
 seals.begin('convergence',3);hero.x=250;hero.y=250;
 for(let i=0;i<380;i++)seals.step();
 assert.equal(hits.length,0,'center of arena should remain safe');
 assert.equal(seals.event.realm,'convergence');
 assert.ok(seals.event.progress>0.6);
});
test('real exposed tentacle ball collision strikes only the shared 3000HP boss through SkillForge.hit',()=>{
 const {g,seals,hero,boss}=make();let calls=0;
 g.SkillForge={hit(attacker,victim,action){calls++;assert.equal(attacker,hero);
  assert.equal(victim,boss);assert.equal(action.status,'none');victim.hp-=action.damage;return true;}};
 const l=seals.limbAt(0,1);
 hero.x=l.x;hero.y=l.y;hero.vx=-4;hero.vy=0;
 seals.step();
 assert.equal(seals.limbHits,1);assert.equal(boss.hp,2978);assert.equal(calls,1);
 for(let i=0;i<25;i++)seals.step();
 assert.equal(calls,1,'tendril contact has a bounded cooldown');
});
test('hero-authored projectiles can physically strike tentacle ends, with deduplicated hit cooldown',()=>{
 const {g,seals,hero,boss}=make();let calls=0;
 g.SkillForge={hit(a,p,act){p.hp-=act.damage;calls++;return true;}};
 const point=seals.limbAt(1,1);
 const shot={x:point.x,y:point.y,vx:0,vy:0,damage:29};
 hero.forgeShots.push(shot);
 seals.step();assert.equal(boss.hp,2971);assert.equal(calls,1);
 for(let i=0;i<15;i++)seals.step();
 assert.equal(calls,1,'same projectile must not repeatedly hurt the same limb');
});
test('all seven seal geometries draw without altering combat values',()=>{
 const {seals,hero,boss,hits}=make(),{c,calls}=fakeCanvas();
 for(const realm of world().ArenaAncientSixSeals.REALMS){
  seals.clear();seals.begin(realm,3);
  for(let i=0;i<160;i++)seals.step();
  const before=JSON.stringify(hero),hp=boss.hp,count=hits.length;
  assert.doesNotThrow(()=>seals.draw(c));
  assert.equal(JSON.stringify(hero),before);
  assert.equal(boss.hp,hp);assert.equal(hits.length,count);
 }
 assert.ok(calls.some(x=>x[0]==='arc'||x[0]==='ellipse'));
});
test('page atmosphere is pointer-safe and respects reduced-motion in desktop and mobile',()=>{
 const {g}=make(),{c}=fakeCanvas();
 const event={realm:'convergence',start:0,progress:.5};
 assert.doesNotThrow(()=>g.ArenaAncientFinaleFX.paint(c,event,3,190,1366,900,false));
 assert.doesNotThrow(()=>g.ArenaAncientFinaleFX.paint(c,event,3,190,390,840,true));
 const canvas={style:{},hidden:false,width:0,height:0,setAttribute(){},getContext(){return c;}};
 const root={appendChild(el){this.el=el;}};
 g.document={createElement(){return canvas;},body:root};
 g.innerWidth=390;g.innerHeight=840;g.matchMedia=()=>({matches:true});
 g.ArenaAncientFinaleFX.page(event,3,190);
 assert.equal(root.el,canvas);assert.match(canvas.style.cssText,/pointer-events:none/);
 g.ArenaAncientFinaleFX.clear();assert.equal(canvas.hidden,true);
});
test('finishing/forfeiting clears seal hitboxes and page overlay without changing other towers',()=>{
 const {g,enemy,boss}=make();for(let i=0;i<80;i++)enemy.step();
 assert.ok(enemy.seals.event);
 boss.hp=0;enemy.step();assert.equal(enemy.seals.event,null);assert.equal(enemy.zones.length,0);
 const code=read('js/features/tower-challenge.js'),html=read('index.html');
 assert.match(code,/encounter\?\.clear\?\.\(\)/);
 assert.match(code,/global\.ArenaAncientFinaleFX\?\.clear\?\.\(\)/);
 assert.ok(html.indexOf('ancient-six-seals.js')<html.indexOf('ancient-one.js'));
 assert.ok(html.indexOf('ancient-final-fx.js')<html.indexOf('ancient-one.js'));
 assert.match(html,/ancient-one\.js\?v=eldritch1-boss3-six-seals/);
});

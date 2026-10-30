'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const world={};vm.createContext(world);
for(const name of ['tower-realms','tower-encounters'])vm.runInContext(fs.readFileSync(__dirname+'/../js/features/'+name+'.js','utf8'),world);
const {ArenaTowerRealms:R,ArenaEncounter:E}=world;
function encounter(realm,level=5){
 const hero={x:250,y:250,radius:20,hp:1000,maxHp:1000},boss={x:250,y:420,radius:25,hp:500,maxHp:500};
 const hits=[];
 const e=E.create({realm,level,hero,boss,damage(p,n,z){hits.push({p,n,id:z.id});p.hp-=n;return true;}});
 return {e,hero,boss,hits};
}
for(const realm of R.REALMS){
 test(realm.id+' terrain: telegraph has no hit, geometry locks, one hit per actor',()=>{
  const {e,hero,boss,hits}=encounter(realm.id,1);
  for(let i=0;i<150;i++)e.step();
  const z=e.zones[0];assert.ok(z);assert.equal(hits.length,0);assert.ok(z.fire-z.born>=90);
  const x=z.x,y=z.y;hero.x=35;hero.y=35;
  for(let i=0;i<95;i++)e.step();
  assert.equal(hits.length,0);assert.equal(z.x,x);assert.equal(z.y,y);
  hero.x=x;hero.y=y;boss.x=x;boss.y=y;e.step();
  assert.equal(hits.length,2);
  for(let i=0;i<30;i++)e.step();assert.equal(hits.length,2);
 });
 for(const level of [5,10])test(realm.id+' '+level+'F: telegraph, safe space, second phase and cleanup',()=>{
  const {e,hero,boss,hits}=encounter(realm.id,level);
  for(let i=0;i<100;i++)e.step();
  assert.ok(e.zones.length);assert.equal(hits.length,0);
  assert.ok(e.zones.every(z=>z.fire-z.born>=78));
  // Each attack has reachable safe ground, including body radius.
  for(const z of e.zones){
   let safe=0;for(let x=30;x<=470;x+=20)for(let y=30;y<=470;y+=20)if(!E.contains(z,{x,y,radius:20}))safe++;
   assert.ok(safe>50,'must never cover the arena');
  }
  boss.hp=200;e.step();assert.equal(e.phase,2);
  const first=e.zones[0],id=first.id;hero.x=first.x;hero.y=first.shape==='ring'?first.y+135:first.y;
  for(let i=0;i<220;i++)e.step();assert.ok(!e.zones.some(z=>z.id===id));
  assert.ok(e.zones.length<12,'bounded hazard list');
 });
}
test('blessings detach shared saved profiles, change actual actions and do not contaminate another fighter',()=>{
 const profile={skills:[{cooldown:3,actions:[{type:'shot',damage:20,radius:100,speed:5,status:'none'}]}]};
 const original=JSON.stringify(profile),a={forge:profile,hp:200,maxHp:200},b={forge:profile,hp:200,maxHp:200};
 R.apply(a,'fire',['echo','haste','reach','element','vital']);
 assert.equal(JSON.stringify(profile),original);assert.equal(JSON.stringify(b.forge),original);
 assert.equal(a.forge.skills[0].actions[0].status,'fire');assert.ok(a.forge.skills[0].actions[0].damage>20);
 assert.ok(a.forge.skills[0].cooldown<3);assert.equal(a.maxHp,240);
 const next={forge:profile,hp:200,maxHp:200};R.apply(next,'ice',[]);assert.equal(JSON.stringify(next.forge),original);
});
test('reward choices are unique, random and stop offering capped blessings',()=>{
 const a=R.choices('time',[],()=>.1),b=R.choices('time',[],()=>.9);
 assert.equal(new Set(a.map(x=>x.id)).size,3);assert.notEqual(a.map(x=>x.id).join(),b.map(x=>x.id).join());
 const capped=['echo','echo','haste','haste','element'];
 assert.ok(R.choices('fire',capped).every(x=>!capped.includes(x.id)));
});
test('ring safe interior and rotated line collision match rendered geometry',()=>{
 assert.equal(E.contains({shape:'ring',x:250,y:250,inner:100,r:150},{x:250,y:250,radius:20}),false);
 assert.equal(E.contains({shape:'ring',x:250,y:250,inner:100,r:150},{x:340,y:250,radius:20}),true);
 assert.equal(E.contains({shape:'line',x:250,y:250,angle:Math.PI/2,width:40,length:500},{x:250,y:80,radius:20}),true);
 assert.equal(E.contains({shape:'line',x:250,y:250,angle:Math.PI/2,width:40,length:500},{x:350,y:80,radius:20}),false);
});

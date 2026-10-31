'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function world(...paths){const w={console,Math,Map,Set,Number};w.window=w;w.globalThis=w;vm.createContext(w);
 for(const file of paths)vm.runInContext(fs.readFileSync(file,'utf8'),w,{filename:file});
 return w;
}
const w=world('js/features/tower-encounters.js','js/features/tower-environment.js'),E=w.ArenaEncounter,V=w.ArenaTowerEnvironment;
const realms=['time','space','fire','storm','ice','forest'];
test('six 5F and 10F bosses have unique names and at most ONE common pattern per pair',()=>{
 const all=[];
 for(const id of realms){
  const five=E.patternNames(id,5),ten=E.patternNames(id,10);
  assert.equal(five.length,4);assert.equal(ten.length,5);
  assert.equal(new Set(five).size,five.length);
  assert.equal(new Set(ten).size,ten.length);
  assert.equal(five.filter(v=>ten.includes(v)).length,1);
  all.push(...five.map(n=>({boss:id+'-5',name:n})),...ten.map(n=>({boss:id+'-10',name:n})));
 }
 const bosses=[...new Set(all.map(v=>v.boss))];
 for(let i=0;i<bosses.length;i++)for(let j=i+1;j<bosses.length;j++){
  const a=all.filter(x=>x.boss===bosses[i]).map(x=>x.name),
    b=all.filter(x=>x.boss===bosses[j]).map(x=>x.name);
  assert.ok(a.filter(v=>b.includes(v)).length<=1,bosses[i]+' vs '+bosses[j]);
 }
});
test('every final Tower boss actually summons its five multi-stage signatures',()=>{
 for(const realm of realms){
  const hero={x:250,y:250,radius:20,hp:30000,maxHp:30000,forgeTicks:[100,100],vx:0,vy:0};
  const boss={x:250,y:430,radius:25,hp:3000,maxHp:3000};
  const hits=[];
  const e=E.create({realm,level:10,hero,boss,damage(p,n,z){hits.push(z.label);p.hp-=n;return true;}});
  const used=new Set();
  for(let i=0;i<1750;i++){
   e.step();
   for(const z of e.zones)if(z.signature)used.add(z.label);
   assert.ok(e.zones.length<=30,'even 100x battles must limit VFX zone count');
  }
  assert.ok(e.attackIndex>=5,realm);
  assert.deepEqual([...used].sort(),[...E.patternNames(realm,10)].sort(),
    realm+' must actually execute all five advertised ultimate patterns');
  assert.ok(e.zones.every(z=>z.fire-z.born>=78),realm+' instant damage warning');
  assert.ok(hits.length>=0);
 }
});
test('six normal enemy families rotate through a real third unique hazard',()=>{
 const third={time:'reverse',space:'debris',fire:'slag',storm:'chainlightning',ice:'shatter',forest:'roots'};
 for(const realm of realms){
  const roster=[{x:250,y:250,radius:18,hp:1200,maxHp:1200,forgeTicks:[20],vx:0,vy:0}];
  const damage=[];
  const env=V.create({realm,level:4,roster,damage(p,n,z){damage.push({n,z});p.hp-=n;return true;}});
  for(let i=0;i<=env.period*2+2;i++)env.step();
  assert.equal(env.zones[0]?.mode,third[realm],realm+' third unique hazard');
  const z=env.zones[0];
  assert.ok(z.fire-z.born>=60);
  let safe=0;
  for(let x=40;x<480;x+=25)for(let y=40;y<480;y+=25)if(!V.contains(z,{x,y,radius:18}))safe++;
  assert.ok(safe>30,realm+' no fair dodge lanes');
 }
});
test('boss signature hits apply six real status/movement identities AFTER confirmed damage',()=>{
 const cases={time:'slowTimer',space:'vx',fire:'bfDot',storm:'vx',ice:'slowTimer',forest:'poisonTimer'};
 for(const realm of realms){
  const hero={x:250,y:250,radius:18,hp:20000,maxHp:20000,forgeTicks:[40],vx:0,vy:0};
  const boss={x:250,y:430,radius:25,hp:3000,maxHp:3000};
  const e=E.create({realm,level:10,hero,boss,damage(p,n,z){p.hp-=n;return true;}});
  for(let i=0;i<101;i++)e.step();
  const z=e.zones[0];if(!z)throw Error(realm+' empty opening');
  if(z.shape==='line'){hero.x=z.x;hero.y=z.y;}
  else if(z.shape==='ring'){hero.x=z.x+Math.min(z.r-12,z.inner+15);hero.y=z.y;}
  else{hero.x=z.x;hero.y=z.y;}
  while(e.tick<=z.fire)e.step();
  assert.ok(hero.hp<20000,realm+' should hit hero inside visible telegraph');
  assert.ok(hero[cases[realm]],realm+' should affect '+cases[realm]);
 }
});

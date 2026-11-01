'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const world={};vm.createContext(world);
for(const name of ['tower-realms','tower-encounters'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/features/'+name+'.js'),'utf8'),world);
const R=world.ArenaTowerRealms,E=world.ArenaEncounter;
test('six realms produce distinct combat loadouts and escalating enemy stats',()=>{
 const pairs=new Set();
 for(const r of R.REALMS){
  const skills=R.enemyLoadout(r.id,8);
  assert.equal(skills.length,5);
  pairs.add(skills.map(s=>s[1]).join(','));
  assert.equal(R.enemyLoadout(r.id,1).length,2);
  assert.equal(R.enemyLoadout(r.id,4).length,4);
  assert.ok(R.floor({number:10,boss:true},r.id).hp>R.floor({number:5,boss:true},r.id).hp);
 }
 assert.equal(pairs.size,6);
});
test('boss patterns change across casts and are never instantaneous',()=>{
 for(const r of R.REALMS){
  const h={x:250,y:250,radius:18,hp:900,maxHp:900},b={x:250,y:420,radius:24,hp:600,maxHp:600};
  const hit=[];const e=E.create({realm:r.id,level:10,hero:h,boss:b,damage(p,n,z){hit.push({p,n,z});p.hp-=n;return true;}});
  for(let i=0;i<100;i++)e.step();
  assert.ok(e.zones.length);
  assert.ok(e.zones.every(z=>z.fire-z.born>=78));
  const first=e.zones[0].label;
  for(let i=0;i<750;i++){h.x=35;h.y=35;e.step();}
  assert.ok(e.attackIndex>=3);
  assert.ok(E.patternNames(r.id).length>=4);
  assert.ok(e.zones.every(z=>z.fire-z.born>=78));
  assert.notEqual(first,E.patternNames(r.id)[1]);
 }
});
test('page enters tower through a selection-only view with explicit return',()=>{
 const ch=fs.readFileSync(path.join(__dirname,'../js/features/tower-challenge.js'),'utf8');
 const route=fs.readFileSync(path.join(__dirname,'../js/features/screen-router.js'),'utf8');
 assert.match(ch,/view='selection'/);
 assert.match(ch,/view='interior'/);
 assert.match(ch,/tower-back-selection/);
 assert.match(route,/openSelection/);
});

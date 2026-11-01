'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const realms=['time','space','fire','storm','ice','forest'];
function load(){
 const g={Math,Date,Set,Map,WeakMap,console};g.globalThis=g;g.window=g;vm.createContext(g);
 for(const f of ['tower-world-mechanics','tower-realms','arena-balance'])
  vm.runInContext(read('js/features/'+f+'.js'),g,{filename:f});
 g.SkillForge={normalize:p=>p};g.BlockForge={};
 vm.runInContext(read('js/features/studio-easy-designer.js'),g);
 return g;
}
const fighter=(x=60,y=430)=>({x,y,vx:0,vy:0,hp:1000,maxHp:1000,radius:20,forgeShots:[]});
function canvas(){const s={createLinearGradient(){return {addColorStop(){}}},createRadialGradient(){return {addColorStop(){}}}};
 return new Proxy(s,{get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true}});}
test('all six ordinary-floor environmental attacks are active gameplay not cosmetic paint',()=>{
 const g=load();
 for(const realm of realms){
  const h=fighter(),b=fighter(420,420),hits=[];
  const m=g.ArenaTowerWorldMechanics.create({realm,level:6,width:500,height:500,hero:h,boss:b,
   damage(...args){hits.push(args);return true;}});
  for(let t=0;t<225;t++)m.step();
  assert.equal(m.event.realm,realm);
  assert.equal(m.zones.length>0,realm!=='storm');
  // Arena drawing only describes attacks; it is not permitted to alter combat state.
  const before=JSON.stringify(h),hitCount=hits.length;
  m.draw(canvas());assert.equal(JSON.stringify(h),before);
  assert.equal(hits.length,hitCount);
  for(let t=0;t<144;t++)m.step();
  assert.equal(m.event?.realm,realm);
  assert.ok(m.event.fire<m.tick,realm+' mechanism becomes active after warning');
  m.clear();assert.equal(m.event,null);
 }
});
test('moving clock hand and ice barrier use real physical capsule collision and cooldown',()=>{
 const g=load();
 for(const realm of ['time','ice']){
  const h=fighter(250,250),b=fighter(425,425),hits=[];
  const m=g.ArenaTowerWorldMechanics.create({realm,level:7,width:500,height:500,hero:h,boss:b,
   damage(p,n){hits.push(n);return true;}});
  m.begin();
  for(let i=0;i<132;i++)m.step();
  const z=m.zones[0];assert.equal(z.shape,'line');
  h.x=z.x;h.y=z.y;h.vx=-3;
  m.step();assert.ok(Math.hypot(h.vx,h.vy)>.1);
  assert.equal(hits.length,1);
  const prev=hits.length;
  for(let i=0;i<10;i++){const v=m.zones[0];h.x=v.x;h.y=v.y;m.step();}
  assert.equal(hits.length,prev,'one hit cannot repeat every frame');
 }
});
test('stock intermediate templates have a bounded optimistic cast budget for all six tower finals',()=>{
 const g=load(),plans=g.StudioEasyDesigner.PLANS,rows={};
 for(const [name,plan] of Object.entries(plans)){
  const actions=plan.skills.map(([,type,damage])=>({type,damage,radius:120,count:1,duration:1.5,status:'none'}));
  const profile={signatureVersion:1,skills:[{name,trigger:'auto',cooldown:4.5,actions}]};
  const soft=g.ArenaBalance.summary(profile).multiplier;
  rows[name]={};
  for(const realm of realms){
   const f=g.ArenaTowerRealms.floor({number:10,name:'boss',boss:true},realm);
   const damage=actions.reduce((sum,a)=>sum+Math.max(0,a.damage)*soft*f.towerDefense,0);
   assert.ok(damage>0,realm+'/'+name+' needs an offensive action to progress');
   const theoretical=Math.ceil(f.hp/damage);
   rows[name][realm]=theoretical;
   // 100% action hit rate, no target shield, no boss heal: ONLY an upper-bound
   // estimate; it is NOT a measured win rate or confirmed tower clear.
   assert.ok(theoretical<=60,name+'/'+realm+' best-case casts '+theoretical);
  }
 }
 console.log('Optimistic full-hit signature casts (not combat win rates): '+JSON.stringify(rows));
 const ice=g.ArenaTowerRealms.floor({number:10,name:'boss',boss:true},'ice');
 assert.ok(ice.hp<1500&&ice.hp>1050);
 assert.ok(ice.towerDefense>=.84);
});
test('reworked regular mob loadouts provide 4 and 5 unique action slots after floor two',()=>{
 const g=load();
 for(const realm of realms){
  assert.equal(g.ArenaTowerRealms.enemyLoadout(realm,1).length,2);
  assert.equal(g.ArenaTowerRealms.enemyLoadout(realm,3).length,4);
  assert.equal(g.ArenaTowerRealms.enemyLoadout(realm,8).length,5);
 }
});
test('new mechanics scripts load before encounter; only PvE normal floors instantiate mechanics',()=>{
 const html=read('index.html'),enc=read('js/features/tower-encounters.js');
 assert.ok(html.indexOf('tower-world-mechanics.js')<html.indexOf('tower-encounters.js'));
 assert.match(enc,/const world=!isBoss/);assert.match(enc,/world\?\.step\(\)/);
 assert.match(enc,/world\?\.draw\(ctx\)/);
 assert.match(enc,/get world\(\)/);
});

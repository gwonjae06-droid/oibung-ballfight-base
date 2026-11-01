'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const text=f=>fs.readFileSync('js/features/'+f+'.js','utf8');
function boot(){
 const g={Math,Number,console,Map,Set,WeakMap,addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const f of ['tower-realms','bounce-momentum','arena-balance','forge-expansion'])
  vm.runInContext(text(f),g);
 return g;
}
const modern=()=>({hp:300,maxHp:300,playerNum:1,towerHero:true,forge:{
 signatureVersion:1,effectColor:'#fafafa',skills:[{name:'파동',cooldown:4.5,actions:[{
  type:'wave',damage:35,radius:120,count:1,duration:1.5,status:'none'}]}]}});
test('Tower haste actually improves modern 100-energy passive and wall rates, 2 stack cap',()=>{
 const g=boot(),R=g.ArenaTowerRealms,M=g.BounceMomentum;
 const plain=modern(),once=modern(),twice=modern();
 R.apply(once,'storm',['haste']);R.apply(twice,'storm',['haste','haste']);
 assert.equal(once._towerMomentumBoost,1.15);
 assert.ok(Math.abs(twice._towerMomentumBoost-1.3225)<1e-10);
 for(const p of [plain,once,twice]){
  for(let i=0;i<60;i++){p._forgeActionClock=i+1;M.tick(p,{hp:200});}
 }
 const [a,b,c]=[plain,once,twice].map(M.meter);
 assert.ok(a>0&&b>a&&c>b);
 assert.ok(Math.abs(b-a*1.15)<.001);
 assert.ok(Math.abs(c-a*1.3225)<.001);
 for(const p of [plain,once,twice]){
  p._forgeActionClock=99;M.wall(p,4.4);
 }
 assert.ok(M.meter(twice)>M.meter(once));
 assert.ok(M.meter(once)>M.meter(plain));
 assert.equal(modern()._towerMomentumBoost,undefined,'saving a new profile never persists the temporary blessing');
});
test('legacy 4-skill fighters still get ordinary cooldown reduction without signature energy',()=>{
 const g=boot(),p={hp:250,maxHp:250,forge:{signatureVersion:0,
   skills:[{name:'파동',cooldown:5,actions:[{type:'wave',damage:25}]}]}};
 g.ArenaTowerRealms.apply(p,'ice',['haste','haste']);
 assert.ok(Math.abs(p.forge.skills[0].cooldown-5*.85*.85)<.001);
 assert.equal(p._towerMomentumBoost,undefined);
});
test('only player Tower energy is boosted, never PvP, minion, boss or scripted time refunds',()=>{
 const g=boot(),M=g.BounceMomentum;
 const hero=modern();g.ArenaTowerRealms.apply(hero,'time',['haste']);
 const boss={...modern(),towerEnemy:true,towerPatternBoss:true,_towerMomentumBoost:1.3225};
 const outside={...modern(),towerHero:false,_towerMomentumBoost:1.3225};
 for(const p of [hero,boss,outside]){
  p._forgeActionClock=1;
  M.add(p,10,'passive');
 }
 assert.equal(Number(M.meter(hero).toFixed(3)),11.5);
 assert.equal(M.meter(boss),10);
 assert.equal(M.meter(outside),10);
 M.add(hero,10,'timeSteal');assert.equal(Number(M.meter(hero).toFixed(3)),21.5);
});
test('excessive authored offense is softened while moderate signature attacks are retained',()=>{
 const g=boot(),A=g.ArenaBalance;
 const normal={signatureVersion:1,skills:[{cooldown:5,actions:[
  {type:'wave',damage:28,radius:120,duration:1.5,count:1,status:'none'},
  {type:'shot',damage:23,radius:120,duration:1.5,count:1,status:'none'}]}]};
 const extreme={signatureVersion:1,skills:[{cooldown:.2,actions:Array.from({length:12},()=>({
  type:'zone',damage:120,radius:300,duration:8,count:8,status:'poison'}))}]};
 const n=A.summary(normal),e=A.summary(extreme);
 assert.equal(n.multiplier,1);
 assert.ok(e.multiplier<=.3&&e.multiplier>=.18);
 assert.ok(e.pressure>n.pressure*15);
});
test('shared healing and shield reserves limit infinite sustain without forbidding defensive builds',()=>{
 const g=boot(),A=g.ArenaBalance,p=modern();p.maxHp=500;
 let total=0,protectedFrames=0;
 for(let i=0;i<900;i++){
  A.tickHealing(p);A.tickShield(p);
  if(p.invincible>0)p.invincible--;
  if(i%12===0){
   total+=A.healingWindow(p,120);
   p.invincible=A.shieldWindow(p,480);
  }
  if(p.invincible>0)protectedFrames++;
 }
 assert.ok(total<2100&&total>1600,'900 frames allow a 200-HP reserve plus 2 HP/tick, not an arbitrary 1000-HP cap');
 assert.ok(protectedFrames<850&&protectedFrames>400);
});

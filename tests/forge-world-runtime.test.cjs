'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync('js/features/skill-forge-world.js','utf8');
function setup(){
  const records=[],markings=[],g={Math,Number,console,canvas:{width:500,height:500},
    BattleFX:{mark:(...args)=>markings.push(args),cast:(...args)=>markings.push(args)}};
  g.window=g;g.globalThis=g;vm.createContext(g);vm.runInContext(code,g);
  const owner={playerNum:1,x:100,y:100,forge:{color:'#abc'},forgeShots:[],forgeZones:[],forgeOrbs:[]};
  let foes=[];
  const hit=(p,e,a,m=1,z)=>{records.push({e:e.playerNum,type:a.type,m,z});e.hp-=Math.round((a.damage||0)*m);return true;};
  const world=g.SkillForgeWorldFactory({hit,hitGround:hit,enemies:()=>foes});
  return {g,owner,records,markings,world,foes:v=>{foes=v}};
}
function enemy(x,y,id=2){return {playerNum:id,x,y,radius:17,hp:300};}
function shot(p,overrides={}){return {x:p.x,y:p.y,vx:50,vy:0,z:0,heightVelocity:0,life:8,a:{type:'shot',damage:20,speed:8,ricochet:0},...overrides};}
test('shots hit only when swept path connects and never cause a second hit after removal',()=>{
 const a=setup(),foe=enemy(150,100);a.foes([foe]);a.owner.forgeShots.push(shot(a.owner));
 a.world.tick(a.owner,foe);
 assert.equal(a.records.length,1);
 assert.equal(a.records[0].type,'shot');
 assert.equal(a.owner.forgeShots.length,0);
 a.world.tick(a.owner,foe);
 assert.equal(a.records.length,1);
});
test('terrain obstruction stops hit and bounded shot rebound is preserved',()=>{
 const a=setup(),foe=enemy(150,100);a.foes([foe]);a.g.ArenaTowerTerrain={obstructsShot:()=>true};
 a.owner.forgeShots.push(shot(a.owner));
 a.world.tick(a.owner,foe);
 assert.equal(a.owner.forgeShots.length,0);
 assert.equal(a.records.length,0);
 a.g.ArenaTowerTerrain={obstructsShot:()=>false};
 a.owner.forgeShots.push(shot(a.owner,{x:490,y:300,vx:25,vy:0,a:{type:'shot',damage:10,ricochet:1,speed:7}}));
 a.world.tick(a.owner,null);
 assert.equal(a.owner.forgeShots.length,1);
 assert.equal(a.owner.forgeShots[0].vx,-25);
 assert.equal(a.owner.forgeShots[0]._reboundCount,1);
 assert.ok(a.markings.some(x=>x[0]==='shot'));
});
test('zone checks once per 30 ticks, bolt resolves on zero, and active pools are bounded',()=>{
 const a=setup(),foe=enemy(100,100);a.foes([foe]);
 a.owner.forgeZones.push({type:'zone',x:100,y:100,timer:40,ticks:28,a:{type:'zone',damage:20,radius:80}});
 a.world.tick(a.owner,foe);assert.equal(a.records.length,0);
 a.world.tick(a.owner,foe);assert.equal(a.records.length,1);
 assert.equal(a.records[0].m,.4);
 a.owner.forgeZones.push({type:'bolt',x:100,y:100,timer:1,ticks:0,a:{type:'bolt',damage:30,radius:100}});
 a.world.tick(a.owner,foe);
 assert.equal(a.owner.forgeZones.filter(x=>x.type==='bolt').length,0);
 assert.ok(a.records.some(x=>x.type==='bolt'));
 assert.ok(a.markings.some(x=>x[1]==='lightning'));
});
test('orbit collision affects contact points only, not the invisible center',()=>{
 const a=setup(),radius=100,theta=28*.09;
 const onOrbit=enemy(a.owner.x+Math.cos(theta)*radius*.75,a.owner.y+Math.sin(theta)*radius*.75,2);
 const center=enemy(a.owner.x,a.owner.y,3);
 a.foes([onOrbit,center]);a.owner.forgeOrbs.push({life:2,phase:27*.09,ticks:27,a:{type:'orbit',damage:20,count:1,radius}});
 a.world.tick(a.owner,null);
 assert.deepEqual(a.records.map(r=>r.e),[2]);
 a.world.tick(a.owner,null);
 assert.equal(a.owner.forgeOrbs.length,0);
});
test('world simulation never writes to localStorage, the DOM or the central skill cooldowns',()=>{
 assert.doesNotMatch(code,/localStorage|innerHTML|document\.|setInterval\(|setTimeout\(/);
 assert.ok(code.includes('global.SkillForgeWorldFactory'));
 assert.ok(!code.includes('BounceMomentum?.spend'));
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const realms=['time','space','fire','storm','ice','forest'];
function boot(){
 const g={console,Math,Set,Map,WeakMap,Number,players:[]};
 g.globalThis=g;g.window=g;
 g.hits=0;g.BounceMomentum={enabled:()=>true,wall:()=>{g.hits++;}};
 vm.createContext(g);
 vm.runInContext(read('js/features/tower-flat-arena.js'),g);
 vm.runInContext(read('js/features/tower-terrain-25d.js'),g);
 return g;
}
function actor(x=250,y=250,vx=0,vy=0){
 return {x,y,vx,vy,radius:22,hp:250,maxHp:250,z:0,vz:0,towerHero:true};
}
function canvasMock(){
 const stats={fill:0,stroke:0,gradients:0,scale:0};
 const c=new Proxy({},{
  get(target,key){
   if(key in target)return target[key];
   if(key==='createLinearGradient'||key==='createRadialGradient')return (...args)=>{
    stats.gradients++;return {addColorStop(){}};
   };
   if(key==='fill')return ()=>{stats.fill++;};
   if(key==='stroke')return ()=>{stats.stroke++;};
   if(key==='scale')return ()=>{stats.scale++;};
   return ()=>{};
  },
  set(target,key,val){target[key]=val;return true;}
 });
 return {c,stats};
}
test('all six towers use one seamless flat accessible deck and no bridge or island nodes',()=>{
 const g=boot(),A=g.ArenaTowerArchitecture;
 for(const realm of realms){
  const map=A.getMap(realm,10,500,500,99);
  assert.equal(map.surfaces.length,1,realm);
  assert.equal(map.surfaces[0].z,0,realm);
  assert.equal(map.surfaces[0].id,'flat-arena-floor');
  assert.equal(map.nav.length,1);
  assert.equal(map.obstacles.length,4,'only corner bumpers are solid');
  for(const pt of [[250,250],[75,250],[425,250],[250,75],[250,425]]){
   assert.equal(A.at(realm,10,pt[0],pt[1]).height,0);
   assert.equal(A.isWalkable(realm,pt[0],pt[1],500,500,10,10),true,
    realm+' continuous floor at '+pt);
  }
  assert.equal(A.heightAt(realm,10,250,250),0);
  assert.equal(A.nextWaypoint(realm,{x:80,y:220},{x:400,y:350}),null);
 }
});
test('all towers have colorful unique floor tiles and visible central thematic motifs',()=>{
 const g=boot(),A=g.ArenaTowerArchitecture;
 const backgrounds=new Set,glows=new Set;
 for(const realm of realms){
  const {c,stats}=canvasMock();
  assert.equal(A.paint(c,realm,5,500,500,134),true);
  assert.ok(stats.fill>8,realm+' colored filled arena shapes');
  assert.ok(stats.stroke>20,realm+' center + rail and bumper details');
  assert.ok(stats.gradients>=2,realm+' dynamic glowing gradients');
  assert.equal(stats.scale,1);
  backgrounds.add(A.style[realm].floor);glows.add(A.style[realm].glow);
 }
 assert.equal(backgrounds.size,6);
 assert.equal(glows.size,6);
});
test('outer edge rebounds with near-original velocity and refills momentum',()=>{
 const g=boot(),A=g.ArenaTowerArchitecture;
 for(const realm of realms){
  const p=actor(495,255,5,1.2);
  const before=Math.hypot(p.vx,p.vy);
  assert.equal(A.bounce(p,realm,500,500,3,0),true);
  assert.ok(p.vx<0,realm+' reflects inward');
  assert.ok(Math.hypot(p.vx,p.vy)>before*.70,realm+' retains velocity');
  assert.ok(p.x<=474-p.radius+.1,realm+' remains inside border');
  assert.ok(p._pinballReboundHold>=9);
 }
 assert.ok(g.hits>=6,'real wall reflections recharge momentum');
});
test('four bumpers reflect instead of trapping the ball; center never obstructed',()=>{
 const g=boot(),A=g.ArenaTowerArchitecture;
 for(const realm of realms){
  const site=A.getMap(realm,3,500,500).obstacles[0];
  const p=actor(site.x,site.y-site.r-20+1,0,5);
  assert.equal(A.bounce(p,realm,500,500,3,0),true);
  assert.ok(p.vy<0,realm+' bumper reverses entry');
  assert.ok(Math.hypot(p.x-site.x,p.y-site.y)>=site.r+p.radius-.1);
  const middle=actor(250,250,3,1);
  assert.equal(A.bounce(middle,realm,500,500,3,0),false);
  assert.equal(middle.vx,3);
 }
});
test('tower physical layouts are different without splitting the navigable floor',()=>{
 const g=boot(),A=g.ArenaTowerArchitecture;
 const placements=new Set();
 for(const realm of realms){
  const map=A.getMap(realm,7,500,500,0);
  const signature=map.obstacles.map(o=>[o.x,o.y,o.r].join(':')).join('|')+
   ':'+map.rails.map(o=>[o.x1,o.y1,o.x2,o.y2].join(':')).join('|');
  placements.add(signature);
  assert.equal(map.rails.length,2,realm+' two short real rebound rails');
  for(const q of map.rails){
   const p=actor((q.x1+q.x2)/2,(q.y1+q.y2)/2,2,1);
   assert.equal(A.bounce(p,realm,500,500,7,0),true);
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
  }
  assert.ok(A.clearance(realm,250,250,500,500,0,7)>38);
 }
 assert.equal(placements.size,6,'real collision arrangements must differ across all towers');
});
test('tower terrain on the new map never introduces height, cliff falls or cover',()=>{
 const g=boot(),T=g.ArenaTowerTerrain,hero=actor(250,250,1,.6);
 for(const realm of realms){
  T.step(realm,8,[hero],500,500,0);
  assert.equal(T.worldHeight(hero.x,hero.y),0);
  assert.equal(hero.towerGroundZ,0);
  assert.equal(hero.towerTerrainSpeed,1);
  assert.equal(T.obstructsShot(75,250,2,425,250,2),false);
  const previous=hero.hp;
  for(let n=1;n<500;n+=25){T.step(realm,8,[hero],500,500,n,()=>{hero.hp-=30;});T.sync([hero]);}
  assert.equal(hero.hp,previous,'no elevation-only damage in '+realm);
  assert.equal(hero._towerVoidFallPending,false);
 }
 T.clear([hero]);assert.equal(hero.towerGroundZ,undefined);
});
test('Tower script links flat module before terrain, uses symmetric face-off spawns',()=>{
 const html=read('index.html'),challenge=read('js/features/tower-challenge.js');
 assert.ok(html.includes('tower-flat-arena.js'));
 assert.ok(html.indexOf('tower-map-architecture.js')<html.indexOf('tower-flat-arena.js'));
 assert.ok(html.indexOf('tower-flat-arena.js')<html.indexOf('tower-terrain-25d.js'));
 assert.ok(challenge.includes('[[157,250],[343,250]]'));
 assert.ok(read('js/features/tower-terrain-25d.js').includes('g.ArenaTowerFlat?.enabled'));
 assert.ok(read('js/features/tower-environment.js').includes('function create('));
 assert.ok(read('js/features/tower-encounters.js').includes('create('));
});

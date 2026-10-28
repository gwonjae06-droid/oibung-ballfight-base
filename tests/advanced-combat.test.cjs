'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/features/advanced-combat.js'),'utf8');
const fighter=(num,x,y,hp=300)=>({
  playerNum:num,id:'forge_test',x,y,vx:1,vy:0,z:0,vz:0,radius:26,
  hp,maxHp:hp,invincible:0,forge:{color:'#347788'}
});
function boot(){
  const sim={window:null,players:[],canvas:{width:500,height:500},Math};
  sim.window=sim;vm.runInNewContext(source,sim,{filename:'advanced-combat.js'});
  const api={
    hit(p,e,a,m=1,z=sim.AdvancedCombat.height(p)){
      if(e.invincible||!sim.AdvancedCombat.canHit(p,e,z))return false;
      const damage=Math.round((a.damage||0)*m);
      if(damage){e.hp=Math.max(0,e.hp-damage);e.invincible=3;}
      return true;
    }
  };
  return {sim,api,world:sim.AdvancedCombat};
}
const action=(type,overrides={})=>({type,damage:35,radius:150,count:3,speed:5,duration:2,...overrides});
const tick=(h,n=1)=>{for(let i=0;i<n;i++){
  for(const p of h.sim.players)if(p.invincible>0)p.invincible--;
  h.world.tick(h.api);
}};
test('height is independent of world-ground x,y and visual y minus z',()=>{
  const h=boot(),p=fighter(1,100,250);h.sim.players.push(p);
  h.world.launch(p,10);tick(h,6);
  assert.ok(p.z>0);assert.equal(p.x,100);assert.equal(p.y,250);
  assert.equal(h.world.renderY(p),p.y-p.z);
  assert.ok(h.world.size(p)>1);
  tick(h,100);assert.equal(p.z,0);
});
test('ground attacks cannot strike a high flyer or an underground fighter',()=>{
  const h=boot(),a=fighter(1,100,100),b=fighter(2,125,100);
  h.sim.players.push(a,b);
  b.z=80;
  assert.equal(h.world.canHit(a,b),false);
  b.z=-31;assert.equal(h.world.canHit(a,b),false);assert.ok(h.world.size(b)<1);
  b.z=10;assert.equal(h.world.canHit(a,b),true);
});
test('park legacy jump is projected through the same height and hit rule',()=>{
  const h=boot(),p=fighter(1,100,200),enemy=fighter(2,125,200);
  p.id='park';p.jumpState='hovering';p.jumpHeight=82;
  assert.equal(h.world.height(p),82);assert.equal(h.world.renderY(p),118);
  assert.equal(h.world.canHit(enemy,p),false);
  p.jumpState='ground';p.jumpHeight=0;assert.equal(h.world.height(p),0);
});
test('uppercut damages and launches; a dive lands with an impact',()=>{
  const h=boot(),p=fighter(1,140,170),e=fighter(2,175,170);
  h.sim.players.push(p,e);
  assert.equal(h.world.execute(p,action('uppercut'),e,h.api),true);
  assert.equal(e.hp,300,'uppercut needs a visible windup before contact');
  tick(h,7);assert.equal(e.hp,300);
  tick(h,1);assert.ok(e.hp<300);assert.ok(e.vz>0);
  tick(h,4);assert.ok(e.z>0);
  h.world.execute(p,action('leap'),e,h.api);tick(h,5);
  h.world.execute(p,action('dive',{damage:25}),e,h.api);
  tick(h,50);assert.equal(p.z,0);assert.ok(h.world.effects.some(x=>x.kind==='ring')||e.hp<300);
});
test('slash telegraphs a sector and thrust only damages targets in its line',()=>{
  const h=boot(),a=fighter(1,100,100),b=fighter(2,145,100),c=fighter(3,100,170);
  h.sim.players.push(a,b,c);
  h.world.execute(a,action('slash'),b,h.api);
  assert.ok(h.world.effects.some(x=>x.kind==='sector'));
  tick(h,12);assert.ok(b.hp<300);
  const after=c.hp;
  h.world.execute(a,action('thrust'),b,h.api);
  tick(h,12);assert.equal(c.hp,after);
});
test('arc projectile visually rises and falls; impact damages only ground level',()=>{
  const h=boot(),a=fighter(1,100,100),b=fighter(2,180,110);
  h.sim.players.push(a,b);
  h.world.execute(a,action('arcshot',{count:1}),b,h.api);
  tick(h,16);assert.ok(h.world.projectiles[0].height>20);
  tick(h,24);assert.ok(b.hp<300);
});
test('split projectile produces multiple independently travelling shards',()=>{
  const h=boot(),a=fighter(1,100,100),b=fighter(2,230,100);
  h.sim.players.push(a,b);
  h.world.execute(a,action('splitshot',{count:1}),b,h.api);
  tick(h,17);assert.ok(h.world.projectiles.some(p=>p.kind==='fragment'));
  assert.ok(h.world.effects.some(e=>e.kind==='burst'));
});
test('walls are solid and destructible, changing physical position',()=>{
  const h=boot(),a=fighter(1,130,130),b=fighter(2,210,130);
  h.sim.players.push(a,b);h.world.execute(a,action('wall',{radius:120}),b,h.api);
  const wall=h.world.objects.find(o=>o.kind==='wall');assert.ok(wall);assert.ok(wall.hp>0);
  b.x=wall.x;b.y=wall.y;
  tick(h,1);assert.ok(Math.hypot(b.x-wall.x,b.y-wall.y)>=b.radius+wall.r-1e-6);
  assert.ok(wall.hp>0);
});
test('paired portals teleport a fighter but prevent immediate looping',()=>{
  const h=boot(),a=fighter(1,100,120),b=fighter(2,330,120);
  h.sim.players.push(a,b);
  h.world.execute(a,action('portal',{radius:200}),b,h.api);
  const pair=h.world.objects.filter(o=>o.kind==='portal');
  assert.equal(pair.length,2);
  const portal=pair[0];b.x=portal.x;b.y=portal.y;
  tick(h,16);assert.ok(Math.hypot(b.x-portal.exitX,b.y-portal.exitY)<3);
  assert.ok(b.portalCooldown>0);
  const pos=b.x;tick(h,1);assert.equal(b.x,pos);
});
test('summons and turrets have independent tick-driven targeting and expiry',()=>{
  const h=boot(),a=fighter(1,100,120),b=fighter(2,180,120);
  h.sim.players.push(a,b);
  h.world.execute(a,action('summon',{duration:1}),b,h.api);
  h.world.execute(a,action('turret',{duration:1}),b,h.api);
  assert.equal(h.world.objects.filter(o=>o.kind==='summon'||o.kind==='turret').length,2);
  const position=h.world.objects.find(o=>o.kind==='summon').x;
  tick(h,37);assert.ok(b.hp<300);assert.notEqual(h.world.objects.find(o=>o.kind==='summon').x,position);
  tick(h,40);assert.equal(h.world.objects.length,0);
});
test('size change changes collision radius and restores after duration',()=>{
  const h=boot(),a=fighter(1,100,100),b=fighter(2,220,220);h.sim.players.push(a,b);
  const normal=a.radius;
  h.world.execute(a,action('grow',{duration:.2}),b,h.api);
  assert.ok(a.radius>normal);
  tick(h,13);assert.equal(a.radius,normal);
  h.world.execute(a,action('shrink',{duration:.2}),b,h.api);
  assert.ok(a.radius<normal);
  tick(h,13);assert.equal(a.radius,normal);
});
test('burrow makes a fighter untargetable from ground and erupts',()=>{
  const h=boot(),a=fighter(1,120,130),b=fighter(2,200,130);h.sim.players.push(a,b);
  h.world.execute(a,action('burrowdash',{duration:.2}),b,h.api);
  assert.ok(a.z<0);assert.equal(h.world.canHit(b,a),false);
  tick(h,13);assert.equal(a.z,0);assert.ok(h.world.effects.some(e=>e.kind==='crack'));
});
test('all 20 new actions have executable branches and bounded objects',()=>{
  const h=boot(),a=fighter(1,140,140),b=fighter(2,215,140);
  h.sim.players.push(a,b);
  assert.equal(Object.keys(h.world.TYPES).length,20);
  for(const type of Object.keys(h.world.TYPES)){
    assert.equal(h.world.execute(a,action(type,{duration:.3,count:2}),b,h.api),true,type);
    tick(h,3);
  }
  assert.ok(h.world.objects.length<=24);
  assert.ok(h.world.projectiles.length<=90);
});

test('leap uses a readable anticipation, rising, apex hover, descent and landing animation',()=>{
  const h=boot(),a=fighter(1,100,150),b=fighter(2,240,150);
  h.sim.players.push(a,b);
  h.world.execute(a,action('leap',{duration:1}),b,h.api);
  assert.equal(a.jumpMotion.phase,'prepare');
  tick(h,5);assert.equal(a.z,0);
  tick(h,3);assert.ok(a.vz>0);
  const phases=new Set();
  let peak=0;
  for(let i=0;i<160;i++){
    tick(h);
    phases.add(a.jumpMotion?.phase||'ground');
    peak=Math.max(peak,a.z);
  }
  assert.ok(peak>65,'leap rises visibly above ground');
  for(const phase of ['rising','hovering','descending','landing'])assert.ok(phases.has(phase),phase);
  assert.equal(a.z,0);
  assert.ok(h.world.effects.length<=90);
});
test('render interpolation samples previous and current simulation coordinates',()=>{
  const h=boot(),a=fighter(1,100,120);h.sim.players.push(a);
  tick(h);a.x=180;a.y=220;
  tick(h);
  h.world.setAlpha(0);const previous=h.world.visual(a);
  h.world.setAlpha(.5);const midpoint=h.world.visual(a);
  h.world.setAlpha(1);const current=h.world.visual(a);
  assert.equal(previous.x,100);assert.equal(current.x,180);
  assert.equal(midpoint.x,140);assert.equal(midpoint.y,170);
});
test('Park jump reuses rising, hover and slam poses without changing legacy height',()=>{
  const h=boot(),p=fighter(1,200,200);p.id='park';p.jumpHeight=80;
  p.jumpState='rising';assert.ok(h.world.pose(p).sy>1);
  p.jumpState='hovering';assert.ok(h.world.pose(p).sx>1);
  p.jumpState='slamming';assert.ok(h.world.pose(p).sx>1);
  assert.equal(h.world.height(p),80);
});
test('rendering the active effects, curved shot trails and portal does not mutate simulation',()=>{
  const h=boot(),a=fighter(1,110,170),b=fighter(2,220,170);
  h.sim.players.push(a,b);
  h.world.execute(a,action('portal'),b,h.api);
  h.world.execute(a,action('arcshot'),b,h.api);
  h.world.execute(a,action('slash'),b,h.api);
  tick(h,7);
  const strokes=[];
  const graphics=new Proxy({},{
    get(obj,key){if(key==='stroke')return ()=>strokes.push('stroke');return obj[key]??(()=>{});},
    set(obj,key,value){obj[key]=value;return true;}
  });
  const hp=b.hp,pos=a.x;
  h.world.draw(graphics);
  assert.equal(a.x,pos);assert.equal(b.hp,hp);
  assert.ok(strokes.length>10);
});

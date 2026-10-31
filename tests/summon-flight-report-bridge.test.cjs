'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=p=>fs.readFileSync(p,'utf8');
function advanced(){
 const w={Math,Number,Set,Map,console,players:[],canvas:{width:500,height:500}};w.globalThis=w;w.window=w;
 vm.createContext(w);vm.runInContext(source('js/features/advanced-combat.js'),w);
 return w;
}
const fighter=(n,x=100,y=150)=>({id:'forge_test',playerNum:n,x,y,vx:0,vy:0,z:0,vz:0,radius:25,hp:300,maxHp:300,invincible:0,forge:{color:'#abc'}});
test('hostile summons take HP damage, preserve timer, and despawn at HP zero',()=>{
 const w=advanced(),a=fighter(1),b=fighter(2);w.players.push(a,b);
 w.AdvancedCombat.execute(b,{type:'summon',damage:24,speed:4,radius:160,duration:3},a,{});
 const obj=w.AdvancedCombat.objects.find(o=>o.kind==='summon');
 assert.ok(obj&&obj.isConstruct&&obj.maxHp>0);
 assert.equal(obj.life,180,'original authored lifetime must not change');
 const hp=obj.hp;const hit=w.AdvancedCombat.blockSegment(obj.x-32,obj.y,obj.x+32,obj.y,15,obj.floorZ,1);
 assert.ok(hit);assert.equal(obj.hp,hp-15);
 assert.equal(obj.life,180,'damage does not secretly reduce summon lifetime');
 const friendly=w.AdvancedCombat.blockSegment(obj.x-32,obj.y,obj.x+32,obj.y,10,obj.floorZ,2);
 assert.equal(friendly,null,'owners cannot shoot their own summons');
 w.AdvancedCombat.blockSegment(obj.x-32,obj.y,obj.x+32,obj.y,200,obj.floorZ,1);
 assert.equal(obj.hp,0);
 w.AdvancedCombat.tick({hit(){return false;}});
 assert.ok(!w.AdvancedCombat.objects.includes(obj));
});
test('tower sky allows flight over missing ground, then falls and takes realm hazard',()=>{
 const w={Math,Number,Set,Map,console};w.globalThis=w;w.window=w;
 vm.createContext(w);vm.runInContext(source('js/features/tower-map-architecture.js'),w);
 vm.runInContext(source('js/features/tower-terrain-25d.js'),w);
 const T=w.ArenaTowerTerrain,p={x:240,y:375,radius:22,z:45,vz:0,vx:0,vy:0,hp:200,maxHp:200,towerHero:true};
 T.step('fire',6,[p],500,500,12,()=>{});T.sync([p]);
 // A rising fighter exits the walkable area without magic snapping it home.
 p.x=6;p.y=6;p.z=45;p.hoverTime=50;p.vz=0;
 const target={x:p.x,y:p.y};T.sync([p]);
 assert.equal(p.x,target.x);assert.equal(p.y,target.y);assert.equal(p._towerOverVoid,true);
 T.step('fire',6,[p],500,500,13,()=>{});
 assert.ok(p._towerOverVoid);
 p.z=0;p.hoverTime=0;const hits=[];T.sync([p]);
 T.step('fire',6,[p],500,500,14,(f,n,info)=>hits.push({n,info}));
 assert.equal(hits.length,1);assert.equal(hits[0].info.label,'용암 추락');
 T.clear([p]);assert.equal(p._towerOverVoid,undefined);
});
test('fire island path chooses a bridge endpoint rather than unsupported crater midpoint',()=>{
 const w={Math,Number,Set,Map,console};w.globalThis=w;w.window=w;
 vm.createContext(w);vm.runInContext(source('js/features/tower-map-architecture.js'),w);
 const A=w.ArenaTowerArchitecture;
 const sourcePos={x:95,y:230},destPos={x:395,y:230};
 const next=A.nextWaypoint('fire',sourcePos,destPos,500,500,7,20);
 assert.ok(next&&Number.isFinite(next.x)&&Number.isFinite(next.y),JSON.stringify(next));
 const dist=Math.hypot(next.x-sourcePos.x,next.y-sourcePos.y);
 assert.ok(dist>2&&dist<330,`bridge waypoint must be reachable: ${dist}`);
 assert.ok(Math.hypot(next.x-248,next.y-265)>15,'do not send melee to caldera centre as default');
});
test('battle report totals confirmed damage by authored skill, not guessed attacks',()=>{
 const parts=new Map();const panel={hidden:true,children:[],replaceChildren(){this.children=[]},append(el){this.children.push(el)}};
 parts.set('arena-defeat-analysis',panel);
 const w={console,window:null,document:{getElementById:id=>parts.get(id)||null,createElement:tag=>({tag,textContent:''})}};w.window=w;
 vm.createContext(w);vm.runInContext(source('js/features/battle-director.js'),w);
 const d=w.ArenaBattleDirector,a={name:'이권재',playerNum:1,hp:250,maxHp:250},b={name:'배서준',playerNum:2,hp:250,maxHp:250};
 d.reset([a,b]);const move={type:'wave'};
 d.skillUsed(a,b,move,'청룡 포효');d.skillHit(a,b,move,30,'freeze');d.skillHit(a,b,move,45,'none');
 d.legacyHit(b,a,12,'contact');b.hp=175;a.hp=238;d.observe([a,b]);b.hp=0;d.finish([a,b],a);
 const text=panel.children.map(x=>x.textContent).join(' ');
 assert.match(text,/청룡 포효: 75 피해 \/ 2회 유효타/);
 assert.match(text,/freeze 1회/);
 assert.match(text,/12/);assert.match(text,/확인된 기술 피해/);
});
test('five default fighters have optional portrait registration and unique identities',()=>{
 const code=source('js/photos.js');const w={CHARACTER_PHOTOS:{},Image:class{}};vm.createContext(w);
 vm.runInContext(code,w);
 const ids=['bae','lee','park','choi','oh'];
 assert.deepEqual(ids.sort(),Object.keys(vm.runInContext('CHAMPION_IDENTITY',w)).sort());
 assert.ok(ids.every(id=>vm.runInContext(`CHAMPION_IDENTITY['${id}'].intro`,w).length>10));
});

test('clearing a floor preserves per-skill analysis through the next floor preparation',()=>{
 const tower=source('js/features/tower-challenge.js');
 assert.match(tower,/const justFinished=global\.ArenaBattleDirector\?\.reportLines\?\.\(players\)/);
 assert.match(tower,/prepareFight\(\);\s*stage='between';\s*retainReport\(justFinished\)/);
 assert.match(tower,/tower-last-report/);
});

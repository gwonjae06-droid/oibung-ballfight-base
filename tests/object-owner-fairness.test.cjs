'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/features/advanced-combat.js','utf8');
const fighter=(id,x=120,y=120)=>({playerNum:id,id:'custom',x,y,vx:0,vy:0,z:0,vz:0,radius:25,hp:300,maxHp:300,invincible:0,forge:{color:'#abc123'}});
const action=(type,extra={})=>({type,damage:20,radius:180,count:1,speed:5,duration:8,...extra});
function setup(size=2){
 const world={players:[],canvas:{width:500,height:500},Math};world.window=world;world.globalThis=world;
 vm.runInNewContext(source,world,{filename:'advanced-combat.js'});
 for(let i=1;i<=size;i++)world.players.push(fighter(i,80+i*22,170+i*8));
 const api={hit(){return true;}};
 return {world,arena:world.AdvancedCombat,players:world.players,api};
}
const cast=(s,owner,type,extra={})=>s.arena.execute(owner,action(type,extra),s.players.find(p=>p!==owner),s.api);

test('spamming summons may replace the caster\'s summons, never an opponent\'s turret',()=>{
 const s=setup(),[a,b]=s.players;
 cast(s,a,'turret');
 const initial=s.arena.objects[0];
 for(let i=0;i<36;i++)cast(s,b,'summon');
 assert.ok(s.arena.objects.includes(initial),'other fighter turret survives saturation');
 assert.equal(s.arena.objects.filter(o=>o.owner===a.playerNum).length,1);
 assert.equal(s.arena.objects.filter(o=>o.owner===b.playerNum).length,12);
 assert.ok(s.arena.objects.length<=24);
});

test('the oldest owned item is retired first; enemy walls and paired portals are preserved',()=>{
 const s=setup(),[a,b]=s.players;
 cast(s,a,'wall');cast(s,a,'portal');
 const protectedItems=s.arena.objects.filter(o=>o.owner===a.playerNum);
 for(let i=0;i<20;i++)cast(s,b,'turret');
 for(const item of protectedItems)assert.ok(s.arena.objects.includes(item),'a rival may not erase a wall or portal');
 const original=s.arena.objects.find(o=>o.owner===b.playerNum);
 cast(s,b,'trap');
 assert.ok(!s.arena.objects.includes(original),'owner quota retires own oldest entry');
 assert.equal(s.arena.objects.filter(o=>o.owner===b.playerNum).length,12);
});

test('crowded 4-way and 10-way arenas reserve independent installation slots',()=>{
 for(const n of [4,10]){
  const s=setup(n),quota=Math.floor(24/n);
  const first=[];
  for(const p of s.players){cast(s,p,'turret');first.push(s.arena.objects.find(o=>o.owner===p.playerNum));}
  for(let round=0;round<quota+6;round++)for(const p of s.players)cast(s,p,'summon');
  for(const o of first)assert.ok(!s.arena.objects.includes(o),'owner\'s own oldest may expire');
  for(const p of s.players)assert.equal(s.arena.objects.filter(o=>o.owner===p.playerNum).length,quota);
  assert.equal(s.arena.objects.length,quota*n);
 }
});

test('repeated projectile barrages preserve the rival\'s existing bullets',()=>{
 const s=setup(),[a,b]=s.players;
 cast(s,a,'arcshot',{count:1});
 const first=s.arena.projectiles[0];
 for(let i=0;i<12;i++)cast(s,b,'arcshot',{count:8});
 assert.ok(s.arena.projectiles.includes(first),'opponent projectile survives barrage');
 assert.equal(s.arena.projectiles.filter(o=>o.owner===b.playerNum).length,45);
 assert.ok(s.arena.projectiles.length<=90);
});

test('global saturation with an unexpected new entrant refuses its item without erasing rivals',()=>{
 const s=setup(),[a,b]=s.players;
 for(let i=0;i<12;i++){cast(s,a,'turret');cast(s,b,'turret');}
 assert.equal(s.arena.objects.length,24);
 const prior=s.arena.objects.slice();
 const newcomer=fighter(3);s.players.push(newcomer);
 cast(s,newcomer,'summon');
 assert.equal(s.arena.objects.length,24);
 assert.ok(prior.every(o=>s.arena.objects.includes(o)));
 assert.equal(s.arena.objects.some(o=>o.owner===3),false);
});

test('object budgets clear on battle reset and stay within the original global limits',()=>{
 const s=setup(),[a,b]=s.players;
 for(let i=0;i<80;i++){cast(s,a,'melee',{radius:120});cast(s,b,'summon');}
 assert.ok(s.arena.objects.length<=24);
 s.arena.reset();
 assert.equal(s.arena.objects.length,0);assert.equal(s.arena.projectiles.length,0);
 cast(s,a,'summon');assert.equal(s.arena.objects.length,1);
});

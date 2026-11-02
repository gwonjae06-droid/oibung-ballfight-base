'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../js/features',name+'.js'),'utf8');
function boot(names){
 const w={Math,Date,Number,console,players:[],canvas:{width:500,height:500},
  SkillForge:{TYPE:{splitshot:'분열탄',shot:'탄환'}}};
 w.window=w;w.globalThis=w;vm.createContext(w);
 for(const name of names)vm.runInContext(read(name),w,{filename:name});
 return w;
}
function fighter(playerNum,x,y){
 return {id:'forge_test',playerNum,x,y,vx:1,vy:1,z:0,vz:0,
  radius:26,hp:600,maxHp:600,invincible:0,forge:{color:'#88bbee'}};
}
test('root splits at 56% of distance-scaled flight, and children use the same 360-degree geometry',()=>{
 const w=boot(['arena-splitshot-geometry','advanced-combat']),
  a=fighter(1,100,200),b=fighter(2,360,200);
 w.players.push(a,b);
 const action={type:'splitshot',damage:20,radius:150,count:5,speed:6,fractureDepth:3,duration:1.5};
 w.AdvancedCombat.execute(a,action,b,{hit(){return false;}});
 const orb=w.AdvancedCombat.projectiles.find(p=>p.kind==='splitshot');
 assert.ok(orb);
 assert.equal(orb.travel,w.ArenaSplitshotGeometry.rootTravel(a.x,a.y,b.x,b.y,action.speed));
 const splitAt=Math.ceil(orb.travel*w.ArenaSplitshotGeometry.SPLIT_PROGRESS);
 for(let i=0;i<splitAt-1;i++)w.AdvancedCombat.tick({hit(){return false;}});
 assert.equal(w.AdvancedCombat.projectiles.filter(p=>p.kind==='fragment').length,0);
 w.AdvancedCombat.tick({hit(){return false;}});
 const kids=w.AdvancedCombat.projectiles.filter(p=>p.kind==='fragment');
 assert.equal(kids.length,5);
 const expected=w.ArenaSplitshotGeometry.childEndpoints(orb.x,orb.y,150,5,500,500);
 for(let i=0;i<kids.length;i++){
  assert.ok(Math.abs(kids[i].tx-expected[i].x)<1e-6);
  assert.ok(Math.abs(kids[i].ty-expected[i].y)<1e-6);
  assert.equal(kids[i].travel,w.ArenaSplitshotGeometry.childTravel(6));
  assert.equal(kids[i].fractureRemaining,2);
 }
});
test('mini shot waits for the same fraction of flight and bursts radially, not in a forward cone',()=>{
 const w=boot(['arena-splitshot-geometry','signature-program','signature-scratch',
   'signature-rule-skill','signature-rule-live','studio-pinball-lab']);
 const action={type:'splitshot',damage:18,radius:150,count:5,speed:6,fractureDepth:3};
 const profile={name:'분열',signatureVersion:1,skills:[{name:'결정 폭주',
  actions:[action],ruleSet:{window:10,rules:[{when:'pulse',interval:4,fracture:3,action}]}}]};
 const lab=w.StudioPinballLab.make(profile);
 lab.fire();lab.advanceTo(350);
 assert.equal(lab.splitEvents,0,'old fixed 17-frame split must not remain');
 const parent=lab.splitProjectiles.find(p=>p.type==='splitshot');
 assert.ok(parent&&parent.travel>=24);
 lab.advanceTo(1050);
 assert.ok(lab.splitEvents>=1);
 const burst=lab.splitHistory[0];
 assert.equal(burst.positions.length,5);
 const expected=w.ArenaSplitshotGeometry.childEndpoints(burst.x,burst.y,150,5,480,300);
 for(let i=0;i<5;i++){
  assert.ok(Math.abs(expected[i].x-burst.positions[i].x)<1e-8);
  assert.ok(Math.abs(expected[i].y-burst.positions[i].y)<1e-8);
 }
 assert.ok(burst.positions.some(p=>p.x>burst.x+30));
 assert.ok(burst.positions.some(p=>p.x<burst.x-30));
 assert.ok(burst.positions.some(p=>p.y>burst.y+30));
 assert.ok(burst.positions.some(p=>p.y<burst.y-30));
 assert.ok(lab.projectiles<=45,'mini obeys live caster projectile budget');
});
test('preview split event triggers subsequent authored rules with finite running action budget',()=>{
 const w=boot(['arena-splitshot-geometry','signature-program','signature-scratch',
   'signature-rule-skill','signature-rule-live','studio-pinball-lab']);
 const profile={name:'연쇄',signatureVersion:1,skills:[{
  name:'연쇄',actions:[{type:'splitshot',damage:15,count:5}],
  ruleSet:{window:10,rules:[
   {when:'pulse',interval:1.3,fracture:3,action:{type:'splitshot',damage:15,count:5,radius:160,speed:6}},
   {when:'split',interval:.8,action:{type:'shot',damage:6,count:3,speed:6}}
  ]}}]};
 const lab=w.StudioPinballLab.make(profile);
 lab.fire();lab.advanceTo(7500);
 assert.ok(lab.splitEvents>0);
 assert.ok(lab.ruleActions>6);
 assert.ok(lab.ruleActions<=w.SignatureRuleLive.MAX_ACTIONS);
 assert.ok(lab.projectiles<=45);
});

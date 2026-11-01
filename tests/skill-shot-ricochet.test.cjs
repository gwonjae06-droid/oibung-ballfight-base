'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
 const g={console,Math,Date,Map,Set,WeakMap,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
 canvas:{width:500,height:500},addFloatingText(){},createHitParticles(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/signature-program.js',
  'js/features/signature-scratch.js','js/features/signature-live.js','js/features/skill-forge.js']){
   vm.runInContext(read(file),g,{filename:file});
 }
 return g;
}
function actor(g,ricochet=2){
 const p={playerNum:1,hp:240,maxHp:240,x:100,y:100,vx:0,vy:0,radius:22,
 forge:{speed:2,signatureVersion:1,effectColor:'#9b91db',color:'#6767b0',skills:[]},
 forgeShots:[],forgeZones:[],forgeOrbs:[],forgeQueue:[],forgeTicks:[],forgeSerial:0};
 p.forgeShots.push({x:496,y:150,vx:7,vy:0,z:0,life:140,
  a:{type:'shot',ricochet,damage:16,speed:7,radius:130,status:'none'}});
 const foe={playerNum:2,hp:240,maxHp:240,x:200,y:420,radius:20};
 g.players=[p,foe];return {p,foe};
}
test('only the normal shot exposes up to 3 rebound options in both editors',()=>{
 const g=world();
 assert.equal(g.SkillForge.supportedParameter('shot','ricochet'),true);
 assert.equal(g.SkillForge.supportedParameter('dash','ricochet'),false);
 assert.equal(g.SkillForge.supportedParameter('wave','ricochet'),false);
 assert.match(read('js/features/block-forge.js'),/벽 반사 횟수/);
 assert.match(read('js/features/scratch-studio.js'),/벽 반사 횟수/);
});
test('old shots stay ordinary but authored ricochet shots reverse direction at real arena edge',()=>{
 const g=world();
 const free=actor(g,0);g.SkillForge.advanceWorld(free.p,free.foe);
 assert.equal(free.p.forgeShots.length,0,'ordinary shot exits the arena');
 const rebound=actor(g,2);g.SkillForge.advanceWorld(rebound.p,rebound.foe);
 assert.equal(rebound.p.forgeShots.length,1);
 assert.ok(rebound.p.forgeShots[0].vx<0,'velocity physically reflected');
 assert.equal(rebound.p.forgeShots[0]._reboundCount,1);
 assert.equal(rebound.p.hp,240);assert.equal(rebound.foe.hp,240);
});
test('shots never reflect beyond authored limit and do not create new passive attacks',()=>{
 const g=world(),{p,foe}=actor(g,1);
 g.SkillForge.advanceWorld(p,foe);
 assert.equal(p.forgeShots[0]._reboundCount,1);
 p.forgeShots[0].x=2;p.forgeShots[0].vx=-7;
 g.SkillForge.advanceWorld(p,foe);
 assert.ok(p.forgeShots.length===0||p.forgeShots[0]._reboundCount===1);
 assert.equal(foe.hp,240);
});
test('rebound count is validated, clamped and kept in real saved Scratch program',()=>{
 const g=world();
 let p=g.SkillForge.normalize({name:'벽 반사 코딩',signatureVersion:1,archetype:'legacy',skills:[{
  name:'내 스킬',trigger:'auto',actions:[{type:'shot',damage:19,ricochet:999}],
  program:[{kind:'action',action:{type:'shot',damage:19,ricochet:999}}]}]});
 assert.equal(p.skills[0].actions[0].ricochet,3);
 assert.equal(p.skills[0].program[0].action.ricochet,3);
 assert.equal(g.SignatureScratch.safeAction({type:'wave',ricochet:3}).ricochet,0);
 assert.equal(g.SignatureScratch.safeAction({type:'shot',ricochet:-30}).ricochet,0);
});
test('pinball lab previews exactly the same reflected-shot setting',()=>{
 const src=read('js/features/studio-pinball-lab.js');
 assert.match(src,/maxRebounds:a\.type==='shot'\?/);
 assert.match(src,/b\.reflects>b\.maxRebounds/);
 assert.match(read('js/features/skill-forge.js'),/const maxRebounds=b\.a\?\.type==='shot'/);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const load=(w,p)=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',p),'utf8'),w,{filename:p});
function world(){
 let now=1000;
 const w={Math,Date,console,performance:{now:()=>now},
  canvas:{width:500,height:500},players:[]};
 w.window=w;w.globalThis=w;vm.createContext(w);
 for(const p of ['js/features/arena-countdown.js','js/features/arena-telegraph.js',
  'js/features/arena-auto-ai.js','js/features/arena-pinball-motion.js'])load(w,p);
 return {w,advance:t=>{now=t;return w.ArenaCountdown.tick(t);}};
}
test('tower countdown finishes and first pinball AI hazard tick does not crash on absent opponent',()=>{
 const {w,advance}=world(),p={id:'hero',towerHero:true,
  hp:200,maxHp:200,playerNum:1,x:105,y:120,vx:3,vy:0,radius:24};
 w.players=[p];w.ArenaAutoAI.setRoster(w.players);
 w.ArenaTower={active:true,encounter:{tick:1,zones:[
  {x:165,y:120,r:80,kind:'boss',shape:'circle',fire:2,end:45}
 ]}};
 w.ArenaCountdown.start(null,1000);
 assert.equal(advance(1700),true);
 assert.equal(advance(2800),true);
 assert.equal(advance(3900),false);
 assert.equal(w.ArenaCountdown.state.phase,'idle');
 assert.deepEqual(Array.from(w.ArenaTelegraph.preview(null)),[]);
 assert.doesNotThrow(()=>w.ArenaAutoAI.dodgePinball(p,3,0));
 assert.doesNotThrow(()=>w.ArenaPinballMotion.end(p,w.ArenaPinballMotion.begin(p)));
});
test('tower hazard AI sees enemy telegraph and keeps working without enemy',()=>{
 const {w}=world();
 const hero={hp:100,towerHero:true,maxHp:100,playerNum:1,x:140,y:140,vx:3,vy:1,radius:24};
 const foe={hp:100,playerNum:2,x:220,y:140,vx:-3,vy:0,radius:24,
   forgeQueue:[{remaining:3,windup:14,castId:1,targetNum:1,
     a:{type:'bolt',radius:120}}]};
 w.ArenaTower={active:true,encounter:{tick:0,zones:[]}};
 w.ArenaAutoAI.setRoster([hero,foe]);
 assert.doesNotThrow(()=>w.ArenaAutoAI.dodgePinball(hero,3,0));
 w.ArenaAutoAI.setRoster([hero]);
 assert.doesNotThrow(()=>w.ArenaAutoAI.dodgePinball(hero,3,0));
});
test('live skill rules include defense, dodge, proximity and critical hp triggers',()=>{
 const w={Math,Date,console,SkillForge:{TYPE:{shield:'보호막',wave:'충격파',dash:'돌진'}}};
 w.window=w;w.globalThis=w;vm.createContext(w);
 for(const p of ['js/features/signature-program.js','js/features/signature-scratch.js',
 'js/features/signature-rule-skill.js','js/features/signature-rule-live.js'])load(w,p);
 const hero={hp:120,maxHp:200,x:50,y:50,forge:{signatureVersion:1},
   _forgeDodgeSerial:0,_scratchEvents:{guard:{count:0}}};
 const foe={hp:100,x:120,y:50};
 const cfg={window:7,rules:[
  {when:'guard',interval:.35,action:{type:'shield'}},
  {when:'dodge',interval:.35,action:{type:'dash'}},
  {when:'hpLow',interval:.35,action:{type:'wave',damage:15}},
  {when:'near',interval:.35,action:{type:'wave',damage:15}}
 ]};
 const run=w.SignatureRuleLive.begin(cfg,hero);
 assert.equal(w.SignatureRuleLive.step(run,hero,foe)?.type,'wave');
 hero._forgeDodgeSerial=1;
 assert.equal(w.SignatureRuleLive.step(run,hero,foe)?.type,'dash');
 hero._scratchEvents.guard={count:1};
 assert.equal(w.SignatureRuleLive.step(run,hero,foe)?.type,'shield');
 hero.hp=45;
 assert.equal(w.SignatureRuleLive.step(run,hero,foe)?.type,'wave');
});
test('free prompt compiler recognizes newly registered actions and status/target modifiers',()=>{
 const w={Math,Date,console,
  SkillForge:{TYPE:{wave:'충격파',shot:'탄환',orbit:'회전 구체',portal:'포탈',shield:'보호막'}},
  NaturalForge:{recognize:raw=>raw.includes('회전 구체')?[{type:'orbit'}]:[]}};
 w.window=w;w.globalThis=w;vm.createContext(w);
 for(const p of ['js/features/signature-program.js','js/features/signature-scratch.js',
  'js/features/signature-rule-skill.js','js/features/signature-prompt-compiler.js'])load(w,p);
 const a=w.SignaturePromptCompiler.parse('회전 구체를 만들고 적을 중독시켜');
 assert.equal(a.ok,true);
 assert.ok(a.recipe.rules.some(r=>r.action.type==='orbit'&&r.action.status==='poison'));
 const b=w.SignaturePromptCompiler.parse('체력이 낮으면 충격파로 가장 먼 적을 공격해');
 assert.equal(b.ok,true);
 assert.ok(b.recipe.rules.some(r=>r.when==='hpLow'));
});
test('main animation loop reschedules even if an arena update throws',()=>{
 const script=fs.readFileSync(path.join(__dirname,'../js/features/battle-effects.js'),'utf8');
 assert.match(script,/gameLoop=function\(time\)\{\s*try\{/);
 assert.match(script,/\}finally\{\s*\/\/ Even when the render\/update throws/);
 assert.match(script,/ArenaCountdown\?\.cancel\?\.\(\)/);
 assert.match(script,/requestAnimationFrame\(gameLoop\);\s*\}\s*\};/);
});

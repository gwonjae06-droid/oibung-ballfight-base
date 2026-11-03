'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=name=>fs.readFileSync('js/features/'+name+'.js','utf8');
function boot(){
 const w={window:null,globalThis:null,Math,Number,Set,Map,WeakMap,Date,console,
  players:[],CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{},
  canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
  getClosestAliveEnemy(p){return w.players.find(v=>v!==p&&v.hp>0)||null;}};
 w.window=w;w.globalThis=w;vm.createContext(w);
 for(const name of ['action-registry','semantic-physics','signature-program','signature-scratch',
 'fantasy-skill-graph','signature-rule-skill','skill-ir','signature-rule-live',
 'arena-balance-formula','arena-balance','bounce-momentum','skill-forge-impact',
 'skill-forge-casting','skill-forge-world','skill-forge-profiles','skill-forge-storage',
 'skill-forge-executor','skill-forge','block-forge'])
  vm.runInContext(read(name),w,{filename:name+'.js'});
 return w;
}
const single=(i,damage=20)=>({name:'능력 '+i,trigger:'auto',cooldown:3,actions:[
 {type:i%3===0?'wave':i%3===1?'tether':'repulse',damage,radius:120,knockback:1,
  speed:5,duration:1.5,status:'none'}]});
test('signature and ordinary custom profiles preserve one hundred independent skills through normalization',()=>{
 const w=boot(),skills=Array.from({length:100},(_,i)=>single(i));
 for(const signatureVersion of [0,1]){
  const p=w.SkillForge.normalize({name:'스킬 백과',signatureVersion,skills});
  assert.equal(p.skills.length,100);
  assert.equal(w.SkillForge.normalize(p).skills.length,100);
  assert.equal(p.skills[97].name,'능력 97');
  assert.equal(p.skills[0].actions.length,1);
 }
 const tower=w.SkillForge.normalize({name:'탑',skills},{towerEnemy:true});
 assert.equal(tower.skills.length,6,'NPC authored tower roster remains bounded');
});
test('independent skills can be added, separated and removed past former four-slot cap',()=>{
 const w=boot();
 let p=w.SkillForge.normalize({name:'연구',signatureVersion:1,skills:[single(0)]});
 for(let i=0;i<65;i++)p=w.BlockForge.modify(p,{kind:'new-skill',type:'tether'});
 assert.equal(p.skills.length,66);
 p=w.BlockForge.modify(p,{kind:'add',skill:0,type:'shot'});
 p=w.BlockForge.modify(p,{kind:'split',skill:0,index:1});
 assert.equal(p.skills.length,67);
 assert.equal(p.skills[1].actions[0].type,'shot');
 p=w.BlockForge.modify(p,{kind:'remove-skill',skill:35});
 assert.equal(p.skills.length,66);
});
test('Skill IR describes bounded executable physics and lowers to the same validated recipe',()=>{
 const w=boot(),raw={window:12,rules:[{
  when:'wall',interval:.4,action:{type:'tether',damage:26,radius:150,knockback:2}
 },{
  when:'pulse',interval:1.5,action:{type:'repulse',damage:32,radius:180}
 }]};
 const normalized=w.SignatureRuleSkill.normalize(raw);
 const ir=w.SkillIR.fromRecipe(raw);
 assert.equal(ir.version,1);
 assert.equal(ir.events[0].physics[0].op,'select-target');
 assert.ok(ir.events[1].physics.some(x=>x.op==='radial-impulse'));
 const recipe=w.SkillIR.toRecipe({...ir,events:ir.events.map(x=>({...x,
  physics:[{op:'arbitrary-js',source:'untrusted'}]}))});
 assert.equal(JSON.stringify(recipe),JSON.stringify(normalized));
 const saved=w.SkillForge.normalize({name:'설계도',signatureVersion:1,skills:[{
  ...single(0),ruleSet:recipe,ir,promptText:'상대를 사슬로 끌어당긴다'}]});
 assert.equal(saved.skills[0].ir.events[0].physics[0].op,'select-target');
 assert.equal(w.SkillForge.normalize(saved).skills[0].promptText,'상대를 사슬로 끌어당긴다');
});
test('energy rotation counts all spells but balances their average output, including custom physics',()=>{
 const w=boot(),s=w.ArenaBalance;
 const attacks=Array.from({length:45},(_,i)=>single(i,95));
 const p={signatureVersion:1,skills:attacks},copy=JSON.stringify(p);
 const report=s.summary(p,true);
 assert.equal(report.perSkill.length,45);
 assert.equal(JSON.stringify(p),copy,'do not overwrite authored damage');
 assert.ok(report.pressure>0&&Number.isFinite(report.multiplier));
 const veryStrong={signatureVersion:1,skills:attacks.map((x,i)=>({
  ...x,ruleSet:{window:18,rules:[{when:'pulse',interval:.35,
   action:{...x.actions[0],type:'vortex',damage:120,duration:8,radius:300}}]}
 }))};
 assert.ok(s.summary(veryStrong,true).multiplier<report.multiplier,
  'sustained overlapping high-power abilities must be softened');
});
test('one momentum payment rotates skill slots and distinct sentence rules retain their identity',()=>{
 const w=boot();
 const rules=w.SignatureRuleSkill.normalize({window:5,rules:[
  {when:'pulse',interval:2,action:{type:'wave',damage:18,radius:120}}]});
 const profile=w.SkillForge.normalize({name:'연쇄',signatureVersion:1,
  skills:Array.from({length:12},(_,i)=>({...single(i),ruleSet:rules}))});
 const id=w.SkillForge.register(profile);
 const p=w.CUSTOM_DEFS.find(x=>x.id===id).createInstance(1);
 const foe={playerNum:2,hp:500,maxHp:500,x:210,y:200,radius:24,vx:0,vy:0,invincible:0};
 p.x=120;p.y=200;w.players.push(p,foe);
 p._bounceMomentum=100;
 w.SkillForge.autoUpdate(p,foe);
 assert.equal(p._bounceMomentum,0);
 assert.equal(p._playerEnergyCursor,1);
 assert.equal(p.forgeRuleRuns.length,1);
 assert.equal(p.forgeRuleRuns[0].index,0);
 // A separate earned gauge payment can activate the next rule without
 // changing the prior rule's clock or replacing the prior cast.
 p._bounceMomentum=100;
 w.SkillForge.autoUpdate(p,foe);
 assert.equal(p._playerEnergyCursor,2);
 assert.ok(p.forgeRuleRuns.some(x=>x.index===0));
 assert.ok(p.forgeRuleRuns.some(x=>x.index===1));
 assert.ok(p.forgeQueue.every(q=>q.skillIndex<12));
});
test('entrypoint scripts load IR before normalized profiles in both local and PvP runtimes',()=>{
 for(const path of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(path,'utf8');
  assert.ok(html.includes('skill-ir.js?v=1-momentum-loadouts'),path);
  assert.ok(html.indexOf('signature-rule-skill.js')<html.indexOf('skill-ir.js'));
  assert.ok(html.indexOf('skill-ir.js')<html.indexOf('skill-forge-profiles.js'));
 }
});

test('sentence studio adds distinct skills and preserves edit/delete/IR on the same draft',()=>{
 const w=boot(),handlers={},messages=[];
 let typed='적을 사슬로 끌어당긴다';
 const panel={innerHTML:'',classList:{add(){}},closest(){return null},
   addEventListener(type,fn){handlers[type]=fn;},
   querySelector(sel){
     if(sel==='#rule-prompt')return {value:typed,focus(){}};
     if(sel==='#rule-name')return {value:'탄성 속박'};
     if(sel==='#rule-feedback')return {set textContent(v){messages.push(v);}};
     return null;
   }};
 let previews=0,selected=null;
 w.document={querySelector:sel=>sel==='#scratch-beginner'?panel:null,
  getElementById:()=>({click(){previews++;}})};
 w.CharacterStudioWorkspace={refresh(){},selectPreviewSkill(i){selected=i;}};
 w.addEventListener=(type,fn)=>{handlers[type]=fn;};
 w.confirm=()=>true;
 vm.runInContext(read('signature-rule-studio'),w,{filename:'signature-rule-studio.js'});
 const proposal={ok:true,name:'속박 기술',sourceText:typed,
  recipe:w.SignatureRuleSkill.normalize({window:5,rules:[{
   when:'pulse',interval:1.2,action:{type:'tether',damage:20,radius:140}
  }]})};
 for(let i=0;i<14;i++){
  assert.equal(w.SignatureRuleStudio.apply(proposal),true);
  assert.ok(selected!==null);
 }
 const many=w.SkillForge.getDraft();
 assert.ok(many.skills.length>=14,'skills are added, not overwritten');
 assert.ok(many.skills.every(s=>s.ruleSet),'all new slots retain executable rules');
 assert.ok(many.skills.every(s=>s.ir?.version===1),'each sentence has a trusted Skill IR');
 assert.ok(panel.innerHTML.includes('개수 제한 없음'));
 function click(q,record){
  handlers.click({target:{closest:sel=>sel===q?record:null}});
 }
 click('[data-rule-skill-index]',{dataset:{ruleSkillIndex:'1'}});
 assert.ok(panel.innerHTML.includes('선택한 스킬'));
 click('[data-rule-command]',{dataset:{ruleCommand:'delete'}});
 assert.equal(w.SkillForge.getDraft().skills.length,many.skills.length-1);
 click('[data-rule-command]',{dataset:{ruleCommand:'new'}});
 assert.ok(panel.innerHTML.includes('새 스킬을 구상 중'));
 assert.ok(previews>=14);
});

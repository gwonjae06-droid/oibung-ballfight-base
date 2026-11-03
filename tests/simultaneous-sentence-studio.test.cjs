'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=f=>fs.readFileSync('js/features/'+f+'.js','utf8');
function world(files){
 const g={Math,Date,Number,Set,Map,WeakMap,console,players:[],CUSTOM_DEFS:[],
 BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:500,height:500},
 createHitParticles(){},addFloatingText(){},
 getClosestAliveEnemy(p){return g.players.find(v=>v!==p&&v.hp>0)||null;}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of files)vm.runInContext(src(file),g,{filename:file+'.js'});
 return g;
}
const scripts=['action-registry','semantic-physics','signature-program',
 'signature-scratch','fantasy-skill-graph','signature-rule-skill','skill-ir','signature-rule-live',
 'arena-balance-formula','arena-balance','bounce-momentum','skill-forge-impact',
 'skill-forge-casting','skill-forge-world','skill-forge-profiles',
 'skill-forge-storage','skill-forge-executor','skill-forge'];
const shot=(i)=>({name:'기술 '+i,trigger:'auto',cooldown:2,
 actions:[{type:'wave',damage:30,radius:180,status:'none',duration:1,knockback:0}]});
test('one 100-point momentum payment activates every independent player skill',()=>{
 const g=world(scripts);
 const profile={name:'합동 기술',signatureVersion:1,skills:Array.from({length:12},(_,i)=>shot(i))};
 const id=g.SkillForge.register(profile),hero=g.CUSTOM_DEFS.find(x=>x.id===id).createInstance(1);
 const foe={playerNum:2,hp:900,maxHp:900,x:180,y:150,radius:25,vx:0,vy:0,invincible:0};
 hero.x=100;hero.y=150;hero._bounceMomentum=100;g.players.push(hero,foe);
 g.SkillForge.autoUpdate(hero,foe);
 assert.equal(hero._bounceMomentum,0,'energy is spent once');
 assert.equal(hero._forgeBurstSkills,12,'all slots activated in one burst');
 assert.equal(hero.forgeSerial,12,'every slot has independent cast ID');
 assert.ok(hero.forgeQueue.length<=12,'actions may execute on the same frame as the burst');
 assert.equal(hero._playerEnergyCursor,1,'one gauge event, not 12 energy payments');
});
test('hundred simultaneous skills retain their action queue instead of silently dropping older casts',()=>{
 const g=world(scripts);
 const id=g.SkillForge.register({name:'기술 100개',signatureVersion:1,
  skills:Array.from({length:100},(_,i)=>shot(i))});
 const hero=g.CUSTOM_DEFS.find(x=>x.id===id).createInstance(1);
 const foe={playerNum:2,hp:1500,maxHp:1500,x:300,y:200,radius:20,vx:0,vy:0};
 hero.x=100;hero.y=200;hero._bounceMomentum=100;g.players.push(hero,foe);
 g.SkillForge.autoUpdate(hero,foe);
 assert.equal(hero._forgeBurstSkills,100);
 assert.equal(hero.forgeQueue.length,82,'18 actions executed immediately, 82 retained for future frames');
});
test('combined burst efficiency is costed as sum, not averaged by skill slots',()=>{
 const g=world(['arena-balance-formula','arena-balance']);
 const one={signatureVersion:1,skills:[shot(0)]};
 const twenty={signatureVersion:1,skills:Array.from({length:20},(_,i)=>shot(i))};
 const a=g.ArenaBalance.summary(one,true),b=g.ArenaBalance.summary(twenty,true);
 assert.ok(b.pressure>a.pressure*15);
 assert.ok(b.multiplier<a.multiplier);
 const d=g.ArenaBalance.defenseSummary({signatureVersion:1,
  skills:Array.from({length:20},(_,i)=>({name:'보호',actions:[{type:'shield',duration:8}]}))},true);
 assert.ok(d.pressure>90&&d.multiplier<1);
});
function language(){
 return world(['action-registry','semantic-physics','signature-program','metaphor-visuals',
  'signature-scratch','fantasy-skill-graph','signature-rule-skill','skill-ir',
  'korean-skill-grammar','korean-skill-parameters','signature-prompt-compiler',
  'skill-sentence-engine']);
}
test('Korean grammar converts numeric fire-rate, damage, count, speed, radius, and duration into actual rules',()=>{
 const g=language();
 const text='투사체 6발을 속도 12로 발사하고 데미지 47, 공격 속도는 초당 2번, 범위 240, 지속시간 3초';
 const s=g.SkillSentenceEngine.parse(text);
 assert.equal(s.ok,true,s.error);
 const action=s.recipe.rules.find(r=>r.action.type==='shot');
 assert.ok(action,JSON.stringify(s.recipe));
 assert.equal(action.action.damage,47);
 assert.equal(action.action.count,6);
 assert.equal(action.action.speed,12);
 assert.equal(action.action.radius,240);
 assert.equal(action.action.duration,3);
 assert.equal(action.interval,.5);
});
test('Korean parameter limits are visible and malformed values do not create executable code',()=>{
 const g=language(),params=g.KoreanSkillParameters;
 const result=params.analyze('데미지 9999 투사체 80발 속도 200 초당 100번 공격 반경 900 넉백 30');
 assert.equal(result.values.damage,120);
 assert.equal(result.values.count,8);
 assert.equal(result.values.speed,14);
 assert.equal(result.values.radius,300);
 assert.equal(result.interval,.35);
 assert.ok(result.warnings.length>=4);
});
test('native Korean counts and attack rate are parsed without external APIs',()=>{
 const g=language(),p=g.KoreanSkillParameters.analyze('화살 다섯 발을 초당 두 번 발사한다');
 assert.equal(p.values.count,5);
 assert.equal(p.interval,.5);
 assert.equal(g.KoreanSkillParameters.analyze('독립 스킬').values.status,undefined);
});
test('same idea is merged, independent Korean sentences create separate skills',()=>{
 const g=language();
 const one=g.SkillSentenceEngine.parseBundle('거대한 턱으로 적을 후려치고 검은 레이저를 발사한다.');
 assert.equal(one.ok,true);
 assert.equal(one.skills.length,1);
 const many=g.SkillSentenceEngine.parseBundle(
  '번개를 발사한다. 적에게 충격파를 보낸다. 그리고 강한 파동을 일으킨다.');
 assert.equal(many.ok,true,many.error);
 assert.equal(many.skills.length,2);
});
test('preview starts multi-skill activation at the same energy threshold',()=>{
 const g=world(['signature-program','signature-scratch','signature-rule-skill','signature-rule-live','studio-pinball-lab']);
 const profile={signatureVersion:1,name:'시연',skills:Array.from({length:3},(_,i)=>shot(i))};
 const lab=g.StudioPinballLab.make(profile,'all');
 lab.fire();lab.advanceTo(300);
 assert.ok(lab.casts>=1);
 assert.match(src('studio-pinball-lab'),/for\(const skill of skills\)/);
});
test('sentence-only UI hides manual block creation but retains numerical edit surfaces',()=>{
 const ui=src('signature-rule-studio'),css=fs.readFileSync('css/sentence-only-studio.css','utf8');
 assert.match(ui,/data-tune-key/);
 assert.match(ui,/data-rule-command="appearance"/);
 assert.match(ui,/parseBundle/);
 assert.doesNotMatch(ui,/data-rule-command="new"/);
 assert.doesNotMatch(ui,/data-rule-command="delete"/);
 assert.match(css,/#studio-mode-compose > #studio-expert-panel/);
 for(const file of ['index.html','pvp-runtime.html']){
  const html=fs.readFileSync(file,'utf8');
  assert.ok(html.includes('skill-forge.js?v=simultaneous-sentence1'));
  assert.ok(html.includes('arena-balance-formula.js?v=concept-fusion1'));
 }
 assert.ok(fs.readFileSync('index.html','utf8').includes('korean-skill-parameters.js?v=1-korean-numeric'));
});

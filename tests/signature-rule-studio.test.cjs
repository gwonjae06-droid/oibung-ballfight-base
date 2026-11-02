'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=path=>fs.readFileSync(require('node:path').join(__dirname,'..',path),'utf8');
function boot(){
 const g={Math,Date,console,SkillForge:{TYPE:{splitshot:'분열탄',wave:'충격파',haste:'가속',leap:'점프',dive:'낙하',heal:'회복'}}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const p of ['js/features/signature-program.js','js/features/signature-scratch.js',
  'js/features/signature-rule-skill.js','js/features/signature-rule-live.js'])
  vm.runInContext(src(p),g,{filename:p});
 return g;
}
test('rules are normalized with safe bounded window, events and actions',()=>{
 const g=boot(),r=g.SignatureRuleSkill.normalize({window:999,
  rules:[{when:'__proto__',interval:0,fracture:50,action:{type:'splitshot',damage:999,count:100}}]});
 assert.equal(r.window,18);
 assert.equal(r.rules[0].when,'pulse');
 assert.equal(r.rules[0].interval,.35);
 assert.equal(r.rules[0].fracture,3);
 assert.equal(r.rules[0].action.damage,120);
 assert.equal(r.rules[0].action.count,8);
});
test('continuous timed attacks are finite and repeat without recursive JS',()=>{
 const g=boot(),p={hp:100,_forgeActionClock:0,_scratchEvents:{}},skill=g.SignatureRuleSkill.normalize({
  window:6,rules:[{when:'pulse',interval:.35,action:{type:'splitshot',damage:18,count:5},fracture:3}]});
 const state=g.SignatureRuleLive.begin(skill,p);let n=0;
 for(let t=0;t<440;t++){p._forgeActionClock++;if(g.SignatureRuleLive.step(state,p))n++;}
 assert.ok(n>=12&&n<=18,'timed volley count is bounded');
 assert.ok(state.finished);
});
test('land/split/contact reactions fire only after confirmed events and throttle',()=>{
 const g=boot(),p={hp:100,_forgeActionClock:0,_scratchEvents:{}},config={
  window:5,rules:[{when:'land',interval:.35,action:{type:'dive'}},
    {when:'split',interval:.35,action:{type:'splitshot'},fracture:2}]};
 const state=g.SignatureRuleLive.begin(config,p);
 assert.equal(g.SignatureRuleLive.step(state,p),null);
 g.SignatureLive; // event snapshots need no browser context
 p._scratchEvents.land={count:1};
 assert.equal(g.SignatureRuleLive.step(state,p).type,'dive');
 assert.equal(g.SignatureRuleLive.step(state,p),null);
 p._scratchEvents.split={count:1};
 assert.equal(g.SignatureRuleLive.step(state,p).fractureDepth,2);
});
test('repeated haste has bounded speed stacks and expires when not refreshed',()=>{
 const g=boot(),p={hp:100,_forgeActionClock:0};
 for(let i=0;i<20;i++){p._forgeActionClock++;g.SignatureRuleLive.performed(p,{type:'haste'});}
 assert.equal(p._ruleSpeed.stacks,7);
 assert.equal(p._ruleSpeed.until,145);
});
test('recipe is wired into save normalization, casting and real contact events',()=>{
 const profiles=src('js/features/skill-forge-profiles.js'),casts=src('js/features/skill-forge-casting.js');
 assert.match(profiles,/ruleSet:signature/);
 assert.match(casts,/SignatureRuleLive\.begin/);
 assert.match(casts,/SignatureRuleLive\?\.step/);
 assert.match(src('js/features/advanced-combat.js'),/record\?\.\(p,'land'\)/);
 assert.match(src('js/features/advanced-combat.js'),/fractureDepth/);
 assert.match(src('js/features/arena-pinball-motion.js'),/_ruleSpeed/);
 assert.match(src('js/features/arena-balance-formula.js'),/SignatureRuleSkill\.pressure/);
 const html=src('index.html');assert.ok(html.indexOf('signature-rule-skill.js')<html.indexOf('skill-forge-profiles.js'));
 assert.ok(html.indexOf('signature-rule-studio.js')>html.indexOf('scratch-beginner.js'));
});

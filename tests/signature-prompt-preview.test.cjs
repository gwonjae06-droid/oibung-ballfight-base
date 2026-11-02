'use strict';
/* Preview integration uses the same RuleLive coroutine in a disposable arena;
 * it never edits a stored profile or real PvE battle state. */
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=file=>fs.readFileSync(path.join(__dirname,'..','js/features',file+'.js'),'utf8');
function boot(){
 const types=['splitshot','shot','wave','haste','timeburst','leap','dive','bolt','blink','shield','heal'];
 const g={Math,Date,Number,console,SkillForge:{TYPE:Object.fromEntries(types.map(x=>[x,x]))}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const name of ['signature-program','signature-scratch','signature-rule-skill','signature-rule-live','studio-pinball-lab'])
  vm.runInContext(source(name),g,{filename:name+'.js'});
 return g;
}
function profile(g,rules,window=10){
 const ruleSet=g.SignatureRuleSkill.normalize({rules,window});
 return {signatureVersion:1,name:'실험',color:'#448aff',skills:[{
  name:'실험 규칙',ruleSet,actions:g.SignatureRuleSkill.preview(ruleSet)}]};
}
test('mini pinball lab executes repeated authored rules instead of showing one static action',()=>{
 const g=boot(),lab=g.StudioPinballLab.make(profile(g,[{when:'pulse',interval:.55,
  action:{type:'wave',damage:20,radius:180}}]));
 lab.advanceTo(7000);
 assert.ok(lab.casts>=1);
 assert.ok(lab.ruleActions>=5,'rule coroutine is actually consuming repeated actions');
});
test('mini pinball lab emits real-looking cascading shards and split reaction events',()=>{
 const g=boot(),lab=g.StudioPinballLab.make(profile(g,[{
  when:'pulse',interval:.75,fracture:3,action:{type:'splitshot',damage:20,count:5}
 },{when:'split',interval:1.4,action:{type:'shot',damage:8,count:3}}],12));
 lab.advanceTo(7000);
 assert.ok(lab.ruleActions>=6);
 assert.ok(lab.splitEvents>0,'a traveling splitshot must actually split on the preview canvas');
 assert.ok(lab.projectiles<=45,'preview projectile budget must stay bounded');
});
test('mini pinball lab landing events can trigger an authored downward combo',()=>{
 const g=boot(),lab=g.StudioPinballLab.make(profile(g,[{
  when:'pulse',interval:2.4,action:{type:'leap'}
 },{when:'land',interval:.5,action:{type:'dive',damage:38}}],12));
 lab.advanceTo(7000);
 assert.ok(lab.landEvents>=1);
 assert.ok(lab.ruleActions>=3,'reactive landing dive should fire after jump');
});

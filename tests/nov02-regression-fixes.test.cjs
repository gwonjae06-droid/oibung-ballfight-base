'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const file=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function boot(paths,globals={}){
 const g={Math,Date,Number,JSON,console,...globals};g.window=g;g.globalThis=g;
 vm.createContext(g);for(const p of paths)vm.runInContext(file(p),g,{filename:p});return g;
}
const actions=[
 {type:'wave',damage:28,radius:140,count:1,speed:5,duration:1.5,status:'none'},
 {type:'splitshot',damage:18,radius:155,count:5,speed:7,duration:1.5,status:'none'}
];
test('Tower blessings reach real ruleSet actions and nested Scratch AST without writing saved definitions',()=>{
 const g=boot(['js/features/tower-realms.js'],{BounceMomentum:{enabled:()=>false}});
 const skill={actions:[{...actions[0]}],
  ruleSet:{window:15,rules:[{when:'pulse',interval:.5,action:{...actions[1]}}]},
  program:[{kind:'repeat',body:[{kind:'action',action:{...actions[0]}}]}]};
 const saved=JSON.parse(JSON.stringify(skill));
 const fighter={forge:{skills:[skill]},hp:300,maxHp:300};
 g.ArenaTowerRealms.apply(fighter,'fire',['echo','element']);
 const edited=fighter.forge.skills[0];
 for(const a of [edited.actions[0],edited.ruleSet.rules[0].action,edited.program[0].body[0].action]){
  assert.equal(a.status,'fire');
  assert.ok(a.damage>saved.actions[0].damage*.6);
 }
 assert.equal(skill.actions[0].status,'none','unmodified profile is not changed');
 assert.equal(edited.ruleSet.rules[0].action.damage,21);
});
test('authored-rule pressure budgets fast 18-second volleys closer to actual number of actions',()=>{
 const g=boot(['js/features/signature-rule-skill.js'],{SkillForge:{TYPE:{wave:'wave'}}});
 const slow={window:18,rules:[{when:'pulse',interval:2,action:{...actions[0]}}]};
 const fast={window:18,rules:[{when:'pulse',interval:.35,action:{...actions[0]}}]};
 const pressure=x=>g.SignatureRuleSkill.pressure(x,a=>a.damage);
 assert.ok(pressure(fast)>pressure(slow)*4,'a 52-action burst must not be evaluated as just 18 actions');
});
test('natural Korean wall-only speed design does not invent a periodic speed rule',()=>{
 const kinds={wave:'wave',haste:'haste',timeburst:'timeburst',shot:'shot',splitshot:'splitshot',dive:'dive',leap:'leap'};
 const g=boot(['js/features/signature-program.js','js/features/signature-scratch.js',
  'js/features/signature-rule-skill.js','js/features/signature-prompt-compiler.js'],
 {SkillForge:{TYPE:kinds}});
 const r=g.SignaturePromptCompiler.parse('벽에 튕길 때마다 가속해서 빨라지는 캐릭터');
 assert.equal(r.ok,true);
 const hastes=r.recipe.rules.filter(x=>x.action.type==='haste');
 assert.ok(hastes.length>=1);
 assert.ok(hastes.every(x=>x.when==='wall'),'no stealth periodic haste');
});
test('online v3 packs full active ruleSet and Scratch program, v2 remains readable',()=>{
 const g=boot(['js/features/pvp-original-engine.js']);
 const profile={id:'custom',name:'폭주',forgeData:{hp:350,speed:2.5,
  color:'#f0f',effectColor:'#f3f',signatureVersion:1,allAbilities:false,
  skills:[{name:'파괴',trigger:'auto',cooldown:3,threshold:50,
   actions:[{...actions[0]}],ruleSet:{window:14,rules:[
    {when:'pulse',interval:.55,fracture:3,action:{...actions[1]}}]},
   program:[{kind:'if',condition:'near',then:[{kind:'action',action:{...actions[0]}}],else:[]}]}]}};
 const packed=g.PvpOriginalEngine.pack(profile);
 assert.equal(packed.v,3);
 assert.ok(JSON.stringify(packed).length<2500);
 const restored=g.PvpOriginalEngine.unpack(packed);
 assert.equal(restored.signatureVersion,1);
 assert.equal(restored.skills[0].ruleSet.rules[0].fracture,3);
 assert.equal(restored.skills[0].program[0].then[0].action.type,'wave');
 const legacy=g.PvpOriginalEngine.unpack({v:2,name:'과거',f:[200,2,'#fff','#fff',0,[
 ['과거 스킬','auto',2,20,[['wave','direct','nearest',15,90,1,5,1,'none',0,0,'after']]]]]});
 assert.equal(legacy.signatureVersion,0);
});
test('backup includes personal art and cosmetic inventory, validates data and restores both',()=>{
 const g=boot(['js/features/tower-save-backup.js']),values=new Map();
 const store={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),
  removeItem:k=>values.delete(k)};
 const key='oibung-fighter-art-v1:art-test-01';
 const jpg='data:image/jpeg;base64,AAAA';
 store.setItem('oibung-forge-v3',JSON.stringify([{name:'사본',artKey:'art-test-01',
  skills:[{name:'기술',actions:[{type:'wave'}]}]}]));
 store.setItem(key,jpg);
 store.setItem('oibung-cosmetics-v1',JSON.stringify({loadouts:{'art-test-01':{border:'gold'}}}));
 const serialized=g.ArenaSaveBackup.snapshot(store),backup=JSON.parse(serialized);
 assert.equal(backup.entries[key],jpg);
 assert.ok(backup.entries['oibung-cosmetics-v1']);
 store.removeItem(key);store.removeItem('oibung-cosmetics-v1');
 const restored=g.ArenaSaveBackup.restore(store,serialized);
 assert.ok(restored.includes(key));
 assert.equal(store.getItem(key),jpg);
 assert.ok(store.getItem('oibung-cosmetics-v1'));
 assert.throws(()=>g.ArenaSaveBackup.parse(JSON.stringify({...backup,entries:{[key]:'<img>'}})),/이미지/);
});
test('preview contains targeted falling arc shots, landing dive impacts and preserved bullets',()=>{
 const s=file('js/features/studio-pinball-lab.js');
 assert.match(s,/\['bolt','meteor','starfall','arcshot'\]/);
 assert.match(s,/hero\.diveImpact/);
 assert.match(s,/previewEffect\(impact\.action,'impact'/);
 assert.match(s,/if\(bullets\.length>=SPLIT_OWNER_BUDGET\)return/);
});
test('PvP snapshot sends denser bullet scenes without modifying authoritative hit simulation',()=>{
 const s=file('js/features/pvp-runtime.js');
 assert.match(s,/forgeShots:encode\(take\(p\.forgeShots,48\)\)/);
 assert.match(s,/projectiles:encode\(take\(AdvancedCombat\.projectiles,72\)\)/);
 const t=file('js/features/pvp-supabase.js');
 assert.match(t,/MAX_FRAME_BYTES=40\*1024/);
});
test('in-flight Forge extras are protected; visible Tower dodge leaves normal roll untouched',()=>{
 const s=file('js/features/forge-expansion.js');
 assert.match(s,/function enqueueExtra/);
 assert.ok(!s.includes('p.forgeExtras.splice(48)'));
 const p=file('js/features/arena-pinball-motion.js');
 assert.match(p,/dodgePinball/);
 const ai=file('js/features/arena-auto-ai.js');
 assert.match(ai,/function dodgePinball/);
});

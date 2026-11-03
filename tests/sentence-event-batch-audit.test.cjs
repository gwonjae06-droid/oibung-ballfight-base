'use strict';
/* Deterministic grammar audit, NOT an arbitrary-language benchmark.
 * Supported templates and deliberate unsupported near misses are scored
 * separately. No API calls or random seeds that CI cannot reproduce.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=x=>fs.readFileSync('js/features/'+x+'.js','utf8');
const scripts=['action-registry','semantic-physics','physics-law-engine',
 'signature-program','skill-fx-composer','metaphor-visuals','skill-color-policy',
 'semantic-concept-atlas','concept-fusion','terminal-event-chain',
 'imagination-concepts','semantic-intent-composer','signature-scratch',
 'fantasy-skill-graph','combat-event-graph','signature-live',
 'signature-rule-skill','skill-ir','signature-rule-live',
 'korean-skill-grammar','korean-skill-parameters','signature-prompt-compiler',
 'semantic-relationship-graph','sentence-auto-repair','skill-sentence-engine'];
function boot(){
 const g={Math,Date,Number,Map,Set,WeakMap,console,players:[],
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:480,height:320},createHitParticles(){},addFloatingText(){}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const n of scripts)vm.runInContext(read(n),g,{filename:n+'.js'});
 return g;
}
const positiveCounts=[
 ['두 번',2],['세 번',3],['네 번',4],
 ['2회',2],['3회',3],['4회',4]
];
const ways=[
 ['고','and'],['거나','or']
];
const events=[
 ['회피하','dodge'],['방어하','guard']
];
const abilities=[
 ['충격파를 일으킨다',['wave']],
 ['보호막을 생성한다',['shield']],
 ['자신을 회복한다',['heal']],
 ['적을 속박한다',['tether']],
 ['충격파를 일으키고 보호막을 두른다',['wave','shield']]
];
function language(count,way,second,ability){
 return '공격을 '+count+' 명중시키'+way+' 적의 공격을 '+second+
  '면 '+ability;
}
test('deterministic 120-sentence supported AND/OR grammar matrix checks executed action order',()=>{
 const g=boot();
 let verified=0,matched=0;
 const failures=[];
 for(const [count,n] of positiveCounts)
  for(const [way,mode] of ways)
   for(const [event,source] of events)
    for(const [ability,expected] of abilities){
     const sentence=language(count,way,event,ability);
     const parsed=g.SkillSentenceEngine.parse(sentence);
     const graph=parsed.recipe?.rules?.[0]?.eventGraph;
     const ordered=parsed.recipe?.rules?.[0]?.steps?.filter(x=>x.kind==='cast')
      .map(x=>x.action.type)||[];
     const ok=parsed.ok===true&&
      graph?.trigger==='hit'&&graph?.minCount===n&&
      graph?.secondary?.trigger===source&&
      graph?.secondary?.mode===mode&&
      graph?.secondary?.minCount===undefined&&
      JSON.stringify(ordered)===JSON.stringify(expected)&&
      !parsed.semanticVerification?.missing?.length&&
      parsed.semanticVerification?.matched?.includes('combatEventGraph');
     if(ok)matched++;
     else failures.push({sentence,error:parsed.error,
      graph:graph?JSON.parse(JSON.stringify(graph)):null,ordered});
     verified++;
    }
 assert.equal(verified,120);
 assert.deepEqual(failures,[]);
 assert.equal(matched,120);
 console.log('Grammar audit: supported templates 120/120, explicit condition/operator/action agreement. Not universal Korean.');
});
test('deterministic 40 unsupported count templates are rejected, never silently approximated',()=>{
 const g=boot();
 const forbiddenCounts=['5회','6회','7회','8회','9회'];
 let total=0,rejected=0;const falseAccepts=[];
 for(const count of forbiddenCounts)
  for(const [way] of ways)
   for(const [event] of events)
    for(const [ability] of abilities.slice(0,2)){
     const sentence=language(count,way,event,ability);
     const parsed=g.SkillSentenceEngine.parse(sentence);
     total++;
     if(!parsed.ok)rejected++;else falseAccepts.push(sentence);
    }
 assert.equal(total,40);
 assert.deepEqual(falseAccepts,[]);
 assert.equal(rejected,40);
 console.log('Grammar audit: unsupported hit counts 40/40 explicitly rejected.');
});
test('negations, unclear order, extra HP condition, or a fourth action do not masquerade as success',()=>{
 const g=boot(),bad=[
  '공격을 두 번 명중시키지 않고 적의 공격을 회피하면 보호막을 생성한다',
  '공격을 두 번 명중시키고 적의 공격을 회피하면 보호막을 생성하지 않는다',
  '공격을 두 번 명중시키거나 적의 공격을 회피하면 내 체력이 40% 이하라면 충격파를 일으킨다',
  '공격을 두 번 명중시키고 적의 공격을 방어하면 충격파를 쓰고 보호막을 생성하고 회복하고 속박한다',
  '공격을 두 번 명중시키고 또는 적의 공격을 회피하면 보호막을 생성한다',
  '공격을 두 번 명중시키고 적의 공격을 회피하면 회복하고 피해가 들어가면 보호막을 생성한다'
 ];
 const accepted=bad.filter(sentence=>g.SkillSentenceEngine.parse(sentence).ok);
 assert.deepEqual(accepted,[]);
 console.log('Grammar audit: adversarial meanings 6/6 rejected, not reinterpreted as another skill.');
});

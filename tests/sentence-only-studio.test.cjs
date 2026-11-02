'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function boot(){
 const labels={wave:'충격파',slash:'베기',beam:'광선',splitshot:'분열탄',shot:'탄환',
  haste:'가속',leap:'점프',dive:'낙하',shield:'보호막'};
 const g={Math,Date,Number,console,
  SkillForge:{TYPE:labels,STATUS:{none:'없음',ice:'빙결',fire:'화염',poison:'중독'}},
  ActionRegistry:{TYPE:labels}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['signature-program','metaphor-visuals','signature-scratch',
   'fantasy-skill-graph','signature-rule-skill','signature-rule-live',
   'signature-prompt-compiler','skill-sentence-engine']){
  vm.runInContext(src('js/features/'+file+'.js'),g,{filename:file});
 }
 return g;
}
test('natural language skill interpreter explains exactly executed triggers and chained actions',()=>{
 const g=boot();
 const result=g.SkillSentenceEngine.parse('거대한 턱으로 후려치고 그리고 검은 멘헤라빔을 발사한다');
 assert.equal(result.ok,true);
 assert.equal(result.mode,'offline');
 assert.ok(result.summary[0].action.includes('베기'));
 assert.ok(result.summary[0].action.includes('광선'));
 assert.ok(Array.isArray(result.limitations));
 const rules=g.SignatureRuleSkill.normalize(result.recipe);
 const hero={hp:100,maxHp:100,x:10,y:20,_scratchEvents:{}},foe={x:60,y:20,hp:100};
 const run=g.SignatureRuleLive.begin(rules,hero),types=[];
 for(let i=0;i<10;i++){
  const action=g.SignatureRuleLive.step(run,hero,foe);
  if(action)types.push(action.type);
 }
 assert.deepEqual(types,['slash','beam']);
});
test('unavailable mechanics are disclosed instead of falsely calling them implemented',()=>{
 const g=boot();
 const partial=g.SkillSentenceEngine.parse('턱으로 상대를 후려치고 팔 관절로 상대를 붙잡는다');
 assert.equal(partial.ok,true);
 assert.ok(partial.limitations.some(s=>s.includes('관절')));
 const impossible=g.SkillSentenceEngine.parse('상대의 마음을 읽고 무작위로 행동');
 assert.equal(impossible.ok,false);
 assert.equal(impossible.summary.length,0);
});
test('signature character profile persists original authoring prompt across saves and edits',()=>{
 const g=boot();
 vm.runInContext(src('js/features/skill-forge-profiles.js'),g,{filename:'skill-forge-profiles'});
 const original='오슬우의 멘헤라가 모아져 두꺼운 빔을 쏩니다';
 const recipe=g.SkillSentenceEngine.parse(original).recipe;
 const f=g.SkillForgeProfilesFactory({TYPE:g.SkillForge.TYPE,
  TRIGGER:{auto:true},STATUS:g.SkillForge.STATUS,ACTION_PARAMETERS:{},MOVEMENT_ONLY:new Set()});
 const normalized=f.normalize({name:'문장 창작',hp:200,speed:2,signatureVersion:1,
  skills:[{name:'멘헤라빔',promptText:original,trigger:'auto',cooldown:3,
   actions:g.SignatureRuleSkill.preview(recipe),ruleSet:recipe}]});
 assert.equal(normalized.skills[0].promptText,original);
 assert.equal(normalized.skills[0].ruleSet.rules[0].action.visual.shape,'beam');
 assert.equal(f.normalize(normalized).skills[0].promptText,original);
});
test('UI removes visible programming controls and retains the same validated execution runtime',()=>{
 const ui=src('js/features/signature-rule-studio.js');
 const css=src('css/sentence-only-studio.css');
 const html=src('index.html');
 assert.match(ui,/data-rule-command="generate"/);
 assert.match(ui,/data-rule-command="apply"/);
 assert.match(ui,/rule-prompt/);
 assert.match(ui,/promptText/);
 assert.doesNotMatch(ui,/data-step-field="type"/);
 assert.doesNotMatch(ui,/graph-add/);
 assert.doesNotMatch(ui,/data-rule-field="type"/);
 assert.match(css,/\.scratch-workbench/);
 assert.match(css,/#studio-expert-panel/);
 assert.match(html,/skill-sentence-engine\.js/);
 assert.match(html,/sentence-only-studio\.css/);
 assert.ok(html.indexOf('skill-sentence-engine.js')<html.indexOf('signature-rule-studio.js'));
 const casting=src('js/features/skill-forge-casting.js');
 const lab=src('js/features/studio-pinball-lab.js');
 assert.match(casting,/SignatureRuleLive\?\.step/);
 assert.match(lab,/SignatureRuleLive\?\.step/);
});
test('sentence-only composer applies generated ruleSet, launches preview and restores saved sentence',()=>{
 const g=boot();
 const start='거대한 턱으로 상대를 후려칩니다';
 const messages=[],handlers={},element={innerHTML:'',classList:{add(){}},
  closest(){return null;},addEventListener(type,fn){handlers[type]=fn},
  querySelector(sel){
   if(sel==='#rule-prompt')return {value:typed,focus(){}};
   if(sel==='#rule-name')return {value:'턱 일격'};
   if(sel==='#rule-feedback')return {set textContent(value){messages.push(value)}};
   return null;
  }};
 let typed=start,previewed=0;
 let draft={name:'테스트',signatureVersion:1,skills:[{name:'첫 기술',trigger:'auto',
  cooldown:3,actions:[{type:'wave',damage:18,radius:120}]}]};
 g.SkillForge.TYPE=g.SkillForge.TYPE||{};
 g.SkillForge.getDraft=()=>draft;g.SkillForge.setDraft=p=>{draft=p};
 g.document={querySelector:sel=>sel==='#scratch-beginner'?element:null,
  getElementById:()=>({click(){previewed++}})};
 g.CharacterStudioWorkspace={refresh(){},selectPreviewSkill(){}};
 g.confirm=()=>true;g.addEventListener=(type,fn)=>{handlers[type]=fn};
 vm.runInContext(src('js/features/signature-rule-studio.js'),g,
  {filename:'signature-rule-studio'});
 assert.ok(element.innerHTML.includes('문장으로'));
 handlers.click({target:{closest:selector=>
  selector==='[data-rule-command]'?{dataset:{ruleCommand:'generate'}}:null}});
 assert.ok(element.innerHTML.includes('이 문장을 이렇게 구현합니다'));
 handlers.click({target:{closest:selector=>
  selector==='[data-rule-command]'?{dataset:{ruleCommand:'apply'}}:null}});
 assert.equal(draft.skills[0].promptText,start);
 assert.equal(draft.skills[0].ruleSet.rules[0].action.visual.shape,'jaw');
 assert.equal(draft.skills[0].name,'턱 일격');
 assert.ok(previewed>0);
 typed='';handlers['studio:open']();
 assert.ok(element.innerHTML.includes(start));
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
test('the Forge view stays separately loaded before its runtime only in the local editor page',()=>{
 const main=read('index.html'),pvp=read('pvp-runtime.html');
 const editor='js/features/skill-forge-editor.js',runtime='js/features/skill-forge.js';
 assert.ok(main.indexOf(editor)>0&&main.indexOf(editor)<main.indexOf(runtime));
 assert.equal(pvp.includes(editor),false,'PvP does not load unused character-editor UI');
 assert.ok(pvp.includes(runtime));
 const view=read(editor),core=read(runtime);
 assert.ok(view.includes("global.SkillForgeEditorFactory=function("));
 assert.ok(core.includes("global.SkillForgeEditorFactory?.("));
 assert.ok(core.includes("getDraft:()=>normalize(draft)"),'the core preserves the old external API');
 assert.ok(!core.includes("getElementById('forge-skills')"),'the core does not own editor DOM');
});
test('existing SkillForge profile editing API stays intact after view extraction',()=>{
 const h={Math,Date,Map,Set,WeakMap,console,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
  canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(){return null;}};
 h.window=h;h.globalThis=h;vm.createContext(h);
 vm.runInContext(read('js/features/skill-forge-editor.js'),h);
 for(const part of ['skill-forge-impact','skill-forge-casting','skill-forge-world','skill-forge-profiles','skill-forge-storage','skill-forge-executor','skill-forge'])
  vm.runInContext(read('js/features/'+part+'.js'),h);
 const initial=h.SkillForge.getDraft();
 assert.equal(initial.signatureVersion,1);
 const changed=h.SkillForge.setDraft({name:'분리 테스트',signatureVersion:1,skills:[
  {name:'시험 충격파',cooldown:4,actions:[{type:'wave',damage:40,radius:120}]}]});
 assert.equal(changed.name,'분리 테스트');
 assert.equal(h.SkillForge.getDraft().name,'분리 테스트');
 assert.doesNotThrow(()=>h.SkillForge.refreshEditor(),'render refresh without DOM must remain safe');
 assert.equal(typeof h.SkillForge.hit,'function');
 assert.equal(typeof h.SkillForge.autoUpdate,'function');
 assert.equal(typeof h.SkillForge.register,'function');
});
test('editor factory uses injected state without cloning or modifying game profiles',()=>{
 const h={Math,Set,Map,console,document:{getElementById(){return null;}}};
 h.window=h;h.globalThis=h;vm.createContext(h);
 vm.runInContext(read('js/features/skill-forge-editor.js'),h);
 let refreshes=0;
 const state={draft:{name:'원본'},refreshForm(){refreshes++;}};
 const view=h.SkillForgeEditorFactory({state,normalize:x=>x,skill:()=>({}),stage:()=>({}),
  allSkillset:()=>[],supportedParameter:()=>false,TYPE:{},TRIGGER:{},STATUS:{},
  MOVEMENT_ONLY:new Set(),register(){},remove(){},persist(){}});
 assert.ok(Object.isFrozen(view));
 assert.doesNotThrow(()=>view.render());
 view.refreshEditor();
 assert.equal(refreshes,1);
 assert.equal(state.draft.name,'원본');
});

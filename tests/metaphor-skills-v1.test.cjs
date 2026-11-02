'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'../js/features',n+'.js'),'utf8');
function boot(extra=[]){
 const types={beam:'레이저',slash:'베기',spinslash:'회전 베기',
  shot:'투사체',splitshot:'분열탄',wave:'충격파',shield:'보호막'};
 const g={Math,Number,Date,console,SkillForge:{TYPE:types,STATUS:{none:'없음'}},
  ActionRegistry:{TYPE:types,ids:()=>Object.keys(types),get:()=>null},ArenaDepth:null};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const name of ['metaphor-visuals','signature-program','signature-scratch',
  'signature-rule-skill','signature-prompt-compiler',...extra])
   vm.runInContext(read(name),g,{filename:name});
 return g;
}
function context(){
 const calls=[],ctx=new Proxy({},{
  get(o,p){if(p in o)return o[p];return (...args)=>{calls.push({name:p,args})};},
  set(o,p,v){o[p]=v;calls.push({name:'set:'+String(p),value:v});return true}
 });
 ctx.globalAlpha=1;
 return {ctx,calls};
}
test('jaw metaphor creates an actual slash with attached large jaw geometry',()=>{
 const g=boot();
 const m=g.MetaphorVisuals.interpret('거대해진 턱으로 상대를 후려칩니다');
 assert.equal(m.type,'slash');
 assert.equal(m.visual.shape,'jaw');
 assert.ok(m.visual.scale>=2);
 const r=g.SignaturePromptCompiler.parse('거대해진 턱으로 상대를 후려칩니다');
 assert.equal(r.ok,true);
 assert.equal(r.recipe.rules[0].action.type,'slash');
 assert.equal(r.recipe.rules[0].action.visual.shape,'jaw');
 assert.ok(r.notes.some(t=>t.includes('비유')));
 const a=g.SignatureScratch.safeAction(r.recipe.rules[0].action);
 assert.equal(a.visual.shape,'jaw','must survive action normalization');
 const {ctx,calls}=context();
 assert.equal(g.MetaphorVisuals.paint(ctx,{visual:a.visual,progress:.4,phase:'cast',radius:120}),true);
 assert.ok(calls.filter(c=>c.name==='quadraticCurveTo').length>=2,
  'partial ball-shaped mandibles must physically draw, not a text label');
});
test('menhera metaphor becomes a charging dark thick beam rather than generic shot',()=>{
 const g=boot(),r=g.SignaturePromptCompiler.parse('오슬우의 멘헤라가 모아져 멘헤라빔을 쏩니다');
 assert.equal(r.ok,true);
 const attacks=r.recipe.rules.map(x=>x.action);
 assert.equal(attacks.length,1,'do not hallucinate a second shot');
 assert.equal(attacks[0].type,'beam');
 assert.equal(attacks[0].visual.shape,'beam');
 assert.equal(attacks[0].visual.color,'#432052');
 assert.equal(attacks[0].visual.charge,true);
 const {ctx,calls}=context();
 assert.equal(g.MetaphorVisuals.paint(ctx,{visual:attacks[0].visual,phase:'cast',progress:.64,length:250,radius:135}),true);
 assert.ok(calls.some(c=>c.name==='set:lineWidth'&&c.value>=15),
  'the attack must draw a visibly thick beam');
 assert.ok(calls.some(c=>c.name==='set:strokeStyle'&&c.value==='#130a20'),
  'dark core, not only a bright generic laser');
});
test('ruleSet and saved Forge profile retain safely bounded visual metaphors',()=>{
 const g=boot(['skill-forge-profiles']);
 const rule=g.SignaturePromptCompiler.parse('두꺼운 어둠의 레이저를 모아 쏩니다').recipe;
 const normalized=g.SignatureRuleSkill.normalize(rule);
 assert.equal(normalized.rules[0].action.visual.shape,'beam');
 const forge=g.SkillForgeProfilesFactory({
  TYPE:g.SkillForge.TYPE,TRIGGER:{auto:true},STATUS:g.SkillForge.STATUS,
  ACTION_PARAMETERS:{},MOVEMENT_ONLY:new Set()
 });
 const saved=forge.normalize({signatureVersion:1,name:'암흑술사',hp:260,speed:2,
  skills:[{name:'그림자',trigger:'auto',cooldown:3,
    actions:g.SignatureRuleSkill.preview(normalized),ruleSet:normalized}]});
 assert.equal(saved.skills[0].ruleSet.rules[0].action.visual.shape,'beam');
 assert.equal(saved.skills[0].actions[0].visual.color,'#432052');
 assert.equal(g.MetaphorVisuals.normalize({shape:'beam',color:'<script>',scale:400}).scale,2.8);
 assert.equal(g.MetaphorVisuals.normalize({shape:'beam',color:'<script>',scale:400}).color,'#a88eff');
});
test('actual SkillVisuals cast and miniature preview use the same metaphor painter',()=>{
 const g=boot(['skill-visuals']);
 const visual={shape:'beam',color:'#432052',scale:2.2,charge:true};
 const action={type:'beam',radius:150,damage:40,visual};
 const player={x:80,y:120,vx:2,vy:0,radius:25,playerNum:1,
  hp:200,forge:{effectColor:'#bb88ff'}};
 const target={x:290,y:120,hp:200,playerNum:2};
 assert.equal(g.SkillVisuals.cast(player,action,target),true);
 const fx=g.SkillVisuals.exportEffects()[0];
 assert.equal(fx.visual.shape,'beam');
 assert.ok(fx.beamLength>200);
 const {ctx,calls}=context();
 g.SkillVisuals.tick();
 assert.doesNotThrow(()=>g.SkillVisuals.draw(ctx));
 const realDark=calls.filter(c=>c.name==='set:strokeStyle'&&c.value==='#130a20').length;
 assert.ok(realDark>0,'live game must paint black laser core');
 const mini=context();
 assert.equal(g.SkillVisuals.previewFrame(mini.ctx,{
  type:'beam',phase:'cast',progress:.5,x:80,y:120,radius:150,
  angle:0,length:fx.beamLength,visual}),true);
 assert.ok(mini.calls.some(c=>c.name==='set:strokeStyle'&&c.value==='#130a20'),
  'mini pinball must draw same dark beam');
});
test('PvP transmits compact metaphor art without changing attack physics',()=>{
 const g=boot(['pvp-original-engine']);
 const a={type:'slash',pattern:'direct',target:'nearest',damage:36,
  radius:145,count:1,speed:5,duration:1.5,status:'none',
  visual:{shape:'jaw',color:'#b19cff',scale:2.2,charge:false}};
 const profile={id:'custom',name:'괴수',forgeData:{signatureVersion:1,
  hp:300,speed:2,color:'#aaaaff',effectColor:'#aaaaff',allAbilities:false,
  skills:[{name:'거악의 턱',trigger:'auto',cooldown:3,threshold:30,
    actions:[a],ruleSet:{window:12,rules:[{when:'pulse',interval:1,fracture:1,action:a}]}}]}};
 const packed=g.PvpOriginalEngine.pack(profile);
 assert.ok(JSON.stringify(packed).length<2380);
 const restored=g.PvpOriginalEngine.unpack(packed);
 assert.equal(restored.skills[0].ruleSet.rules[0].action.visual.shape,'jaw');
 assert.equal(restored.skills[0].actions[0].visual.scale,2.2);
});
test('studio UI allows customizing imagined appearance, saturation and size',()=>{
 const s=read('signature-rule-studio');
 assert.match(s,/data-rule-field="visual\.shape"/);
 assert.match(s,/data-rule-field="visual\.color"/);
 assert.match(s,/data-rule-field="visual\.scale"/);
 assert.match(s,/data-rule-field="visual\.charge"/);
 const lab=read('studio-pinball-lab');
 assert.match(lab,/visual:fx\.a\.visual/);
});

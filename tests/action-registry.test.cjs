'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function sandbox(){
  const sounds=[],draws=[];
  const w={window:null,console,Math,players:[],screenShake:0,
    BattleFX:{sound:(...args)=>sounds.push(args)},
    createHitParticles(){},addFloatingText(){},canvas:{width:600,height:600},
    SkillForge:null,globalThis:null,CharacterStudioWorkspace:null,BlockForge:null};
  w.window=w;w.globalThis=w;
  vm.createContext(w);
  const load=p=>vm.runInContext(read(p),w,{filename:p});
  load('js/features/action-registry.js');
  load('js/features/skill-forge.js');
  load('js/features/skill-visuals.js');
  load('js/features/studio-motion-model.js');
  load('js/features/block-forge.js');
  load('js/features/impact-physics.js');
  const ctx=new Proxy({}, {get(obj,k){
    if(k in obj)return obj[k];
    return (...args)=>draws.push([k,...args]);
  },set(obj,k,value){obj[k]=value;return true;}});
  return {w,r:w.ActionRegistry,load,sounds,draws,ctx};
}
test('canonical action list contains all 55 legacy actions with old names, controls and visual signatures',()=>{
  const {w,r}=sandbox();
  assert.equal(r.ids().length,55);
  assert.equal(new Set(r.ids()).size,55);
  assert.equal(Object.keys(w.SkillForge.TYPE).length,55);
  assert.equal(Object.keys(w.SkillVisuals.catalog).length,55);
  assert.equal(w.SkillVisuals.TYPES.length,55);
  assert.equal(r.get('uppercut').label,'어퍼컷');
  assert.equal(r.get('dash').category,'mobility');
  assert.equal(r.get('dash').movementOnly,true);
  assert.equal(r.get('dash').physics,'none');
  assert.equal(r.get('shot').physics,'projectile');
  assert.equal(r.get('shot').executor,'atlas');
  assert.equal(r.get('uppercut').executor,'advanced');
  assert.equal(r.get('blackhole').executor,'expansion');
  assert.ok(r.get('shot').parameters.includes('damage'));
  assert.equal(w.SkillForge.supportedParameter('dash','damage'),false);
  assert.deepEqual(Object.keys(r.GROUPS).sort(),['attacks','defense','mobility','special']);
  assert.equal(r.entries().length,55);
  for(const entry of r.entries()){
    assert.equal(w.SkillForge.TYPE[entry.id],entry.label);
    assert.ok(w.SkillVisuals.catalog[entry.id]);
    assert.ok(w.SkillForge.supportedParameter(entry.id,'delay'));
    assert.ok(r.byGroup(entry.category).includes(entry.id));
  }
});
test('a trusted newly registered punch automatically joins blocks, editor, preview, sound and execution',()=>{
  const {w,r,ctx,draws,sounds}=sandbox();
  let castCount=0;
  const definition=r.register({
    id:'superpunch',label:'강타 펀치',category:'attacks',
    parameters:['target','damage','radius','knockback'],family:'fist',
    visual:{motif:'punch',color:'#ce7243'},physics:'strike',
    preview:{duration:780,pose:'arm',anchor:'caster'},
    audio:{cast:'heavy',impact:'hit'},offense:true,
    execute:(caster,action,target,api)=>{castCount++;if(target)api.hit(caster,target,action);return true;}
  });
  assert.equal(definition.legacy,false);
  assert.equal(w.SkillForge.TYPE.superpunch,'강타 펀치');
  assert.ok(r.byGroup('attacks').includes('superpunch'));
  assert.ok(w.SkillForge.ACTION_PARAMETERS.superpunch.includes('damage'));
  assert.equal(w.SkillForge.supportedParameter('superpunch','damage'),true);
  assert.ok(w.SkillVisuals.catalog.superpunch);
  assert.equal(w.SkillVisuals.TYPES.length,56);
  assert.equal(w.StudioMotionModel.duration({type:'superpunch'}),780);
  assert.equal(w.BlockForge.action('superpunch').type,'superpunch');
  const profile={name:'시험 파이터',hp:260,speed:1.8,skills:[
    {name:'시험 기술',cooldown:2,trigger:'auto',actions:[{type:'superpunch',damage:33,radius:100,knockback:2}]}
  ]};
  const normalized=w.SkillForge.normalize(profile);
  assert.equal(normalized.skills[0].actions[0].type,'superpunch');
  const preview=w.StudioMotionModel.plan(normalized,0);
  assert.equal(preview.events[0].length,780);
  assert.equal(w.SkillVisuals.previewFrame(ctx,{
    type:'superpunch',phase:'cast',progress:.5,x:100,y:100}),true);
  assert.ok(draws.some(d=>d[0]==='stroke'),'registered action has visible effect');
  const actor={x:100,y:100,radius:25,hp:100,vx:1,vy:0,forge:{effectColor:'#df876c'}};
  const target={x:155,y:100,hp:100,radius:25};
  assert.equal(w.SkillVisuals.cast(actor,{type:'superpunch'},target),true);
  assert.ok(sounds.some(s=>s[0]==='heavy'),'registered sound fires on cast');
  let hitCount=0;
  assert.equal(r.run(actor,normalized.skills[0].actions[0],target,
    {hit(){hitCount++;}}),true);
  assert.equal(hitCount,1);
  assert.equal(castCount,1);
});
test('new purely positional movement cannot become damage or knockback, including saved profiles',()=>{
  const {w,r}=sandbox();
  r.register({
    id:'stepdash',label:'잔상 대시',category:'mobility',parameters:['speed','duration','target'],
    family:'movement',visual:{motif:'speed',color:'#4a839c'},
    physics:'none',movementOnly:true,preview:{duration:650,anchor:'caster'},
    audio:{cast:'dash'},execute:(p,a)=>{p.vx=a.speed;return true;}
  });
  const actor={x:100,y:100,hp:150,vx:0,vy:0,radius:25};
  const enemy={x:155,y:100,hp:150,vx:0,vy:0,radius:25};
  assert.equal(w.ImpactPhysics.hit(actor,enemy,60,{type:'stepdash'}),false);
  assert.equal(enemy.hp,150);assert.equal(enemy.impactVX,undefined);
  assert.equal(w.SkillForge.supportedParameter('stepdash','damage'),false);
  const old=w.SkillForge.normalize({name:'이동',skills:[{name:'이동',actions:[
    {type:'stepdash',damage:100,knockback:9,status:'fire'}]}]});
  const a=old.skills[0].actions[0];
  assert.equal(a.damage,0);assert.equal(a.knockback,0);assert.equal(a.status,'none');
});
test('registry rejects duplicate, invalid and non-executable action definitions',()=>{
  const {r}=sandbox();
  const def={id:'anothermove',label:'추가 기술',category:'attacks',parameters:['damage'],
    family:'wave',visual:{motif:'ripples',color:'#ffffff'},physics:'strike',
    execute:()=>true};
  assert.throws(()=>r.register({...def,execute:null}),/실행 함수/);
  assert.throws(()=>r.register({...def,id:'shot'}),/이미 존재/);
  assert.throws(()=>r.register({...def,id:'x space'}),/잘못된/);
  assert.throws(()=>r.register({...def,parameters:['eval']}),/알 수 없는/);
  assert.throws(()=>r.register({...def,movementOnly:true}),/순수 이동/);
  r.register(def);
  assert.throws(()=>r.register(def),/이미 존재/);
});
test('main HTML loads registry before all metadata consumers while old combat adapters remain',()=>{
  const html=read('index.html');
  const registry=html.indexOf('js/features/action-registry.js');
  assert.ok(registry>=0);
  for(const file of ['ability-atlas','advanced-combat','forge-expansion',
    'skill-forge','skill-visuals','block-forge','studio-motion-model','studio-workspace']){
    assert.ok(html.indexOf('js/features/'+file+'.js')>registry,file+' loads after registry');
  }
  const skill=read('js/features/skill-forge.js');
  assert.ok(skill.includes('ActionRegistry?.run(p,a,target,{hit,enemies})'));
  assert.ok(read('js/features/block-forge.js').includes('ActionRegistry?.GROUPS'));
  assert.ok(read('js/features/skill-visuals.js').includes('ActionRegistry?.visualCatalog'));
  assert.ok(read('js/features/studio-motion-model.js').includes('ActionRegistry?.duration(a.type)'));
  assert.ok(read('js/features/impact-physics.js').includes('ActionRegistry?.get(type)?.physics'));
});

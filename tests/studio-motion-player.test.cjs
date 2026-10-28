'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function world(){
  const calls=[];
  const ctx=new Proxy({}, {get(o,k){
    if(k in o)return o[k];
    return (...args)=>{calls.push([k,...args]);};
  },set(o,k,v){o[k]=v;return true;}});
  const h={window:null,SkillForge:{TYPE:{},allSkillset:()=>[]},console,Math};
  h.window=h;vm.createContext(h);
  vm.runInContext(read('js/features/studio-motion-model.js'),h);
  vm.runInContext(read('js/features/skill-visuals.js'),h);
  return {h,ctx,calls};
}
const skill=(name,cooldown,actions)=>({name,cooldown,trigger:'auto',actions});
test('selected skill planning respects sequential, overlapping and simultaneous Scratch connections',()=>{
  const {h}=world(),d={skills:[skill('시험',3,[
    {type:'dash',delay:0},{type:'uppercut',link:'and',delay:0},
    {type:'nova',link:'after',delay:0}])]};
  const data=h.StudioMotionModel.plan(d,0);
  assert.equal(data.events.length,3);
  const [dash,uppercut,nova]=data.events;
  assert.ok(uppercut.start>dash.start&&uppercut.start<dash.end);
  assert.ok(nova.start>uppercut.end);
  d.skills[0].actions[1].link='with';
  const simultaneous=h.StudioMotionModel.plan(d,0);
  assert.equal(simultaneous.events[0].start,simultaneous.events[1].start);
  assert.ok(simultaneous.events[2].start>simultaneous.events[1].end);
  assert.equal(d.skills[0].actions[1].link,'with','planner cannot modify a draft');
});
test('separate skills keep independent cooldowns on the all-skills timeline',()=>{
  const {h}=world(),d={skills:[
    skill('빠른 스킬',1,[{type:'shot'}]),
    skill('느린 스킬',2,[{type:'timestop'}])
  ]};
  const all=h.StudioMotionModel.plan(d,'all'),a=all.events.filter(x=>x.skillIndex===0),
    b=all.events.filter(x=>x.skillIndex===1);
  assert.ok(a.length>b.length);
  assert.equal(a[1].start-a[0].start,1000);
  assert.equal(b[1].start-b[0].start,2000);
  assert.ok(all.duration<10000);
  assert.ok(all.events.length<=160);
});
test('an all-ability fighter is sampled safely without overwhelming the preview renderer',()=>{
  const {h}=world();
  h.SkillForge.allSkillset=()=>Array.from({length:55},(_,i)=>skill('스킬 '+i,.6,
    [{type:'shot'},{type:'wave',link:'with'},{type:'uppercut',link:'after'}]));
  const value=h.StudioMotionModel.plan({allAbilities:true},'all');
  assert.equal(value.skills.length,55);
  assert.ok(value.events.length<=160);
  assert.ok(value.events.every(e=>e.skillIndex<12));
});
test('preview renders all seven real battle VFX families without modifying live effect state',()=>{
  const {h,ctx,calls}=world(),v=h.SkillVisuals;
  const cases=['uppercut','shot','wave','dash','timestop','nova','blackhole'];
  const start=v.active;
  for(const type of cases){
    calls.length=0;
    assert.equal(v.previewFrame(ctx,{type,phase:'cast',progress:.45,
      x:120,y:80,radius:90,color:'#936cce'}),true);
    assert.ok(calls.some(c=>c[0]==='stroke'||c[0]==='fill'),type+' must be visible');
    assert.equal(v.active,start,type+' must not cast a real effect');
  }
  for(const phase of ['cast','impact']){
    assert.equal(v.previewFrame(ctx,{type:'meteor',phase,progress:.6,x:170,y:100}),true);
  }
  assert.equal(v.active,start,'preview must not mutate shared VFX pools');
});
test('studio preview contains explicit playback and focus controls, and stays independent of live battle APIs',()=>{
  const script=read('js/features/studio-workspace.js');
  const block=read('js/features/block-forge.js'),html=read('index.html');
  assert.ok(script.includes('studio-motion-select'));
  assert.ok(script.includes('studio-motion-replay'));
  assert.ok(script.includes('studio-motion-play'));
  assert.ok(script.includes('studio-motion-speed'));
  assert.ok(script.includes('studio-motion-fill'));
  assert.ok(script.includes('SkillVisuals?.previewFrame?.('));
  assert.ok(script.includes('devicePixelRatio'));
  assert.ok(script.includes('prefers-reduced-motion: reduce'));
  assert.ok(script.includes('document.hidden'));
  assert.ok(block.includes('data-op="preview"'));
  assert.ok(block.includes('previewSkill?.(si,ai)'));
  assert.ok(!script.includes('SkillForge.hit('));
  assert.ok(!script.includes('SkillForge.cast('));
  assert.ok(html.indexOf('js/features/studio-motion-model.js')<
    html.indexOf('js/features/studio-workspace.js'));
  assert.ok(read('css/style.css').includes('.studio-motion-progress'));
});

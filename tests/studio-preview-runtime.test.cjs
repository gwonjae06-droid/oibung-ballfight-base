'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../js/features/studio-workspace.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../css/style.css'),'utf8');
const start=src.indexOf('function render(time){');
const end=src.indexOf('\nfunction dpi(){',start);
const renderSource=src.slice(start,end);
function fixture(){
  const calls=[],previewCalls=[],caption={textContent:''},fill={style:{}},
    track={setAttribute(key,value){calls.push([key,value]);}};
  const ctx=new Proxy({},{get(o,key){
    if(key in o)return o[key];
    return (...args)=>{calls.push([key,...args]);};
  },set(o,key,value){o[key]=value;return true;}});
  const events=[
    {action:{type:'dash',radius:75},skillIndex:0,skillName:'접근 콤보',
      actionIndex:0,link:'and',start:250,length:850,end:1100},
    {action:{type:'uppercut',radius:55},skillIndex:0,skillName:'접근 콤보',
      actionIndex:1,link:'and',start:800,length:950,end:1750}
  ];
  const context={
    ctx,sequence:{events,duration:2300},profile:{name:'실전 캐릭터',color:'#5c94bb',effectColor:'#c5a5e7'},
    WIDTH:480,HEIGHT:180,TAU:Math.PI*2,
    global:{SkillVisuals:{previewFrame(_ctx,args){previewCalls.push(args);}}},
    R:null,Math,Array,Number,
    clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
    isMoving:type=>type==='dash',
    isRanged:type=>type==='shot',
    isDefense:()=>false,
    reduced:()=>false,
    MOVE:new Set(['dash']),PURE:new Set(['dash']),DEFENSE:new Set(),
    EXPLOSION:new Set(['nova']),
    circle:(...args)=>calls.push(['circle',...args]),
    line:(...args)=>calls.push(['line',...args]),
    fighter:(...args)=>calls.push(['fighter',...args]),
    arm:(...args)=>calls.push(['arm',...args]),
    label:type=>type,
    caption,fill,track,lastText:''
  };
  vm.createContext(context);
  vm.runInContext(renderSource,context,{filename:'studio-render-extracted.js'});
  return {context,calls,previewCalls,caption,fill,track};
}
test('movement preview renders without temporal-dead-zone failure when dashing',()=>{
  const {context,calls}=fixture();
  assert.doesNotThrow(()=>vm.runInContext('render(700)',context));
  assert.ok(calls.some(c=>c[0]==='fillRect'),'rehearsal canvas is painted');
  assert.ok(calls.some(c=>c[0]==='fighter'),'both fighters are visible');
  assert.ok(calls.some(c=>c[0]==='circle'),'movement afterimage is visible');
});
test('movement followed by uppercut renders and invokes original, read-only VFX renderer',()=>{
  const {context,previewCalls,fill,caption}=fixture();
  assert.doesNotThrow(()=>vm.runInContext('render(1250)',context));
  assert.ok(previewCalls.some(e=>e.type==='uppercut'),'second linked move invokes previewFrame');
  assert.match(caption.textContent,/어퍼컷/);
  assert.ok(parseFloat(fill.style.width)>0);
  assert.doesNotThrow(()=>vm.runInContext('render(2000)',context),'idle scene remains visible');
});
test('movement test function is not shadowed by boolean state in render scope',()=>{
  assert.ok(start>=0&&end>start);
  assert.ok(renderSource.includes('events.filter(e=>isMoving(e.action.type)'));
  assert.ok(renderSource.includes('const isMovingNow='));
  assert.ok(!/\bconst isMoving\s*=/.test(renderSource));
  assert.ok(css.includes('.character-studio-dialog .studio-motion-preview'));
  assert.ok(src.includes('shell.insertBefore(preview,content)'));
  assert.ok(src.includes('get previewTimeline(){return sequence;}'));
});

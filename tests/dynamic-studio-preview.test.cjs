'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function arena(){
  const canvas={width:500,height:500},elements=new Map();
  const doc={getElementById(id){
    if(id==='arena')return canvas;
    if(!elements.has(id))elements.set(id,{style:{},dataset:{},innerText:'',classList:{add(){},remove(){}}});
    return elements.get(id);
  }};
  const state={document:doc,Math,console};
  vm.createContext(state);
  vm.runInContext(read('js/core/state.js'),state);
  vm.runInContext(read('js/core/engine.js'),state);
  return state;
}
const fighter=(n,x,y,vx,vy)=>({playerNum:n,name:'테스트',id:'test',
  x,y,vx,vy,radius:34,hp:250,maxHp:250,invincible:0,
  slowTimer:0,slowMultiplier:1,getTag(){return null;}});
test('first head-on collision makes a symmetric oblique bounce',()=>{
  const s=arena(),a=fighter(1,250,220,0,2),b=fighter(2,250,274,0,-2);
  s.a=a;s.b=b;
  vm.runInContext('handleCombat(a,b)',s);
  assert.ok(Math.abs(a.vx)>.5,'first impact breaks the vertical axis');
  assert.ok(Math.abs(b.vx)>.5);
  assert.ok(Math.abs(a.vx+b.vx)<1e-8,'lateral momentum must remain balanced');
  assert.ok(Math.abs(a.vy+b.vy)<1e-8);
  const firstA=a.vx,firstB=b.vx;
  a.y=220;b.y=274;a.vx=firstA;b.vx=firstB;a.vy=2;b.vy=-2;
  vm.runInContext('handleCombat(a,b)',s);
  assert.equal(a.vx,firstA,'opening glance applies only once per pair');
  assert.equal(b.vx,firstB);
});
test('wall bounce adds small, bounded velocity and side drift',()=>{
  const s=arena(),a=fighter(1,100,35,0,-3),b=fighter(2,400,400,0,0);
  s.a=a;s.b=b;
  vm.runInContext('players=[a,b];isPlaying=true;update()',s);
  assert.equal(a.y,a.radius);
  assert.ok(a.vy>3,'wall reflection gives a modest bonus');
  assert.ok(a.vx>0,'straight path gains slight lateral motion');
  assert.ok(Math.hypot(a.vx,a.vy)<=12+1e-8);
});
test('studio preserves accessible tabs with a compact looping preview',()=>{
  const script=read('js/features/studio-workspace.js');
  const html=read('index.html'),css=read('css/style.css');
  new vm.Script(script,{filename:'studio-workspace.js'});
  assert.ok(html.indexOf('js/features/studio-art.js')<html.indexOf('js/features/studio-workspace.js'));
  assert.ok(html.indexOf('js/features/studio-workspace.js')<html.indexOf('js/features/battle-effects.js'));
  for(const phrase of ['aria-selected="true"','studio-panel-skills','studio-panel-appearance',
    'studio.replaceChildren','shell.insertBefore(preview,content)',
    'SkillForge.getDraft()','CharacterStudioArt','requestAnimationFrame(frame)',
    'document.hidden','prefers-reduced-motion: reduce']){
    assert.ok(script.includes(phrase),phrase);
  }
  assert.ok(css.includes('.studio-category-panel[hidden]{display:none!important}'));
  assert.ok(css.includes('@media(max-width:380px)'));
});

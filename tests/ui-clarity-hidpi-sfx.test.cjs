'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function highDpi(dpr=2){
  const stats={transforms:[],resizes:0};
  const ctx={setTransform(...args){stats.transforms.push(args);},
    imageSmoothingEnabled:false,imageSmoothingQuality:'low'};
  class Canvas{
    constructor(){this._width=500;this._height=500;}
    get width(){return this._width;}
    set width(v){this._width=v;stats.resizes++;}
    get height(){return this._height;}
    set height(v){this._height=v;stats.resizes++;}
    getContext(){return ctx;}
  }
  const node=new Canvas(),listeners={};
  const world={window:null,document:{getElementById:()=>node},HTMLCanvasElement:Canvas,
    devicePixelRatio:dpr,addEventListener(type,fn){listeners[type]=fn;},console};
  world.window=world;vm.createContext(world);
  vm.runInContext(read('js/features/arena-resolution.js'),world);
  return {node,ctx,stats,listeners,world};
}
test('DPR two scales actual pixels while preserving every arena collision coordinate',()=>{
  const h=highDpi(2);
  assert.equal(h.node.width,500);
  assert.equal(h.node.height,500);
  assert.equal(h.node._width,1000);
  assert.equal(h.node._height,1000);
  assert.deepEqual(h.stats.transforms.at(-1),[2,0,0,2,0,0]);
  assert.equal(h.ctx.imageSmoothingEnabled,true);
  assert.equal(h.ctx.imageSmoothingQuality,'high');
  h.node.width=700;h.node.height=600;
  assert.equal(h.node._width,1400);
  assert.equal(h.node._height,1200);
  assert.equal(h.node.width,700);
  assert.equal(h.node.height,600);
});
test('DPR changes resize the backing store without changing physics bounds',()=>{
  const h=highDpi(1);
  h.world.devicePixelRatio=2.5;h.listeners.resize();
  assert.equal(h.node.width,500);
  assert.equal(h.node._width,1250);
  assert.equal(h.world.ArenaResolution.scale,2.5);
  h.world.devicePixelRatio=1;h.world.ArenaResolution.sync();
  assert.equal(h.node._width,500);
  const h10=highDpi(3);
  h10.node.width=1156;h10.node.height=1156;
  assert.ok(h10.node._width<=2300,'ten-person backing buffer must remain bounded');
  assert.equal(h10.node.width,1156);
});
test('two-player fighter radius is smaller but other modes and health remain unchanged',()=>{
  const h={window:null,canvas:{width:500,height:500},CHARACTER_DEFS:[],CUSTOM_DEFS:[],
    CosmeticArcade:{applyToFighter(){}},Math,console};
  h.window=h;h.globalThis=h;vm.createContext(h);
  vm.runInContext(read('js/core/engine.js'),h);
  const make=()=>({radius:34,hp:250,maxHp:250,x:0,y:0,vx:0,vy:0});
  const defs=Array.from({length:10},()=>({createInstance:make}));
  const duo=h.placeFighters(defs.slice(0,2));
  assert.equal(duo.length,2);
  for(const fighter of duo){
    assert.equal(fighter.radius,28.9);
    assert.equal(fighter.baseRadius,28.9);
    assert.equal(fighter.hp,250);
  }
  const trio=h.placeFighters(defs.slice(0,3));
  assert.ok(trio.every(f=>f.radius===34));
  assert.ok(trio.every(f=>f.baseRadius===undefined));
  const group=h.placeFighters(defs);
  assert.ok(group.every(f=>f.radius===34));
  assert.equal(h.canvas.width,500);
});
test('procedural SFX are damped and dynamically limited, while music remains separate',()=>{
  const s=read('js/features/vfx-audio.js');
  assert.ok(s.includes("f.type='lowpass'"),'percussive noise is filtered');
  assert.ok(s.includes("limiter.threshold.value=-20"),'a compressor must protect against loud peaks');
  assert.ok(s.includes('recentVoices.length>=7'),'rapid sound stacking must have a bounded voice budget');
  assert.ok(s.includes("kind==='hit'")&&s.includes("kind==='heavy'")&&s.includes("kind==='dash'"));
  assert.ok(s.includes("kind==='heal'")&&s.includes("kind==='shield'")&&s.includes("kind==='lightning'"));
  assert.ok(s.includes("master.gain.value=muted?0:.18"));
  assert.ok(s.includes("setMuted(value){muted=!!value"));
  assert.ok(!s.includes("tone(625,990"),'the previous very high bright synth beep is removed');
  assert.ok(read('js/features/background-music.js').includes('assets/music/main.mp3'));
});
test('CSS animation supports UI panels and reduced-motion accessibility',()=>{
  const css=read('css/style.css');
  assert.ok(css.includes('@keyframes arena-panel-appear'));
  assert.ok(css.includes('@keyframes arena-modal-appear'));
  assert.ok(css.includes('.character-studio-dialog[open]'));
  assert.ok(css.includes('(prefers-reduced-motion:reduce)'));
  assert.ok(css.includes('transform:none!important'));
  assert.ok(css.includes('opacity:0'));
  const html=read('index.html');
  assert.ok(html.indexOf('js/features/arena-resolution.js')<
    html.indexOf('js/core/engine.js'),'high-DPI logical canvas must be ready before engine');
  assert.ok(read('js/features/battle-effects.js').includes('ArenaResolution?.sync?.()'));
});
test('names, numeric text and vector fighter art render with clearer typography',()=>{
  const r=read('js/core/render.js');
  assert.ok(r.includes("ctx.createRadialGradient"),'fallback vector art gets a smooth sculpted shape');
  assert.ok(r.includes("ctx.strokeText(p.name[0]"),'fighter initials are outlined');
  assert.ok(r.includes("ctx.strokeText(f.text"),'floating numbers have high contrast outlines');
  assert.ok(r.includes('700 14px'),'arena names should be more legible');
  const audio=read('js/features/vfx-audio.js');
  assert.ok(audio.includes("750 12.5px"),'skill labels should be legible');
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../js/features/tower-controls.js'),'utf8');
function setup(){
  const nodes=new Map(),events={},calls={cast:[],updates:0};
  class Element{
    constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.style={};this.dataset={};this.hidden=false;this.disabled=false;}
    set id(id){this._id=id;nodes.set(id,this);}
    get id(){return this._id;}
    set innerHTML(html){
      this._html=html;
      if(this.tag==='button'){
        this.children=[{textContent:''},{textContent:''},{textContent:''}];
      }
      for(const m of html.matchAll(/id="([^"]+)"/g))new Element().id=m[1];
    }
    append(...children){this.children.push(...children);}
    setAttribute(k,v){this[k]=v;}
    addEventListener(event,fn){this.listeners[event]=fn;}
    getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
    setPointerCapture(){}
  }
  const arena=new Element();arena.id='tower-arena-slot';
  const doc={getElementById:id=>nodes.get(id)||null,
    createElement:tag=>new Element(tag),addEventListener:(type,fn)=>{events['document:'+type]=fn;}};
  const tower={active:true,mode:'manual',stage:'fighting'};
  const fighter={playerNum:1,hp:250,maxHp:250,x:100,y:100,vx:0,vy:0,
    speedMultiplier:1,forgeDash:0,forge:{speed:3,skills:Array.from({length:4},(_,i)=>({name:'스킬'+i,cooldown:2}))},
    forgeTicks:[120,120,120,120]};
  const opponent={playerNum:2,hp:200,maxHp:200,x:180,y:100};
  const w={window:null,document:doc,console,Math,players:[fighter,opponent],
    isPlaying:true,isGameOver:false,ArenaTower:tower,
    ArenaScreenRouter:{active:'tower',activeTowerTab:'tower'},
    SkillForge:{enableManual(p){p.manualTower=true;return true;},
      cooldownFrames(){return 120;},manualCast(p,i,target){
        calls.cast.push(i);return p.manualTower&&target?.hp>0;
      },manualUpdate(){calls.updates++;}},
    ForgeExpansion:{blocked(){return false;}},
    getClosestAliveEnemy(){return opponent;},
    addEventListener:(type,fn)=>{events[type]=fn;}
  };
  const pause=new Element('button');pause.id='tower-pause';
  pause.click=()=>{w.isPlaying=!w.isPlaying;};
  tower.forfeit=()=>{tower.stage='lost';tower.active=false;return true;};
  w.window=w;vm.createContext(w);vm.runInContext(src,w);
  const el=id=>nodes.get(id),controller=w.ArenaTowerControls;
  assert.ok(controller);
  assert.equal(controller.prepare(fighter),true);controller.refresh();
  return {w,tower,fighter,opponent,el,events,calls,controller};
}
function keyboard(h,key,event='keydown',extra={}){
  const e={key,target:{closest(){return null;}},preventDefault(){this.prevented=true;},...extra};
  h.events[event](e);return e;
}
test('WASD and arrow-key player movement is isolated to active manual Tower rounds',()=>{
  const h=setup();
  keyboard(h,'d');keyboard(h,'w');
  assert.equal(h.controller.update(h.fighter,h.opponent),true);
  assert.ok(h.fighter.vx>0&&h.fighter.vy<0);
  assert.ok(Math.hypot(h.fighter.vx,h.fighter.vy)<=3.001);
  keyboard(h,'d','keyup');keyboard(h,'w','keyup');
  h.controller.update(h.fighter,h.opponent);
  assert.equal(h.fighter.vx,0);assert.equal(h.fighter.vy,0);
  h.tower.mode='auto';h.controller.refresh();
  keyboard(h,'a');assert.equal(h.controller.update(h.fighter,h.opponent),false);
  assert.equal(h.fighter.vx,0);
});
test('Q/E/R/F cast only while live; typing in inputs does not trigger combat',()=>{
  const h=setup();
  keyboard(h,'q');keyboard(h,'e');keyboard(h,'r');keyboard(h,'f');
  assert.deepEqual(h.calls.cast,[0,1,2,3]);
  keyboard(h,'q','keydown',{repeat:true});
  keyboard(h,'q','keydown',{target:{closest(){return {};}}});
  assert.deepEqual(h.calls.cast,[0,1,2,3]);
  h.w.isPlaying=false;keyboard(h,'q');
  assert.deepEqual(h.calls.cast,[0,1,2,3],'paused Tower rejects skill activation');
  h.w.isPlaying=true;h.tower.stage='lost';keyboard(h,'q');
  assert.deepEqual(h.calls.cast,[0,1,2,3],'ended Tower rejects skill activation');
});
test('touch joystick drives movement and clears on release, blur, or mode exit',()=>{
  const h=setup(),stick=h.el('tower-joystick');
  stick.listeners.pointerdown({pointerId:7,clientX:83,clientY:50,preventDefault(){}});
  assert.ok(h.controller.input.touchX>0);
  h.controller.update(h.fighter,h.opponent);
  assert.ok(h.fighter.vx>0);
  stick.listeners.pointerup({pointerId:7});
  assert.equal(h.controller.input.touchX,0);
  h.events.blur();
  assert.deepEqual(Array.from(h.controller.input.keys),[]);
  h.w.ArenaScreenRouter.activeTowerTab='free';h.controller.refresh();
  assert.equal(h.el('tower-manual-controls').hidden,true);
});
test('manual controls are scoped to Tower and appear after the arena',()=>{
  const h=setup();
  assert.equal(h.el('tower-manual-controls').hidden,false);
  assert.equal(h.el('tower-manual-abilities').children.length,4);
  assert.ok(h.el('tower-arena-slot').children.includes(h.el('tower-manual-controls')));
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(html,/js\/features\/tower-controls\.js/);
  assert.ok(!html.includes('id="tower-speed"'));
});

test('focused HUD shows floor, both hit points and combat controls without relying on old HUD',()=>{
  const h=setup();
  assert.equal(h.el('tower-manual-hud').hidden,false);
  assert.equal(h.el('tower-manual-floor').textContent,'1 / 10F');
  assert.equal(h.el('tower-manual-player-hp').textContent,'250 / 250');
  assert.equal(h.el('tower-manual-enemy-hp').textContent,'200 / 200');
  assert.equal(h.el('tower-manual-player-bar').style.width,'100.0%');
  h.fighter.hp=100;h.opponent.hp=50;h.controller.refresh();
  assert.equal(h.el('tower-manual-player-bar').style.width,'40.0%');
  assert.equal(h.el('tower-manual-enemy-bar').style.width,'25.0%');
});
test('compact HUD pauses and resumes the underlying Tower and blocks controls when paused',()=>{
  const h=setup(),pause=h.el('tower-manual-pause');
  keyboard(h,'d');h.controller.update(h.fighter,h.opponent);
  assert.ok(h.fighter.vx>0);
  pause.listeners.click();
  assert.equal(h.w.isPlaying,false);
  assert.equal(pause.textContent,'▶ 계속');
  assert.deepEqual(Array.from(h.controller.input.keys),[],'pause releases active keys');
  assert.equal(h.controller.update(h.fighter,h.opponent),false);
  assert.equal(h.el('tower-manual-hud').hidden,false,'paused combat retains its controls');
  pause.listeners.click();
  assert.equal(h.w.isPlaying,true);
  assert.equal(pause.textContent,'⏸ 일시정지');
  h.el('tower-manual-leave').listeners.click();
  assert.equal(h.tower.active,false);
  assert.equal(h.el('tower-manual-hud').hidden,true);
  assert.equal(h.el('tower-manual-controls').hidden,true);
});
test('responsive focus CSS hides optional panels but keeps canvas, HP, speed and skills',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../css/tower-mine-ui.css'),'utf8');
  assert.match(css,/#screen-tower\[data-manual-focus="true"\] #tower-mode-slot/);
  assert.match(css,/#screen-tower\[data-manual-focus="true"\] #tower-arena-slot/);
  assert.match(css,/#tower-manual-hud\[hidden\]/);
  assert.match(css,/#tower-manual-player-bar|tower-manual-hp-track/);
  assert.match(css,/media\(pointer:coarse\)/);
  assert.match(css,/\.tower-manual-abilities/);
  assert.match(css,/#btn-stop/);
});

test('touch joystick remains active while another touch presses a skill without double firing',()=>{
  const h=setup(),stick=h.el('tower-joystick');
  const button=h.el('tower-manual-abilities').children[0];
  stick.listeners.pointerdown({pointerId:11,pointerType:'touch',clientX:82,clientY:50,preventDefault(){}});
  assert.equal(h.controller.input.pointer,11);
  const skillPress={pointerId:22,pointerType:'touch',preventDefault(){this.prevented=true;}};
  button.listeners.pointerdown(skillPress);
  assert.equal(skillPress.prevented,true);
  assert.deepEqual(h.calls.cast,[0],'second finger casts skill immediately');
  assert.equal(h.controller.input.pointer,11,'joystick keeps ownership of original finger');
  assert.ok(h.controller.input.touchX>0,'movement input still active');
  h.controller.update(h.fighter,h.opponent);
  assert.ok(h.fighter.vx>0,'player keeps moving during skill');
  button.listeners.click();
  assert.deepEqual(h.calls.cast,[0],'synthetic click is suppressed after touch');
  stick.listeners.pointerup({pointerId:11});
  assert.equal(h.controller.input.touchX,0);
});
test('manual tracking camera enlarges characters but does not alter physics positions',()=>{
  const h=setup(),old={x:h.fighter.x,y:h.fighter.y,enemyX:h.opponent.x};
  const view=h.controller.camera(500,500);
  assert.ok(view.zoom>1&&view.zoom<=1.2);
  assert.equal(h.fighter.x,old.x);
  assert.equal(h.fighter.y,old.y);
  assert.equal(h.opponent.x,old.enemyX);
  const commands=[],ctx={translate:(...args)=>commands.push(['translate',...args]),
    scale:(...args)=>commands.push(['scale',...args])};
  h.controller.applyView(ctx,view);
  assert.equal(commands.length,3);
  assert.equal(commands[1][1],view.zoom);
  h.tower.mode='auto';
  assert.equal(h.controller.camera(500,500),null,'no zoom in automatic fight');
});
test('mobile layout pins two-thumb controls below expanded arena, and renderer shares one camera',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../css/tower-mine-ui.css'),'utf8');
  assert.match(css,/max-width:800px\) and \(pointer:coarse\)/);
  assert.match(css,/position:fixed!important;bottom:0;left:0;right:0/);
  assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
  assert.match(css,/canvas-wrapper\{[\s\S]*?max-width:none!important/);
  assert.match(css,/\.tower-manual-skill\{[\s\S]*?touch-action:none/);
  const renderer=fs.readFileSync(path.join(__dirname,'../js/core/render.js'),'utf8');
  const effects=fs.readFileSync(path.join(__dirname,'../js/features/battle-effects.js'),'utf8');
  assert.match(renderer,/ArenaTowerControls\?\.camera\?\./);
  assert.match(renderer,/ArenaTowerControls\?\.applyView\?\./);
  assert.match(effects,/ArenaTowerControls\?\.applyView\?\./);
  assert.match(renderer,/p\.manualTower&&p\.hp>0/);
});

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
  const opponent={playerNum:2,hp:200,x:180,y:100};
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

test('compact HP strip updates live statistics without hiding the playfield',()=>{
  const h=setup();
  assert.equal(h.el('tower-focus-hud').hidden,false);
  assert.equal(h.el('tower-focus-player-hp').textContent,'250 / 250');
  assert.equal(h.el('tower-focus-enemy-hp').textContent,'200 / 200');
  h.fighter.hp=125;h.opponent.hp=40;h.controller.refresh();
  assert.equal(h.el('tower-focus-player-hp').textContent,'125 / 250');
  assert.equal(h.el('tower-focus-player-fill').style.width,'50.0%');
  assert.equal(h.el('tower-focus-enemy-fill').style.width,'20.0%');
});
test('intermission shows HP and Next Start overlay without live buttons or movement',()=>{
  const h=setup();
  h.tower.stage='between';h.w.isPlaying=false;
  h.controller.refresh();
  assert.equal(h.el('tower-focus-hud').hidden,false,'next-floor HUD remains visible');
  assert.equal(h.el('tower-manual-controls').hidden,true,'touch attacks are hidden until Start');
  assert.equal(h.el('tower-focus-state').textContent,'다음 층 준비 · 시작 대기');
  keyboard(h,'w');
  assert.equal(h.controller.update(h.fighter,h.opponent),false);
  assert.equal(h.controller.cast(0),false);
  h.tower.stage='fighting';h.w.isPlaying=true;h.controller.refresh();
  assert.equal(h.el('tower-manual-controls').hidden,false);
});
test('focus styling removes duplicate spectator HUD and keeps speed selector',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../css/tower-mine-ui.css'),'utf8');
  assert.match(css,/data-manual-focus="true"/);
  assert.match(css,/#tower-arena-slot \.ui-container\{\s*display:none!important/);
  assert.match(css,/\.tower-intel-details\[open\]/);
  assert.match(css,/#tower-focus-hud/);
  assert.match(css,/\.tower-manual-abilities/);
  const router=fs.readFileSync(path.join(__dirname,'../js/features/screen-router.js'),'utf8');
  assert.match(router,/doc\.getElementById\('tower-arena-slot'\)/);
});

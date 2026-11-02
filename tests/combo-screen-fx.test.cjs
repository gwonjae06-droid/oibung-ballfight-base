'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');
function browser(){
 const map=new Map(),elements=[];
 function make(tag='div'){
  const el={tag,hidden:false,children:[],dataset:{},style:{values:{},setProperty(k,v){this.values[k]=v;}},
   classList:{active:new Set(),add(s){this.active.add(s);},remove(s){this.active.delete(s);}},
   setAttribute(k,v){this[k]=v;},
   append(...kids){for(const kid of kids){this.children.push(kid);kid.parentElement=this;if(kid.id)map.set(kid.id,kid);}},
   prepend(...kids){for(const kid of kids){this.children.unshift(kid);kid.parentElement=this;if(kid.id)map.set(kid.id,kid);}},
   insertBefore(kid){this.append(kid);},
   querySelector(k){
     if(k==='.canvas-wrapper')return this._field||null;
     this.slots??={};return this.slots[k]??(this.slots[k]={textContent:'',style:{}});
   }
  };
  elements.push(el);return el;
 }
 const screen=make('section'),field=make('div'),heading=make('div');
 screen._field=field;screen.append(field);
 const doc={createElement:make,getElementById:id=>map.get(id)||null,
  querySelector(q){
   if(q==='.battle-screen')return screen;
   if(q==='.battle-screen .canvas-wrapper')return field;
   if(q==='.battle-screen .arena-heading')return heading;
   return null;
  }};
 const player={id:'hero',playerNum:1,hp:300,maxHp:300,x:125,y:260,
   _combat2Tick:0,manualTower:false},foe={id:'enemy',playerNum:2,
   hp:300,maxHp:300,x:380,y:250,_combat2Tick:0};
 const g={Math,Date,Object,Number,console,document:doc,canvas:{width:500,height:500},
  players:[player,foe],ArenaScreenRouter:{active:'pve'}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 vm.runInContext(read('js/features/combo-screen-fx.js'),g);
 vm.runInContext(read('js/features/arena-combat-v2.js'),g);
 return {g,doc,field,elements,player,foe};
}
test('only accepted own-player hits can mount the unique arena-wide celebration',()=>{
 const {g,doc,field,elements,player,foe}=browser();
 const combo=g.ArenaCombatV2;combo.reset();
 assert.equal(doc.getElementById('arena-combo-screen-fx'),null,'0 combo is quiet');
 for(let n=1;n<=20;n++){
  player._combat2Tick=n*30;
  assert.equal(combo.signal(player,n%2?'wall-left':'wall-right',7),true);
  const fx=doc.getElementById('arena-combo-screen-fx');
  if(n<3){assert.equal(fx,null);continue;}
  assert.equal(fx.dataset.combo,String(n));
  assert.equal(fx.dataset.tier,String(g.ComboScreenFX.tier(n)));
  assert.equal(fx.parentElement,field,'effect lives inside battle field');
  assert.equal(fx['aria-hidden'],'true','purely decorative layer');
  assert.equal(fx.hidden,false);
  assert.equal(fx.dataset.milestone,['3','5','8','12','20'].includes(String(n))?'true':'false');
  assert.equal(fx.querySelector('.combo-screen-announcement').textContent,
   ({3:'CHAIN HIT',5:'COMBO RUSH',8:'FURY RUSH',12:'UNSTOPPABLE',20:'OVERDRIVE'})[n]||'');
 }
 const initial=field.children.filter(x=>x.id==='arena-combo-screen-fx');
 assert.equal(initial.length,1,'one DOM overlay even after twenty collisions');
 assert.equal(g.ComboScreenFX.tier(2),0);assert.equal(g.ComboScreenFX.tier(99),5);
 assert.equal(player.hp,300);assert.equal(foe.hp,300,'cosmetic FX never changes HP');
 player._combat2Tick++;
 assert.equal(combo.signal(player,'wall-left',7),false,'anti-spam rejects the hit');
 assert.equal(doc.getElementById('arena-combo-screen-fx').dataset.combo,'20');
 foe._combat2Tick=900;
 assert.equal(combo.signal(foe,'wall-right',7),false,'opponent is ignored');
 assert.equal(doc.getElementById('arena-combo-screen-fx').dataset.combo,'20');
 player._combat2Tick+=COMBO_GAP();
 combo.ui(player);
 assert.equal(doc.getElementById('arena-combo-screen-fx').hidden,true,'expired combo cleans up');
 combo.reset();
 assert.equal(doc.getElementById('arena-combo-screen-fx').hidden,true,'round reset cleans up');
 assert.equal(field.children.filter(x=>x.id==='arena-combo-screen-fx').length,1);
 function COMBO_GAP(){return g.ArenaCombatV2.COMBO_GAP+5;}
});
test('effect intensity, responsive layout, pointer safety and reduced motion have CSS safeguards',()=>{
 const css=read('css/combo-screen-fx.css'),html=read('index.html'),engine=read('js/features/arena-combat-v2.js');
 for(const token of ['pointer-events:none','prefers-reduced-motion:reduce',
   'max-width:600px','arenaComboShock','arenaComboRays','arenaComboHeadline','arenaComboMicroJolt',
   '[data-milestone="true"]'])assert.ok(css.includes(token),token);
 assert.ok(html.indexOf('combo-screen-fx.js')<html.indexOf('arena-combat-v2.js'));
 assert.ok(html.includes('combo-screen-fx.css'));
 assert.ok(engine.includes('g.ComboScreenFX?.pulse?.(p,chain)'));
 assert.ok(engine.includes('g.ComboScreenFX?.clear?.()'));
 assert.doesNotMatch(read('js/features/combo-screen-fx.js'),
  /(?:\.hp\s*=|\.vx\s*=|\.vy\s*=|\.maxHp\s*=|\.invincible\s*=|setInterval|setTimeout)/);
});

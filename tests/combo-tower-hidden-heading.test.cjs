'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
  fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function browserDom(){
 const byId=new Map();
 function element(tag='div',className=''){
   const e={tag,className,children:[],parentElement:null,hidden:false,
     offsetWidth:100,dataset:{},style:{},attributes:{},
     setAttribute(name,value){this.attributes[name]=value;},
     classList:{add(){},remove(){}},
     append(n){this.children.push(n);n.parentElement=this; if(n.id)byId.set(n.id,n);},
     insertBefore(n,before){
       const index=before?this.children.indexOf(before):-1;
       if(index<0)this.append(n);
       else{this.children.splice(index,0,n);n.parentElement=this;if(n.id)byId.set(n.id,n);}
     },
     querySelector(sel){
       if(sel==='#arena-commentary')return this.children.find(x=>x.id==='arena-commentary')||null;
       if(sel==='.canvas-wrapper')return this.children.find(x=>x.className==='canvas-wrapper')||null;
       if(sel.startsWith('.combo-')){
         this.slots??={};
         return this.slots[sel]??(this.slots[sel]={style:{},textContent:''});
       }
       return null;
     }
   };return e;
 }
 const screen=element('section','battle-screen');
 const heading=element('div','arena-heading'),commentary=element('div','arena-commentary');
 commentary.id='arena-commentary';
 const canvas=element('div','canvas-wrapper');
 heading.cssHiddenForTower=true;
 screen.append(heading);screen.append(commentary);screen.append(canvas);
 const doc={
   querySelector(sel){
     if(sel==='.battle-screen')return screen;
     if(sel==='.battle-screen .arena-heading')return heading;
     return null;
   },
   getElementById(id){return byId.get(id)||null;},
   createElement:element
 };
 return {screen,heading,commentary,canvas,doc,byId};
}
function run(route){
 const dom=browserDom();
 const g={Math,console,Map,Set,Date,document:dom.doc,
   ArenaScreenRouter:{active:route}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 vm.runInContext(read('js/features/arena-combat-v2.js'),g);
 return {g,...dom};
}
for(const route of ['tower','pve']){
 test('combo HUD renders as live battle-screen sibling, NOT the intentionally hidden arena heading: '+route,()=>{
   const {g,screen,heading,commentary,canvas,byId}=run(route);
   assert.equal(heading.cssHiddenForTower,true,'tower CSS hides the duplicate heading');
   g.ArenaCombatV2.reset();
   const el=byId.get('arena-combo-status');
   assert.ok(el,'HUD must exist as soon as a match resets');
   assert.equal(el.parentElement,screen,'HUD must be a sibling of the hidden heading');
   assert.equal(heading.children.includes(el),false,'never put combo inside hidden heading');
   assert.ok(screen.children.indexOf(el)<screen.children.indexOf(commentary),'counter above live commentary');
   assert.ok(screen.children.indexOf(el)<screen.children.indexOf(canvas),'counter above arena canvas');
   assert.equal(el.hidden,false,'show COMBO 0 even before any physical collision');
   assert.equal(el.dataset.combo,'0');
   const ball={playerNum:1,hp:200,maxHp:200,_combat2Tick:1,manualTower:false};
   assert.equal(g.ArenaCombatV2.signal(ball,'wall-left',7),true);
   assert.equal(el.dataset.combo,'1');
   ball._combat2Tick=44;
   assert.equal(g.ArenaCombatV2.signal(ball,'wall-right',6),true);
   assert.equal(el.dataset.combo,'2','real second rebound must visibly increment counter');
   assert.equal(el.hidden,false);
 });
}
test('regression: CSS intentionally hides only the duplicate tower title, not the combo sibling',()=>{
 const css=read('css/app-shell.css'),js=read('js/features/arena-combat-v2.js'),html=read('index.html');
 assert.match(css,/#screen-tower #tower-arena-slot \.arena-heading,/);
 assert.match(css,/display:none!important/);
 assert.match(js,/screen\.insertBefore\(el,anchor\)/);
 assert.match(js,/doc\.querySelector\?\.\('\.battle-screen'\)/);
 assert.match(html,/arena-combat-v2\.js\?v=4-visible-tower-sibling/);
 assert.match(html,/combo-celebration\.css/);
});

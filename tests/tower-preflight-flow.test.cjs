'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync('js/features/'+name+'.js','utf8');
function setup(){
 const nodes=new Map();
 class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.value='';this.hidden=false;this.style={setProperty(){}};this.attributes={};}
  set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
  set innerHTML(value){this._html=value;for(const match of value.matchAll(/id="([^"]+)"/g))new Element('node').id=match[1];}
  get innerHTML(){return this._html||'';}
  append(...items){this.children.push(...items);}
  prepend(...items){this.children.unshift(...items);}
  replaceChildren(...items){this.children=items;if(items[0]?.value)this.value=items[0].value;}
  addEventListener(name,cb){this.listeners[name]=cb;}
  querySelectorAll(){return [];}
  querySelector(sel){if(sel==='.tower-fighter-tabs')return nodes.get('fighter-tabs');return nodes.get(sel.slice(1))||null;}
  setAttribute(name,value){this.attributes[name]=value;}
 }
 const screen=new Element();screen.id='screen-tower';
 const mount=new Element();mount.id='tower-mode-slot';
 const field=new Element();
 const tabs=new Element();tabs.id='fighter-tabs';
 const doc={createElement:tag=>new Element(tag),getElementById:id=>nodes.get(id)||null,
  querySelector:sel=>sel==='#tower-arena-slot .canvas-wrapper'?field:null};
 const store=new Map();
 const originals=[{id:'bae',name:'배서준',createInstance(n){return {id:this.id,name:this.name,
   playerNum:n,hp:250,maxHp:250,x:160,y:250,forge:null};}}];
 const customs=[{id:'my-custom',name:'내 커스텀',createInstance(n){return {
   id:this.id,name:this.name,playerNum:n,hp:350,maxHp:350,x:160,y:250,
   forge:{signatureVersion:1,skills:[{actions:[{type:'wave',damage:40}]}]}
 };}}];
 const g={Math,Date,console,Set,Map,WeakMap,document:doc,localStorage:{
  getItem:id=>store.get(id)||null,setItem:(id,value)=>store.set(id,value)
 },CHARACTER_DEFS:originals,CUSTOM_DEFS:customs,BEHAVIORS:{},players:[],
 isPlaying:false,isGameOver:false,roundStarted:false,canvas:{width:500,height:500},
 setMatchCount(n){return n===2;},reRollMatch(defs){this.players=defs.map((d,i)=>d.createInstance(i+1));
   this.isPlaying=false;this.roundStarted=false;return true;},
 togglePlay(){this.isPlaying=true;this.roundStarted=true;return true;},
 SkillForge:{register(profile){
   const id='enemy-temp-'+(g.seq=(g.seq||0)+1);
   const d={id,name:profile.name,createInstance(n){return {id,playerNum:n,
     name:profile.name,hp:profile.hp,maxHp:profile.hp,forge:profile,x:343,y:250};}};
   customs.push(d);g.BEHAVIORS[id]={};return id;
  },enableManual(p){p.forge={skills:[{actions:[{type:'wave',damage:30}]}]};return true;}},
 ArenaAncientOne:{create(){return {step(){},clear(){},spectacle:null};}},
 ArenaScreenRouter:{refresh(){},showArena(){}},ArenaTowerSpectacle:{page(){}}
 };
 g.window=g;g.globalThis=g;vm.createContext(g);
 vm.runInContext(read('tower-realms'),g,{filename:'tower-realms.js'});
 vm.runInContext(read('tower-challenge'),g,{filename:'tower-challenge.js'});
 return {g,store,nodes,originals,customs};
}
test('Ancient portal opens character preparation and cannot silently start a battle',()=>{
 const {g,store,nodes}=setup();
 for(const id of g.ArenaTowerRealms.REALMS.map(r=>r.id)){
  const current=JSON.parse(store.get('oibung-tower-v1')||'{"records":{}}');
  current.records[id+'_bae']={best:10};store.set('oibung-tower-v1',JSON.stringify(current));
 }
 assert.equal(g.ArenaTower.beginAncient(),true);
 assert.equal(g.ArenaTower.state.ancient,true);
 assert.equal(g.ArenaTower.stage,'ready');
 assert.equal(g.ArenaTower.active,false);
 assert.equal(g.isPlaying,false);
 assert.equal(g.players.length,0,'the portal alone never spawns fighters');
 assert.equal(nodes.get('tower-start').disabled,false,'start confirmation is shown');
 assert.equal(g.ArenaTower.chooseFighter('my-custom'),true);
 assert.equal(nodes.get('tower-hero').value,'my-custom');
 assert.equal(g.ArenaTower.state.level,10);
 assert.equal(g.ArenaTower.begin(),true);
 assert.equal(g.isPlaying,true);
 assert.equal(g.ArenaTower.stage,'fighting');
 assert.equal(g.players[0].id,'my-custom');
 assert.equal(g.players[1].hp,3000);
 assert.equal(g.CUSTOM_DEFS.length,1,'transient Ancient dummy never enters saved custom roster');
});
test('normal Tower exposes the same selected hero and retains floor-start gating',()=>{
 const {g,nodes}=setup();
 assert.equal(g.ArenaTower.selectRealm('fire'),true);
 assert.equal(g.ArenaTower.chooseFighter('my-custom'),true);
 assert.equal(g.ArenaTower.begin(),true);
 assert.equal(g.players[0].id,'my-custom');
 assert.equal(g.players[1].towerEnemy,true);
 assert.equal(g.ArenaTower.chooseFighter('bae'),false,'cannot switch the fighter mid-run');
 assert.equal(nodes.get('tower-hero').disabled,true);
});
test('preflight has separate card groups, native selection bridge, no duplicate battle speed',()=>{
 const js=read('tower-challenge'),css=fs.readFileSync('css/tower-preflight.css','utf8');
 assert.match(js,/data-fighter-group="basic"/);
 assert.match(js,/data-fighter-group="custom"/);
 assert.match(js,/fighterCards\.replaceChildren\(\)/);
 assert.match(js,/const category=fighterGroup==='custom'\?CUSTOM_DEFS:CHARACTER_DEFS/);
 assert.match(js,/beginAncient\(\)[\s\S]*?show\(\);return true;/);
 assert.doesNotMatch(js,/beginAncient\(\)[^{]*\{[^}]*return begin\(\)/);
 assert.match(css,/data-tower-phase="fighting"/);
 assert.match(css,/\.tower-fighter-roster/);
 assert.match(css,/\.tower-prep-side/);
 assert.ok(fs.readFileSync('index.html','utf8').includes('tower-preflight.css'));
});

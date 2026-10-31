'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=x=>fs.readFileSync(x,'utf8');
function harness(){
 const elements=new Map();const doc={getElementById(id){return elements.get(id)||null;},createElement(type){return {type,textContent:''};}};
 for(const id of ['arena-defeat-analysis','arena-commentary-line','arena-commentary'])elements.set(id,{hidden:false,textContent:'',dataset:{},classList:{add(){},remove(){}},children:[],replaceChildren(){this.children=[];},append(c){this.children.push(c)},offsetWidth:20});
 const w={window:null,document:doc,console};w.window=w;vm.createContext(w);vm.runInContext(read('js/features/battle-director.js'),w);
 return {dir:w.ArenaBattleDirector,elems:elements};
}
test('commentator reports observed defeat cause, not a fabricated killer',()=>{
 const {dir,elems}=harness(),one={name:'용감한 공',hp:200,maxHp:200,forgeEffects:{}},two={name:'가시 공',hp:210,maxHp:210,forgeEffects:{}};
 dir.reset([one,two]);one.hp=180;dir.observe([one,two]);one.forgeEffects.stun={time:45};one.hp=0;dir.observe([one,two]);
 const lines=dir.finish([one,two],two);
 assert.match(lines[0],/체력이 0/);assert.match(lines[0],/180 HP/);
 assert.match(lines[0],/stun/);assert.doesNotMatch(lines[0],/가시 공의 공격/);
 assert.equal(elems.get('arena-defeat-analysis').hidden,false);
 assert.ok(elems.get('arena-defeat-analysis').children.length>=3);
});
test('draw explanation does not invent winner and reset hides previous outcome',()=>{
 const {dir,elems}=harness(),one={name:'가',hp:100,maxHp:100},two={name:'나',hp:100,maxHp:100};
 dir.reset([one,two]);dir.observe([one,two],{overtime:true});const result=dir.finish([one,two],null,'timeout');
 assert.match(result[0],/무승부/);dir.reset([one,two]);assert.equal(elems.get('arena-defeat-analysis').hidden,true);
});
test('theme motion assets are accessible, distinct and honor reduced motion',()=>{
 const html=read('index.html'),css=read('css/arena-cinematic-ui.css'),js=read('js/features/tower-ui-cinematics.js');
 for(const realm of ['time','space','fire','storm','ice','forest'])assert.ok(css.includes('data-tower-realm="'+realm+'"'));
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/ancientAwaken/);
 assert.match(html,/tower-ui-cinematics\.js/);assert.match(html,/arena-commentary-line/);
 assert.match(js,/aria-hidden/);
});
test('PvP exposes host overtime state to guest and visible HUD after a retry-safe channel join',()=>{
 const rt=read('js/features/pvp-runtime.js'),online=read('js/features/pvp-online.js'),net=read('js/features/pvp-supabase.js');
 assert.match(rt,/overtime:\{active:/);assert.match(online,/pvp-overtime-banner/);
 assert.match(online,/pvp-defeat-analysis/);assert.match(net,/attempt<3/);
 assert.match(net,/this\.sb\.removeChannel\(channel\)/);
});

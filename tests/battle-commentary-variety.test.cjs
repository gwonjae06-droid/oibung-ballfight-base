'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('js/features/battle-director.js','utf8');
function boot(){const lines=[],node={dataset:{},classList:{add(){},remove(){}},offsetWidth:1,set textContent(v){this._text=v;lines.push(v)},get textContent(){return this._text}};
 const panel={hidden:true,replaceChildren(){},append(){}},doc={getElementById(id){return id==='arena-commentary-line'?node:id==='arena-defeat-analysis'?panel:null;},createElement(){return {textContent:''}}};
 const w={window:null,document:doc};w.window=w;vm.createContext(w);vm.runInContext(script,w);return {d:w.ArenaBattleDirector,lines};}
const fighter=(playerNum,name)=>({playerNum,name,hp:400,maxHp:400,forgeEffects:{}});
function advance(d,players,n){for(let i=0;i<n;i++)d.observe(players);}
test('actual cast and verified hit are narrated with the authored skill name, target and actual damage',()=>{
 const {d,lines}=boot(),a=fighter(1,'푸른 공'),b=fighter(2,'붉은 공'),act={type:'wave',status:'ice'};
 d.reset([a,b]);d.skillUsed(a,b,act,'빙결 충격파');d.skillHit(a,b,act,29,'ice');b.hp-=29;
 advance(d,[a,b],116);
 assert.ok(lines.some(x=>/빙결 충격파/.test(x)&&/붉은 공/.test(x)&&/빙결 둔화/.test(x)),JSON.stringify(lines));
 assert.ok(!lines.some(x=>/피해.*[0-9]+/.test(x)&&!/29/.test(x)),JSON.stringify(lines));
});
test('rapid repeating skills cannot generate identical adjacent commentary or overflow the queue',()=>{
 const {d,lines}=boot(),a=fighter(1,'번개 공'),b=fighter(2,'수비 공'),action={type:'bolt',damage:3};
 d.reset([a,b]);
 for(let i=0;i<1500;i++){
  if(i%12===0){d.skillUsed(a,b,action,'번개 난사');d.skillHit(a,b,action,3,'none');}
  d.observe([a,b]);
 }
 for(let i=1;i<lines.length;i++)assert.notEqual(lines[i],lines[i-1]);
 assert.ok(lines.length<15,'commentary must stay sparse when a .2s skill spams');
 assert.ok(lines.length>3,'some variety and actual results still appear');
});
test('a missed skill produces a cast line but no fabricated impact or status outcome',()=>{
 const {d,lines}=boot(),a=fighter(1,'초록 공'),b=fighter(2,'빨간 공'),action={type:'shot'};
 d.reset([a,b]);d.skillUsed(a,b,action,'확산탄');advance(d,[a,b],120);
 assert.ok(lines.some(x=>/확산탄/.test(x)));
 assert.ok(!lines.some(x=>/명중|피해|상태가 적용/.test(x)));
});

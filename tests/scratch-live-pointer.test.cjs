'use strict';
const test=require('node:test');
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function world(){
 const g={console,Math,Date,Set,Map,WeakMap,CUSTOM_DEFS:[],BEHAVIORS:{},players:[],
 createHitParticles(){},addFloatingText(){},CHARACTER_PHOTOS:{}};
 g.window=g;g.globalThis=g;vm.createContext(g);
 for(const file of ['js/features/action-registry.js','js/features/signature-program.js',
 'js/features/signature-scratch.js','js/features/signature-live.js','js/features/skill-forge.js'])
 vm.runInContext(read(file),g,{filename:file});
 return g;
}
const action=(type='shot')=>({kind:'action',action:{type,damage:20,radius:120,count:1,speed:5,duration:1,status:'none',link:'after'}});
const p=()=>({forge:{signatureVersion:1},x:0,y:0,hp:80,maxHp:100,_forgeActionClock:1,_scratchEvents:{}});
function tick(g,run,owner,target){
 owner._forgeActionClock++;
 return g.SignatureLive.step(run,owner,target);
}
test('a condition after an action is checked only when that action has finished',()=>{
 const g=world(),owner=p(),target={x:100,y:0};
 const program=[action('wave'),{kind:'if',condition:'hit',then:[action('shot')],else:[action('shield')]}];
 const run=g.SignatureLive.begin(program,owner);
 assert.equal(tick(g,run,owner,target).type,'wave');
 assert.equal(tick(g,run,owner,target),null,'an in-flight action suspends later blocks');
 g.SignatureLive.record(owner,'hit');
 g.SignatureLive.performed(run);
 assert.equal(tick(g,run,owner,target).type,'shot');
});
test('wait-until observes real future hit event, then unlocks follow-up',()=>{
 const g=world(),owner=p(),target={x:100,y:0};
 const program=[action('shot'),{kind:'waitUntil',condition:'hit',timeout:2},action('beam')];
 const run=g.SignatureLive.begin(program,owner);
 assert.equal(tick(g,run,owner,target).type,'shot');
 g.SignatureLive.performed(run);
 assert.equal(tick(g,run,owner,target),null);
 assert.equal(tick(g,run,owner,target),null);
 g.SignatureLive.record(owner,'hit');
 assert.equal(tick(g,run,owner,target).type,'beam');
});
test('failed wait-until ends safely instead of emitting follow-up actions',()=>{
 const g=world(),owner=p(),target={x:100,y:0};
 const run=g.SignatureLive.begin([{kind:'waitUntil',condition:'guard',timeout:.5},action('beam')],owner);
 for(let i=0;i<45;i++)tick(g,run,owner,target);
 assert.equal(run.finished,true);
 assert.equal(run.actions,0);
});
test('repeat-until stops on success and never exceeds bounded execution',()=>{
 const g=world(),owner=p(),target={x:100,y:0};
 const run=g.SignatureLive.begin([{kind:'repeatUntil',condition:'hit',times:3,body:[action('shot')]}],owner);
 assert.equal(tick(g,run,owner,target).type,'shot');
 g.SignatureLive.performed(run);
 assert.equal(tick(g,run,owner,target).type,'shot');
 g.SignatureLive.record(owner,'hit');g.SignatureLive.performed(run);
 assert.equal(tick(g,run,owner,target),null);
 assert.equal(run.finished,true);
});
test('set/change variable blocks influence later branches, with bounded values',()=>{
 const g=world(),owner=p(),target={x:100,y:0};
 const nodes=[{kind:'set',value:2},{kind:'change',value:1},
 {kind:'if',condition:'charge3',then:[action('beam')],else:[action('shield')]}];
 const run=g.SignatureLive.begin(nodes,owner);
 assert.equal(tick(g,run,owner,target).type,'beam');
 assert.equal(run.charge,3);
});
test('a non-existing or invalid action cannot execute arbitrary code',()=>{
 const g=world(),owner=p(),run=g.SignatureLive.begin([{kind:'action',action:{type:'eval',code:'process.exit()'}}],owner);
 assert.equal(tick(g,run,owner,{x:100,y:0}).type,'wave');
});
test('confirmed shield, dodge and movement events publish to live scripts',()=>{
 const g=world(),owner=p();
 const run=g.SignatureLive.begin([{kind:'if',condition:'guard',then:[action('wave')],else:[action('shield')]}],owner);
 g.SignatureLive.record(owner,'guard');
 assert.equal(tick(g,run,owner,{x:70,y:0}).type,'wave');
 const moveRun=g.SignatureLive.begin([{kind:'waitUntil',condition:'move',timeout:2},action('shot')],owner);
 owner._scratchMove=null;
 g.SignatureLive.beginMove(owner,{type:'blink',duration:.2});
 owner.movementOnlyFrames=0;owner.forgeDash=0;
 owner._forgeActionClock++;g.SignatureLive.tickMove(owner);
 assert.equal(tick(g,moveRun,owner,{x:70,y:0}).type,'shot');
});
test('real game routes only queued actions into delayed live interpreter',()=>{
 const src=read('js/features/skill-forge.js');
 assert.match(src,/const run=global.SignatureLive\?\.begin/);
 assert.match(src,/const a=global.SignatureLive\?\.step/);
 assert.match(src,/global.SignatureLive\?\.performed/);
 assert.match(src,/global.SignatureLive\?\.record\?\.\(p,'hit'\)/);
 const tower=read('js/features/tower-encounters.js');
 assert.match(tower,/SignatureLive\?\.record\?\.\(hero,'dodge'\)/);
 const html=read('index.html');
 assert.ok(html.indexOf('signature-scratch.js')<html.indexOf('signature-live.js'));
 assert.ok(html.indexOf('signature-live.js')<html.indexOf('skill-forge.js'));
});
test('editing surface is larger with usable grab handles and pointer drop overlay',()=>{
 const style=read('css/scratch-studio.css'),src=read('js/features/scratch-studio.js');
 assert.match(style,/width:min\(99vw,1880px\)/);
 assert.match(style,/scratch-studio-wide/);
 assert.match(style,/scratch-live-drop-guide/);
 assert.match(src,/pointermove/);
 assert.match(src,/pointerup/);
 assert.match(src,/getBoundingClientRect/);
 assert.match(src,/elementFromPoint/);
 assert.match(src,/pointerType==='touch'/);
 assert.match(src,/closest\('input,select,textarea/);
});

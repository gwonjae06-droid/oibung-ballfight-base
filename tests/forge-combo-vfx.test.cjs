'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function harness(){
 const calls=[],ctx=new Proxy({},{get(o,k){if(k in o)return o[k];return (...args)=>{calls.push([k,...args]);};},set(o,k,v){o[k]=v;return true;}});
 const w={window:null,Math,console};w.window=w;vm.createContext(w);
 vm.runInContext(read('js/features/forge-combo-vfx.js'),w);
 const player={name:'custom',x:130,y:170,hp:200,forge:{effectColor:'#a37be1'},radius:24};
 const enemy={name:'enemy',x:240,y:170,hp:240, radius:24};
 return {fx:w.ForgeComboFX,w,calls,ctx,player,enemy};
}
test('three block connectors produce moving actual Canvas line, arc and polygon geometry',()=>{
 const {fx,ctx,calls,player,enemy}=harness();
 for(const [i,link] of ['and','with','after'].entries())assert.equal(fx.cast(player,{type:['wave','shot','slash'][i],status:'fire'}, {step:i,steps:3,link,castId:5},enemy),true);
 assert.equal(fx.active,3);
 for(let t=0;t<12;t++)fx.tick();fx.draw(ctx);
 assert.ok(calls.filter(x=>x[0]==='arc').length>22,'rotating sigils and sparkles are geometric animations');
 assert.ok(calls.some(x=>x[0]==='quadraticCurveTo'),'connected blocks leave actual flowing ribbons');
 assert.ok(calls.some(x=>x[0]==='lineTo'),'simultaneous and after connectors have distinct trails');
 assert.equal(player.hp,200);assert.equal(enemy.hp,240);
});
test('statuses create contrasting effect geometry without altering actual statuses',()=>{
 const {fx,ctx,calls,player,enemy}=harness();
 for(const status of ['fire','ice','poison'])assert.equal(fx.cast(player,{type:'bolt',status},{steps:2,step:1,link:'with'},enemy),true);
 fx.tick();fx.draw(ctx);
 assert.ok(calls.some(x=>x[0]==='ellipse'),'poison has leaves or spores');
 assert.ok(calls.some(x=>x[0]==='lineTo'),'fire sparks and ice crystal branches are drawn');
 assert.equal(enemy.slowTimer,undefined);assert.equal(enemy.hp,240);
});
test('contact bursts trigger only through explicit hit event and expire',()=>{
 const {fx,ctx,calls,player,enemy}=harness();
 assert.equal(fx.active,0);
 assert.equal(fx.impact(player,enemy,{type:'slash',radius:80,status:'ice'}),true);
 for(let j=0;j<5;j++)fx.tick();fx.draw(ctx);
 assert.ok(calls.some(x=>x[0]==='arc'),'impact radiates from real target');
 for(let j=0;j<30;j++)fx.tick();
 assert.equal(fx.active,0);assert.equal(enemy.hp,240);
});
test('reduced settings suppress dense particles and preserve a readable spell',()=>{
 const {fx,ctx,calls,player,enemy}=harness();fx.setReduced(true);
 fx.cast(player,{type:'shot'}, {steps:2,step:1,link:'after'},enemy);fx.draw(ctx);
 assert.equal(fx.reduced,true);assert.ok(calls.some(x=>x[0]==='arc'));
 fx.preview(ctx,{type:'heal',status:'ice',link:'with',progress:.5});
 assert.equal(enemy.hp,240);fx.clear();assert.equal(fx.active,0);
});
test('single-block skill remains modest; tower AI is not burdened with custom-only trails',()=>{
 const {fx,player,enemy}=harness();
 assert.equal(fx.cast({...player,towerEnemy:true},{type:'wave'},{step:0,steps:3},enemy),false);
 assert.equal(fx.cast(player,{type:'wave'}, {steps:1,step:0},enemy),true);
 assert.equal(fx.active,1);
});
test('connected VFX hooks use actual queued execution not scheduling and are cleared by arena lifecycle',()=>{
 const forge=read('js/features/skill-forge.js'),visual=read('js/features/skill-visuals.js'),studio=read('js/features/studio-workspace.js'),html=read('index.html');
 assert.ok(forge.includes('steps:s.actions.length'));
 assert.ok(forge.indexOf('global.ForgeComboFX?.cast?.(')>forge.indexOf('    execute(p,q.a,castTarget);'));
 assert.ok(forge.includes('global.ForgeComboFX?.impact?.(p,e,action)'));
 assert.ok(visual.includes('global.ForgeComboFX?.tick?.()'));
 assert.ok(visual.includes('global.ForgeComboFX?.draw?.(ctx)'));
 assert.ok(visual.includes('global.ForgeComboFX?.clear?.()'));
 assert.ok(visual.includes('global.ForgeComboFX?.setReduced?.(low)'));
 assert.ok(studio.includes('status:e.action.status,link:e.link'));
 assert.ok(html.indexOf('forge-combo-vfx.js')>html.indexOf('skill-visuals.js'));
 assert.ok(html.indexOf('forge-combo-vfx.js')<html.indexOf('studio-workspace.js'));
});

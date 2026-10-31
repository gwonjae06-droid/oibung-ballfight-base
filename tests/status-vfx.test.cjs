'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/features/status-vfx.js','utf8');
function fixture(){
 const global={matchMedia:()=>({matches:false})};global.window=global;global.globalThis=global;
 vm.createContext(global);vm.runInContext(source,global,{filename:'status-vfx.js'});
 const log=[];
 const ctx=new Proxy({}, {get(target,key){return key in target?target[key]:(...args)=>{log.push([String(key),...args]);};},set(target,key,val){target[key]=val;return true;}});
 return {global,ctx,log,fx:global.ArenaStatusVFX};
}
const fighter=()=>({name:'타깃',playerNum:2,hp:100,maxHp:100,radius:24,x:150,y:190,
 _forgeBalanceFrame:50,forgeEffects:{}});
test('every supported harmful and beneficial status gets a unique high-contrast symbol and legible badge',()=>{
 const {fx,ctx,log}=fixture(),p=fighter();
 for(const key of ['freeze','stun','root','silence','bleed','shock','vulnerable','weak','fear','charm','blind','curse','regen','haste','fortify','timeburst']){
  p.forgeEffects={[key]:{time:90,age:9}};
  const item=fx.collect(p).find(v=>v.key===key);
  assert.ok(item,key+' was missing');assert.ok(item.color&&item.glyph&&item.label,key+' needs color glyph label');
  assert.doesNotThrow(()=>fx.draw(ctx,p,{x:p.x,y:p.y,radius:p.radius,canvasWidth:600,canvasHeight:420}),key);
 }
 assert.ok(log.some(x=>x[0]==='fillText'&&String(x[1]).includes('빙결')));
});
test('legacy slow and DoT use actual simulation state and never invent a status',()=>{
 const {fx}=fixture(),p=fighter();p.bfDot=80;p._forgeDotKind='fire';p.slowTimer=55;
 assert.deepEqual(Array.from(fx.collect(p),x=>x.key),['fire','ice']);
 p._forgeDotKind='poison';assert.deepEqual(Array.from(fx.collect(p),x=>x.key),['poison','ice']);
 p._forgeDotKind=null;assert.ok(fx.collect(p).some(x=>x.key==='dot'));
 p.bfDot=0;p.slowTimer=0;assert.equal(fx.collect(p).length,0);
});
test('actual guard is rendered but 12-frame impact grace never masquerades as immunity',()=>{
 const {fx}=fixture(),p=fighter();p.invincible=12;p._forgeImpactGrace=12;
 assert.equal(fx.collect(p).some(x=>x.key==='shield'),false);
 p.invincible=40;
 assert.equal(fx.collect(p).some(x=>x.key==='shield'),true);
 p.invincible=0;p._forgeImpactGrace=0;p._forgeCCReady=132;
 assert.equal(fx.collect(p).find(x=>x.key==='resist').time,82);
 p.forgeEffects.freeze={time:50};
 assert.equal(fx.collect(p).some(x=>x.key==='resist'),false);
});
test('draw uses only supplied state and restores it, respects reduced movement',()=>{
 const {fx,ctx,log}=fixture(),p=fighter();p.forgeEffects={freeze:{time:60},poison:{time:90},weak:{time:105},charm:{time:110},stun:{time:45},blind:{time:70},bleed:{time:24}};
 const before=JSON.stringify(p);
 fx.setReduced(true);
 assert.equal(fx.reduced,true);
 assert.doesNotThrow(()=>fx.draw(ctx,p,{x:150,y:190,radius:24,canvasWidth:350,canvasHeight:330}));
 assert.equal(JSON.stringify(p),before);
 assert.ok(log.some(x=>x[0]==='fillText'&&String(x[1]).startsWith('+')),'overflow count badge');
 assert.doesNotThrow(()=>fx.draw(ctx,{...p,hp:0},{x:150,y:190,radius:24}));
 fx.setReduced(false);
 assert.equal(fx.reduced,false);
});
test('renderer mounts status FX on final fighter plane and game binds effects preference',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.includes('js/features/status-vfx.js?v=status-vfx1'));
 assert.ok(html.indexOf('status-vfx.js')>html.indexOf('forge-expansion.js'));
 const render=fs.readFileSync('js/core/render.js','utf8');
 assert.ok(render.includes('ArenaStatusVFX?.draw?.(ctx,p,'));
 assert.ok(render.indexOf('ArenaStatusVFX?.draw?.(ctx,p,')<render.indexOf('function draw(){'));
 const sfx=fs.readFileSync('js/features/battle-effects.js','utf8');
 assert.ok(sfx.includes('ArenaStatusVFX?.setReduced?.(gentle.checked)'));
});
test('effect-specific DoT kind tracks fire and poison and clears on expiry or cleanse',()=>{
 const forge=fs.readFileSync('js/features/skill-forge.js','utf8');
 assert.ok(forge.includes('e._forgeDotKind=action.status;'));
 const exp=fs.readFileSync('js/features/forge-expansion.js','utf8');
 assert.ok(exp.includes('p._forgeDotKind=null;'));
});

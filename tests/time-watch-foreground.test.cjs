'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness(){
  const calls=[];
  const ctx=new Proxy({},{
    get(obj,key){
      if(key in obj)return obj[key];
      if(key==='measureText')return text=>({width:text.length*12});
      return (...args)=>{calls.push({kind:key,args});};
    },set(obj,key,value){obj[key]=value;return true;}
  });
  const w={window:null,globalThis:null,Math,Map,Set,console,
    ArenaMotion:{position:p=>p},
    ArenaDepth:{screenPoint:(x,y)=>({x,y}),spriteScale:()=>1},
    AdvancedCombat:{visibleHeight:()=>0}};
  w.window=w;w.globalThis=w;
  vm.createContext(w);vm.runInContext(read('js/features/skill-visuals.js'),w);
  const actor={x:250,y:250,hp:250,maxHp:250,radius:28,vx:1,vy:0,
    forge:{color:'#9fd6e8',effectColor:'#9fd6e8'}};
  return {fx:w.SkillVisuals,ctx,calls,actor,canvas:{width:500,height:500}};
}
test('the time clock overlay is painted AFTER projected fighter billboards but BEFORE hit text',()=>{
  const s=read('js/core/render.js');
  const actors=s.indexOf('airItems.sort((a,b)=>a.depth-b.depth).forEach(item=>item.paint(ctx))');
  const watches=s.indexOf('SkillVisuals?.drawForeground?.(ctx,canvas)');
  const damageText=s.indexOf('floatingTexts.forEach(f=>');
  assert.ok(actors>=0&&watches>actors&&damageText>watches);
  const effects=read('js/features/skill-visuals.js');
  assert.match(effects,/function drawForeground\(ctx,canvas\)/);
  assert.match(effects,/ArenaDepth\?\.screenPoint\?\.\(pos\.x,pos\.y,canvas\)/);
  assert.match(effects,/const rightFits=at\.x\+spacing\+outer\+7<canvas\.width/);
});
test('time stop, acceleration and reversal all draw distinct front-layer clocks',()=>{
  for(const [type,label] of [['timestop','시간정지'],['timeburst','시간가속'],['rewind','시간역행']]){
    const {fx,ctx,calls,actor,canvas}=harness();
    assert.equal(fx.cast(actor,{type,radius:120},null),true);
    fx.drawForeground(ctx,canvas);
    const title=calls.find(c=>c.kind==='fillText'&&c.args[0]===label);
    assert.ok(title,type+' should show its name on the foreground dial');
    assert.ok(calls.some(c=>c.kind==='arc'),type+' should have a clock outline');
    const before=JSON.stringify({x:actor.x,y:actor.y,hp:actor.hp});
    fx.drawForeground(ctx,canvas);
    assert.equal(JSON.stringify({x:actor.x,y:actor.y,hp:actor.hp}),before);
    assert.equal(fx.active,1,'rendering never creates extra combat effects');
  }
});
test('the clock remains beside the actor and inside viewport edges',()=>{
  for(const x of [25,250,475]){
    const {fx,ctx,calls,actor,canvas}=harness();actor.x=x;
    fx.cast(actor,{type:'timeburst',radius:160});
    fx.drawForeground(ctx,canvas);
    const translate=calls.find(c=>c.kind==='translate'&&c.args.length===2);
    assert.ok(translate,'foreground painter must position a clock');
    assert.ok(translate.args[0]>=40&&translate.args[0]<=460,'clock stays inside viewport');
    assert.ok(Math.abs(translate.args[0]-actor.x)>=50,'clock cannot hide behind the actor');
  }
});
test('multiple active clocks from one fighter are collapsed to one front badge',()=>{
  const {fx,ctx,calls,actor,canvas}=harness();
  for(const type of ['timestop','rewind','timeburst'])fx.cast(actor,{type,radius:110});
  fx.drawForeground(ctx,canvas);
  assert.equal(calls.filter(c=>c.kind==='fillText'&&['시간정지','시간가속','시간역행'].includes(c.args[0])).length,1);
  // The active combo is still preserved by the original simulation.
  assert.equal(fx.active,3);
  fx.setReduced(true);
  assert.doesNotThrow(()=>fx.drawForeground(ctx,canvas));
  fx.clear();
  calls.length=0;fx.drawForeground(ctx,canvas);
  assert.equal(calls.length,0,'no ghosts remain after resetting the match');
});

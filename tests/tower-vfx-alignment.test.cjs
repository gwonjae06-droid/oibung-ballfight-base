'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('camera transforms scenery, actors and secondary VFX exactly once',()=>{
 const render=read('js/core/render.js'),effects=read('js/features/battle-effects.js');
 const start=render.indexOf('function draw(){');
 const draw=render.slice(start);
 const camera=draw.indexOf('ArenaTowerControls?.applyView?.');
 const background=draw.indexOf('ArenaTower?.paintBackground?.');
 const extra=draw.indexOf('ArenaFXLayer?.draw?.');
 const restore=draw.indexOf('ctx.restore();ctx.save();',background);
 assert.ok(camera>=0&&background>camera,'background must share the game world camera');
 assert.ok(extra>background&&extra<restore,'extra skill effects must be drawn before world transform is restored');
 assert.match(effects,/window\.ArenaFXLayer=\{draw\(worldCtx\)/);
 assert.doesNotMatch(effects,/ArenaTowerControls\?\.applyView\?\./,'no second camera in VFX renderer');
});
test('a character cannot receive both interpolated actor offsets',()=>{
 const s=read('js/features/battle-effects.js'),motion=read('js/features/motion-smoothing.js');
 assert.match(motion,/ctx\.translate\(dx,dy\)/);
 assert.match(s,/if\(!window\.ArenaMotion&&globalThis\.AdvancedCombat\)/);
 assert.match(read('js/features/skill-visuals.js'),/ArenaMotion\?\.position\?\.\(e\.source\)/);
});
test('stale effects clear before the next roster is drawn even when paused',()=>{
 const s=read('js/features/battle-effects.js');
 assert.match(s,/function syncRoster\(\)/);
 assert.match(s,/draw=function\(\)\{syncRoster\(\);oldDraw\(\);\}/);
 assert.match(s,/SkillVisuals\?\.clear\?\.\(\)/);
});
test('tower effects keep original bright colors while normal white arena still darkens',()=>{
 const source=read('js/core/render.js');
 const helper=source.slice(0,source.indexOf('/* Photo-free renderer'));
 const world={globalThis:{ArenaTower:{active:true},ArenaScreenRouter:{active:'tower'}},Map,Math,Number,String};
 vm.createContext(world);vm.runInContext(helper,world);
 assert.equal(world.arenaEffectColor('#f5ce78'),'#f5ce78');
 world.globalThis.ArenaScreenRouter.active='pve';
 assert.notEqual(world.arenaEffectColor('#f5ce78'),'#f5ce78');
});
test('environment particles render underneath telegraphed hazards',()=>{
 const s=read('js/features/tower-challenge.js');
 const a=s.indexOf('function drawEncounter(ctx)');
 const line=s.slice(a,a+300);
 assert.ok(line.indexOf('ArenaTowerAtmosphere?.particles?.')<line.indexOf('encounter?.draw'));
});

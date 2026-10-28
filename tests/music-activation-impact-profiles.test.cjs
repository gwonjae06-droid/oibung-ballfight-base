'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function physics(){
  const world={window:null,canvas:{width:1000,height:1000},screenShake:0,
    BattleFX:{sound(){}}};
  world.window=world;vm.createContext(world);
  vm.runInContext(read('js/features/impact-physics.js'),world);
  return world.ImpactPhysics;
}
function fighters(){
  return [
    {playerNum:1,x:300,y:300,radius:28,vx:0,vy:0,hp:200},
    {playerNum:2,x:420,y:300,radius:28,vx:0,vy:0,hp:200}
  ];
}
test('contact physical collision is slightly weaker than the same intentional melee hit',()=>{
  const fx=physics(),[a,b]=fighters();
  fx.hit(a,b,25,{type:'slash'});
  const melee=b.impactSpeed;fx.reset();
  const [c,d]=fighters();fx.hit(c,d,25,{type:'contact'});
  const contact=d.impactSpeed;
  assert.ok(contact<melee*.85&&contact>melee*.68,JSON.stringify({melee,contact}));
  assert.equal(d.hp,200);
});
test('projectiles are dramatically weaker, produce minimal shove and never recoil the caster',()=>{
  const projectileTypes=['shot','projectile','homing','pierce','boomerang',
    'arcshot','splitshot','bolt','dung','meteor','starfall','summon','turret'];
  const fx=physics(),[ma,mb]=fighters();fx.hit(ma,mb,25,{type:'slash'});
  const melee=mb.impactSpeed;
  for(const type of projectileTypes){
    fx.reset();const [a,b]=fighters(),before=b.x;
    fx.hit(a,b,25,{type,knockback:9});
    assert.ok(b.impactSpeed<melee*.38,type+' impulse too large');
    assert.ok(b.x-before<=3.1,type+' excessive teleport/nudge');
    assert.equal(a.vx,0,type+' ranged hit must not throw caster backwards');
    assert.equal(b.hp,200,type+' physics must not alter damage');
  }
});
test('projectile and contact source routes correctly tag actual damaging attacks',()=>{
  const skill=read('js/features/skill-forge.js');
  const engine=read('js/core/engine.js');
  assert.match(skill,/ImpactPhysics\?\.hit\?\.\(p,e,d,\{[^\n]+type:action\.type/);
  assert.match(engine,/ImpactPhysics\?\.hit\?\.\(attacker,defender,value,\{[^\n]+type:action\.type/);
  for(const id of ['bae','park','choi'])assert.match(read('js/characters/'+id+'.js'),/type:'contact'/);
  const oh=read('js/characters/oh.js');
  assert.equal((oh.match(/type:'shot'/g)||[]).length,2);
  assert.match(oh,/type:'contact'/);
});
test('one-click music activation unsets persisted mute/off/zero volume and starts audio',async()=>{
  const {MusicPlayer}=require('../js/features/background-music.js');
  const created=[];
  const p=new MusicPlayer({random:()=>0,now:()=>0,schedule:()=>1,cancel:()=>{},
    makeAudio:src=>{
      const a={src,paused:true,volume:0,currentTime:0,
        addEventListener(){},
        play(){this.paused=false;return Promise.resolve();},
        pause(){this.paused=true;}};
      created.push(a);return a;
    }});
  p.setEnabled(false);p.setMuted(true);p.setVolume(0);
  p.playMusic();await Promise.resolve();await Promise.resolve();
  assert.equal(p.enabled,true);
  assert.equal(p.muted,false);
  assert.equal(p.volume,.35);
  assert.equal(p.unlocked,true);
  assert.equal(created.length,1);
  assert.equal(created[0].paused,false);
});
test('arena exposes the music enable control and saved BGM cannot be mistaken for sound effects',()=>{
  const music=read('js/features/background-music.js'),css=read('css/style.css'),html=read('index.html');
  assert.ok(music.includes('bgm-quick-start'));
  assert.ok(music.includes('if(!musicControl(event.target))player.unlock()'));
  assert.ok(music.includes('자동재생 제한'));
  assert.ok(css.includes('.bgm-quick-start'));
  assert.ok(html.includes('js/features/background-music.js'));
  for(const src of ['main','iron-sunlight','iron-sunlight-alt','snowflower-night','snowflower-night-alt'])
    assert.ok(fs.statSync(path.join(__dirname,'..','assets/music',src+'.mp3')).size>800000);
});

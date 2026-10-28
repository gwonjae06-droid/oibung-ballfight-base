'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {MusicPlayer,tracks}=require('../js/features/background-music');
function setup(){
  let time=0,timer=null,denied=false;
  const audio=[];
  const p=new MusicPlayer({random:()=>0,now:()=>time,schedule:fn=>(timer=fn,1),cancel:()=>{timer=null;},makeAudio:src=>{
    const listeners={};
    const a={src,currentTime:0,paused:true,ended:false,volume:0,muted:false,
      addEventListener:(type,fn)=>listeners[type]=fn,
      play(){if(denied)return Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));this.paused=false;return Promise.resolve();},
      pause(){this.paused=true;},emit(type){listeners[type]?.();}};
    audio.push(a);return a;
  }});
  return {p,audio,deny:v=>denied=v,async fade(){await Promise.resolve();time+=700;timer?.();await Promise.resolve();},async half(){await Promise.resolve();time+=325;timer?.();}};
}
test('waits for a user gesture and chooses a random menu song',async()=>{
  const h=setup();assert.equal(h.audio.length,0);h.p.unlock();await h.fade();
  assert.equal(h.p.current,h.p.menu);assert.equal(h.p.current.audio.paused,false);assert.equal(h.p.current.audio.volume,.35);
});
test('crossfades to a different battle track and resumes the same menu position',async()=>{
  const h=setup();h.p.unlock();await h.fade();const menu=h.p.menu;menu.audio.currentTime=12;
  h.p.setBattle(true);await h.half();
  assert.notEqual(h.p.current.track,menu.track);assert.equal(menu.gain,.5);assert.equal(h.p.current.gain,.5);
  await h.fade();assert.equal(menu.audio.paused,true);
  h.p.setBattle(false);await h.fade();assert.equal(h.p.current,menu);assert.equal(menu.audio.currentTime,12);assert.equal(h.p.voices.size,1);
});
test('pause freezes all voices and resumes the same battle song',async()=>{
  const h=setup();h.p.unlock();await h.fade();h.p.setBattle(true);await h.half();const battle=h.p.current;
  battle.audio.currentTime=7;h.p.setBattle(true,true);await h.fade();assert.ok(h.audio.every(a=>a.paused));
  h.p.setBattle(true,false);await h.fade();assert.equal(h.p.current,battle);assert.equal(battle.audio.currentTime,7);assert.equal(battle.audio.paused,false);
});
test('manual music stop survives round changes and next song until explicitly resumed',async()=>{
  const h=setup();h.p.unlock();await h.fade();h.p.setEnabled(false);h.p.setBattle(true);h.p.next();h.p.setBattle(false);await h.fade();
  assert.ok(h.audio.every(a=>a.paused));h.p.setEnabled(true);await h.fade();assert.equal(h.p.current.audio.paused,false);
});
test('ended advances without immediate repeat or consuming the saved menu song',async()=>{
  const h=setup();h.p.unlock();await h.fade();const first=h.p.current;first.audio.emit('ended');await h.fade();assert.notEqual(h.p.current.track,first.track);
  const menu=h.p.menu;h.p.setBattle(true);await h.fade();const battle=h.p.current;battle.audio.emit('ended');await h.fade();
  assert.notEqual(h.p.current.track,battle.track);assert.notEqual(h.p.current.track,menu.track);assert.equal(h.p.menu,menu);
});
test('autoplay rejection is caught and retried on the next gesture',async()=>{
  const h=setup();h.deny(true);h.p.unlock();await h.fade();assert.equal(h.p.blocked,true);
  h.deny(false);h.p.unlock();await h.fade();assert.equal(h.p.blocked,false);assert.equal(h.p.current.audio.paused,false);
});
test('rapid changes do not leave stale audio running',async()=>{
  const h=setup();h.p.unlock();h.p.setBattle(true);h.p.setBattle(false);h.p.setBattle(true);h.p.setBattle(true,true);await h.fade();
  assert.ok(h.audio.every(a=>a.paused));h.p.setBattle(false);await h.fade();assert.equal(h.audio.filter(a=>!a.paused).length,1);assert.equal(h.p.current,h.p.menu);
});
test('late play resolution after stop cannot restart audio',async()=>{
  const h=setup();h.p.unlock();await h.fade();let resolve;
  const a=h.p.current.audio;a.play=()=>new Promise(r=>resolve=()=>{a.paused=false;r();});
  h.p.transition(h.p.current);h.p.setEnabled(false);resolve();await h.fade();assert.equal(a.paused,true);
});
test('mute and volume apply to both crossfade voices and are bounded',async()=>{
  const h=setup();h.p.unlock();await h.fade();h.p.setBattle(true);await h.half();h.p.setMuted(true);h.p.setVolume(.8);
  for(const v of h.p.voices){assert.equal(v.audio.muted,true);assert.equal(v.audio.volume,.4);}
  h.p.setVolume(5);assert.equal(h.p.volume,1);h.p.setVolume(NaN);assert.equal(h.p.volume,1);h.p.setVolume(-1);assert.equal(h.p.volume,0);
});
test('broken media is skipped and all failures terminate without an endless retry loop',async()=>{
  const h=setup();h.p.unlock();await h.fade();
  for(let i=0;i<tracks.length;i++){h.p.current.audio.emit('error');await h.fade();}
  assert.equal(h.p.current,null);assert.equal(h.p.failed.size,tracks.length);assert.ok(h.audio.every(a=>a.paused));
});
test('repeated rounds keep the menu and release old battle elements',async()=>{
  const h=setup();h.p.unlock();await h.fade();const menu=h.p.menu;
  for(let i=0;i<15;i++){h.p.setBattle(true);await h.fade();assert.equal(h.p.voices.size,2);h.p.setBattle(false);await h.fade();assert.equal(h.p.menu,menu);assert.equal(h.p.voices.size,1);}
});
test('the playlist ships five distinct MP3 files rather than missing placeholders',()=>{
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  const hashes=tracks.map(t=>{const bytes=fs.readFileSync(path.join(__dirname,'..',t.src));assert.ok(bytes.length>800000);return crypto.createHash('sha256').update(bytes).digest('hex');});
  assert.equal(new Set(hashes).size,5);
});

/* Independent music transport: synthesized combat effects stay in BattleFX. */
(function(global){
  'use strict';
  const tracks=[
    {src:'assets/music/main.mp3',title:'MAIN'},
    {src:'assets/music/iron-sunlight.mp3',title:'Iron Sunlight'},
    {src:'assets/music/iron-sunlight-alt.mp3',title:'Iron Sunlight (1)'},
    {src:'assets/music/snowflower-night.mp3',title:'참깨도끼 눈꽃밤'},
    {src:'assets/music/snowflower-night-alt.mp3',title:'참깨도끼 눈꽃밤 (1)'}
  ];
  class MusicPlayer {
    constructor(options={}){
      this.tracks=options.tracks||tracks;
      this.makeAudio=options.makeAudio||(src=>new global.Audio(src));
      this.random=options.random||Math.random;
      this.schedule=options.schedule||((fn)=>setInterval(fn,30));
      this.cancel=options.cancel||(id=>clearInterval(id));
      this.now=options.now||(()=>performance.now());
      this.changed=options.changed||(()=>{});
      this.mode='menu';this.paused=false;this.enabled=true;this.muted=false;
      this.volume=.35;this.unlocked=false;this.blocked=false;this.failed=new Set();
      this.voices=new Set();this.menu=null;this.current=null;this.timer=null;this.revision=0;
    }
    pick(excluded=[]){
      const pool=this.tracks.filter(t=>!excluded.includes(t)&&!this.failed.has(t));
      return pool.length?pool[Math.floor(this.random()*pool.length)]:null;
    }
    voice(track){
      if(!track)return null;
      const audio=this.makeAudio(track.src),v={track,audio,gain:0};
      audio.preload='metadata';audio.loop=false;audio.volume=0;
      audio.addEventListener('ended',()=>{if(this.current===v)this.next();});
      audio.addEventListener('error',()=>this.failure(v));
      this.voices.add(v);return v;
    }
    allowed(){return this.unlocked&&this.enabled&&!this.paused;}
    volumes(){for(const v of this.voices){v.audio.muted=this.muted;v.audio.volume=this.volume*v.gain;}}
    halt(){
      this.revision++;
      if(this.timer!==null)this.cancel(this.timer);
      this.timer=null;
    }
    prune(){
      for(const v of this.voices){
        if(v!==this.current){v.audio.pause();v.gain=0;}
        if(v!==this.current&&v!==this.menu)this.voices.delete(v);
      }
    }
    async transition(target){
      this.halt();this.current=target;this.blocked=false;
      if(!target){this.prune();this.changed();return;}
      if(!this.allowed()){
        this.prune();target.audio.pause();target.gain=1;this.volumes();this.changed();return;
      }
      const revision=this.revision;
      try{await target.audio.play();}
      catch(error){
        if(revision!==this.revision)return;
        if(error.name==='NotAllowedError'){
          this.blocked=true;this.prune();target.gain=1;this.volumes();this.changed();
        }else if(error.name!=='AbortError')this.failure(target);
        return;
      }
      if(revision!==this.revision){if(this.current!==target||!this.allowed())target.audio.pause();return;}
      const start=this.now(),levels=new Map([...this.voices].map(v=>[v,v.gain]));
      this.timer=this.schedule(()=>{
        const progress=Math.min(1,(this.now()-start)/650);
        for(const [v,level] of levels)v.gain=level+((v===target?1:0)-level)*progress;
        this.volumes();
        if(progress===1){this.halt();this.prune();}
      });
      this.changed();
    }
    failure(v){
      if(!this.voices.has(v)||this.failed.has(v.track))return;
      this.failed.add(v.track);v.audio.pause();
      if(this.menu===v)this.menu=null;
      if(this.current===v)this.next();
    }
    unlock(){
      this.unlocked=true;
      if(!this.current)this.next();
      else if(this.blocked)this.transition(this.current);
    }
    next(){
      const excluded=[this.current?.track];
      if(this.mode==='battle')excluded.push(this.menu?.track);
      const v=this.voice(this.pick(excluded));
      if(this.mode==='menu')this.menu=v;
      this.transition(v);
    }
    setBattle(active,paused=false){
      const mode=active?'battle':'menu';
      if(mode===this.mode){this.setPaused(active&&paused);return;}
      this.mode=mode;this.paused=active&&paused;
      if(active){
        if(!this.menu)this.menu=this.voice(this.pick());
        this.transition(this.voice(this.pick([this.menu?.track,this.current?.track])));
      }else{
        if(!this.menu||this.menu.audio.ended)this.menu=this.voice(this.pick([this.current?.track]));
        this.transition(this.menu);
      }
    }
    setPaused(value){
      if(this.paused===!!value)return;
      this.paused=!!value;this.transition(this.current);
    }
    setEnabled(value){this.enabled=!!value;this.transition(this.current);}
    setMuted(value){this.muted=!!value;this.volumes();this.changed();}
    setVolume(value){if(Number.isFinite(Number(value)))this.volume=Math.max(0,Math.min(1,Number(value)));this.volumes();this.changed();}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={MusicPlayer,tracks};
  if(!global.document)return;
  const player=new MusicPlayer();global.BackgroundMusic=player;
  global.document.addEventListener('pointerdown',()=>player.unlock());
  global.document.addEventListener('keydown',()=>player.unlock());
  global.addEventListener('DOMContentLoaded',()=>{
    const panel=document.querySelector('.bf-tools');if(!panel)return;
    const bar=document.createElement('div');bar.className='bf-music';
    bar.innerHTML='<button type="button" id="bgm-toggle" aria-pressed="true">음악 중지</button> <button type="button" id="bgm-next">다음 곡</button> <button type="button" id="bgm-mute" aria-pressed="false">음악 음소거</button> <label for="bgm-volume">음악 볼륨 <input id="bgm-volume" type="range" min="0" max="100" value="35"></label> <span id="bgm-status" role="status" aria-live="polite"></span>';
    panel.append(bar);
    const get=id=>bar.querySelector('#'+id);
    const save=()=>{try{localStorage.setItem('ballfight-music',JSON.stringify({volume:player.volume,muted:player.muted,enabled:player.enabled}));}catch(_){}};
    try{
      const saved=JSON.parse(localStorage.getItem('ballfight-music')||'null');
      if(saved){if(typeof saved.volume==='number')player.setVolume(saved.volume);player.muted=saved.muted===true;player.enabled=saved.enabled!==false;}
    }catch(_){}
    player.changed=()=>{
      get('bgm-toggle').textContent=player.enabled?'음악 중지':'음악 재생';
      get('bgm-toggle').setAttribute('aria-pressed',String(player.enabled));
      get('bgm-mute').textContent=player.muted?'음악 음소거 해제':'음악 음소거';
      get('bgm-mute').setAttribute('aria-pressed',String(player.muted));
      get('bgm-volume').value=String(Math.round(player.volume*100));
      const state=!player.enabled?'중지됨':player.paused?'경기 일시정지':!player.unlocked||player.blocked?'클릭하거나 키를 누르면 음악이 시작됩니다':!player.current?'재생 가능한 음악이 없습니다':player.mode==='battle'?'전투':'메인';
      get('bgm-status').textContent=state+(player.current?' · '+player.current.track.title:'');
    };
    get('bgm-toggle').addEventListener('click',()=>{player.unlock();player.setEnabled(!player.enabled);save();});
    get('bgm-next').addEventListener('click',()=>{player.unlock();player.next();});
    get('bgm-mute').addEventListener('click',()=>{player.setMuted(!player.muted);save();});
    get('bgm-volume').addEventListener('input',event=>{player.setVolume(Number(event.target.value)/100);save();});
    player.changed();
  });
})(typeof window==='undefined'?globalThis:window);

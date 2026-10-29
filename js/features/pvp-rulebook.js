/* Browser build of workers/pvp-rules.mjs. Generated from the exact same
 * deterministic PvP rules to avoid .mjs MIME/deployment errors on Pages. */
(function(global){
'use strict';
/* Shared, server-authoritative rules for Oibung PvP v1.
 * Ability statistics use fixed PvP balance values (not client supplied).
 * When hosted by Supabase, player A computes the simulation; this does not
 * provide server-authoritative anti-cheat. The Tower engine remains untouched. */
const WIDTH=680,HEIGHT=460,MAX_SECONDS=120;
const ABILITIES={
  shot:{kind:'shot',damage:17,range:480,cooldown:1.7},
  homing:{kind:'shot',damage:19,range:480,cooldown:2.5},
  pierce:{kind:'shot',damage:22,range:480,cooldown:3},
  arcshot:{kind:'shot',damage:21,range:480,cooldown:3},
  splitshot:{kind:'shot',damage:16,range:480,cooldown:2.4},
  dung:{kind:'shot',damage:15,range:480,cooldown:2.7},
  wave:{kind:'wave',damage:20,range:125,cooldown:3},
  nova:{kind:'wave',damage:24,range:95,cooldown:3.6},
  spinslash:{kind:'wave',damage:24,range:88,cooldown:3.1},
  chain:{kind:'wave',damage:22,range:155,cooldown:3.8},
  blackhole:{kind:'wave',damage:19,range:165,cooldown:4.4},
  zone:{kind:'wave',damage:21,range:125,cooldown:3.5},
  meteor:{kind:'wave',damage:28,range:145,cooldown:4.8},
  bolt:{kind:'wave',damage:23,range:160,cooldown:3.6},
  starfall:{kind:'wave',damage:25,range:160,cooldown:4},
  trap:{kind:'wave',damage:17,range:95,cooldown:3.2},
  uppercut:{kind:'melee',damage:27,range:76,cooldown:2.6},
  slash:{kind:'melee',damage:22,range:90,cooldown:2.2},
  thrust:{kind:'melee',damage:25,range:112,cooldown:2.9},
  aircombo:{kind:'melee',damage:25,range:90,cooldown:3},
  dive:{kind:'melee',damage:23,range:92,cooldown:3},
  drain:{kind:'drain',damage:19,range:145,cooldown:4.5},
  beam:{kind:'beam',damage:24,range:245,cooldown:3.7},
  dash:{kind:'dash',damage:0,range:100,cooldown:3.4},
  blink:{kind:'dash',damage:0,range:120,cooldown:4},
  retreat:{kind:'retreat',damage:0,range:105,cooldown:3.3},
  shield:{kind:'shield',damage:0,range:0,cooldown:5.2},
  fortify:{kind:'shield',damage:0,range:0,cooldown:5.4},
  wall:{kind:'shield',damage:0,range:0,cooldown:5.4},
  heal:{kind:'heal',damage:0,range:0,cooldown:5.1},
  regen:{kind:'heal',damage:0,range:0,cooldown:5.7},
  lifebloom:{kind:'heal',damage:0,range:0,cooldown:5.7},
  haste:{kind:'haste',damage:0,range:0,cooldown:5},
  timeburst:{kind:'haste',damage:0,range:0,cooldown:5.8},
  timestop:{kind:'stun',damage:0,range:130,cooldown:6},
  stun:{kind:'stun',damage:0,range:130,cooldown:5.8},
  summon:{kind:'shot',damage:20,range:480,cooldown:4.5},
  turret:{kind:'shot',damage:20,range:480,cooldown:4.2},
  orbit:{kind:'wave',damage:17,range:130,cooldown:4},
  pull:{kind:'wave',damage:17,range:145,cooldown:3.4}
};
const BUILTINS={
  bae:[['화염 돌진','dash'],['충격파','wave'],['회전베기','spinslash'],['방어막','shield']],
  oh:[['어둠 탄환','shot'],['순간이동','blink'],['흡혈','drain'],['회복','heal']],
  lee:[['찌르기','thrust'],['가속','haste'],['낙뢰','bolt'],['방어막','shield']],
  park:[['분화','nova'],['어퍼컷','uppercut'],['방어막','shield'],['돌진','dash']],
  choi:[['투사체','shot'],['지속 장판','zone'],['장벽','wall'],['주변 폭발','nova']]
};
const DEFAULT=[['투사체','shot'],['충격파','wave'],['돌진','dash'],['방어막','shield']];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(Number(n))?Number(n):a));
function normalizeProfile(raw){
  const name=String(raw?.name||'플레이어').replace(/[<>\r\n]/g,'').slice(0,20)||'플레이어';
  const color=/^#[0-9a-f]{6}$/i.test(raw?.color||'')?raw.color:'#4f86c6';
  const id=String(raw?.id||'').slice(0,32);
  // A custom fighter's 1–4 actual authored skills are the entire kit.
  // Only built-in fighters receive their explicitly defined four skills.
  const src=Array.isArray(raw?.skills)?raw.skills:
    (BUILTINS[id]||DEFAULT).map(([name,type])=>({name,type}));
  const skills=src.slice(0,4).map((s,i)=>{
    const rawActions=Array.isArray(s?.actions)&&s.actions.length?s.actions:
      [{type:s?.type||'shot'}];
    const actions=rawActions.slice(0,3).map(action=>{
      const type=String(action?.type||'shot'),a=ABILITIES[type]||ABILITIES.shot;
      return {type:ABILITIES[type]?type:'shot',kind:a.kind,
        damage:a.damage,range:a.range,cooldown:a.cooldown};
    });
    const first=actions[0],cd=Math.max(...actions.map(a=>a.cooldown));
    return {name:String(s?.name||'스킬 '+(i+1)).replace(/[<>\r\n]/g,'').slice(0,18),
      ...first,cooldown:cd,actions};
  });
  return {name,color,skills};
}
function createRoom(profileA,profileB,mode,now=Date.now(),modes=null){
  // The two users may choose different control methods.
  const selected=Array.isArray(modes)&&modes.length===2?modes:[mode,mode];
  const make=(p,index)=>({name:p.name,color:p.color,skills:p.skills,
    mode:selected[index]==='manual'?'manual':'auto',
    x:index?WIDTH-110:110,y:HEIGHT/2,hp:240,maxHp:240,
    shieldUntil:0,hasteUntil:0,stunUntil:0,ready:[0,0,0,0],
    dx:0,dy:0,lastInput:now});
  return {mode:selected.every(m=>m==='auto')?'auto':'manual',
    modes:selected,started:now,ended:false,winner:null,sequence:0,
    players:[make(profileA,0),make(profileB,1)],projectiles:[],pending:[],events:[]};
}
function setInput(room,index,raw,now=Date.now()){
  if(room.ended)return false;
  const p=room.players[index];if(!p||p.mode!=='manual')return false;
  const dx=clamp(raw?.x,-1,1),dy=clamp(raw?.y,-1,1),len=Math.hypot(dx,dy);
  p.dx=len>1?dx/len:dx;p.dy=len>1?dy/len:dy;p.lastInput=now;
  return true;
}
function damage(room,index,amount,now){
  const target=room.players[1-index];
  if(now<target.shieldUntil){room.events.push({type:'blocked',target:1-index});return false;}
  const dealt=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-dealt);
  room.events.push({type:'hit',target:1-index,amount:dealt,x:target.x,y:target.y});
  return true;
}
function perform(room,index,slot,action,now){
  const p=room.players[index],e=room.players[1-index];
  if(!p||!e||p.hp<=0||e.hp<=0)return;
  const d=Math.hypot(p.x-e.x,p.y-e.y);
  const kind=action.kind,style=action.type;
  room.events.push({type:'cast',caster:index,slot,kind,style,
    x:p.x,y:p.y,targetX:e.x,targetY:e.y,range:action.range});
  if(kind==='shot'){
    const dx=(e.x-p.x)/(d||1),dy=(e.y-p.y)/(d||1);
    const split=style==='splitshot'?3:1;
    for(let j=0;j<split;j++){
      const angle=Math.atan2(dy,dx)+(j-(split-1)/2)*.19;
      room.projectiles.push({id:++room.sequence,owner:index,x:p.x,y:p.y,
        vx:Math.cos(angle)*390,vy:Math.sin(angle)*390,
        style,damage:action.damage/(split===3?1.65:1),life:1.5});
    }
  }else if(['wave','melee','beam','drain'].includes(kind)){
    if(d<=action.range+25&&damage(room,index,action.damage,now)&&kind==='drain')
      p.hp=Math.min(p.maxHp,p.hp+Math.round(action.damage*.5));
  }else if(kind==='heal'){p.hp=Math.min(p.maxHp,p.hp+30);room.events.push({type:'heal',target:index,x:p.x,y:p.y});}
  else if(kind==='shield')p.shieldUntil=now+1200;
  else if(kind==='haste')p.hasteUntil=now+2400;
  else if(kind==='stun'&&d<=action.range){e.stunUntil=Math.max(e.stunUntil,now+450);room.events.push({type:'stun',target:1-index,x:e.x,y:e.y});}
  else if(kind==='dash'||kind==='retreat'){
    const direction=kind==='retreat'?-1:1;
    const fromX=p.x,fromY=p.y;
    p.x=clamp(p.x+(e.x-p.x)/(d||1)*action.range*direction,26,WIDTH-26);
    p.y=clamp(p.y+(e.y-p.y)/(d||1)*action.range*direction,26,HEIGHT-26);
    room.events.push({type:'dash',caster:index,fromX,fromY,x:p.x,y:p.y});
  }
}
function cast(room,index,slot,now=Date.now()){
  if(room.ended||!Number.isInteger(slot)||slot<0||slot>=4)return false;
  const p=room.players[index],skill=p?.skills?.[slot];
  if(!skill||p.hp<=0||now<p.ready[slot]||now<p.stunUntil)return false;
  p.ready[slot]=now+skill.cooldown*1000;
  const actions=skill.actions?.length?skill.actions:[skill];
  perform(room,index,slot,actions[0],now);
  for(let i=1;i<actions.length;i++)
    room.pending.push({owner:index,slot,action:actions[i],at:now+i*165});
  return true;
}
function step(room,dt,now=Date.now()){
  if(room.ended)return room;
  dt=clamp(dt,0,.1);
  for(let i=0;i<2;i++){
    const p=room.players[i],e=room.players[1-i];
    if(p.mode==='auto'&&now>=p.stunUntil){
      const d=Math.hypot(e.x-p.x,e.y-p.y);
      const direction=d<85?-1:1;
      p.dx=(e.x-p.x)/(d||1)*direction;
      p.dy=(e.y-p.y)/(d||1)*direction;
      for(let j=0;j<4;j++)if(now>=p.ready[j])cast(room,i,j,now);
    }
    if(p.mode==='manual'&&now-p.lastInput>450){p.dx=0;p.dy=0;}
    if(now<p.stunUntil){p.dx=0;p.dy=0;}
    const speed=now<p.hasteUntil?215:165;
    p.x=clamp(p.x+p.dx*speed*dt,26,WIDTH-26);
    p.y=clamp(p.y+p.dy*speed*dt,26,HEIGHT-26);
  }
  room.pending.sort((a,b)=>a.at-b.at);
  while(room.pending.length&&room.pending[0].at<=now){
    const next=room.pending.shift();perform(room,next.owner,next.slot,next.action,now);
  }
  for(let i=room.projectiles.length-1;i>=0;i--){
    const b=room.projectiles[i],e=room.players[1-b.owner];
    const oldX=b.x,oldY=b.y;
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    const dx=b.x-oldX,dy=b.y-oldY,length2=dx*dx+dy*dy;
    const t=length2?clamp(((e.x-oldX)*dx+(e.y-oldY)*dy)/length2,0,1):0;
    if(Math.hypot(e.x-(oldX+dx*t),e.y-(oldY+dy*t))<31){
      damage(room,b.owner,b.damage,now);room.projectiles.splice(i,1);
    }else if(b.life<=0||b.x<0||b.x>WIDTH||b.y<0||b.y>HEIGHT)room.projectiles.splice(i,1);
  }
  const p=room.players;
  if(p.some(x=>x.hp<=0)||now-room.started>=MAX_SECONDS*1000){
    room.ended=true;
    room.winner=p[0].hp===p[1].hp?-1:p[0].hp>p[1].hp?0:1;
  }
  return room;
}
function snapshot(room,now=Date.now()){
  return {type:'state',mode:room.mode,modes:room.modes,clock:Math.max(0,MAX_SECONDS-(now-room.started)/1000),
    players:room.players.map(p=>({x:p.x,y:p.y,name:p.name,color:p.color,
      hp:p.hp,maxHp:p.maxHp,mode:p.mode,shield:now<p.shieldUntil,
      stunned:now<p.stunUntil,haste:now<p.hasteUntil,
      cooldowns:p.ready.map(t=>Math.max(0,(t-now)/1000)),
      skills:p.skills.map(s=>({name:s.name,type:s.type,kind:s.kind,actions:s.actions?.map(a=>a.type)||[s.type]}))})),
    bullets:room.projectiles.map(p=>({x:p.x,y:p.y,owner:p.owner,style:p.style})),
    events:room.events.splice(0,24),finished:room.ended,winner:room.winner};
}

global.OibungPvpRules={WIDTH,HEIGHT,MAX_SECONDS,ABILITIES,clamp,normalizeProfile,
  createRoom,setInput,cast,step,snapshot};
})(window);

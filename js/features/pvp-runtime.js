/* Isolated copy of the original combat engine; no wallet, UI scheduler or saves. */
(function(global){
'use strict';
updateUI=()=>{};syncStopButton=()=>{};
global.settleRound=()=>{};
let current=null,accumulator=0,remote=false,targets=null,lastPaint=0;
const baseUpdate=updateCharacter;
updateCharacter=function(p){
 if(!p.onlineManual)return baseUpdate(p);
 const target=getClosestAliveEnemy(p);
 if(ForgeExpansion.blocked(p)){SkillForge.advanceTimers(p);SkillForge.advanceWorld(p,target);return;}
 if(!(p.forgeDash>0)){p.vx=(p.inputX||0)*p.forge.speed;p.vy=(p.inputY||0)*p.forge.speed;}
 SkillForge.manualUpdate(p,target);
};
const baseDraw=drawCharacter;
drawCharacter=p=>{if(p.forge)SkillForge.drawFighter(p);baseDraw(p);};
global.ArenaTower={paintBackground:(c,s)=>ArenaTowerScenes.paint(c,s.width,s.height,1)};
function createRoom(a,b,mode,now,modes){
 AdvancedCombat.reset();SkillVisuals.clear();CUSTOM_DEFS.forEach(d=>delete BEHAVIORS[d.id]);CUSTOM_DEFS.length=0;
 const defs=[a,b].map(raw=>{
  if(raw.skills){const id=SkillForge.register(raw);return CUSTOM_DEFS.find(d=>d.id===id);}
  const def=CHARACTER_DEFS.find(d=>d.id===raw.id);if(!def)throw Error('Unknown fighter');return def;
 });
 players=placeFighters(defs);particles=[];floatingTexts=[];shockwaves=[];
 openingCollisionPairs.clear();isPlaying=true;isGameOver=false;roundStarted=true;
 players.forEach((p,i)=>{p.onlineManual=modes[i]==='manual';if(p.onlineManual)SkillForge.enableManual(p);});
 remote=false;targets=null;accumulator=0;current={players,started:now,elapsed:0,ended:false,winner:null,modes,pending:[]};return current;
}
function setInput(room,i,msg,now=Date.now()){
 const p=players[i];if(!p?.onlineManual||room.ended)return false;
 let x=Number.isFinite(Number(msg.x))?Number(msg.x):0,y=Number.isFinite(Number(msg.y))?Number(msg.y):0,n=Math.max(1,Math.hypot(x,y));
 p.inputX=x/n;p.inputY=y/n;p.inputAt=now;return true;
}
function cast(room,i,slot){return !room.ended&&!!players[i]?.onlineManual&&SkillForge.manualCast(players[i],slot,getClosestAliveEnemy(players[i]));}
function step(room,dt,now){
 if(room.ended)return;accumulator+=dt;
 while(accumulator>=1/60&&!isGameOver){
  players.forEach(p=>{if(p.onlineManual&&now-(p.inputAt||0)>700)p.inputX=p.inputY=0;});
  update();SkillVisuals.tick();accumulator-=1/60;room.elapsed+=1/60;
 }
 if(isGameOver||room.elapsed>=120){room.ended=true;isPlaying=false;isGameOver=true;
  room.winner=players[0].hp===players[1].hp?-1:players[0].hp>players[1].hp?0:1;}
}
// Explicit references keep projectile owners, targets and hit sets intact.
function encode(value,root=false,seen=new Set()){
 if(!root&&players.includes(value))return {$fighter:players.indexOf(value)};
 if(value===null||typeof value!=='object')return typeof value==='function'?undefined:value;
 if(value instanceof Set)return {$set:[...value].map(v=>encode(v,false,seen))};
 if(seen.has(value))return undefined;seen.add(value);
 const out=Array.isArray(value)?[]:{};
 for(const k of Object.keys(value)){if(k==='forge')continue;const v=encode(value[k],false,seen);if(v!==undefined)out[k]=v;}
 seen.delete(value);return out;
}
function decode(v){
 if(!v||typeof v!=='object')return v;
 if('$fighter'in v)return players[v.$fighter];if('$set'in v)return new Set(v.$set.map(decode));
 const out=Array.isArray(v)?[]:{};for(const k of Object.keys(v))out[k]=decode(v[k]);return out;
}
function snapshot(room){return {type:'state',clock:Math.max(0,120-room.elapsed),finished:room.ended,winner:room.winner,
 players:players.map((p,i)=>({x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,name:p.name,color:p.themeColor,mode:room.modes[i],
 skills:p.forge?.skills.slice(0,4).map(s=>({name:s.name}))||[],
 cooldowns:p.forge?.skills.slice(0,4).map((s,j)=>Math.max(0,(SkillForge.cooldownFrames(p,s)-(p.forgeTicks[j]||0))/60))||[]})),
 world:{skillEffects:encode(SkillVisuals.exportEffects()),players:players.map(p=>encode(p,true)),objects:encode(AdvancedCombat.objects),projectiles:encode(AdvancedCombat.projectiles),effects:encode(AdvancedCombat.effects),floatingTexts:encode(floatingTexts),shockwaves:encode(shockwaves)}};}
function receive(s){
 if(!s.world)return;
 remote=true;targets=s.world.players.map(p=>({x:p.x,y:p.y}));
 s.world.players.forEach((p,i)=>{const old={x:players[i].x,y:players[i].y};Object.assign(players[i],decode(p));Object.assign(players[i],old);});
 for(const k of ['objects','projectiles','effects'])AdvancedCombat[k].splice(0,AdvancedCombat[k].length,...decode(s.world[k]));
 SkillVisuals.importEffects(decode(s.world.skillEffects||[]));
 floatingTexts=decode(s.world.floatingTexts);shockwaves=decode(s.world.shockwaves);
 isGameOver=!!s.finished;isPlaying=!isGameOver;
}
function paint(){
 const now=Date.now(),alpha=1-Math.exp(-Math.min(100,now-(lastPaint||now))/45);lastPaint=now;
 if(remote&&targets)players.forEach((p,i)=>{p.x+=(targets[i].x-p.x)*alpha;p.y+=(targets[i].y-p.y)*alpha;});
 draw();SkillVisuals.draw(ctx);
}
global.PvpRuntime={createRoom,setInput,cast,step,snapshot,receive,paint};
})(window);

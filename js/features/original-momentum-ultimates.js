/* Five original fighters: one 100-point momentum skill, no periodic or
 * uncharged contact attacks. Old character definitions remain for saves,
 * portraits and existing render shapes; only their active behavior is replaced.
 * Normal collision remains purely physical, except Choi's charged bull rush.
 * Runs inside the shared fixed-frame engine (not a wall-clock setTimeout).
 */
(function(g){'use strict';
const IDS=Object.freeze(['bae','oh','lee','park','choi']);
const isOriginal=p=>!!p&&IDS.includes(p.id)&&!p.forge&&!p.towerEnemy;
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
const labels=Object.freeze({
 bae:'피의 파동 → 피의 파동 → 피모으기',oh:'모드 변환',
 lee:'거대한 턱 후려치기',park:'하늘 낙하 강타',choi:'수능의 심판'
});
const inWorld=p=>Array.isArray(p)&&p.length?p:[];
function targets(p,roster){
 const pool=inWorld(roster).filter(e=>e!==p&&e.hp>0)
  .concat(g.ArenaTower?.encounter?.spectacle?.targets?.(p)||[]);
 return [...new Set(pool)];
}
function report(p,title,kind='cast'){
 g.ArenaBattleDirector?.originalUltimate?.(p,title,kind);
 g.BattleFX?.caption?.(p,title,p.themeColor||p.tagColor||'#e5bdff');
 g.BattleFX?.sound?.('signature-launch',.55);
 g.addFloatingText?.('⚡ '+title,p.x,p.y-(p.radius||30)-25,p.tagColor||'#ffe29c',20);
}
function hit(p,e,damage,{color=p.borderColor||'#8bd5ff',heavy=false,type='필살기',push=0}={}){
 if(!e||e.hp<=0||e.invincible>0)return false;
 if(g.AdvancedCombat?.canHit&&!g.AdvancedCombat.canHit(p,e,0))return false;
 const d=Math.max(0,Math.round(damage));
 if(!d)return false;
 e.hp=Math.max(0,e.hp-d);e.invincible=18;
 if(push){
  const dx=e.x-p.x,dy=e.y-p.y,dist=Math.hypot(dx,dy)||1;
  e.vx=(e.vx||0)+dx/dist*push;e.vy=(e.vy||0)+dy/dist*push;
 }
 g.ImpactPhysics?.hit?.(p,e,d,{heavy,color,type:'signature'});
 g.createHitParticles?.(e.x,e.y,color,heavy?20:11);
 g.addFloatingText?.('-'+d,e.x,e.y-(e.radius||28),color,19);
 g.ArenaBattleDirector?.legacyHit?.(p,e,d,type);
 return true;
}
function wave(p,roster){
 const order=p.skillCycle||0;
 if(order===2){
  const old=p.hp;
  p.hp=Math.min(p.maxHp,p.hp+38);
  p.skillCycle=0;
  report(p,'피모으기','heal');
  g.BattleFX?.cast?.(p,'heal');
  g.addFloatingText?.('+'+Math.round(p.hp-old)+' HP',p.x,p.y-38,'#86efac',16);
  return;
 }
 report(p,'피의 파동 '+(order+1));
 p.skillCycle=order+1;
 p.waves||=[];
 // Each wave travels the arena outward. Hit registry prevents multiple hits
 // from a single ring, and standard invincibility prevents stacked spam.
 p.waves.push({x:p.x,y:p.y,currentRadius:10,maxRadius:195,
  speed:5,alpha:.96,hitTargets:new Set(),damage:order===0?32:36});
 g.BattleFX?.cast?.(p,'wave',{radius:175,color:'#ef5264'});
}
function updateWaves(p,roster){
 if(!p.waves)return;
 for(let i=p.waves.length-1;i>=0;i--){
  const w=p.waves[i];w.currentRadius+=w.speed;w.alpha-=.021;
  for(const e of targets(p,roster)){
   if(w.hitTargets.has(e))continue;
   const dist=Math.hypot(e.x-w.x,e.y-w.y);
   if(Math.abs(dist-w.currentRadius)<(e.radius||28)+8){
    w.hitTargets.add(e);
    // The waves originate at the cast center, not p's later location.
    if(hit(p,e,w.damage,{color:'#f35d75',type:'피의 파동',push:2.7})){
     const amount=Math.min(7,p.maxHp-p.hp);
     p.hp+=amount;
     if(amount)g.addFloatingText?.('+'+amount+' 흡혈',p.x,p.y-26,'#82e6ae',13);
    }
   }
  }
  if(w.currentRadius>=w.maxRadius||w.alpha<=0)p.waves.splice(i,1);
 }
}
function morph(p){
 p.mode=p.mode==='boin'?'menhera':'boin';
 p.modeTimer=0;
 p._originalFormUntil=(p._combat2Tick||0)+330;
 p.invincible=Math.max(p.invincible||0,12);
 if(p.mode==='boin'){
  const m=Math.hypot(p.vx,p.vy)||1;
  p.vx=p.vx/m*Math.min(10,m*1.33+1.3);
  p.vy=p.vy/m*Math.min(10,m*1.33+1.3);
  report(p,'보인고 · 가속 형태');
  g.BattleFX?.cast?.(p,'dash');
 }else{
  p._originalMassBoost=1.48;
  report(p,'멘헤라 · 중량 형태');
  g.BattleFX?.cast?.(p,'shield');
 }
}
function jaw(p,roster){
 const list=targets(p,roster),near=list.reduce((b,e)=>{
  const d=Math.hypot(e.x-p.x,e.y-p.y);
  return d<(b?.d??Infinity)?{e,d}:b;
 },null);
 const angle=near?Math.atan2(near.e.y-p.y,near.e.x-p.x):Math.atan2(p.vy,p.vx);
 p.pokeAnim=1;p.pokeRange=210;
 p.pokeTargetX=p.x+Math.cos(angle)*196;p.pokeTargetY=p.y+Math.sin(angle)*196;
 p._jawVisual={angle,life:30};
 report(p,'거대한 턱 후려치기');
 g.BattleFX?.cast?.(p,'heavy',{radius:200});
 for(const e of list){
  const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy)||1;
  const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle));
  if(d<203+(e.radius||20)&&Math.abs(delta)<.69)
   hit(p,e,105,{color:'#5ed7ff',heavy:true,type:'거대한 턱',push:9});
 }
}
function beginSlam(p,target){
 p.jumpState='rising';p.jumpHeight=0;p.jumpAirTime=0;
 p.targetLandX=target?.x??p.x;p.targetLandY=target?.y??p.y;
 report(p,'하늘 낙하 강타');
 g.BattleFX?.cast?.(p,'leap');
}
function updateSlam(p,target,roster){
 if(p.jumpState==='ground')return;
 if(target?.hp>0){p.targetLandX=target.x;p.targetLandY=target.y;}
 if(p.jumpState==='rising'){
  p.jumpHeight=Math.min(90,(p.jumpHeight||0)+6);
  if(p.jumpHeight>=90)p.jumpState='hovering';
 }else if(p.jumpState==='hovering'){
  p.jumpAirTime=(p.jumpAirTime||0)+1;
  if(p.jumpAirTime>=16)p.jumpState='slamming';
 }else if(p.jumpState==='slamming'){
  p.jumpHeight=Math.max(0,p.jumpHeight-15);
  if(p.jumpHeight<=0){
   p.jumpState='ground';p.jumpHeight=0;
   p.invincible=Math.max(p.invincible||0,13);
   g.BattleFX?.sound?.('heavy',.85);
   g.BattleFX?.cast?.(p,'wave',{radius:124});
   g.ArenaOriginalMomentum?.shockwave?.(p);
   const r=128;
   for(const e of targets(p,roster))
    if(Math.hypot(e.x-p.targetLandX,e.y-p.targetLandY)<=r+(e.radius||28))
     hit(p,e,98,{color:'#63e6bb',heavy:true,type:'급강하 낙하',push:6});
  }
 }
 // Remain visually over the selected target until falling.
 p.x+=(p.targetLandX-p.x)*.16;
 p.y+=(p.targetLandY-p.y)*.16;
}
function exam(p){
 p.nSuCount=(p.nSuCount||1)+1;
 const r=Math.random();
 p._originalExamUntil=(p._combat2Tick||0)+230;
 if(r<.3){
  p.suneungState='fail';p._originalBullUntil=0;
  p.slowTimer=Math.max(p.slowTimer||0,125);
  p.slowMultiplier=.62;
  report(p,'수능 실패 · 잠깐 감속','danger');
 }else if(r<.75){
  p.suneungState='normal';p._originalBullUntil=0;
  const gain=Math.min(36,p.maxHp-p.hp);
  p.hp+=gain;
  report(p,'수능 평타 · 체력 회복','heal');
  g.BattleFX?.cast?.(p,'heal');
  if(gain)g.addFloatingText?.('+'+gain+' HP',p.x,p.y-35,'#8ff3b3',16);
 }else{
  p.suneungState='success';
  p._originalBullUntil=(p._combat2Tick||0)+245;
  report(p,'수능 대박! 미친황소','critical');
  g.BattleFX?.cast?.(p,'dash');
 }
}
function bull(p,target){
 if((p._originalBullUntil||0)<=(p._combat2Tick||0)){
  p.suneungState='normal';return;
 }
 if(!target||target.hp<=0)return;
 const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;
 p.vx=(p.vx||0)*.89+dx/d*1.15;p.vy=(p.vy||0)*.89+dy/d*1.15;
 const speed=Math.hypot(p.vx,p.vy);
 if(speed>9.4){p.vx=p.vx/speed*9.4;p.vy=p.vy/speed*9.4;}
 p.bullChargePulse=(p.bullChargePulse||0)+.09;
}
function onContact(p,other){
 // All uncharged contact damage is retired. Only a CHARGED Choi bull
 // rush receives temporary direct collision damage.
 if(p.id!=='choi'||p.suneungState!=='success'||
   (p._originalBullUntil||0)<=(p._combat2Tick||0))return false;
 return hit(p,other,39,{color:'#f54963',heavy:true,type:'미친황소 돌진',push:7});
}
function nextSkill(p){
 if(!isOriginal(p))return '';
 if(p.id==='bae')return ['피의 파동','피의 파동','피모으기'][(p.skillCycle||0)%3];
 if(p.id==='oh')return p.mode==='boin'?'멘헤라로 변환':'보인고로 변환';
 return labels[p.id];
}
function update(p,target,roster=[]){
 if(!isOriginal(p)||p.hp<=0)return false;
 const now=p._combat2Tick||0;
 updateWaves(p,roster);
 if(p.id==='park')updateSlam(p,target,roster);
 if(p.id==='lee'&&p.pokeAnim>0)p.pokeAnim=Math.max(0,p.pokeAnim-.07);
 if(p.id==='lee'&&p._jawVisual&&--p._jawVisual.life<=0)p._jawVisual=null;
 if(p.id==='oh'&&p.mode==='menhera')
  p._originalMassBoost=1.48;
 if(p.id==='choi'){
  if(p.suneungState==='success')bull(p,target);
  else if(p.suneungState==='fail'&&now>(p._originalExamUntil||0))
   p.suneungState='normal';
 }
 g.BounceMomentum?.tick?.(p,target);
 if(!target||target.hp<=0||!g.BounceMomentum?.ready?.(p))return true;
 if(p.id==='park'&&p.jumpState!=='ground')return true;
 if(!g.BounceMomentum.spend(p))return true;
 const label=nextSkill(p);
 if(p.id==='bae')wave(p,roster);
 else if(p.id==='oh')morph(p);
 else if(p.id==='lee')jaw(p,roster);
 else if(p.id==='park')beginSlam(p,target);
 else if(p.id==='choi')exam(p);
 p._originalLastCast=now;p._originalLastLabel=label;
 return true;
}
function shockwave(p){
 if(Array.isArray(g.shockwaves))g.shockwaves.push({x:p.x,y:p.y,radius:10,maxRadius:130,alpha:1});
}
function install(){
 for(const id of IDS){
  if(!g.BEHAVIORS?.[id])continue;
  g.BEHAVIORS[id].update=(p,t)=>update(p,t,g.ArenaOriginalRoster?.()||[]);
  g.BEHAVIORS[id].onContact=onContact;
 }
}
const api=Object.freeze({IDS,isOriginal,update,onContact,nextSkill,hit,shockwave,install});
g.ArenaOriginalMomentum=api;
install();
})(typeof window!=='undefined'?window:globalThis);

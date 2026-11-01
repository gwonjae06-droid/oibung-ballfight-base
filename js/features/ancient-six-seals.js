/* Ancient One: six shattered tower seals + physical exposed tentacle endpoints.
 * Gameplay is simulation-owned. Every danger is telegraphed before activation.
 * HP damage to the player goes through Tower's hazard adapter; limb damage to
 * Ancient One goes through SkillForge.hit so invulnerability/defense still work.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const REALMS=['time','space','fire','storm','ice','forest','convergence'];
const COLORS={time:'#ffdf8d',space:'#bda5ff',fire:'#ffad75',storm:'#9ceaff',
 ice:'#c7f8ff',forest:'#b5f58e',convergence:'#f6e4ff'};
function create({width=500,height=500,hero,boss,damage}){
 const cx=width/2,cy=height/2,u=Math.min(width,height)/500;
 let tick=0,event=null,contacts=0,limbHits=0;
 const cooldown=new Map(),shotsHit=new WeakMap();
 const age=()=>event?tick-event.start:-1;
 function begin(realm,phase=1){
  if(event||!REALMS.includes(realm))return false;
  event={realm,phase,start:tick,end:tick+(phase===3?510:480),
   warning:phase===3?122:130,progress:0,active:false};
  cooldown.clear();return true;
 }
 function clear(){event=null;cooldown.clear();}
 function limbAt(i,now=tick){
  // Contract: these are visible, genuine targetable exposed tentacle ends.
  // The body is permanently behind the arena; fighter HP belongs to the body.
  const side=i===0?-1:1,mid=height*(.4+.025*Math.sin(now*.006+i));
  return {x:cx+side*Math.min(width*.245,144)*u+Math.sin(now*.018+i*2.1)*28*u,
   y:mid+Math.cos(now*.013+i)*18*u,r:27*u,index:i};
 }
 function tentacleDamage(amount,tag){
  if(!g.SkillForge?.hit||boss.hp<=0||hero.hp<=0)return false;
  const act={type:'wave',damage:cap(amount,1,42),radius:0,knockback:0,status:'none'};
  const result=g.SkillForge.hit(hero,boss,act,1,g.AdvancedCombat?.height?.(boss));
  if(result!==false){limbHits++;g.addFloatingText?.('촉수 타격!',boss.x,boss.y-60,'#f0cfff',15);return true;}
  return false;
 }
 function limbsStep(){
  // Ordinary auto-battle remains valid even without projectile skill loadouts.
  for(let i=0;i<2;i++){
   const a=limbAt(i),d=Math.hypot(hero.x-a.x,hero.y-a.y);
   if(d<a.r+(hero.radius||22)&&Math.hypot(hero.vx||0,hero.vy||0)>1.7){
    const key='limb'+i;if(tick-(cooldown.get(key)??-1000)>62){
     if(tentacleDamage(22,'pinball'))cooldown.set(key,tick);
    }
   }
  }
  let inspected=0;const seen=new Set();
  for(const list of [hero.forgeShots,hero.bfShots,g.AdvancedCombat?.projectiles]){
   if(!Array.isArray(list))continue;
   for(const shot of list){
    if(!shot||typeof shot!=='object'||seen.has(shot)||++inspected>95)continue;
    seen.add(shot);
    if(list===g.AdvancedCombat?.projectiles &&
       shot.owner!==hero.playerNum&&shot.owner!==hero&&shot.playerNum!==hero.playerNum)continue;
    if(!Number.isFinite(shot.x)||!Number.isFinite(shot.y)||
       tick-(shotsHit.get(shot)??-1000)<60)continue;
    for(let i=0;i<2;i++){
     const a=limbAt(i);
     if(Math.hypot(shot.x-a.x,shot.y-a.y)>a.r+(shot.radius||6))continue;
     const power=cap(Number(shot.a?.damage)||Number(shot.damage)||18,7,35);
     if(tentacleDamage(power,'shot')){shotsHit.set(shot,tick);break;}
    }
   }
  }
 }
 function nearLine(p,l){
  const dx=l.x2-l.x1,dy=l.y2-l.y1,m=dx*dx+dy*dy||1,t=cap(((p.x-l.x1)*dx+(p.y-l.y1)*dy)/m,0,1);
  const x=l.x1+dx*t,y=l.y1+dy*t,dist=Math.hypot(p.x-x,p.y-y),d=Math.sqrt(m);
  return {dist,nx:dist>.01?(p.x-x)/dist:-dy/d,ny:dist>.01?(p.y-y)/dist:dx/d};
 }
 function point(i,r,a=age()){
  const t=TAU*i/6+a*.005*(i%2?-1:1),radius=r*u;
  return {x:cx+Math.cos(t)*radius,y:cy+Math.sin(t)*radius};
 }
 function handAt(i,a=age()){
  const angle=(a-130)*(.008+i*.004)+(i?Math.PI/2:0),R=(i?192:163)*u;
  return {x1:cx,y1:cy,x2:cx+Math.cos(angle)*R,y2:cy+Math.sin(angle)*R,
   width:18*u};
 }
 function lightningAt(i){
  const x=width*(.17+.22*i),a=(i%2?.18:.82)*height;
  return {x1:x,y1:height*.09,x2:x,y2:height*.91,width:24*u,fire:182+i*68,end:213+i*68,
   accent:a};
 }
 function iceAt(i,a=age()){
  const t=i*TAU/4+a*.004,r=146*u;
  return {x:cx+Math.cos(t)*r,y:cy+Math.sin(t)*r,r:24*u};
 }
 function rootAt(i,a=age()){
  const theta=i*TAU/4+(a-135)*.006,inner=61*u,outer=213*u;
  return {x1:cx+Math.cos(theta)*inner,y1:cy+Math.sin(theta)*inner,
   x2:cx+Math.cos(theta)*outer,y2:cy+Math.sin(theta)*outer,width:22*u};
 }
 function fireAt(i){return {x:width*(i%2?.71:.29),y:height*(i<2?.28:.71),r:48*u,fire:180+i*51,end:222+i*51};}
 function push(nx,ny,force){
  const imp=cap(force,.5,7.5),margin=(hero.radius||22)+13;
  hero.x=cap(hero.x+nx*2,margin,width-margin);
  hero.y=cap(hero.y+ny*2,margin,height-margin);
  hero.vx=cap((hero.vx||0)+nx*imp,-12,12);
  hero.vy=cap((hero.vy||0)+ny*imp,-12,12);
  g.ArenaBallSquash?.wall?.(hero,nx,ny,imp);
  g.BounceMomentum?.wall?.(hero,imp);
 }
 function hurt(key,amount,label,interval=75,realm){
  if(tick-(cooldown.get(key)??-1000)<interval)return false;
  if(damage?.(hero,amount,{kind:'boss',realm:realm||event.realm,label})===false)return false;
  cooldown.set(key,tick);contacts++;return true;
 }
 function collideCircle(x,y,r,key,amount,label,realm){
  const d=Math.max(.001,Math.hypot(hero.x-x,hero.y-y)),limit=r+(hero.radius||22);
  if(d>=limit)return false;
  const nx=(hero.x-x)/d,ny=(hero.y-y)/d;
  push(nx,ny,2);
  if(amount)hurt(key,amount,label,80,realm);
  return true;
 }
 function collideLine(l,key,amount,label,realm){
  const q=nearLine(hero,l);
  if(q.dist>l.width*.5+(hero.radius||22))return false;
  push(q.nx,q.ny,2.3);
  hurt(key,amount,label,88,realm);
  return true;
 }
 function radiusSafe(){
  // Stasis, vortex and convergence have a safe outer/inner escape region.
  return Math.hypot(hero.x-cx,hero.y-cy);
 }
 function physicalStep(){
  const a=age(),realm=event.realm,third=event.phase===3;
  if(a<event.warning)return;
  const air=Math.max(hero.z||0,hero.jumpHeight||0)>65;
  if(realm==='time'){
   if(a>=148&&a<445){
    if(radiusSafe()<185*u&&(hero.vx||hero.vy)){
     hero.vx=(hero.vx||0)*.994;hero.vy=(hero.vy||0)*.994;
    }
    if(!air)for(let i=0;i<2;i++)collideLine(handAt(i,a),'time'+i,third?43:33,'멈춘 시계바늘','time');
   }
  }else if(realm==='space'){
   if(a>=160&&a<455){
    const dx=cx-hero.x,dy=cy-hero.y,d=Math.max(3,Math.hypot(dx,dy));
    if(d<225*u){
     const strength=cap((225*u-d)/(225*u),0,1)*.27;
     hero.vx=cap((hero.vx||0)+(dx/d*strength-dy/d*.1),-11,11);
     hero.vy=cap((hero.vy||0)+(dy/d*strength+dx/d*.1),-11,11);
    }
    if(!air&&d<58*u)collideCircle(cx,cy,38*u,'event-horizon',third?44:32,'사건의 지평선','space');
   }
  }else if(realm==='fire'){
   if(!air)for(let i=0;i<4;i++){
    const q=fireAt(i);
    if(a>=q.fire&&a<q.end)collideCircle(q.x,q.y,q.r,'fire'+i,third?45:34,'용암 분화','fire');
   }
  }else if(realm==='storm'){
   if(a>=170&&a<466){
    hero.vx=cap((hero.vx||0)+Math.sin(a*.024)*.13,-11,11);
    hero.vy=cap((hero.vy||0)+Math.cos(a*.019)*.11,-11,11);
    if(!air)for(let i=0;i<4;i++){
     const beam=lightningAt(i);
     if(a>=beam.fire&&a<beam.end)collideLine(beam,'storm'+i,third?48:34,'천공 뇌격','storm');
    }
   }
  }else if(realm==='ice'){
   if(!air&&a>=150&&a<459)for(let i=0;i<4;i++){
    const q=iceAt(i,a);collideCircle(q.x,q.y,q.r,'ice'+i,third?42:32,'빙하의 거울','ice');
   }
   if(radiusSafe()<205*u&&a>=160&&a<460&&Math.hypot(hero.vx||0,hero.vy||0)>1.2){
    hero.vx*=.995;hero.vy*=.995;
   }
  }else if(realm==='forest'){
   if(!air&&a>=157&&a<458)for(let i=0;i<4;i++)
    collideLine(rootAt(i,a),'forest'+i,third?43:32,'세계수 뿌리','forest');
  }else if(realm==='convergence'){
   // All six tower powers spiral along the *same* 3 visible lanes, leaving
   // both a near-center and outer corner refuge. Not an unavoidable wipe.
   if(a>=185&&a<470){
    if(!air)for(let i=0;i<3;i++){
     const angle=a*.008+i*TAU/3,x1=cx+Math.cos(angle)*74*u,y1=cy+Math.sin(angle)*74*u,
      x2=cx+Math.cos(angle)*199*u,y2=cy+Math.sin(angle)*199*u;
     collideLine({x1,y1,x2,y2,width:26*u},'converge'+i,48,
       '여섯 봉인의 붕괴','convergence');
    }
   }
  }
  // Modulate only projectiles with velocity-based physics. Do not mutate
  // AdvancedCombat target-lerp missiles whose path ignores vx/vy.
  if(realm==='space'||realm==='storm'){
   let n=0;
   for(const list of [hero.forgeShots,boss.forgeShots,hero.bfShots,boss.bfShots]){
    if(!Array.isArray(list))continue;
    for(const shot of list){
     if(++n>80)return;
     if(!Number.isFinite(shot.x)||!Number.isFinite(shot.y))continue;
     if(realm==='space'&&a>=160&&a<455){
      const dx=cx-shot.x,dy=cy-shot.y,d=Math.max(3,Math.hypot(dx,dy));
      const force=cap((222*u-d)/(222*u),0,1)*.2;
      if(Number.isFinite(shot.vx))shot.vx=cap(shot.vx+dx/d*force,-15,15);
      if(Number.isFinite(shot.vy))shot.vy=cap(shot.vy+dy/d*force,-15,15);
     }else if(realm==='storm'&&a>=170&&a<466){
      if(Number.isFinite(shot.vx))shot.vx=cap(shot.vx+Math.sin(a*.024)*.18,-15,15);
      if(Number.isFinite(shot.vy))shot.vy=cap(shot.vy+Math.cos(a*.019)*.16,-15,15);
     }
    }
   }
  }
 }
 function step(){
  tick++;if(hero.hp<=0||boss.hp<=0){clear();return;}
  // Targetable appendages remain active between special powers.
  limbsStep();
  if(!event)return;
  event.progress=cap((tick-event.start)/(event.end-event.start),0,1);
  event.active=age()>=event.warning;
  physicalStep();
  if(tick>=event.end)clear();
 }
 function draw(ctx){
  ctx.save();
  for(let i=0;i<2;i++){
   const l=limbAt(i);ctx.save();ctx.translate(l.x,l.y);
   ctx.fillStyle='rgba(20,22,46,.83)';ctx.strokeStyle='#a8b1ea';ctx.lineWidth=3;
   ctx.shadowColor='#c5a9ff';ctx.shadowBlur=8;
   ctx.beginPath();ctx.arc(0,0,l.r,0,TAU);ctx.fill();ctx.stroke();
   ctx.shadowBlur=0;
   for(let j=0;j<5;j++){
    ctx.rotate(TAU/5);ctx.strokeStyle='#7d89c8';ctx.lineWidth=2;ctx.beginPath();
    ctx.moveTo(0,-l.r*.43);ctx.lineTo(0,-l.r*.85);ctx.stroke();
   }
   ctx.restore();
  }
  if(!event){ctx.restore();return;}
  const a=age(),realm=event.realm,live=a>=event.warning,fade=cap((event.end-tick)/55,0,1),
   col=COLORS[realm],warning=live?.85:.2;
  ctx.globalAlpha=fade*warning;ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=3;
  const circle=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();};
  const line=l=>{ctx.save();ctx.lineCap='round';ctx.lineWidth=l.width;
   ctx.beginPath();ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);ctx.stroke();
   ctx.lineWidth=2;ctx.strokeStyle='#f9ffff';ctx.beginPath();ctx.moveTo(l.x1,l.y1);
   ctx.lineTo(l.x2,l.y2);ctx.stroke();ctx.restore();};
  if(realm==='time'){for(let i=0;i<2;i++)line(handAt(i,a));
   for(let i=0;i<12;i++){const rad=TAU*i/12;circle(cx+Math.cos(rad)*192*u,cy+Math.sin(rad)*192*u,3*u);}}
  if(realm==='space'){
   const glow=ctx.createRadialGradient(cx,cy,4,cx,cy,160*u);
   glow.addColorStop(0,'#120c28');glow.addColorStop(.26,'#5c3d8e');
   glow.addColorStop(1,'rgba(161,126,255,0)');
   ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,160*u,0,TAU);ctx.fill();
   ctx.strokeStyle='#d9c2ff';for(let i=0;i<3;i++){
    ctx.save();ctx.translate(cx,cy);ctx.rotate(a*.005+i*.46);
    ctx.beginPath();ctx.ellipse(0,0,(76+i*36)*u,(32+i*19)*u,0,0,TAU);ctx.stroke();ctx.restore();
   }circle(cx,cy,38*u);
  }
  if(realm==='fire')for(let i=0;i<4;i++){
   const p=fireAt(i);ctx.save();ctx.globalAlpha=fade*(a>=p.fire&&a<p.end?.85:.27);
   circle(p.x,p.y,p.r);if(a>=p.fire&&a<p.end){ctx.fillStyle='#ff793f22';
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();}ctx.restore();
  }
  if(realm==='storm')for(let i=0;i<4;i++){
   const p=lightningAt(i);ctx.save();ctx.globalAlpha=fade*(a>=p.fire&&a<p.end?.88:a<p.end?.2:0);
   line(p);ctx.restore();
  }
  if(realm==='ice')for(let i=0;i<4;i++){const q=iceAt(i,a);
   ctx.save();ctx.translate(q.x,q.y);ctx.rotate(a*.012+i);ctx.beginPath();
   for(let k=0;k<6;k++){const t=TAU*k/6;k?ctx.lineTo(Math.cos(t)*q.r,Math.sin(t)*q.r):
     ctx.moveTo(Math.cos(t)*q.r,Math.sin(t)*q.r);}
   ctx.closePath();ctx.stroke();ctx.restore();
  }
  if(realm==='forest')for(let i=0;i<4;i++){
   const p=rootAt(i,a);line(p);
  }
  if(realm==='convergence'){
   ctx.save();ctx.translate(cx,cy);
   for(let i=0;i<6;i++){
    const th=a*.006+i*TAU/6;ctx.strokeStyle=COLORS[REALMS[i]];
    ctx.lineWidth=2*u;ctx.beginPath();ctx.arc(Math.cos(th)*190*u,
     Math.sin(th)*190*u,15*u,0,TAU);ctx.stroke();
   }
   ctx.restore();
   if(a>=185&&a<470)for(let i=0;i<3;i++){
    const angle=a*.008+i*TAU/3;
    line({x1:cx+Math.cos(angle)*74*u,y1:cy+Math.sin(angle)*74*u,
     x2:cx+Math.cos(angle)*199*u,y2:cy+Math.sin(angle)*199*u,width:26*u});
   }
  }
  ctx.restore();
 }
 return {begin,clear,step,draw,limbAt,handAt,lightningAt,iceAt,rootAt,fireAt,
  get event(){return event;},get tick(){return tick;},get age(){return age();},
  get limbHits(){return limbHits;},get contacts(){return contacts;}};
}
g.ArenaAncientSixSeals=Object.freeze({create,REALMS,COLORS});
})(globalThis);

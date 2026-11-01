/* Space Tower: simulation-owned gravitational pinball apparatus.
 * Identical physical and drawn centers; no artwork-created damage or AI chase.
 * 5F controls gravity and star bumpers; 10F adds big bang, zero-G and galaxy.
 */
(function(g){'use strict';
const TAU=Math.PI*2,clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
const palette=Object.freeze({nebula:'#b898ff',light:'#e8d8ff',starlight:'#ffebbf',void:'#09051a',blue:'#9bdfff'});
const ageOf=s=>s?Math.max(0,s.tick-s.start):0;
function create({width=500,height=500,hero,boss,damage,weakpoint}){
 const cx=width/2,cy=height/2,scale=Math.min(width,height)/500;
 let tick=0,spell=null,stars=[],lastCoreHit=-100,lastCleave=-100,starContacts=0,weakTriggered=false;
 let blastCount=0,hitCount=0;
 const lastBeam=[-100,-100,-100],projectileLimit=100;
 function begin(tier=1,variant=0){
  spell={tier,variant,start:tick,tick,end:tick+540,warning:variant===0?105:variant===1?125:135};
  stars=[];blastCount=0;hitCount=0;lastCoreHit=-100;lastCleave=-100;
  starContacts=0;weakTriggered=false;lastBeam.fill(-100);
  return spell;
 }
 function clear(){
  spell=null;stars.length=0;hero._towerSpaceZeroG=0;boss._towerSpaceZeroG=0;
 }
 function zoneAge(){return spell?tick-spell.start:-1;}
 function bounce(p,nx,ny,impulse,source){
  const approach=(p.vx||0)*nx+(p.vy||0)*ny;
  const strength=clamp(Math.max(0,-approach)*1.7+impulse,.8,8);
  // Give moving bumpers an outward normal kick even at near-zero speed.
  p.vx=clamp((p.vx||0)-Math.min(0,approach)*1.7*nx+nx*impulse,-12,12);
  p.vy=clamp((p.vy||0)-Math.min(0,approach)*1.7*ny+ny*impulse,-12,12);
  g.ArenaBallSquash?.wall?.(p,nx,ny,strength);
  g.BounceMomentum?.wall?.(p,strength);
  if(g.BounceMomentum?.enabled?.(p))p._pinballReboundHold=Math.max(p._pinballReboundHold||0,8);
  return strength;
 }
 function gravity(p,x,y,power,polarity=1){
  if(!p||p.hp<=0)return;
  const dx=x-p.x,dy=y-p.y,d=Math.max(1,Math.hypot(dx,dy));
  if(d>260*scale)return;
  const fraction=clamp(1-d/(270*scale),0,1);
  const f=power*fraction*fraction;
  const amount=polarity*f/d;
  p.vx=clamp((p.vx||0)+dx*amount-dy/d*f*.38,-11,11);
  p.vy=clamp((p.vy||0)+dy*amount+dx/d*f*.38,-11,11);
 }
 function bendProjectile(b,x,y,power){
  if(!b||!Number.isFinite(b.x)||!Number.isFinite(b.y)||!Number.isFinite(b.vx)||!Number.isFinite(b.vy))return;
  const dx=x-b.x,dy=y-b.y,d=Math.max(22,Math.hypot(dx,dy));
  if(d>245*scale)return;
  const f=clamp(power*(1-d/(265*scale)),0,.28);
  b.vx=clamp(b.vx+dx/d*f-dy/d*f*.21,-15,15);
  b.vy=clamp(b.vy+dy/d*f+dx/d*f*.21,-15,15);
 }
 function trajectories(x,y,power){
  const lists=[hero.forgeShots,boss.forgeShots,hero.bfShots,boss.bfShots,g.AdvancedCombat?.projectiles];
  const seen=new Set();let count=0;
  for(const list of lists){
   if(!Array.isArray(list))continue;
   for(const b of list){
    if(seen.has(b)||++count>projectileLimit)break;
    seen.add(b);bendProjectile(b,x,y,power);
   }
   if(count>projectileLimit)break;
  }
 }
 function contactCore(age){
  for(const p of [hero,boss]){
   const d=Math.hypot(p.x-cx,p.y-cy),radius=(spell.tier===2?40:34)*scale+(p.radius||22);
   if(d>=radius)continue;
   const nx=d>1?(p.x-cx)/d:1,ny=d>1?(p.y-cy)/d:0;
   p.x=clamp(cx+nx*(radius+.5),(p.radius||22)+24,width-(p.radius||22)-24);
   p.y=clamp(cy+ny*(radius+.5),(p.radius||22)+24,height-(p.radius||22)-24);
   bounce(p,nx,ny,2.3,'blackhole');
   if(p===hero&&tick-lastCoreHit>=85){
    lastCoreHit=tick;
    if(damage?.(hero,spell.tier===2?15:11,{realm:'space',kind:'boss',label:'사건의 지평선'})!==false)hitCount++;
   }
  }
 }
 function summonStars(tier){
  stars=[];
  const count=tier===2?7:5;
  for(let i=0;i<count;i++){
   const angle=i*TAU/count+.21,rad=(105+(i%2)*51)*scale;
   stars.push({x:cx+Math.cos(angle)*rad,y:cy+Math.sin(angle)*rad,
    angle,rad,r:(11+i%3*2.8)*scale,phase:i*.69,last:-100});
  }
 }
 function contactStars(age){
  const p=hero;
  for(const [i,s] of stars.entries()){
   const a=s.angle+Math.max(0,age-255)*.003*(i%2?-1:1);
   s.x=cx+Math.cos(a)*s.rad;s.y=cy+Math.sin(a)*s.rad;
   for(const q of [p,boss]){
    const dx=q.x-s.x,dy=q.y-s.y,d=Math.max(.001,Math.hypot(dx,dy));
    const threshold=(q.radius||22)+s.r;
    if(d>=threshold)continue;
    const nx=dx/d,ny=dy/d;
    q.x=clamp(q.x+nx*(threshold-d+.25),(q.radius||22)+25,width-(q.radius||22)-25);
    q.y=clamp(q.y+ny*(threshold-d+.25),(q.radius||22)+25,height-(q.radius||22)-25);
    bounce(q,nx,ny,1.2,'star');
    if(q===hero&&tick-s.last>=48){
     s.last=tick;starContacts++;
     if(starContacts>=2&&!weakTriggered){
      weakTriggered=true;weakpoint?.();
     }
    }
   }
  }
 }
 function bigBang(age){
  const chargeAge=230;
  if(age===chargeAge&&blastCount===0){
   blastCount=1;
   summonStars(spell.tier);
   for(const p of [hero,boss]){
    const dx=p.x-cx,dy=p.y-cy,d=Math.max(1,Math.hypot(dx,dy));
    const nx=dx/d,ny=dy/d;
    const imp=p===hero?6.8:2.4;
    p.vx=clamp((p.vx||0)+nx*imp,-12,12);p.vy=clamp((p.vy||0)+ny*imp,-12,12);
    g.ArenaBallSquash?.wall?.(p,nx,ny,imp);
    if(p===hero&&d<220*scale&&
       damage?.(p,spell.tier===2?22:16,{realm:'space',kind:'boss',label:'태초의 빅뱅'})!==false)
       hitCount++;
   }
   // Big Bang shock front also pushes active skill projectiles.
   for(const list of [hero.forgeShots,boss.forgeShots,g.AdvancedCombat?.projectiles]){
    if(!Array.isArray(list))continue;
    for(const b of list.slice(0,90)){
     const dx=b.x-cx,dy=b.y-cy,d=Math.max(1,Math.hypot(dx,dy));
     b.vx=clamp((b.vx||0)+dx/d*3.1,-15,15);b.vy=clamp((b.vy||0)+dy/d*3.1,-15,15);
    }
   }
  }
  if(age>=chargeAge&&age<505)contactStars(age);
 }
 function nearestOnSegment(p,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,div=dx*dx+dy*dy||1;
  const t=clamp(((p.x-x1)*dx+(p.y-y1)*dy)/div,0,1);
  const x=x1+t*dx,y=y1+t*dy,d=Math.hypot(p.x-x,p.y-y);
  return {x,y,d,nx:d>.001?(p.x-x)/d:-(y2-y1)/Math.sqrt(div),
   ny:d>.001?(p.y-y)/d:(x2-x1)/Math.sqrt(div)};
 }
 function galaxyBeam(age,i){
  const rotation=(age-150)*.005*(i%2?-1:1)+i*TAU/3-.5;
  const len=(spell.tier===2?209:181)*scale;
  return {angle:rotation,x1:cx-Math.cos(rotation)*len,y1:cy-Math.sin(rotation)*len,
    x2:cx+Math.cos(rotation)*len,y2:cy+Math.sin(rotation)*len,width:(i===0?18:15)*scale};
 }
 function galaxy(age){
  // Near-zero-G is physical: conserve current launch heading and speed,
  // rather than letting ordinary AI cruise continuously reapply drag.
  if(age>=130&&age<435){
   hero._towerSpaceZeroG=2;boss._towerSpaceZeroG=2;
   const dir=Math.sin(age*.026);
   for(const p of [hero,boss]){
    const scaleP=p===hero?1:.4;
    p.vx=clamp((p.vx||0)+dir*.025*scaleP,-11,11);
    p.vy=clamp((p.vy||0)+Math.cos(age*.017)*.023*scaleP,-11,11);
   }
  }else{hero._towerSpaceZeroG=0;boss._towerSpaceZeroG=0;}
  if(age<162||age>465)return;
  for(let i=0;i<3;i++){
   const arm=galaxyBeam(age,i),p=hero;
   const q=nearestOnSegment(p,arm.x1,arm.y1,arm.x2,arm.y2);
   if(q.d>(p.radius||22)+arm.width*.5)continue;
   const push=(p.radius||22)+arm.width*.5-q.d+.3;
   p.x=clamp(p.x+q.nx*push,(p.radius||22)+25,width-(p.radius||22)-25);
   p.y=clamp(p.y+q.ny*push,(p.radius||22)+25,height-(p.radius||22)-25);
   bounce(p,q.nx,q.ny,2.1,'galaxy');
   if(tick-lastBeam[i]>=85){
    lastBeam[i]=tick;
    if(damage?.(p,spell.tier===2?17:13,
      {realm:'space',kind:'boss',label:i===0?'행성 가르기':'밀키웨이 은하수'})!==false)hitCount++;
   }
  }
 }
 function step(){
  tick++;
  if(!spell)return;
  spell.tick=tick;
  const age=zoneAge();
  if(age>=spell.end-spell.start){clear();return;}
  if(age<spell.warning)return;
  if(spell.variant===0){
   const power=(spell.tier===2?.30:.21)*clamp((age-spell.warning)/45,0,1);
   gravity(hero,cx,cy,power);
   gravity(boss,cx,cy,power*.33);
   trajectories(cx,cy,power*1.4);
   contactCore(age);
  }else if(spell.variant===1){
   if(age<230){
    const power=.12*clamp((age-spell.warning)/90,0,1);
    gravity(hero,cx,cy,power);
    gravity(boss,cx,cy,power*.3);
    trajectories(cx,cy,power);
   }
   bigBang(age);
  }else galaxy(age);
 }
 function draw(ctx){
  if(!spell)return;
  const age=zoneAge(),variant=spell.variant,warning=spell.warning;
  const progress=clamp((age-warning)/62,0,1),fade=clamp((540-age)/55,0,1);
  const time=age*.017;
  ctx.save();ctx.translate(cx,cy);
  // Deep-field background is transparent to keep ball silhouettes readable.
  const depth=ctx.createRadialGradient(0,0,9,0,0,229*scale);
  depth.addColorStop(0,variant===0?'rgba(8,3,24,.72)':'rgba(64,31,125,.19)');
  depth.addColorStop(.54,'rgba(61,38,118,.21)');
  depth.addColorStop(1,'rgba(16,12,53,0)');
  ctx.globalAlpha=fade;ctx.fillStyle=depth;
  ctx.beginPath();ctx.arc(0,0,229*scale,0,TAU);ctx.fill();
  if(variant===0){
   const r=(29+progress*8)*scale;
   const disk=ctx.createRadialGradient(-7*scale,-9*scale,1,0,0,r*2.3);
   disk.addColorStop(0,'#160724');disk.addColorStop(.44,'#02030b');
   disk.addColorStop(.57,'#6e439a');disk.addColorStop(.7,'#dfb4ff');
   disk.addColorStop(.82,'rgba(165,113,239,.3)');disk.addColorStop(1,'rgba(40,20,75,0)');
   ctx.globalAlpha=.4+progress*.6;ctx.fillStyle=disk;
   ctx.beginPath();ctx.arc(0,0,r*2.3,0,TAU);ctx.fill();
   for(let i=0;i<5;i++){
    ctx.save();ctx.rotate(time*.45+i*.38);
    ctx.globalAlpha=fade*progress*(.28+i*.10);ctx.strokeStyle=i%2?'#a1caff':'#e2b0ff';
    ctx.lineWidth=(1+i*.47)*scale;ctx.beginPath();
    ctx.ellipse(0,0,r*(1.8+i*.39),r*(.42+i*.13),i*.24,0,TAU);ctx.stroke();
    ctx.restore();
   }
   ctx.globalAlpha=.95*fade*progress;ctx.fillStyle=palette.void;
   ctx.beginPath();ctx.arc(0,0,r*.87,0,TAU);ctx.fill();
   ctx.strokeStyle=palette.light;ctx.lineWidth=1.5*scale;
   ctx.beginPath();ctx.arc(0,0,r*.92,0,TAU);ctx.stroke();
  }else if(variant===1){
   const blastAge=age-230;
   const grow=blastAge>=0?clamp(blastAge/43,0,1):0;
   const constrict=age<230?1-clamp((age-warning)/(230-warning),0,1)*.68:.26;
   const size=(32+165*constrict+grow*130)*scale;
   ctx.globalAlpha=fade*(blastAge>=0?1-grow*.86:.65);
   ctx.strokeStyle=blastAge>=0?'#ffe8c3':'#c9b0ff';
   ctx.lineWidth=(blastAge>=0?8-grow*6:2)*scale;
   ctx.beginPath();ctx.arc(0,0,size,0,TAU);ctx.stroke();
   if(blastAge>=0&&blastAge<67){
    const pulse=ctx.createRadialGradient(0,0,0,0,0,(95+grow*140)*scale);
    pulse.addColorStop(0,'rgba(255,238,206,.28)');
    pulse.addColorStop(.7,'rgba(178,140,251,.09)');pulse.addColorStop(1,'rgba(171,125,246,0)');
    ctx.fillStyle=pulse;ctx.beginPath();ctx.arc(0,0,(95+grow*140)*scale,0,TAU);ctx.fill();
   }
  }else{
   for(let i=0;i<4;i++){
    ctx.save();ctx.rotate(time*(i%2?-.37:.23)+i*.48);
    ctx.globalAlpha=fade*(.33+i*.11);ctx.strokeStyle=i%2?'#c4acff':'#a4dbff';
    ctx.lineWidth=(2+i*.25)*scale;
    ctx.beginPath();ctx.ellipse(0,0,(72+i*37)*scale,(24+i*19)*scale,i*.15,0,TAU);ctx.stroke();
    ctx.restore();
   }
  }
  // Deterministic star scatter: no Math.random, no allocations per frame.
  for(let j=0;j<(variant===2?60:45);j++){
   const a=j*2.39996+time*(variant===2?.12:.05);
   const r=(28+(j*47%182))*scale;
   const x=Math.cos(a)*r,y=Math.sin(a)*r;
   const twinkle=.3+.7*(.5+.5*Math.sin(time*2+j*1.77));
   ctx.globalAlpha=fade*twinkle*(variant===0?progress:1)*.75;
   ctx.fillStyle=j%4?'#d0baff':'#fff2ca';
   ctx.beginPath();ctx.arc(x,y,(j%5===0?2:1.1)*scale,0,TAU);ctx.fill();
  }
  ctx.restore();
  // World-space constructs and GALAXY BEAMS share actual hitbox coordinates.
  for(const star of stars){
   const r=star.r,halo=ctx.createRadialGradient(star.x,star.y,0,star.x,star.y,r*2.5);
   halo.addColorStop(0,'rgba(255,248,214,.95)');halo.addColorStop(.25,'rgba(202,164,255,.8)');
   halo.addColorStop(1,'rgba(136,88,213,0)');
   ctx.save();ctx.globalAlpha=fade;ctx.fillStyle=halo;
   ctx.beginPath();ctx.arc(star.x,star.y,r*2.5,0,TAU);ctx.fill();
   ctx.fillStyle='#fff4d4';ctx.beginPath();ctx.arc(star.x,star.y,r*.48,0,TAU);ctx.fill();
   ctx.restore();
  }
  if(variant===2){
   const live=age>=162&&age<465;
   ctx.save();ctx.globalAlpha=fade*(live?.84:.22);
   for(let i=0;i<3;i++){
    const b=galaxyBeam(age,i);
    ctx.strokeStyle=i%2?'#c9adff':'#c5e6ff';
    ctx.shadowColor=i%2?'#9764dc':'#77c7ff';ctx.shadowBlur=live?15*scale:0;
    ctx.lineWidth=b.width;ctx.beginPath();ctx.moveTo(b.x1,b.y1);ctx.lineTo(b.x2,b.y2);ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle='#f5edff';ctx.lineWidth=1.5*scale;
    ctx.beginPath();ctx.moveTo(b.x1,b.y1);ctx.lineTo(b.x2,b.y2);ctx.stroke();
   }
   ctx.restore();
  }
  ctx.restore();
 }
 return {begin,step,draw,clear,gravity,bendProjectile,galaxyBeam,
  get active(){return !!spell;},get spell(){return spell;},get stars(){return stars;},
  get coreHits(){return hitCount;},get blastCount(){return blastCount;},
  get age(){return zoneAge();}};
}
g.ArenaSpaceGravity=Object.freeze({create,palette});
})(globalThis);

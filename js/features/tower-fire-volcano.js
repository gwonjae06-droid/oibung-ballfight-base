/* Fire Tower boss apparatus. All hits/impulses are simulation-owned; draw is pure.
 * Existing 12-second extinction meteor is intentionally left to the spectacle.
 * Fire pinball adds telegraphed vents, rotating fire cyclones and a safe-center
 * caldera. The visual geometry below is identical to its collision geometry.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(x,l,h)=>Math.max(l,Math.min(h,x));
const COL={white:'#fff6c9',gold:'#ffc36d',orange:'#ff7136',lava:'#ee321c',basalt:'#271a28'};
function create({width=500,height=500,hero,boss,damage,weakpoint}){
 const cx=width*.5,cy=height*.5,scale=Math.min(width,height)/500;
 let tick=0,spell=null,vents=[],hitCount=0,coreHits=0,coreLast=-100,weakDone=false;
 const hitLast=new Map(),maxShots=90;
 function begin(tier=1,variant=0){
  const warning=variant===0?100:variant===1?115:125;
  spell={tier,variant,start:tick,warning,end:tick+(variant===0?788:540)};
  vents=[];hitLast.clear();coreHits=0;coreLast=-100;weakDone=false;hitCount=0;
  if(variant===0||variant===1){
   const count=variant===0?(tier===2?5:4):(tier===2?5:3);
   for(let i=0;i<count;i++){
    const a=TAU*i/count+(variant===0?.24:.34);
    const rad=(variant===0?138:125+(i%2)*36)*scale;
    vents.push({x:cap(cx+Math.cos(a)*rad,70*scale,width-70*scale),
      y:cap(cy+Math.sin(a)*rad,70*scale,height-70*scale),
      r:(variant===0?30:36+(i%2)*5)*scale,
      fire:variant===0?150+i*78:155+i*53,
      life:variant===0?72:90,id:i});
   }
  }
  return spell;
 }
 function clear(){spell=null;vents.length=0;hitLast.clear();}
 function age(){return spell?tick-spell.start:-1;}
 function bounce(p,nx,ny,kick){
  const approach=(p.vx||0)*nx+(p.vy||0)*ny;
  const impulse=cap(Math.max(0,-approach)*1.7+kick,.6,9);
  p.vx=cap((p.vx||0)+nx*impulse,-12,12);
  p.vy=cap((p.vy||0)+ny*impulse,-12,12);
  g.ArenaBallSquash?.wall?.(p,nx,ny,impulse);
  g.BounceMomentum?.wall?.(p,impulse);
  p._pinballReboundHold=Math.max(p._pinballReboundHold||0,8);
  return impulse;
 }
 function hit(p,amount,key,label,cooldown){
  const last=hitLast.get(key)??-1000;
  if(tick-last<cooldown)return;
  const accepted=damage?.(p,amount,{realm:'fire',kind:'boss',label});
  if(accepted!==false){hitLast.set(key,tick);hitCount++;}
 }
 function collideCircle(p,x,y,r,kick,key,label,amount){
  const dx=p.x-x,dy=p.y-y,dist=Math.hypot(dx,dy),threshold=r+(p.radius||22);
  if(dist>=threshold)return false;
  const nx=dist>.001?dx/dist:1,ny=dist>.001?dy/dist:0;
  const push=threshold-dist+.2;
  const margin=(p.radius||22)+18;
  p.x=cap(p.x+nx*push,margin,width-margin);
  p.y=cap(p.y+ny*push,margin,height-margin);
  bounce(p,nx,ny,kick);
  if(amount&&((p.z||p.jumpHeight||0)<=38))hit(p,amount,key,label,84);
  return true;
 }
 function ventActive(v,a){return a>=v.fire&&a<v.fire+v.life;}
 function cyclone(i,a){
  const angle=(a-125)*.0105*(i%2?-1:1)+i*TAU/3;
  const radius=(107+(i%2)*42)*scale;
  return {x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius,
    r:(i===0?34:29)*scale,angle};
 }
 function shotLists(){
  return [hero.forgeShots,boss.forgeShots,hero.bfShots,boss.bfShots,g.AdvancedCombat?.projectiles];
 }
 function perturbShots(a){
  let processed=0;const seen=new Set();
  for(const list of shotLists()){
   if(!Array.isArray(list))continue;
   for(const s of list){
    if(seen.has(s))continue;seen.add(s);
    if(++processed>maxShots)return;
    if(!Number.isFinite(s.x)||!Number.isFinite(s.y))continue;
    let vx=Number.isFinite(s.vx)?s.vx:0,vy=Number.isFinite(s.vy)?s.vy:0;
    for(const v of vents){
     if(!ventActive(v,a))continue;
     const dx=s.x-v.x,dy=s.y-v.y,d=Math.max(1,Math.hypot(dx,dy));
     if(d<v.r+50*scale){
      const force=(1-d/(v.r+50*scale))*.48;
      vx+=dx/d*force;vy+=dy/d*force;
     }
    }
    if(spell.variant===2&&a>=158&&a<478){
     for(let i=0;i<(spell.tier===2?3:2);i++){
      const c=cyclone(i,a),dx=s.x-c.x,dy=s.y-c.y,d=Math.max(1,Math.hypot(dx,dy));
      if(d<c.r+64*scale){const force=(1-d/(c.r+64*scale))*.28;
       vx+=-dy/d*force;vy+=dx/d*force;}
     }
    }
    s.vx=cap(vx,-15,15);s.vy=cap(vy,-15,15);
   }
  }
 }
 function step(){
  tick++;if(!spell)return;
  const a=age();
  if(tick>=spell.end){clear();return;}
  if(a<spell.warning)return;
  const amount=spell.tier===2?22:15;
  for(const v of vents){
   if(!ventActive(v,a))continue;
   collideCircle(hero,v.x,v.y,v.r,3.8,'vent-'+v.id,
    spell.variant===0?'화산쇄설류 충격':'마그마 화구 분출',amount);
  }
  if(spell.variant===2){
   const count=spell.tier===2?3:2;
   if(a>=158&&a<478)for(let i=0;i<count;i++){
    const c=cyclone(i,a),dx=hero.x-c.x,dy=hero.y-c.y,d=Math.max(1,Math.hypot(dx,dy));
    if(d<c.r+76*scale){
      const strength=(1-d/(c.r+76*scale))*.31;
      hero.vx=cap((hero.vx||0)-dy/d*strength,-12,12);
      hero.vy=cap((hero.vy||0)+dx/d*strength,-12,12);
    }
    collideCircle(hero,c.x,c.y,c.r,3.2,'cyclone-'+i,'화염 회오리 핵',spell.tier===2?23:16);
   }
   // The rim is visible, damaging, but the center remains a large safe lane.
   if(a>=245&&a<455){
    const inner=164*scale,outer=242*scale,dx=hero.x-cx,dy=hero.y-cy;
    const d=Math.max(.001,Math.hypot(dx,dy)),r=hero.radius||22;
    if(d+r>=inner&&d-r<=outer){
     const nx=-dx/d,ny=-dy/d;
     bounce(hero,nx,ny,1.55);
     if((hero.z||hero.jumpHeight||0)<=38)
      hit(hero,spell.tier===2?27:18,'caldera','칼데라 용암해',95);
    }
   }
  }
  // Physical contact with the exposed glowing magma core, not a free timer.
  if(spell.variant!==0&&a>=160&&a<458){
   const d=Math.hypot(hero.x-cx,hero.y-cy);
   const impact=Math.hypot(hero.vx||0,hero.vy||0);
   if(d<(hero.radius||22)+23*scale&&impact>=1.8&&tick-coreLast>=62){
    coreLast=tick;coreHits++;
    collideCircle(hero,cx,cy,23*scale,2,'core','마그마 심장 반발',0);
    if(coreHits>=2&&!weakDone){weakDone=true;weakpoint?.();}
   }
  }
  perturbShots(a);
 }
 function draw(ctx){
  if(!spell)return;
  const a=age(),tier=spell.tier,variant=spell.variant;
  const fade=cap((spell.end-tick)/42,0,1);
  const size=scale,warning=spell.warning;
  ctx.save();
  // Visible, readable warning circles remain even before the first explosion.
  for(const v of vents){
   if(a>v.fire+v.life)continue;
   const live=ventActive(v,a),soon=cap((a-v.fire+85)/85,0,1);
   ctx.save();ctx.translate(v.x,v.y);ctx.globalAlpha=fade*(live?.95:.20+.3*soon);
   const halo=ctx.createRadialGradient(0,0,1,0,0,v.r*2.1);
   halo.addColorStop(0,live?'rgba(255,236,157,.84)':'rgba(238,67,32,.12)');
   halo.addColorStop(.43,'rgba(255,89,31,.46)');halo.addColorStop(1,'rgba(222,41,24,0)');
   ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,v.r*2.1,0,TAU);ctx.fill();
   ctx.lineWidth=(live?4:2)*size;ctx.strokeStyle=live?COL.white:COL.orange;
   ctx.setLineDash(live?[]:[5*size,5*size]);ctx.beginPath();ctx.arc(0,0,v.r,0,TAU);ctx.stroke();ctx.setLineDash([]);
   const core=ctx.createRadialGradient(-v.r*.2,-v.r*.3,1,0,0,v.r);
   core.addColorStop(0,live?'#ffe5a1':'#4b2730');core.addColorStop(.5,live?'#f9622e':'#69392e');core.addColorStop(1,'#261922');
   ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,v.r*.72,0,TAU);ctx.fill();
   if(live)for(let j=0;j<9;j++){
    const theta=j*TAU/9+(a-v.fire)*.014,rad=v.r*(.6+(j%3)*.34);
    ctx.strokeStyle=j%2?COL.gold:COL.white;ctx.lineWidth=(j%3+1)*size;
    ctx.beginPath();ctx.moveTo(Math.cos(theta)*rad,Math.sin(theta)*rad);
    ctx.lineTo(Math.cos(theta)*rad*1.3,Math.sin(theta)*rad*1.3);ctx.stroke();
   }
   ctx.restore();
  }
  if(variant===2){
   if(a>=warning&&a<490){
    const rimIn=164*size,rimOut=242*size,live=a>=245&&a<455;
    ctx.save();ctx.translate(cx,cy);ctx.globalAlpha=fade*(live?.5:.2);
    ctx.beginPath();ctx.arc(0,0,rimOut,0,TAU);ctx.arc(0,0,rimIn,0,TAU,true);
    const molten=ctx.createRadialGradient(0,0,rimIn,0,0,rimOut);
    molten.addColorStop(0,'rgba(255,154,58,.05)');molten.addColorStop(.5,'rgba(248,66,24,.66)');
    molten.addColorStop(1,'rgba(118,20,18,.12)');
    ctx.fillStyle=molten;ctx.fill('evenodd');ctx.lineWidth=2*size;ctx.strokeStyle=COL.orange;ctx.stroke();
    for(let j=0;j<24;j++){const theta=j*TAU/24+a*.006,rad=202*size;
     ctx.fillStyle=j%3?COL.orange:COL.gold;ctx.beginPath();
     ctx.arc(Math.cos(theta)*rad,Math.sin(theta)*rad,(2+j%3)*size,0,TAU);ctx.fill();}
    ctx.restore();
   }
   if(a>=120&&a<490)for(let i=0;i<(tier===2?3:2);i++){
    const c=cyclone(i,a),live=a>=158&&a<478;
    ctx.save();ctx.translate(c.x,c.y);ctx.globalAlpha=fade*(live?.95:.28);
    const vortex=ctx.createRadialGradient(0,0,0,0,0,c.r*2.4);
    vortex.addColorStop(0,'rgba(255,241,195,.95)');
    vortex.addColorStop(.28,'rgba(255,137,50,.72)');
    vortex.addColorStop(.7,'rgba(234,47,31,.2)');vortex.addColorStop(1,'rgba(180,19,20,0)');
    ctx.fillStyle=vortex;ctx.beginPath();ctx.arc(0,0,c.r*2.4,0,TAU);ctx.fill();
    ctx.strokeStyle=COL.white;ctx.lineWidth=2*size;
    ctx.beginPath();ctx.arc(0,0,c.r,0,TAU);ctx.stroke();
    for(let j=0;j<3;j++){ctx.save();ctx.rotate(c.angle+j*TAU/3);ctx.strokeStyle=j%2?COL.gold:COL.orange;
      ctx.lineWidth=(6-j)*size;ctx.beginPath();
      ctx.arc(0,0,c.r*(.7+j*.45),0,Math.PI*1.44);ctx.stroke();ctx.restore();}
    ctx.restore();
   }
  }
  if(variant!==0&&a>=warning&&a<470){
   ctx.save();ctx.translate(cx,cy);ctx.globalAlpha=fade*.87;
   const core=ctx.createRadialGradient(-6*size,-7*size,1,0,0,35*size);
   core.addColorStop(0,COL.white);core.addColorStop(.33,COL.gold);
   core.addColorStop(.65,'#b62c20');core.addColorStop(1,'rgba(113,23,28,0)');
   ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,35*size,0,TAU);ctx.fill();
   ctx.strokeStyle=weakDone?'#fff9ba':COL.orange;ctx.lineWidth=2.5*size;
   ctx.beginPath();ctx.arc(0,0,23*size,0,TAU);ctx.stroke();
   for(let j=0;j<8;j++){const theta=j*TAU/8+a*.008;ctx.beginPath();
    ctx.moveTo(Math.cos(theta)*27*size,Math.sin(theta)*27*size);
    ctx.lineTo(Math.cos(theta)*34*size,Math.sin(theta)*34*size);ctx.stroke();}
   ctx.restore();
  }
  ctx.restore();
 }
 return {begin,clear,step,draw,cyclone,ventActive,
  get active(){return !!spell;},get spell(){return spell;},get vents(){return vents;},
  get hits(){return hitCount;},get coreHits(){return coreHits;},
  get age(){return age();}};
}
g.ArenaFireVolcano=Object.freeze({create,COL});
})(globalThis);

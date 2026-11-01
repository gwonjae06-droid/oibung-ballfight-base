/* Storm Tower 5F/10F: deterministic simulation-owned supercells and lightning.
 * Render uses the same spokes, arcs and dive centers as collision geometry.
 * The page canvas never controls physics. All damage goes via Tower adapter.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(x,l,h)=>Math.max(l,Math.min(h,x));
const PALETTE=Object.freeze({cloud:'#24374e',blue:'#78ccff',white:'#ecffff',electric:'#b7faff',violet:'#afa1ff'});
function create({width=500,height=500,hero,boss,damage,weakpoint}){
 const cx=width/2,cy=height/2,unit=Math.min(width,height)/500;
 let tick=0,spell=null,rods=[],contacts=0,weakDone=false,coreLast=-100,hitCount=0;
 const lastHit=new Map(),maxProjectiles=90;
 function begin(tier=1,variant=0){
  spell={tier,variant,start:tick,end:tick+540,warning:variant===0?110:variant===1?120:138};
  contacts=0;weakDone=false;coreLast=-100;hitCount=0;lastHit.clear();rods=[];
  if(variant===1){
   const n=tier===2?5:3;
   for(let i=0;i<n;i++){
    rods.push({x:width*(.14+.72*i/(n-1)),y:height*(i%2?.68:.32),
      r:22*unit,id:i});
   }
  }
  return spell;
 }
 function age(){return spell?tick-spell.start:-1;}
 function clear(){spell=null;rods=[];lastHit.clear();}
 function impact(p,nx,ny,kick){
  const approach=(p.vx||0)*nx+(p.vy||0)*ny;
  const impulse=cap(-Math.min(approach,-.5)*1.65+kick,.5,8.7);
  p.vx=cap((p.vx||0)+impulse*nx,-12,12);
  p.vy=cap((p.vy||0)+impulse*ny,-12,12);
  g.ArenaBallSquash?.wall?.(p,nx,ny,impulse);
  g.BounceMomentum?.wall?.(p,impulse);
  p._pinballReboundHold=Math.max(p._pinballReboundHold||0,8);
 }
 function hurt(p,amount,key,label,cooldown=78){
  const last=lastHit.get(key)??-10000;
  if(tick-last<cooldown)return;
  if(damage?.(p,amount,{realm:'storm',kind:'boss',label})!==false){
   lastHit.set(key,tick);hitCount++;
  }
 }
 function circleHit(p,x,y,r,kick,amount,key,label){
  const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy),rr=r+(p.radius||22);
  if(d>=rr)return false;
  const nx=d>.0001?dx/d:1,ny=d>.0001?dy/d:0,margin=(p.radius||22)+16;
  p.x=cap(p.x+nx*(rr-d+.35),margin,width-margin);
  p.y=cap(p.y+ny*(rr-d+.35),margin,height-margin);
  impact(p,nx,ny,kick);
  if(amount)hurt(p,amount,key,label);
  return true;
 }
 function nearest(p,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,m=dx*dx+dy*dy||1;
  const t=cap(((p.x-x1)*dx+(p.y-y1)*dy)/m,0,1);
  const x=x1+t*dx,y=y1+t*dy,d=Math.hypot(p.x-x,p.y-y);
  const len=Math.sqrt(m);
  return {d,nx:d>.001?(p.x-x)/d:-dy/len,ny:d>.001?(p.y-y)/d:dx/len};
 }
 function lineHit(p,line,key,label,amount,cooldown=75){
  const n=nearest(p,line.x1,line.y1,line.x2,line.y2);
  const threshold=(p.radius||22)+(line.width||15)*.5;
  if(n.d>=threshold)return false;
  const push=threshold-n.d+.35,margin=(p.radius||22)+16;
  p.x=cap(p.x+n.nx*push,margin,width-margin);
  p.y=cap(p.y+n.ny*push,margin,height-margin);
  impact(p,n.nx,n.ny,2.15);
  hurt(p,amount,key,label,cooldown);
  return true;
 }
 function spokeAt(i,a){
  const count=spell?.tier===2?3:2,angle=(a-110)*.0105*(i%2?-1:1)+i*TAU/count-.6;
  const inner=48*unit,outer=(spell?.tier===2?206:186)*unit;
  return {x1:cx+Math.cos(angle)*inner,y1:cy+Math.sin(angle)*inner,
    x2:cx+Math.cos(angle)*outer,y2:cy+Math.sin(angle)*outer,
    angle,width:(spell?.tier===2?21:17)*unit};
 }
 function arcAt(i){const a=rods[i],b=rods[i+1];return {
  x1:a.x,y1:a.y,x2:b.x,y2:b.y,width:(spell?.tier===2?22:18)*unit};}
 function arcLive(i,a){const start=175+i*64;return a>=start&&a<start+38;}
 function diveAt(i,a){
  const progress=cap((a-(170+i*35))/(300+(i%2)*25),0,1);
  const phase=(i%2)?1:-1;
  return {x:width*(.12+progress*.76),y:height*(.5+phase*(.23*Math.cos(progress*Math.PI*2+i*.3))),
    r:(spell?.tier===2?29:26)*unit,progress};
 }
 function coreContact(a){
  if(a<175||a>=470)return;
  const d=Math.hypot(hero.x-cx,hero.y-cy),speed=Math.hypot(hero.vx||0,hero.vy||0);
  if(d>(hero.radius||22)+24*unit||speed<1.8||tick-coreLast<67)return;
  coreLast=tick;contacts++;
  circleHit(hero,cx,cy,24*unit,1.7,0,'core','폭풍의 눈');
  if(contacts>=2&&!weakDone){weakDone=true;weakpoint?.();}
 }
 function gust(p,x,y,strength,twist){
  const dx=p.x-x,dy=p.y-y,d=Math.max(5,Math.hypot(dx,dy));
  const near=cap((216*unit-d)/(216*unit),0,1);
  const wind=strength*near;
  p.vx=cap((p.vx||0)+(-dy/d*wind+dx/d*wind*twist),-11,11);
  p.vy=cap((p.vy||0)+(dx/d*wind+dy/d*wind*twist),-11,11);
 }
 function bendShots(a){
  let processed=0;const seen=new Set();
  for(const list of [hero.forgeShots,boss.forgeShots,hero.bfShots,boss.bfShots,g.AdvancedCombat?.projectiles]){
   if(!Array.isArray(list))continue;
   for(const b of list){
    if(seen.has(b))continue;seen.add(b);
    if(++processed>maxProjectiles)return;
    if(!Number.isFinite(b.x)||!Number.isFinite(b.y))continue;
    let vx=Number.isFinite(b.vx)?b.vx:0,vy=Number.isFinite(b.vy)?b.vy:0;
    if(spell.variant===0&&a>=145&&a<475){
     const dx=b.x-cx,dy=b.y-cy,d=Math.max(4,Math.hypot(dx,dy));
     const near=cap((220*unit-d)/(220*unit),0,1);
     vx+=(-dy/d*.36+dx/d*.045)*near;vy+=(dx/d*.36+dy/d*.045)*near;
    }else if(spell.variant===1){
     for(let i=0;i<rods.length-1;i++)if(arcLive(i,a)){
      const line=arcAt(i),n=nearest(b,line.x1,line.y1,line.x2,line.y2);
      if(n.d<line.width*.5+10*unit){
       vx+=n.nx*.42;vy+=n.ny*.42;
      }
     }
    }else if(spell.variant===2&&a>=170&&a<495){
     for(let i=0;i<(spell.tier===2?3:2);i++){
      const bird=diveAt(i,a),dx=b.x-bird.x,dy=b.y-bird.y,d=Math.max(2,Math.hypot(dx,dy));
      if(d<bird.r+70*unit){const weight=cap((bird.r+70*unit-d)/(bird.r+70*unit),0,1);
       vx+=-dy/d*.32*weight;vy+=dx/d*.32*weight;}
     }
    }
    b.vx=cap(vx,-15,15);b.vy=cap(vy,-15,15);
   }
  }
 }
 function step(){
  tick++;if(!spell)return;
  const a=age();
  if(tick>=spell.end){clear();return;}
  if(a<spell.warning)return;
  if(spell.variant===0){
   if(a>=145&&a<475){
    gust(hero,cx,cy,spell.tier===2?.29:.21,-.16);
    gust(boss,cx,cy,.045,-.08);
    const n=spell.tier===2?3:2;
    for(let i=0;i<n;i++)lineHit(hero,spokeAt(i,a),'spoke-'+i,'허리케인 회전벽',spell.tier===2?18:13);
    coreContact(a);
   }
  }else if(spell.variant===1){
   for(let i=0;i<rods.length-1;i++){
    const r=rods[i],aStart=175+i*64;
    if(a>=aStart&&a<aStart+38){
     lineHit(hero,arcAt(i),'chain','천공의 심판 · 전격 통로',spell.tier===2?27:19,80);
     circleHit(hero,r.x,r.y,r.r,2.1,spell.tier===2?20:15,'rod','번개 기둥');
     const last=rods[i+1];circleHit(hero,last.x,last.y,last.r,2.1,
       spell.tier===2?20:15,'rod','번개 기둥');
    }
   }
   coreContact(a);
  }else if(a>=170&&a<495){
   const n=spell.tier===2?3:2;
   for(let i=0;i<n;i++){
    const bird=diveAt(i,a);
    if(bird.progress<=0||bird.progress>=1)continue;
    const dx=hero.x-bird.x,dy=hero.y-bird.y,d=Math.max(1,Math.hypot(dx,dy));
    if(d<bird.r+80*unit){
     const influence=(1-d/(bird.r+80*unit))*.21;
     hero.vx=cap((hero.vx||0)-dy/d*influence,-11,11);
     hero.vy=cap((hero.vy||0)+dx/d*influence,-11,11);
    }
    circleHit(hero,bird.x,bird.y,bird.r,3.1,spell.tier===2?24:17,'dive-'+i,'천둥새 충격');
   }
  }
  bendShots(a);
 }
 function draw(ctx){
  if(!spell)return;
  const a=age(),fade=cap((spell.end-tick)/55,0,1),live= a>=spell.warning;
  ctx.save();
  // Atmospheric funnel: transparent to keep ball silhouettes and HUD readable.
  const bg=ctx.createRadialGradient(cx,cy,4,cx,cy,229*unit);
  bg.addColorStop(0,'rgba(13,27,48,.04)');bg.addColorStop(.62,'rgba(51,93,124,.11)');
  bg.addColorStop(1,'rgba(90,164,205,0)');
  ctx.globalAlpha=.62*fade;ctx.fillStyle=bg;ctx.beginPath();ctx.arc(cx,cy,229*unit,0,TAU);ctx.fill();
  if(spell.variant===0){
   const n=spell.tier===2?3:2,active=a>=145&&a<475;
   ctx.save();ctx.translate(cx,cy);
   for(let k=0;k<4;k++){
    ctx.globalAlpha=fade*(active?.23:.11);
    ctx.strokeStyle=k%2?PALETTE.violet:PALETTE.electric;ctx.lineWidth=(1.4+k*.6)*unit;
    ctx.beginPath();ctx.ellipse(0,0,(82+k*39)*unit,(63+k*27)*unit,
      (a*.002*(k%2?-1:1)+k*.27),0,TAU);ctx.stroke();
   }
   ctx.restore();
   for(let i=0;i<n;i++){
    const arm=spokeAt(i,a);ctx.save();ctx.globalAlpha=fade*(active?.9:.28);
    ctx.strokeStyle=PALETTE.electric;ctx.lineWidth=arm.width;
    ctx.lineCap='round';ctx.shadowColor=PALETTE.blue;ctx.shadowBlur=active?14*unit:0;
    ctx.beginPath();ctx.moveTo(arm.x1,arm.y1);ctx.lineTo(arm.x2,arm.y2);ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle=PALETTE.white;ctx.lineWidth=2*unit;
    ctx.beginPath();ctx.moveTo(arm.x1,arm.y1);ctx.lineTo(arm.x2,arm.y2);ctx.stroke();ctx.restore();
   }
  }else if(spell.variant===1){
   for(let i=0;i<rods.length-1;i++){
    const arc=arcAt(i),start=175+i*64,active=arcLive(i,a);
    if(a>start+38)continue;
    const appearing=cap((a-start+85)/85,0,1);
    ctx.save();ctx.globalAlpha=fade*(active?.95:.12+.35*appearing);
    ctx.lineCap='round';ctx.strokeStyle=active?PALETTE.white:PALETTE.blue;
    ctx.lineWidth=arc.width;ctx.shadowColor=PALETTE.electric;ctx.shadowBlur=active?17*unit:0;
    ctx.setLineDash(active?[]:[8*unit,6*unit]);ctx.beginPath();
    ctx.moveTo(arc.x1,arc.y1);ctx.lineTo(arc.x2,arc.y2);ctx.stroke();ctx.setLineDash([]);
    if(active){
     ctx.shadowBlur=0;ctx.strokeStyle='#3c8dbb';ctx.lineWidth=2*unit;ctx.beginPath();
     ctx.moveTo(arc.x1,arc.y1);ctx.lineTo(arc.x2,arc.y2);ctx.stroke();
    }
    ctx.restore();
   }
   for(const rod of rods){
    ctx.save();ctx.globalAlpha=fade*.8;ctx.fillStyle=PALETTE.cloud;ctx.strokeStyle=PALETTE.electric;
    ctx.lineWidth=3*unit;ctx.beginPath();ctx.arc(rod.x,rod.y,rod.r,0,TAU);ctx.fill();ctx.stroke();
    ctx.fillStyle=PALETTE.white;ctx.beginPath();ctx.arc(rod.x,rod.y,rod.r*.32,0,TAU);ctx.fill();ctx.restore();
   }
  }else{
   const n=spell.tier===2?3:2,active=a>=170&&a<495;
   for(let i=0;i<n;i++){
    const p=diveAt(i,a);
    if(p.progress<=0||p.progress>=1)continue;
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=fade*(active?.88:.25);
    const halo=ctx.createRadialGradient(0,0,1,0,0,p.r*2.6);
    halo.addColorStop(0,'rgba(230,252,255,.95)');halo.addColorStop(.28,'rgba(109,203,255,.66)');
    halo.addColorStop(1,'rgba(118,134,255,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,p.r*2.6,0,TAU);ctx.fill();
    // Wing-like nested cloud arcs, not a humanoid bird.
    for(let wing of [-1,1]){ctx.strokeStyle=wing===1?PALETTE.electric:PALETTE.white;
     ctx.lineWidth=4*unit;ctx.beginPath();ctx.ellipse(wing*p.r*.33,0,p.r*.77,p.r*.38,
       wing*.42,0,Math.PI*1.7);ctx.stroke();}
    ctx.strokeStyle=PALETTE.white;ctx.lineWidth=2*unit;
    ctx.beginPath();ctx.arc(0,0,p.r,0,TAU);ctx.stroke();ctx.restore();
   }
  }
  // Precisely match the physical core collision radius.
  if(spell.variant!==2&&a>=150&&a<470){
   ctx.save();ctx.globalAlpha=fade*(live?.86:.24);
   ctx.strokeStyle=weakDone?'#fff8c7':PALETTE.electric;ctx.lineWidth=2.5*unit;
   ctx.beginPath();ctx.arc(cx,cy,24*unit,0,TAU);ctx.stroke();
   ctx.fillStyle='#b5eaff';ctx.beginPath();ctx.arc(cx,cy,8*unit,0,TAU);ctx.fill();ctx.restore();
  }
  ctx.restore();
 }
 return {begin,step,draw,clear,spokeAt,arcAt,arcLive,diveAt,
  get active(){return !!spell;},get spell(){return spell;},get rods(){return rods;},
  get contacts(){return contacts;},get hitCount(){return hitCount;},get age(){return age();}};
}
g.ArenaStormSupercell=Object.freeze({create,PALETTE});
})(globalThis);

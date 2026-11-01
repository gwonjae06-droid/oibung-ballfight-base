/* Ice Tower 5F/10F — deterministic, simulation-owned crystalline pinball.
 * Warning/active phases, geometry, damage and visual shapes share one clock.
 * No damage is applied by drawing; no fake rewind, free aim or HP rewrites.
 */
(function(g){'use strict';
const TAU=Math.PI*2,clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const COLORS=Object.freeze({glass:'#d8ffff',core:'#8dd9f7',blue:'#6fa7ed',ink:'#17324e',white:'#f7ffff'});
function create({width=500,height=500,hero,boss,damage,weakpoint}){
 const cx=width*.5,cy=height*.5,unit=Math.min(width,height)/500;
 let tick=0,spell=null,contactCount=0,coreLast=-999,weakOpened=false,hitCount=0,projectilesBent=0;
 const contactLast=new Map(),shotLast=new WeakMap();
 function begin(tier=1,variant=0){
  clear();
  spell={tier,variant,start:tick,end:tick+540,warning:variant===0?95:variant===1?120:135};
  contactCount=0;coreLast=-999;weakOpened=false;hitCount=0;projectilesBent=0;
  return spell;
 }
 function clear(){
  spell=null;contactLast.clear();
  if(hero&&hero._towerIceAbsoluteZero)hero._towerIceAbsoluteZero=0;
 }
 const age=()=>spell?tick-spell.start:-1;
 const coldWindow=a=>spell?.variant===1&&a>=165&&a<430;
 const prismAt=(i,a)=>{
  const count=spell?.tier===2?6:4,theta=i*TAU/count+Math.max(0,a-95)*(i%2?-.0025:.0038);
  const orbit=(spell?.tier===2?137:124)*unit;
  return {x:cx+Math.cos(theta)*orbit,y:cy+Math.sin(theta)*orbit,
   radius:(spell?.tier===2?25:22)*unit,angle:theta,id:i};
 };
 const frostRing=a=>{
  const phase=clamp((a-175)/200,0,1);
  return {r:(94+106*phase)*unit,width:21*unit,phase};
 };
 const wallAt=(i,a)=>{
  const progress=clamp((a-170)/180,0,1);
  const easing=progress*progress*(3-2*progress);
  const x=(i%2===0?width*(.08+easing*.25):width*(.92-easing*.25));
  // Each wall is a 2D prism with a safe open corridor between its ends.
  const upper=i<2;
  const y1=height*(upper?.08:.62),y2=height*(upper?.38:.92);
  return {x1:x,y1,x2:x,y2,width:(spell?.tier===2?24:21)*unit,id:i,progress};
 };
 const lanceAt=(i,a)=>{
  const count=spell?.tier===2?5:3;
  const start=228+i*43,progress=clamp((a-start)/73,0,1);
  const dir=i%2?1:-1;
  const y=height*(.2+i*.6/(count-1));
  const x=width*(dir===1? .08+progress*.84:.92-progress*.84);
  const length=59*unit,ang=(i%2?0:Math.PI)+(i%3-1)*.14;
  return {x1:x-Math.cos(ang)*length*.5,y1:y-Math.sin(ang)*length*.5,
   x2:x+Math.cos(ang)*length*.5,y2:y+Math.sin(ang)*length*.5,
   x,y,angle:ang,width:17*unit,progress,start,id:i};
 };
 const inHeight=p=>Math.max(Number(p?.z)||0,Number(p?.jumpHeight)||0)<=62;
 function bounce(p,nx,ny,kick=1.7){
  const approach=(p.vx||0)*nx+(p.vy||0)*ny;
  const impulse=clamp(-Math.min(approach,-.5)*1.68+kick,.6,8);
  p.vx=clamp((p.vx||0)+nx*impulse,-12,12);
  p.vy=clamp((p.vy||0)+ny*impulse,-12,12);
  g.ArenaBallSquash?.wall?.(p,nx,ny,impulse);
  g.BounceMomentum?.wall?.(p,impulse);
  p._pinballReboundHold=Math.max(p._pinballReboundHold||0,8);
 }
 function hit(p,key,amount,label,interval=88){
  const last=contactLast.get(key)??-999;
  if(tick-last<interval)return false;
  if(damage?.(p,amount,{realm:'ice',kind:'boss',label})===false)return false;
  contactLast.set(key,tick);hitCount++;
  return true;
 }
 function circleContact(p,x,y,r,kick,key,amount,label){
  if(!inHeight(p))return false;
  const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy),pr=p.radius||22;
  if(d>=r+pr)return false;
  const nx=d>.001?dx/d:1,ny=d>.001?dy/d:0,margin=pr+16,overlap=r+pr-d+.35;
  p.x=clamp(p.x+nx*overlap,margin,width-margin);
  p.y=clamp(p.y+ny*overlap,margin,height-margin);
  bounce(p,nx,ny,kick);
  if(amount)hit(p,key,amount,label);
  return true;
 }
 function nearest(p,s){
  const dx=s.x2-s.x1,dy=s.y2-s.y1,div=dx*dx+dy*dy||1;
  const t=clamp(((p.x-s.x1)*dx+(p.y-s.y1)*dy)/div,0,1);
  const x=s.x1+t*dx,y=s.y1+t*dy,d=Math.hypot(p.x-x,p.y-y),len=Math.sqrt(div);
  return {x,y,d,nx:d>.0001?(p.x-x)/d:-dy/len,ny:d>.0001?(p.y-y)/d:dx/len};
 }
 function segmentContact(p,segment,kick,key,amount,label){
  if(!inHeight(p))return false;
  const q=nearest(p,segment),limit=(p.radius||22)+segment.width*.5;
  if(q.d>=limit)return false;
  const margin=(p.radius||22)+16,overlap=limit-q.d+.35;
  p.x=clamp(p.x+q.nx*overlap,margin,width-margin);
  p.y=clamp(p.y+q.ny*overlap,margin,height-margin);
  bounce(p,q.nx,q.ny,kick);
  if(amount)hit(p,key,amount,label);
  return true;
 }
 function coreContact(a){
  if(a<165||a>=465||spell.variant===2)return;
  const dist=Math.hypot(hero.x-cx,hero.y-cy);
  if(dist>(hero.radius||22)+23*unit||Math.hypot(hero.vx||0,hero.vy||0)<1.9||tick-coreLast<65)return;
  coreLast=tick;contactCount++;
  circleContact(hero,cx,cy,23*unit,1.7,'core',0,'빙정 코어');
  if(contactCount>=2&&!weakOpened){weakOpened=true;weakpoint?.();}
 }
 function shotLists(){
  return [hero.forgeShots,boss.forgeShots,hero.bfShots,boss.bfShots,g.AdvancedCombat?.projectiles];
 }
 function reflectShot(shot,shape,round=false){
  if(!Number.isFinite(shot.x)||!Number.isFinite(shot.y))return;
  const q=round?(()=>{
    const dx=shot.x-shape.x,dy=shot.y-shape.y,d=Math.hypot(dx,dy);
    return {d,nx:d>.001?dx/d:1,ny:d>.001?dy/d:0};
  })():nearest(shot,shape);
  const threshold=round?shape.radius+(Number(shot.radius)||3):(shape.width*.5+(Number(shot.radius)||3));
  if(q.d>threshold||tick-(shotLast.get(shot)??-999)<8)return;
  const vx=Number(shot.vx)||0,vy=Number(shot.vy)||0,approach=vx*q.nx+vy*q.ny;
  if(approach>=0)return;
  shot.vx=clamp(vx-1.7*approach*q.nx,-15,15);
  shot.vy=clamp(vy-1.7*approach*q.ny,-15,15);
  shotLast.set(shot,tick);projectilesBent++;
 }
 function projectileStep(a){
  const shapes=[];
  if(spell.variant===0&&a>=140&&a<468)
   for(let i=0;i<(spell.tier===2?6:4);i++)shapes.push({...prismAt(i,a),round:true});
  if(spell.variant===2&&a>=170&&a<471){
   for(let i=0;i<4;i++)shapes.push(wallAt(i,a));
   for(let i=0;i<(spell.tier===2?5:3);i++){
    const s=lanceAt(i,a);if(s.progress>0&&s.progress<1)shapes.push(s);
   }
  }
  const seen=new Set();let processed=0;
  for(const list of shotLists()){
   if(!Array.isArray(list))continue;
   for(const shot of list){
    if(!shot||typeof shot!=='object'||seen.has(shot))continue;
    seen.add(shot);if(++processed>90)return;
    if(spell.variant===1&&coldWindow(a)){
     const dx=shot.x-cx,dy=shot.y-cy;
     if(Number.isFinite(dx)&&Number.isFinite(dy)&&Math.hypot(dx,dy)<223*unit){
      if(Number.isFinite(shot.vx))shot.vx*=.991;
      if(Number.isFinite(shot.vy))shot.vy*=.991;
     }
    }
    for(const s of shapes)reflectShot(shot,s,!!s.round);
   }
  }
 }
 function step(){
  tick++;if(!spell)return;
  const a=age();
  if(tick>=spell.end){clear();return;}
  if(a<spell.warning)return;
  if(spell.variant===0){
   if(a>=140&&a<468){
    for(let i=0;i<(spell.tier===2?6:4);i++){
     const s=prismAt(i,a);
     circleContact(hero,s.x,s.y,s.radius,2.6,'prism-'+i,
      spell.tier===2?19:14,'거울 빙정 반사');
    }
   }
   coreContact(a);
  }else if(spell.variant===1){
   if(coldWindow(a)){
    // Actual friction with preserved heading, not CC freeze/status damage.
    // Keep momentum above a floor so pinball cannot become permanently stuck.
    const speed=Math.hypot(hero.vx||0,hero.vy||0);
    if(speed>1){
     const slow=spell.tier===2?.982:.988;
     hero.vx*=slow;hero.vy*=slow;
    }
    hero._towerIceAbsoluteZero=2;
    const ring=frostRing(a),d=Math.max(.0001,Math.hypot(hero.x-cx,hero.y-cy));
    const thickness=(hero.radius||22)+ring.width*.5;
    if(inHeight(hero)&&Math.abs(d-ring.r)<thickness){
     const direction=d<ring.r?-1:1,dx=(hero.x-cx)/d,dy=(hero.y-cy)/d;
     const overlap=thickness-Math.abs(d-ring.r)+.2,margin=(hero.radius||22)+16;
     hero.x=clamp(hero.x+dx*direction*overlap,margin,width-margin);
     hero.y=clamp(hero.y+dy*direction*overlap,margin,height-margin);
     bounce(hero,dx*direction,dy*direction,1.5);
     hit(hero,'frost-ring',spell.tier===2?24:17,'절대영도 파동',100);
    }
   }else hero._towerIceAbsoluteZero=0;
   coreContact(a);
  }else if(a>=170&&a<471){
   // Moving, collision-active glacier plates; central 24%-width lane open.
   for(let i=0;i<4;i++){
    const s=wallAt(i,a);
    segmentContact(hero,s,2.3,'wall-'+i,spell.tier===2?19:14,'빙하 대륙 분열');
   }
   for(let i=0;i<(spell.tier===2?5:3);i++){
    const s=lanceAt(i,a);
    if(s.progress>0&&s.progress<1)
     segmentContact(hero,s,2.9,'lance-'+i,spell.tier===2?24:17,'천년 빙창');
   }
  }
  projectileStep(a);
 }
 function draw(ctx){
  if(!spell)return;
  const a=age(),fade=clamp((spell.end-tick)/52,0,1),tier=spell.tier,v=spell.variant;
  ctx.save();
  const aura=ctx.createRadialGradient(cx,cy,15*unit,cx,cy,232*unit);
  aura.addColorStop(0,'rgba(187,242,255,.06)');
  aura.addColorStop(.45,'rgba(103,171,217,.12)');
  aura.addColorStop(1,'rgba(48,105,177,0)');
  ctx.globalAlpha=.65*fade;ctx.fillStyle=aura;ctx.beginPath();ctx.arc(cx,cy,232*unit,0,TAU);ctx.fill();
  if(v===0){
   for(let i=0;i<(tier===2?6:4);i++){
    const s=prismAt(i,a),live=a>=140&&a<468;
    if(a>=490)break;
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);
    ctx.globalAlpha=fade*(live?.95:.28);
    ctx.shadowColor=COLORS.core;ctx.shadowBlur=live?12*unit:0;
    ctx.fillStyle='#4e92bc';ctx.strokeStyle=COLORS.glass;ctx.lineWidth=2.5*unit;
    ctx.beginPath();ctx.moveTo(0,-s.radius);ctx.lineTo(s.radius*.85,-s.radius*.26);
    ctx.lineTo(s.radius*.75,s.radius*.65);ctx.lineTo(0,s.radius);
    ctx.lineTo(-s.radius*.75,s.radius*.65);ctx.lineTo(-s.radius*.85,-s.radius*.26);
    ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='rgba(238,255,255,.53)';ctx.beginPath();
    ctx.moveTo(0,-s.radius*.7);ctx.lineTo(s.radius*.55,-s.radius*.15);
    ctx.lineTo(0,s.radius*.23);ctx.closePath();ctx.fill();
    // Outer ring indicates the exact collision boundary.
    ctx.strokeStyle=COLORS.glass;ctx.lineWidth=1*unit;ctx.beginPath();
    ctx.arc(0,0,s.radius,0,TAU);ctx.stroke();ctx.restore();
   }
  }else if(v===1){
   const ring=frostRing(a),live=coldWindow(a);
   if(a<486){
    ctx.save();ctx.translate(cx,cy);ctx.globalAlpha=fade*(live?.75:.18);
    ctx.strokeStyle=COLORS.glass;ctx.lineWidth=ring.width;
    ctx.shadowColor=COLORS.blue;ctx.shadowBlur=live?18*unit:0;
    ctx.beginPath();ctx.arc(0,0,ring.r,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    for(let k=0;k<24;k++){
     const ang=k*TAU/24,rr=ring.r;
     ctx.lineWidth=2*unit;ctx.strokeStyle=k%3?COLORS.core:COLORS.white;
     ctx.beginPath();ctx.moveTo(Math.cos(ang)*(rr-ring.width*.8),Math.sin(ang)*(rr-ring.width*.8));
     ctx.lineTo(Math.cos(ang)*(rr+ring.width*.8),Math.sin(ang)*(rr+ring.width*.8));ctx.stroke();
    }
    ctx.restore();
   }
  }else{
   for(let i=0;i<4;i++){
    const s=wallAt(i,a),live=a>=170&&a<471;
    if(a>488)continue;
    ctx.save();ctx.globalAlpha=fade*(live?.81:.24);
    ctx.strokeStyle='#77bbe4';ctx.lineWidth=s.width;
    ctx.lineCap='round';ctx.shadowColor=COLORS.glass;ctx.shadowBlur=live?12*unit:0;
    ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle=COLORS.glass;ctx.lineWidth=2*unit;
    ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();
    ctx.restore();
   }
   for(let i=0;i<(tier===2?5:3);i++){
    const s=lanceAt(i,a);
    if(a>=s.start-60&&a<s.start){
     // The spear's track is visibly warned before the collidable lance moves.
     ctx.save();ctx.globalAlpha=fade*(.19+.23*clamp((a-s.start+60)/60,0,1));
     ctx.setLineDash([9*unit,7*unit]);ctx.strokeStyle=COLORS.glass;
     ctx.lineWidth=2*unit;ctx.beginPath();
     ctx.moveTo(24*unit,s.y);ctx.lineTo(width-24*unit,s.y);ctx.stroke();
     ctx.setLineDash([]);ctx.restore();
    }
    if(a<s.start||s.progress<=0||s.progress>=1)continue;
    ctx.save();ctx.globalAlpha=fade*.89;ctx.lineCap='round';
    ctx.strokeStyle=COLORS.glass;ctx.lineWidth=s.width;
    ctx.shadowColor=COLORS.core;ctx.shadowBlur=15*unit;
    ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle=COLORS.blue;ctx.lineWidth=2*unit;
    ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();ctx.restore();
   }
  }
  if(v!==2&&a>=150&&a<480){
   ctx.save();ctx.translate(cx,cy);ctx.globalAlpha=fade*.87;
   const core=ctx.createRadialGradient(0,0,0,0,0,31*unit);
   core.addColorStop(0,'rgba(248,255,255,.94)');
   core.addColorStop(.36,'rgba(142,236,255,.68)');
   core.addColorStop(1,'rgba(95,162,229,0)');
   ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,31*unit,0,TAU);ctx.fill();
   ctx.strokeStyle=weakOpened?'#fff4b8':COLORS.glass;ctx.lineWidth=2*unit;
   ctx.beginPath();ctx.arc(0,0,23*unit,0,TAU);ctx.stroke();ctx.restore();
  }
  ctx.restore();
 }
 return {begin,clear,step,draw,prismAt,frostRing,wallAt,lanceAt,coldWindow,
  get active(){return !!spell;},get spell(){return spell;},get age(){return age();},
  get contacts(){return contactCount;},get hitCount(){return hitCount;},
  get projectilesBent(){return projectilesBent;}};
}
g.ArenaIceGlacier=Object.freeze({create,COLORS});
})(globalThis);

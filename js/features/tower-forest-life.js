/* Forest Tower 5F/10F: simulation-owned living pinball architecture.
 * Root capsules, seed bumpers, spore fields and the World Tree's lifebloom
 * share exact telegraphed geometry with the canvas; no hitboxes in rendering.
 * All damage goes through the existing tower adapter. No direct HP drains.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(x,l,h)=>Math.max(l,Math.min(h,x));
const C=Object.freeze({leaf:'#c7efa6',glow:'#edffd7',moss:'#5eae73',wood:'#5a4735',poison:'#c5b4ef',ink:'#1c322e'});
function create({width=500,height=500,hero,boss,damage,weakpoint}){
 const cx=width/2,cy=height/2,u=Math.min(width,height)/500;
 let tick=0,spell=null,seeds=[],blooms=[],hits=0,coreHits=0,weakDone=false,coreLast=-100,heals=0,shotBounces=0;
 const hitLast=new Map(),shotLast=new WeakMap();
 const age=()=>spell?tick-spell.start:-1;
 function clear(){spell=null;seeds=[];blooms=[];hitLast.clear();}
 function begin(tier=1,variant=0){
  clear();
  spell={tier,variant,start:tick,end:tick+540,warning:variant===0?105:variant===1?120:130};
  hits=0;coreHits=0;weakDone=false;coreLast=-100;heals=0;shotBounces=0;
  if(variant===1||variant===2){
   const n=variant===1?(tier===2?5:3):(tier===2?5:4);
   for(let i=0;i<n;i++){
    const a=TAU*i/n+.24,r=(variant===2?149:136)*u;
    const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
    seeds.push({id:i,x,y,r:(tier===2?19:16)*u,hp:2,maxHp:2,
      born:tick,first:variant===2?182:164,until:variant===2?495:435,
      lastContact:-100,destroyed:false});
   }
  }
  if(variant===1){
   const n=tier===2?5:3;
   for(let i=0;i<n;i++){
    const a=TAU*i/n+.55;
    blooms.push({id:i,x:cx+Math.cos(a)*145*u,y:cy+Math.sin(a)*145*u,
      r:(tier===2?62:55)*u,fire:185+i*34,until:395+i*19});
   }
  }
  return spell;
 }
 function activeSeed(s,a){return !s.destroyed&&a>=s.first&&a<s.until;}
 function rootAt(i,a){
  const n=spell?.tier===2?4:3,theta=i*TAU/n+
    Math.max(0,a-145)*(i%2?-.006:.0075)+(i%2?.15:0);
  const outer=(spell?.tier===2?211:184)*u,inner=53*u;
  return {x1:cx+Math.cos(theta)*inner,y1:cy+Math.sin(theta)*inner,
    x2:cx+Math.cos(theta)*outer,y2:cy+Math.sin(theta)*outer,
    width:(spell?.tier===2?25:21)*u,angle:theta,id:i};
 }
 function vineAt(i,a){
  const n=spell?.tier===2?5:4;
  const pos=i/(n-1),start=205+i*38,progress=cap((a-start)/75,0,1);
  const x=width*(.13+pos*.74),drift=Math.sin((a-start)*.018+i)*13*u;
  const fromTop=i%2===0;
  const y1=fromTop?height*.12:height*.88;
  const y2=fromTop?height*(.12+progress*.58):height*(.88-progress*.58);
  return {x1:x+drift,y1,x2:x+drift,y2,width:18*u,start,progress,id:i};
 }
 function nearest(p,l){
  const dx=l.x2-l.x1,dy=l.y2-l.y1,div=dx*dx+dy*dy||1;
  const t=cap(((p.x-l.x1)*dx+(p.y-l.y1)*dy)/div,0,1);
  const x=l.x1+t*dx,y=l.y1+t*dy,dist=Math.hypot(p.x-x,p.y-y),len=Math.sqrt(div);
  return {dist,nx:dist>.001?(p.x-x)/dist:-dy/len,ny:dist>.001?(p.y-y)/dist:dx/len};
 }
 function impact(p,nx,ny,kick){
  const speed=(p.vx||0)*nx+(p.vy||0)*ny;
  const imp=cap(-Math.min(speed,-.5)*1.6+kick,.7,8.5);
  p.vx=cap((p.vx||0)+nx*imp,-12,12);p.vy=cap((p.vy||0)+ny*imp,-12,12);
  g.ArenaBallSquash?.wall?.(p,nx,ny,imp);
  g.BounceMomentum?.wall?.(p,imp);
  p._pinballReboundHold=Math.max(p._pinballReboundHold||0,8);
 }
 function hurt(p,key,amount,label,frames=86,poison=false){
  if(tick-(hitLast.get(key)??-1000)<frames)return false;
  const result=damage?.(p,amount,{realm:'forest',kind:'boss',label});
  if(result===false)return false;
  hitLast.set(key,tick);hits++;
  if(poison){
   // Existing poison status is visual/control only here; the hit adapter
   // remains the sole damage source, preventing overlapping hidden DOT.
   p.poisonTimer=Math.max(p.poisonTimer||0,60);
   p.slowTimer=Math.max(p.slowTimer||0,12);
   p.slowMultiplier=Math.min(p.slowMultiplier||1,.88);
  }
  return true;
 }
 function lineContact(p,l,key,amount,label){
  if(Math.max(p.z||0,p.jumpHeight||0)>62)return false;
  const q=nearest(p,l),limit=(p.radius||22)+l.width*.5;
  if(q.dist>=limit)return false;
  const margin=(p.radius||22)+18,overlap=limit-q.dist+.2;
  p.x=cap(p.x+q.nx*overlap,margin,width-margin);
  p.y=cap(p.y+q.ny*overlap,margin,height-margin);
  impact(p,q.nx,q.ny,2.1);hurt(p,key,amount,label);
  return true;
 }
 function circleContact(p,s,key,amount,label,poison=false){
  if(Math.max(p.z||0,p.jumpHeight||0)>62)return false;
  const dx=p.x-s.x,dy=p.y-s.y,d=Math.hypot(dx,dy);
  const limit=s.r+(p.radius||22);if(d>=limit)return false;
  const nx=d>.001?dx/d:1,ny=d>.001?dy/d:0,margin=(p.radius||22)+18;
  p.x=cap(p.x+nx*(limit-d+.2),margin,width-margin);
  p.y=cap(p.y+ny*(limit-d+.2),margin,height-margin);
  impact(p,nx,ny,2.05);if(amount)hurt(p,key,amount,label,86,poison);
  return true;
 }
 function splinterSeed(s,a,fromProjectile=false){
  if(!activeSeed(s,a)||tick-s.lastContact<46)return false;
  s.lastContact=tick;s.hp=Math.max(0,s.hp-1);
  if(!s.hp){s.destroyed=true;
   g.addFloatingText?.('🌿 씨앗핵 분쇄!',s.x,s.y-28,'#baf0aa',15);
   if(weakDone)return true;
   // Destroying two real seed constructs temporarily exposes the boss;
   // unlike auto-dodge, physics/projectile collisions earn the window.
   const destroyed=seeds.filter(v=>v.destroyed).length;
   if(destroyed>=2){weakDone=true;weakpoint?.();}
  }
  return true;
 }
 function collideSeed(s,a){
  if(!activeSeed(s,a))return;
  const dx=hero.x-s.x,dy=hero.y-s.y,d=Math.hypot(dx,dy);
  const speed=Math.hypot(hero.vx||0,hero.vy||0);
  if(d>=s.r+(hero.radius||22))return;
  const blocked=circleContact(hero,s,'seed-'+s.id,spell.tier===2?16:11,'씨앗 수호석');
  if(blocked&&speed>2.1&&tick-s.lastContact>=46)splinterSeed(s,a);
 }
 function sporeAt(b,a){
  const drift=Math.max(0,a-b.fire)*.004;
  return {x:b.x+Math.sin(drift+b.id)*10*u,y:b.y+Math.cos(drift+b.id)*8*u,r:b.r};
 }
 function spores(a){
  if(a<185)return;
  for(const b of blooms){
   if(a<b.fire||a>=b.until)continue;
   const patch=sporeAt(b,a),d=Math.hypot(hero.x-patch.x,hero.y-patch.y);
   if(d<=patch.r+(hero.radius||22)&&Math.max(hero.z||0,hero.jumpHeight||0)<=38){
    hurt(hero,'spore-'+b.id,spell.tier===2?12:8,'독성 포자 개화',96,true);
    const vx=hero.vx||0,vy=hero.vy||0;
    const drift=.028*(1-d/(patch.r+(hero.radius||22)));
    hero.vx=cap(vx+(hero.x-patch.x)/Math.max(1,d)*drift,-11,11);
    hero.vy=cap(vy+(hero.y-patch.y)/Math.max(1,d)*drift,-11,11);
   }
  }
 }
 function coreContact(a){
  if(a<170||a>464||spell.variant===2)return;
  const speed=Math.hypot(hero.vx||0,hero.vy||0);
  if(speed<2.0||tick-coreLast<66)return;
  if(Math.hypot(hero.x-cx,hero.y-cy)>(hero.radius||22)+24*u)return;
  coreLast=tick;coreHits++;
  circleContact(hero,{x:cx,y:cy,r:24*u},'heart',0,'세계수 핵');
  if(coreHits>=2&&!weakDone){weakDone=true;weakpoint?.();}
 }
 function shotStep(a){
  const shapes=[];
  if(spell.variant===0&&a>=145&&a<475)
   for(let i=0;i<(spell.tier===2?4:3);i++)shapes.push(rootAt(i,a));
  if(spell.variant===2&&a>=215&&a<474)
   for(let i=0;i<(spell.tier===2?5:4);i++){
    const v=vineAt(i,a);if(v.progress>0&&v.progress<1)shapes.push(v);
   }
  let count=0;const seen=new Set();
  for(const list of [hero.forgeShots,boss.forgeShots,hero.bfShots,boss.bfShots,g.AdvancedCombat?.projectiles]){
   if(!Array.isArray(list))continue;
   for(const shot of list){
    if(!shot||typeof shot!=='object'||seen.has(shot))continue;
    seen.add(shot);if(++count>100)return;
    if(!Number.isFinite(shot.x)||!Number.isFinite(shot.y))continue;
    // Real moving vines/roots bounce authored projectiles instead of
    // steering enemies or adding invisible damage.
    for(const l of shapes){
     const q=nearest(shot,l),r=l.width*.5+(shot.radius||3);
     if(q.dist>=r||tick-(shotLast.get(shot)??-1000)<8)continue;
     const incoming=(shot.vx||0)*q.nx+(shot.vy||0)*q.ny;
     if(incoming>=0)continue;
     shot.vx=cap((shot.vx||0)-1.8*incoming*q.nx,-15,15);
     shot.vy=cap((shot.vy||0)-1.8*incoming*q.ny,-15,15);
     shotLast.set(shot,tick);shotBounces++;
    }
    for(const s of seeds){
     if(!activeSeed(s,a)||tick-s.lastContact<46)continue;
     const dx=shot.x-s.x,dy=shot.y-s.y,d=Math.hypot(dx,dy);
     if(d>=s.r+(shot.radius||3))continue;
     // No friendly-fire healing loophole: either side may disrupt a seed.
     if(splinterSeed(s,a,true)){
      shot.vx=-(shot.vx||0)*.6;shot.vy=-(shot.vy||0)*.6;
      shotBounces++;
     }
    }
   }
  }
 }
 function step(){
  tick++;if(!spell)return;
  const a=age();if(tick>=spell.end){clear();return;}
  if(a<spell.warning)return;
  if(spell.variant===0){
   if(a>=145&&a<475){
    for(let i=0;i<(spell.tier===2?4:3);i++)
     lineContact(hero,rootAt(i,a),'root-'+i,spell.tier===2?19:13,'세계수 휘감는 뿌리');
   }
   coreContact(a);
  }else if(spell.variant===1){
   for(const s of seeds)collideSeed(s,a);
   spores(a);coreContact(a);
  }else{
   for(const s of seeds)collideSeed(s,a);
   if(a>=215&&a<474){
    for(let i=0;i<(spell.tier===2?5:4);i++){
     const v=vineAt(i,a);if(v.progress>0&&v.progress<1)
      lineContact(hero,v,'vine-'+i,spell.tier===2?20:14,'덩굴 파수목');
    }
   }
   // Regeneration is bounded and conditional on LIVE, breakable seed cores.
   if(a>=230&&a<470&&a%90===0&&seeds.some(s=>activeSeed(s,a))){
    const amount=Math.min(boss.maxHp*.008,18),old=boss.hp;
    boss.hp=Math.min(boss.maxHp,boss.hp+amount);
    if(boss.hp>old)heals++;
   }
  }
  shotStep(a);
 }
 function draw(ctx){
  if(!spell)return;
  const a=age(),fade=cap((spell.end-tick)/58,0,1),v=spell.variant;
  ctx.save();
  const forest=ctx.createRadialGradient(cx,cy,12*u,cx,cy,240*u);
  forest.addColorStop(0,'rgba(48,89,48,.08)');
  forest.addColorStop(.58,'rgba(54,131,69,.11)');
  forest.addColorStop(1,'rgba(23,52,40,0)');
  ctx.globalAlpha=fade*.75;ctx.fillStyle=forest;
  ctx.beginPath();ctx.arc(cx,cy,239*u,0,TAU);ctx.fill();
  const drawRoot=(l,live)=>{
   ctx.save();ctx.globalAlpha=fade*(live?.89:.22);ctx.lineCap='round';
   ctx.strokeStyle=C.wood;ctx.lineWidth=l.width;
   ctx.shadowColor=C.moss;ctx.shadowBlur=live?11*u:0;
   ctx.beginPath();ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);ctx.stroke();
   ctx.shadowBlur=0;ctx.strokeStyle=C.glow;ctx.lineWidth=1.9*u;
   ctx.beginPath();ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);ctx.stroke();
   const dx=l.x2-l.x1,dy=l.y2-l.y1,normalX=-dy/(Math.hypot(dx,dy)||1),normalY=dx/(Math.hypot(dx,dy)||1);
   for(let j=1;j<=5;j++){
    const t=j/6,x=l.x1+dx*t,y=l.y1+dy*t,side=j%2?-1:1,len=(9+j%3*3)*u;
    ctx.strokeStyle=j%2?'#a8e897':'#7ab967';ctx.lineWidth=(2.5-j*.18)*u;
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.quadraticCurveTo(x+normalX*side*len*.7,y+normalY*side*len*.7,
      x+normalX*side*len+dx*.055,y+normalY*side*len+dy*.055);ctx.stroke();
   }
   ctx.restore();
  };
  if(v===0&&a<480)for(let i=0;i<(spell.tier===2?4:3);i++)
    drawRoot(rootAt(i,a),a>=145&&a<475);
  if(v===2&&a<486)for(let i=0;i<(spell.tier===2?5:4);i++){
   const line=vineAt(i,a);
   if(a>=line.start-60){
    if(a<line.start){
     ctx.save();ctx.globalAlpha=fade*.3;ctx.setLineDash([7*u,5*u]);
     ctx.strokeStyle=C.leaf;ctx.lineWidth=2*u;ctx.beginPath();
     ctx.moveTo(line.x1,line.y1);ctx.lineTo(line.x1,line.y1+(i%2?-.58:.58)*height);
     ctx.stroke();ctx.setLineDash([]);ctx.restore();
    }else if(line.progress>0&&line.progress<1)drawRoot(line,true);
   }
  }
  for(const s of seeds){
   if(s.destroyed||a<s.first-55||a>s.until)continue;
   const live=activeSeed(s,a),twinkle=.7+.3*Math.sin(a*.06+s.id);
   ctx.save();ctx.globalAlpha=fade*(live?.85:.31);ctx.translate(s.x,s.y);
   const glow=ctx.createRadialGradient(0,0,1,0,0,s.r*2.1);
   glow.addColorStop(0,'rgba(219,255,177,.87)');
   glow.addColorStop(.4,'rgba(102,193,79,.37)');
   glow.addColorStop(1,'rgba(54,129,87,0)');
   ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,s.r*2.1,0,TAU);ctx.fill();
   ctx.strokeStyle=C.leaf;ctx.lineWidth=2*u;ctx.beginPath();ctx.arc(0,0,s.r,0,TAU);ctx.stroke();
   ctx.fillStyle=C.wood;ctx.beginPath();ctx.arc(0,0,s.r*.76,0,TAU);ctx.fill();
   ctx.fillStyle=C.glow;ctx.beginPath();ctx.arc(0,0,s.r*.26*twinkle,0,TAU);ctx.fill();
   for(let k=0;k<5;k++){
    ctx.save();ctx.rotate(k*TAU/5+a*.007);
    ctx.fillStyle=k%2?C.leaf:C.moss;ctx.beginPath();
    ctx.ellipse(0,-s.r*.95,s.r*.22,s.r*.38,.3,0,TAU);ctx.fill();ctx.restore();
   }
   ctx.restore();
  }
  if(v===1){
   for(const b of blooms){
    if(a>b.until||a<b.fire-65)continue;
    const live=a>=b.fire&&a<b.until,s=sporeAt(b,a);
    ctx.save();ctx.globalAlpha=fade*(live?.57:.15);
    const haze=ctx.createRadialGradient(s.x,s.y,3,s.x,s.y,s.r);
    haze.addColorStop(0,'rgba(217,170,244,.45)');
    haze.addColorStop(.7,'rgba(168,126,221,.25)');
    haze.addColorStop(1,'rgba(175,121,226,0)');
    ctx.fillStyle=haze;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,TAU);ctx.fill();
    ctx.strokeStyle=C.poison;ctx.lineWidth=2*u;ctx.setLineDash(live?[]:[7*u,5*u]);
    ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,TAU);ctx.stroke();ctx.setLineDash([]);
    if(live)for(let i=0;i<13;i++){
     const theta=i*2.39996+a*.009,r=s.r*(.16+(i*17%65)/100);
     ctx.fillStyle=i%3===0?C.glow:C.poison;ctx.beginPath();
     ctx.arc(s.x+Math.cos(theta)*r,s.y+Math.sin(theta)*r,(1+i%3)*u,0,TAU);ctx.fill();
    }
    ctx.restore();
   }
  }
  if(v!==2&&a>=170&&a<465){
   ctx.save();ctx.translate(cx,cy);ctx.globalAlpha=fade*.79;
   const halo=ctx.createRadialGradient(0,0,1,0,0,35*u);
   halo.addColorStop(0,'rgba(247,255,205,.95)');
   halo.addColorStop(.4,'rgba(151,233,143,.64)');
   halo.addColorStop(1,'rgba(85,173,109,0)');
   ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,35*u,0,TAU);ctx.fill();
   ctx.strokeStyle=weakDone?'#fff0b9':C.leaf;ctx.lineWidth=2.3*u;
   ctx.beginPath();ctx.arc(0,0,24*u,0,TAU);ctx.stroke();ctx.restore();
  }
  ctx.restore();
 }
 return {begin,clear,step,draw,rootAt,vineAt,sporeAt,activeSeed,
  get active(){return !!spell;},get spell(){return spell;},get age(){return age();},
  get seeds(){return seeds;},get blooms(){return blooms;},get hits(){return hits;},
  get heals(){return heals;},get coreHits(){return coreHits;},get shotBounces(){return shotBounces;}};
}
g.ArenaForestLife=Object.freeze({create,C});
})(globalThis);

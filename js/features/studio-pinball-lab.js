/* Studio mini pinball sandbox. Read-only and independent of real matches.
 * Uses the real mass-based collision and squash helpers on disposable balls.
 * Authored Scratch actions drive VFX and bounded practice projectiles.
 * Preview is intentionally a physics/visual simulator, not HP/DPS validation.
 */
(function(g){
'use strict';
const TAU=Math.PI*2,W=480,H=300,FRAME=1000/60;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const RANGED=new Set(['shot','homing','pierce','boomerang','arcshot','splitshot','dung','meteor','starfall','beam','chain','bolt']);
const MOVE=new Set(['dash','blink','retreat','swap','leap','hover','glide','flight','burrow','burrowdash','portal','dive']);
const AREA=new Set(['wave','nova','slash','spinslash','thrust','uppercut','aircombo','erupt','zone','blackhole','mine','trap','pull']);
const SUPPORT=new Set(['shield','fortify','regen','heal','lifebloom','haste','timestop','timeburst','rewind','grow','shrink','resurrect','cleanse']);
const BUMPERS=[[60,60],[420,60],[60,240],[420,240]];
function actionsFor(profile,index,actionIndex=-1){
 const list=profile?.allAbilities?g.SkillForge?.allSkillset?.()||[]:profile?.skills||[];
 if(!list.length)return [];
 const selected=index==='all'?list.slice(0,Math.min(list.length,5)):
  [list[clamp(Number(index)||0,0,list.length-1)]];
 return selected.map(s=>{
  // The real Scratch preview compiler bounds loops and keeps the true branch
  // for conditional samples; never execute arbitrary source or mutate a draft.
  const actions=profile?.signatureVersion===1&&Array.isArray(s.program)?
   g.SignatureScratch?.preview?.(s.program)||[]:(s.actions||[]);
  const limited=actions.slice(0,12);
  const chosen=Number.isInteger(actionIndex)&&actionIndex>=0?limited.slice(actionIndex,actionIndex+1):limited;
  return {name:s.name||'내 필살기',actions:chosen};
 });
}
function make(profile={},focus=0,actionIndex=-1){
 const skills=actionsFor(profile,focus,actionIndex);
 let frame=0,simMs=0,energy=86,casts=0,active='',activity=0;
 const color=profile.effectColor||profile.color||'#a68fff';
 const hero={x:129,y:143,vx:3.5,vy:2.5,radius:18,hp:100,playerNum:1,
  forge:{speed:2.7,effectColor:color}};
 const target={x:355,y:148,vx:-2.7,vy:2.0,radius:19,hp:100,playerNum:2};
 const bullets=[],rings=[],sparks=[],queue=[];
 let cursor=0,lastContact=-100,lastWall=-100;
 const history=[];
 function spark(x,y,color='#f1ddac',strength=10){
  if(sparks.length>44)sparks.splice(0,sparks.length-28);
  sparks.push({x,y,color,t:0,life:clamp(strength,6,20)});
 }
 function squash(p,imp,nx,ny){g.ArenaBallSquash?.wall?.(p,nx,ny,imp);}
 function rebound(p,nx,ny,isHero){
  const d=p.vx*nx+p.vy*ny;
  if(d>=0)return;
  p.vx-=1.91*d*nx;p.vy-=1.91*d*ny;
  p.vx*=.985;p.vy*=.985;
  squash(p,-d,nx,ny);spark(p.x,p.y,isHero?color:'#f5a8a8',11);
  if(isHero&&frame-lastWall>=26){energy=clamp(energy+9,0,100);lastWall=frame;}
 }
 function bounds(p,isHero){
  const r=p.radius;
  if(p.x<19+r){p.x=19+r;rebound(p,1,0,isHero);}
  if(p.x>W-19-r){p.x=W-19-r;rebound(p,-1,0,isHero);}
  if(p.y<19+r){p.y=19+r;rebound(p,0,1,isHero);}
  if(p.y>H-19-r){p.y=H-19-r;rebound(p,0,-1,isHero);}
  for(const [x,y] of BUMPERS){
   const d=Math.hypot(p.x-x,p.y-y),threshold=r+12;
   if(d>=threshold)continue;
   const nx=d>.001?(p.x-x)/d:1,ny=d>.001?(p.y-y)/d:0;
   p.x=x+nx*(threshold+.01);p.y=y+ny*(threshold+.01);
   rebound(p,nx,ny,isHero);
  }
 }
 function bodyCollision(){
  const dist=near(hero,target),limit=hero.radius+target.radius;
  if(dist>=limit)return;
  const nx=dist>.001?(target.x-hero.x)/dist:1,ny=dist>.001?(target.y-hero.y)/dist:0;
  const push=(limit-dist+.01)/2;
  hero.x-=nx*push;hero.y-=ny*push;target.x+=nx*push;target.y+=ny*push;
  const closing=(target.vx-hero.vx)*nx+(target.vy-hero.vy)*ny;
  if(closing>=-.10)return;
  if(g.ArenaBodyPhysics?.pair)g.ArenaBodyPhysics.pair(hero,target,nx,ny);
  else{
   const pulse=-(1+.89)*closing*.5;
   hero.vx-=nx*pulse;hero.vy-=ny*pulse;
   target.vx+=nx*pulse;target.vy+=ny*pulse;
  }
  g.ArenaBallSquash?.pair?.(hero,target,closing,nx,ny);
  spark((hero.x+target.x)/2,(hero.y+target.y)/2,'#f8f2c6',17);
  if(frame-lastContact>=34){energy=clamp(energy+17,0,100);lastContact=frame;}
 }
 function hitTarget(x=target.x,y=target.y,large=false){
  const dx=target.x-x,dy=target.y-y,d=Math.hypot(dx,dy)||1;
  const nx=dx/d,ny=dy/d;
  target.vx=clamp(target.vx+nx*(large?2.4:1.1),-9,9);
  target.vy=clamp(target.vy+ny*(large?2.4:1.1),-9,9);
  squash(target,large?5:2,nx,ny);spark(target.x,target.y,'#ffb5a4',18);
 }
 function projectile(a,angle){
  if(bullets.length>=35)bullets.splice(0,bullets.length-9);
  const speed=clamp(Number(a.speed)||5,2,12)*.8;
  bullets.push({x:hero.x,y:hero.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
   life:220,r:5,color,status:a.status||'none',type:a.type,reflects:0,split:false,
   maxRebounds:a.type==='shot'?clamp(Math.round(Number(a.ricochet)||0),0,3):0});
 }
 function perform(action){
  const a=action||{},type=a.type||'wave';
  active=(g.SkillForge?.TYPE?.[type]||type)+' 실험 중';
  activity=frame+90;
  const dx=target.x-hero.x,dy=target.y-hero.y,angle=Math.atan2(dy,dx);
  if(RANGED.has(type)){
   if(['bolt','meteor','starfall','beam','chain'].includes(type)){
    rings.push({x:target.x,y:target.y,r:clamp((a.radius||80)*.35,23,65),age:0,life:33,color});
    hitTarget(hero.x,hero.y,true);
   }else{
    const count=clamp(Math.round(a.count||1),1,8);
    for(let j=0;j<count;j++)projectile(a,angle+(j-(count-1)/2)*.17);
   }
  }else if(MOVE.has(type)){
   if(type==='blink'||type==='swap'||type==='portal'){
    spark(hero.x,hero.y,color,17);
    const distance=Math.hypot(dx,dy)||1;
    hero.x=clamp(target.x-dx/distance*65,45,W-45);
    hero.y=clamp(target.y-dy/distance*65,45,H-45);
    spark(hero.x,hero.y,color,17);
   }else if(type==='retreat'){
    hero.vx=-Math.cos(angle)*5;hero.vy=-Math.sin(angle)*5;
   }else{
    hero.vx=Math.cos(angle)*clamp(Number(a.speed)||8,5,11);
    hero.vy=Math.sin(angle)*clamp(Number(a.speed)||8,5,11);
   }
  }else{
   const px=type==='zone'||type==='blackhole'?target.x:hero.x;
   const py=type==='zone'||type==='blackhole'?target.y:hero.y;
   rings.push({x:px,y:py,r:clamp((a.radius||90)*.5,30,92),age:0,life:52,color,
    pull:type==='blackhole'});
   if(AREA.has(type)&&near(hero,target)<clamp(a.radius||105,45,230)+target.radius)
    hitTarget(hero.x,hero.y,true);
   if(type==='timestop')target.frozen=Math.min(84,Math.round((Number(a.duration)||1.5)*60));
   if(type==='timeburst')hero.fastTime=clamp(Math.round((Number(a.duration)||1.5)*60),12,480);
   if(type==='rewind'){
     const past=history[Math.max(0,history.length-1-Math.round((Number(a.duration)||2)*60))];
     if(past){
       hero.x=past.x;hero.y=past.y;hero.vx=past.vx;hero.vy=past.vy;
       energy=clamp(energy+Math.min(30,Math.max(0,past.energy-energy)),0,100);
       spark(hero.x,hero.y,color,18);
     }
   }
  }
 }
 function launch(){
  if(!skills.length)return;
  const skill=skills[cursor++%skills.length];
  const list=skill.actions;
  if(!list.length)return;
  energy=0;casts++;active=skill.name;activity=frame+80;
  let next=frame+3;
  for(let i=0;i<list.length;i++){
   const a=list[i],link=a.link||'and',delay=clamp(Math.round((a.delay||0)*60),0,120);
   if(i>0&&link!=='with')next+=link==='after'?28:12;
   queue.push({when:next+delay,action:a});
   if(queue.length>36)break;
  }
 }
 function step(){
  frame++;simMs=frame*FRAME;
  if(frame>1500)return;
  g.ArenaBallSquash?.tick?.(hero);g.ArenaBallSquash?.tick?.(target);
  // Fast preview recharge is explicitly marked as simulated: practice is not
  // a deterministic balance prediction for PvE.
  history.push({x:hero.x,y:hero.y,vx:hero.vx,vy:hero.vy,energy});
  if(history.length>185)history.shift();
  const boost=hero.fastTime>0?1.75:1;
  if(hero.fastTime>0)hero.fastTime--;
  energy=Math.min(100,energy+.29*boost);
  if(energy>=100&&queue.length===0)launch();
  for(let i=queue.length-1;i>=0;i--)if(queue[i].when<=frame){
   perform(queue[i].action);queue.splice(i,1);
  }
  for(const p of [hero,target]){
   if(p===target&&p.frozen>0){p.frozen--;continue;}
   const speed=Math.hypot(p.vx,p.vy)||1;
   if(speed<2){const ratio=2.25/speed;p.vx*=ratio;p.vy*=ratio;}
   if(speed>10){p.vx*=10/speed;p.vy*=10/speed;}
   p.x+=p.vx;p.y+=p.vy;
   bounds(p,p===hero);
  }
  bodyCollision();
  for(let i=bullets.length-1;i>=0;i--){
   const b=bullets[i];
   if(b.type==='homing'){
    const a=Math.atan2(target.y-b.y,target.x-b.x);
    b.vx=b.vx*.93+Math.cos(a)*.42;b.vy=b.vy*.93+Math.sin(a)*.42;
   }
   for(const ring of rings)if(ring.pull&&ring.age<ring.life){
    const d=Math.hypot(ring.x-b.x,ring.y-b.y)||1;
    if(d<ring.r*2){b.vx+=(ring.x-b.x)/d*.13;b.vy+=(ring.y-b.y)/d*.13;}
   }
   b.x+=b.vx;b.y+=b.vy;b.life--;
   let reflected=false;
   if(b.x<25||b.x>W-25){b.vx=-b.vx;b.x=clamp(b.x,25,W-25);reflected=true;}
   if(b.y<25||b.y>H-25){b.vy=-b.vy;b.y=clamp(b.y,25,H-25);reflected=true;}
   for(const [x,y] of BUMPERS){
    const dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy);
    if(d<17){const nx=d>.001?dx/d:1,ny=d>.001?dy/d:0;
     const dot=b.vx*nx+b.vy*ny;
     if(dot<0){b.vx-=1.9*dot*nx;b.vy-=1.9*dot*ny;reflected=true;}
     b.x=x+nx*18;b.y=y+ny*18;
    }
   }
   if(reflected){
    b.reflects++;spark(b.x,b.y,b.color,9);
    // The practice lab follows the same actual skill-only reflection option:
    // a plain shot expires at the wall; an authored rebound shot can reflect.
    if(b.reflects>b.maxRebounds)b.life=0;
    if(b.type==='splitshot'&&!b.split&&bullets.length<30){
     b.split=true;
     for(const sign of [-1,1]){
      const t=Math.atan2(b.vy,b.vx)+sign*.32,v=Math.hypot(b.vx,b.vy);
      bullets.push({...b,vx:Math.cos(t)*v,vy:Math.sin(t)*v,split:true,r:4,life:90});
     }
    }
   }
   if(near(b,target)<target.radius+b.r){hitTarget(b.x-b.vx,b.y-b.vy);b.life=0;}
   if(b.reflects>3||b.life<=0)bullets.splice(i,1);
  }
  for(let i=rings.length-1;i>=0;i--){rings[i].age++;if(rings[i].age>=rings[i].life)rings.splice(i,1);}
  for(let i=sparks.length-1;i>=0;i--){sparks[i].t++;if(sparks[i].t>=sparks[i].life)sparks.splice(i,1);}
 }
 function advanceTo(time){
  const goal=clamp(Math.floor(Math.max(0,time)/FRAME),0,720);
  while(frame<goal)step();
 }
 function fill(ctx,x,y,r,c){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=c;ctx.fill();}
 function disk(ctx,p,c,letter){
  ctx.save();ctx.translate(p.x,p.y);
  const pose=g.ArenaBallSquash?.pose?.(p);
  if(pose){ctx.rotate(pose.angle);ctx.scale(pose.sx,pose.sy);ctx.rotate(-pose.angle);}
  ctx.shadowColor=c;ctx.shadowBlur=11;
  ctx.fillStyle=c;ctx.strokeStyle='#ecf9ff';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.arc(0,0,p.radius,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='800 11px sans-serif';ctx.fillText(letter,0,0);ctx.restore();
 }
 function render(ctx){
  if(!ctx)return;
  ctx.save();ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#142236';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#1d3751';ctx.fillRect(18,18,W-36,H-36);
  ctx.strokeStyle='#3f637e';ctx.lineWidth=1;
  for(let x=35;x<W-20;x+=32){ctx.beginPath();ctx.moveTo(x,19);ctx.lineTo(x,H-18);ctx.stroke();}
  for(let y=32;y<H-20;y+=32){ctx.beginPath();ctx.moveTo(19,y);ctx.lineTo(W-18,y);ctx.stroke();}
  ctx.strokeStyle='#8bd7f1';ctx.lineWidth=5;ctx.strokeRect(18,18,W-36,H-36);
  for(const [x,y] of BUMPERS){
   ctx.shadowColor='#74e1ff';ctx.shadowBlur=9;fill(ctx,x,y,13,'#327a9d');
   ctx.shadowBlur=0;fill(ctx,x,y,7,'#c0f5ff');
  }
  for(const ring of rings){
   const progress=ring.age/ring.life;
   ctx.save();ctx.globalAlpha=(1-progress)*.83;
   ctx.strokeStyle=ring.color;ctx.lineWidth=4*(1-progress)+1;
   ctx.beginPath();ctx.arc(ring.x,ring.y,ring.r*(.45+progress*.75),0,TAU);ctx.stroke();ctx.restore();
  }
  for(const b of bullets){
   ctx.strokeStyle=b.color;ctx.globalAlpha=.55;ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(b.x-b.vx*2,b.y-b.vy*2);ctx.lineTo(b.x,b.y);ctx.stroke();
   ctx.globalAlpha=1;fill(ctx,b.x,b.y,b.r,b.color);
  }
  for(const v of sparks){
   ctx.globalAlpha=(1-v.t/v.life)*.85;
   ctx.strokeStyle=v.color;ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(v.x,v.y,5+v.t*1.5,0,TAU);ctx.stroke();
  }
  ctx.globalAlpha=1;
  disk(ctx,target,'#dd7785','적');
  disk(ctx,hero,profile.color||'#69a8f7',(profile.name||'나').slice(0,1));
  // This is the SAME VFX family preview used in the actual game; our sandbox
  // supplies only local coordinates and never runs real hit/damage functions.
  if(frame<activity&&active){
   const e=queue[0]?.action||skills[(cursor-1+skills.length)%Math.max(1,skills.length)]?.actions?.[0];
   if(e)g.SkillVisuals?.previewFrame?.(ctx,{type:e.type,phase:'cast',progress:clamp((activity-frame)/80,0,1),
    x:hero.x,y:hero.y,radius:clamp(e.radius||85,30,95),color,status:e.status});
  }
  ctx.fillStyle='rgba(10,22,35,.89)';ctx.fillRect(29,27,W-58,32);
  ctx.textAlign='left';ctx.font='700 12px sans-serif';ctx.fillStyle='#fff';
  ctx.fillText('🎱 미니 핀볼 실험장  ·  스킬만 발동',38,47);
  ctx.fillStyle='rgba(9,22,36,.9)';ctx.fillRect(29,H-49,W-58,28);
  ctx.fillStyle='#233c57';ctx.fillRect(35,H-41,166,12);
  ctx.fillStyle='#8ad4ff';ctx.fillRect(35,H-41,166*(energy/100),12);
  ctx.fillStyle='#d9f2ff';ctx.font='700 11px sans-serif';
  ctx.fillText('⚡ 기세 '+Math.floor(energy)+' / 100',212,H-30);
  ctx.textAlign='right';ctx.fillText('스킬 발동 '+casts+'회',W-35,H-30);
  ctx.restore();
 }
 return {advanceTo,render,fire:()=>{energy=100;},get frame(){return frame;},
  get energy(){return energy;},get casts(){return casts;},get title(){return frame<activity?active:'벽·공 충돌로 기세 충전 중';},
  get projectiles(){return bullets.length;},get balls(){return [hero,target];}};
}
g.StudioPinballLab=Object.freeze({make,actionsFor,WIDTH:W,HEIGHT:H});
})(typeof window!=='undefined'?window:globalThis);

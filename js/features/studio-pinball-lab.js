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
// AdvancedCombat reserves 90 shots in a two-player fight: 45 per owner.
const SPLIT_OWNER_BUDGET=45;
function actionsFor(profile,index,actionIndex=-1){
 const list=profile?.allAbilities?g.SkillForge?.allSkillset?.()||[]:profile?.skills||[];
 if(!list.length)return [];
 const selected=index==='all'?list.slice(0,Math.min(list.length,24)):
  [list[clamp(Number(index)||0,0,list.length-1)]];
 return selected.map(s=>{
  // The real Scratch preview compiler bounds loops and keeps the true branch
  // for conditional samples; never execute arbitrary source or mutate a draft.
  const actions=profile?.signatureVersion===1&&Array.isArray(s.program)?
   g.SignatureScratch?.preview?.(s.program)||[]:(s.actions||[]);
  const limited=actions.slice(0,12);
  const chosen=Number.isInteger(actionIndex)&&actionIndex>=0?limited.slice(actionIndex,actionIndex+1):limited;
  return {name:s.name||'내 필살기',actions:chosen,ruleSet:s.ruleSet||null};
 });
}
function make(profile={},focus=0,actionIndex=-1){
 const skills=actionsFor(profile,focus,actionIndex);
 let frame=0,simMs=0,energy=86,casts=0,active='',activity=0;
 const color=profile.effectColor||profile.color||'#a68fff';
 const hero={x:129,y:143,vx:3.5,vy:2.5,radius:18,hp:100,playerNum:1,
  forge:{speed:2.7,effectColor:color}};
 const target={x:355,y:148,vx:-2.7,vy:2.0,radius:19,hp:100,playerNum:2,energy:62};
 hero.baseRadius=hero.radius;
 const bullets=[],rings=[],sparks=[],queue=[],walls=[],portals=[],activeEffects=[];
 let lastContact=-100,lastWall=-100,ruleRun=null,ruleRuns=[];
 const splitHistory=[],terminalBurstHistory=[];
 // The shared graph tests proximity and HP against simulated actors,
 // never empty placeholder coordinates, so mini-lab conditions match combat.
 const previewActor={hp:100,maxHp:100,x:hero.x,y:hero.y,radius:hero.radius,
  forge:{signatureVersion:1},_forgeActionClock:0,
  _scratchEvents:Object.create(null)};
 function recordRuleEvent(name){
  const old=previewActor._scratchEvents[name]||{count:0,frame:-100};
  // Real SignatureLive.record counts a confirmed event at most once per tick.
  if(old.frame===frame)return;
  previewActor._scratchEvents[name]={count:old.count+1,frame};
 }
 const history=[];
 function spark(x,y,color='#f1ddac',strength=10){
  if(sparks.length>44)sparks.splice(0,sparks.length-28);
  sparks.push({x,y,color,t:0,life:clamp(strength,6,20)});
 }
 function squash(p,imp,nx,ny){g.ArenaBallSquash?.wall?.(p,nx,ny,imp);}
 function rebound(p,nx,ny,isHero,wallKind=null){
  const d=p.vx*nx+p.vy*ny;
  if(d>=0)return;
  p.vx-=1.91*d*nx;p.vy-=1.91*d*ny;
  p.vx*=.985;p.vy*=.985;
  squash(p,-d,nx,ny);spark(p.x,p.y,isHero?color:'#f5a8a8',11);
  // Only physical perimeter rebounds, not bumpers, charge wall storage.
  if(isHero&&wallKind)g.WallImpactStore?.record?.(previewActor,-d,wallKind);
  if(isHero&&frame-lastWall>=26){energy=clamp(energy+9,0,100);lastWall=frame;recordRuleEvent('wall');}
 }
 function bounds(p,isHero){
  const r=p.radius;
  for(const o of walls){
   const d=Math.hypot(p.x-o.x,p.y-o.y),limit=p.radius+o.r;
   if(d>=limit)continue;
   const nx=d>.001?(p.x-o.x)/d:1,ny=d>.001?(p.y-o.y)/d:0;
   p.x=o.x+nx*(limit+.1);p.y=o.y+ny*(limit+.1);
   rebound(p,nx,ny,isHero);
  }
  if(p.x<19+r){p.x=19+r;rebound(p,1,0,isHero,'wall-left');}
  if(p.x>W-19-r){p.x=W-19-r;rebound(p,-1,0,isHero,'wall-right');}
  if(p.y<19+r){p.y=19+r;rebound(p,0,1,isHero,'wall-top');}
  if(p.y>H-19-r){p.y=H-19-r;rebound(p,0,-1,isHero,'wall-bottom');}
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
  if(frame-lastContact>=34){energy=clamp(energy+17,0,100);lastContact=frame;recordRuleEvent('contact');}
 }
 function previewEffect(a,phase,x,y,life=36){
  if(!a)return;
  if(activeEffects.length>=42)activeEffects.shift();
  activeEffects.push({a,phase,x,y,start:frame,life});
 }
 function hitTarget(x=target.x,y=target.y,large=false){
  const dx=target.x-x,dy=target.y-y,d=Math.hypot(dx,dy)||1;
  const nx=dx/d,ny=dy/d;
  target.vx=clamp(target.vx+nx*(large?2.4:1.1),-9,9);
  target.vy=clamp(target.vy+ny*(large?2.4:1.1),-9,9);
  squash(target,large?5:2,nx,ny);spark(target.x,target.y,'#ffb5a4',18);
  recordRuleEvent('hit');
 }
 function projectile(a,angle){
  // Preserve live bullets: reject overload instead of deleting oldest shots.
  if(bullets.length>=SPLIT_OWNER_BUDGET)return;
  const speed=clamp(Number(a.speed)||5,2,12)*.8;
  bullets.push({x:hero.x,y:hero.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
   life:220,r:5,color:a.visual?.color||color,status:a.status||'none',type:a.type,a,reflects:0,split:false,age:0,
   fractureRemaining:clamp(Math.round(a.fractureDepth||1),1,3),fragmentCount:clamp(Math.round(a.count||1),1,8),
   maxRebounds:a.type==='shot'?clamp(Math.round(Number(a.ricochet)||0),0,3):0});
 }
 function retireFusionPreview(b){
  const group=b?._fusionTerminalGroup;
  if(!group||b._fusionTerminalRetired)return;
  b._fusionTerminalRetired=true;
  group.remaining=Math.max(0,group.remaining-1);
  if(group.remaining||group.finished)return;
  group.finished=true;
  const radius=clamp(Number(group.a?.fusion?.radius)||85,35,160);
  const px=clamp(b.x,0,W),py=clamp(b.y,0,H);
  const tint=group.a?.visual?.color||color;
  previewEffect({...group.a,type:'wave',radius},'impact',px,py,35);
  rings.push({x:px,y:py,r:Math.min(96,radius*.7),age:0,
   life:29,color:tint});
  spark(px,py,tint,20);
  if(Math.hypot(px-target.x,py-target.y)<=radius+target.radius)
   hitTarget(px,py,true); // visual preview only, never modify target HP
  recordRuleEvent('finalFragment');
  if(terminalBurstHistory.length>=24)terminalBurstHistory.shift();
  terminalBurstHistory.push({frame,x:px,y:py,radius});
 }
 // Splitshots share the REAL combat trajectory: one target-aimed crystal
 // that bursts after 56% of its own flight, not an arbitrary 17-frame timer.
 // One shared preview path mirrors ForgeWorld's bounded, nonrecursive
 // child projectile creation. Triggered by elapsed time or real contact.
 function fractureFusion(b){
  if(b._fusionChild||!b.a?.fusion?.split)return false;
  const number=Math.min(4,Math.max(2,Number(b.a.fusion.fragments)||3));
  const dir=Math.atan2(target.y-b.y,target.x-b.x);
  const speed=clamp(Number(b.a.speed)||5,2,14)*.8;
  const sub={...b.a,damage:Math.round((Number(b.a.damage)||0)*.55),
    fusion:{...b.a.fusion,split:false}};
  const terminal=b.a.fusion.finalBurst?{remaining:0,finished:false,a:b.a}:null;
  for(let j=0;j<number&&bullets.length<SPLIT_OWNER_BUDGET;j++){
   const angle=dir+(j-(number-1)/2)*.38;
   bullets.push({...b,x:b.x,y:b.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
    a:sub,age:0,life:Math.max(28,Math.min(150,b.life)),
    _fusionChild:true,reflects:0,maxRebounds:0,
    ...(terminal?{_fusionTerminalGroup:terminal}:{})});
   if(terminal)terminal.remaining++;
  }
  previewEffect({...b.a,type:'splitshot'},'impact',b.x,b.y,24);
  recordRuleEvent('split');b.life=0;return true;
 }
 function splitshot(a){
  if(bullets.length>=SPLIT_OWNER_BUDGET)return;
  const tx=clamp(target.x,18,W-18),ty=clamp(target.y,18,H-18);
  const speed=Math.max(2,Number(a.speed)||6),distance=Math.hypot(tx-hero.x,ty-hero.y);
  const travel=g.ArenaSplitshotGeometry?.rootTravel?.(hero.x,hero.y,tx,ty,speed) ??
   clamp(Math.ceil(distance/(speed*.5)),24,72);
  bullets.push({kind:'splitshot',type:'splitshot',x:hero.x,y:hero.y,
   startX:hero.x,startY:hero.y,tx,ty,
   vx:(tx-hero.x)/travel,vy:(ty-hero.y)/travel,age:0,travel,life:travel+8,
   color,status:a.status||'none',r:5,a:{...a},fractureRemaining:clamp(
    Math.round(a.fractureDepth||1),1,3),fragmentCount:clamp(Math.round(a.count||1),1,8),
   split:false});
 }
 function fragment(b){
  if(b.split)return;
  b.split=true;recordRuleEvent('split');
  previewEffect({type:'splitshot',radius:65,status:b.status},'impact',b.x,b.y,21);
  const n=clamp(Math.round(b.fragmentCount||1),1,8);
  const generations=clamp(Number(b.fractureRemaining??b.a?.fractureDepth??1),1,3);
  const remaining=generations-1;
  const tips=g.ArenaSplitshotGeometry?.childEndpoints?.(b.x,b.y,b.a?.radius,n,W,H) ??
   Array.from({length:n},(_,j)=>{
    const t=j/n*TAU,len=Math.min(95,b.a?.radius||95);
    return {x:clamp(b.x+Math.cos(t)*len,15,W-15),
      y:clamp(b.y+Math.sin(t)*len,15,H-15),theta:t};
   });
  const speed=Math.max(2,Number(b.a?.speed)||6);
  const travel=g.ArenaSplitshotGeometry?.childTravel?.(speed) ??
   clamp(Math.ceil(95/speed),10,40);
  splitHistory.push({frame,kind:b.type,generations,x:b.x,y:b.y,
    positions:tips.map(t=>({x:t.x,y:t.y}))});
  for(let j=0;j<n&&bullets.length<SPLIT_OWNER_BUDGET;j++){
   const tip=tips[j],a=generations>1?
    {...b.a,damage:Math.max(1,Math.round((b.a?.damage||1)*.55))}:b.a;
   bullets.push({kind:'fragment',type:'fragment',x:b.x,y:b.y,
    startX:b.x,startY:b.y,tx:tip.x,ty:tip.y,
    vx:(tip.x-b.x)/travel,vy:(tip.y-b.y)/travel,life:50,travel,age:0,
    color:b.color,status:b.status,r:3.8,a,split:false,
    fractureRemaining:remaining,fragmentCount:n});
  }
  spark(b.x,b.y,b.color,18);b.life=0;
 }
 // Swept collision, just like AdvancedCombat's real shard hit detection.
 function segmentRadius(ax,ay,bx,by,px,py){
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
  const t=den?clamp(((px-ax)*dx+(py-ay)*dy)/den,0,1):0;
  return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
 }
 function previewPhysicalHit(_attacker,e,a){
  // Never modify HP in preview. Real collision/damage goes through ForgeImpact.
  previewEffect(a,'impact',e.x,e.y,20);
  spark(e.x,e.y,'#ffb5a4',15);
  recordRuleEvent('hit');
  return true;
 }
 function perform(action){
  const a=action||{},type=a.type||'wave';
  active=(g.SkillForge?.TYPE?.[type]||type)+' 실험 중';
  const targeted=['bolt','meteor','starfall','chain','blackhole','zone','arcshot'].includes(type);
  previewEffect(a,'cast',targeted?target.x:hero.x,targeted?target.y:hero.y,
   clamp(Math.round((g.ActionRegistry?.duration?.(type)||1050)/35),18,58));
  activity=frame+90;
  const dx=target.x-hero.x,dy=target.y-hero.y,angle=Math.atan2(dy,dx);
  if(type==='kinetic_relay'&&g.ImaginationConcepts){
   g.ImaginationConcepts.relayBegin(hero,a);
   const radius=clamp(a.relay?.radius||a.radius||140,35,260);
   previewEffect(a,'cast',hero.x,hero.y,48);
   rings.push({x:hero.x,y:hero.y,r:radius*.45,age:0,life:48,color:a.visual?.color||color});
   return;
  }
  if(type==='phenomenon'&&g.PhysicsLawEngine){
   g.PhysicsLawEngine.fieldFor(hero,a,target);
   const radius=clamp(a.law?.radius||a.radius||120,30,300);
   previewEffect(a,'cast',hero.x,hero.y,48);
   rings.push({x:hero.x,y:hero.y,r:radius*.48,age:0,life:56,color:a.visual?.color||color});
   return;
  }
  if(['tether','repulse','vortex'].includes(type)&&g.SemanticPhysics){
   g.ActionRegistry?.run?.(hero,a,target,{hit:previewPhysicalHit,enemies:()=>[target]});
   const life=clamp(Math.round((Number(a.duration)||1.5)*60),15,480);
   if(type==='tether')hero._semanticTetherUntil=frame+life;
   if(type==='vortex')hero._semanticVortexUntil=frame+life;
   rings.push({x:hero.x,y:hero.y,r:clamp(a.radius||120,40,220)*.35,
    age:0,life:52,color});
   return;
  }
  if(RANGED.has(type)){
   if(['bolt','meteor','starfall','arcshot','beam','chain'].includes(type)){
    const falling=['bolt','meteor','starfall','arcshot'].includes(type);
    rings.push({x:target.x,y:target.y,r:clamp((a.radius||80)*.35,23,65),
     age:0,life:falling?36:24,color,impactAt:falling?30:0,attack:a,hit:false});
    if(!falling)hitTarget(hero.x,hero.y,true);
   }else if(type==='splitshot')splitshot(a);
   else{
    const count=clamp(Math.round(a.count||1),1,8);
    for(let j=0;j<count;j++)projectile(a,angle+(j-(count-1)/2)*.17);
   }
  }else if(MOVE.has(type)){
   if(type==='leap'||type==='dive'){
    hero.landAt=frame+(type==='leap'?50:38);
    if(type==='dive'){
     hero.diveImpact={x:target.x,y:target.y,r:clamp(Number(a.radius)||160,45,220),action:a};
     // A descending dive locks onto the opponent overhead, not the
     // forward ground velocity of a normal dash.
     hero.x=clamp(target.x,45,W-45);hero.y=clamp(target.y,45,H-45);
    }
   }
   if(type==='portal'){
    const aPos={x:clamp(hero.x+Math.cos(angle)*65,37,W-37),
      y:clamp(hero.y+Math.sin(angle)*65,37,H-37)};
    const bPos={x:clamp(target.x-Math.cos(angle)*65,37,W-37),
      y:clamp(target.y-Math.sin(angle)*65,37,H-37)};
    portals.push({a:aPos,b:bPos,life:clamp(Math.round((Number(a.duration)||1.5)*60),20,300)});
   }else if(type==='swap'){
    [hero.x,target.x]=[target.x,hero.x];
    [hero.y,target.y]=[target.y,hero.y];
    spark(hero.x,hero.y,color,17);spark(target.x,target.y,'#f5a8a8',17);
   }else if(type==='blink'){
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
   if(type==='timestop'&&near(hero,target)<=clamp(a.radius||120,30,300)+target.radius){
     target.frozen=Math.min(84,Math.round((Number(a.duration)||1.5)*60));
     const taken=Math.min(20,target.energy);
     target.energy-=taken;energy=clamp(energy+taken*.5,0,100);
   }
   if(type==='wall')walls.push({x:clamp((hero.x+target.x)*.5,40,W-40),
     y:clamp((hero.y+target.y)*.5,40,H-40),r:clamp((a.radius||95)*.32,22,45),
     life:clamp(Math.round((Number(a.duration)||1.5)*60),30,300)});
   if(type==='timeburst')hero.fastTime=clamp(Math.round((Number(a.duration)||1.5)*60),12,480);
   if(type==='haste')hero.hasteTime=clamp(Math.round((Number(a.duration)||1.5)*60),12,480);
   if((type==='haste'||type==='timeburst')&&ruleRuns.length)g.SignatureRuleLive?.performed?.(previewActor,a);
   if(type==='grow'||type==='shrink'){
     hero.radius=type==='grow'?clamp(hero.baseRadius*(1.25+(Number(a.count)||1)*.08),22,44):
       clamp(hero.baseRadius*(.6-(Number(a.count)||1)*.015),9,18);
     hero.sizeTime=clamp(Math.round((Number(a.duration)||1.5)*60),12,400);
   }
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
  energy=0;casts++;
  active=skills.length===1?skills[0].name:skills.length+'개 스킬 동시 발동';
  activity=frame+80;
  ruleRuns=[];
  for(const skill of skills){
   const list=skill.actions;
   if(!list.length)continue;
   const run=skill.ruleSet&&g.SignatureRuleLive?.begin?.(skill.ruleSet,previewActor)||null;
   if(run){ruleRuns.push(run);ruleRun=run;continue;}
   let next=frame+3;
   for(let i=0;i<list.length;i++){
    const a=list[i],link=a.link||'and',delay=clamp(Math.round((a.delay||0)*60),0,120);
    if(i>0&&link!=='with')next+=link==='after'?28:12;
    queue.push({when:next+delay,action:a});
   }
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
  const boost=hero.fastTime>0?1.75:hero.hasteTime>0?1.25:1;
  if(hero.fastTime>0)hero.fastTime--;
  if(hero.hasteTime>0)hero.hasteTime--;
  if(hero.sizeTime>0&&--hero.sizeTime===0)hero.radius=hero.baseRadius;
  energy=Math.min(100,energy+.29*boost);
  previewActor._forgeActionClock=frame;
  previewActor.x=hero.x;previewActor.y=hero.y;previewActor.hp=hero.hp;
  if(hero.landAt&&frame>=hero.landAt){
    hero.landAt=0;
    if(hero.diveImpact){
     const impact=hero.diveImpact;hero.diveImpact=null;
     previewEffect(impact.action,'impact',hero.x,hero.y,32);
     rings.push({x:hero.x,y:hero.y,r:clamp(impact.r*.4,25,95),age:0,life:27,color});
     if(near(hero,target)<=impact.r+target.radius)hitTarget(hero.x,hero.y,true);
    }
    recordRuleEvent('land');
    rings.push({x:hero.x,y:hero.y,r:48,age:0,life:27,color});
  }
  if(energy>=100&&queue.length===0&&ruleRuns.every(r=>r.finished))launch();
  for(const run of ruleRuns)if(!run.finished&&queue.length<42){
   const action=g.SignatureRuleLive?.step?.(run,previewActor,target);
   if(action)queue.push({when:frame+2,action});
  }
  let budget=18;
  for(let i=queue.length-1;i>=0&&budget>0;i--)if(queue[i].when<=frame){
   perform(queue[i].action);queue.splice(i,1);budget--;
  }
  // Same bounded attraction/rotation code as the actual combat world.
  g.SemanticPhysics?.tick?.(hero,[target],previewPhysicalHit);
  g.PhysicsLawEngine?.tick?.(hero,[target],previewPhysicalHit);
  g.ImaginationConcepts?.relayTick?.(hero,[target],previewPhysicalHit);
  for(const p of [hero,target]){
   if(p.portalCooldown>0)p.portalCooldown--;
   if(p===target&&p.frozen>0){p.frozen--;continue;}
   const speed=Math.hypot(p.vx,p.vy)||1;
   if(speed<2){const ratio=2.25/speed;p.vx*=ratio;p.vy*=ratio;}
   if(speed>10){p.vx*=10/speed;p.vy*=10/speed;}
   const stacks=previewActor._ruleSpeed?.until>frame?previewActor._ruleSpeed.stacks:0;
   const speedEffect=p===hero?(hero.hasteTime>0?1.6:1)*(1+stacks*.15):1;
   p.x+=p.vx*speedEffect;p.y+=p.vy*speedEffect;
   bounds(p,p===hero);
   if(!p.portalCooldown)for(const pair of portals){
     const from=near(p,pair.a)<p.radius+13?pair.a:
       near(p,pair.b)<p.radius+13?pair.b:null;
     if(from){
       const to=from===pair.a?pair.b:pair.a;
       p.x=clamp(to.x,20+p.radius,W-20-p.radius);
       p.y=clamp(to.y,20+p.radius,H-20-p.radius);
       p.portalCooldown=65;spark(p.x,p.y,'#bdb0ff',18);break;
     }
   }
  }
  bodyCollision();
  if(target.frozen<=0)target.energy=Math.min(100,target.energy+.16);
  for(let i=walls.length-1;i>=0;i--)if(--walls[i].life<=0)walls.splice(i,1);
  for(let i=portals.length-1;i>=0;i--)if(--portals[i].life<=0)portals.splice(i,1);
  for(let i=bullets.length-1;i>=0;i--){
   const b=bullets[i];
   if(b.type==='splitshot'||b.type==='fragment'){
    const oldX=b.x,oldY=b.y;
    b.age++;b.life--;
    const t=clamp(b.age/Math.max(1,b.travel),0,1);
    b.x=b.startX+(b.tx-b.startX)*t;
    b.y=b.startY+(b.ty-b.startY)*t;
    const shouldSplit=g.ArenaSplitshotGeometry?.shouldSplit?.(
      b.type,b.age,b.travel,b.fractureRemaining) ??
      ((b.type==='splitshot'||b.type==='fragment'&&b.fractureRemaining>1)&&t>=.56);
    if(shouldSplit&&!b.split)fragment(b);
    // The original projectile does not damage on its way to the split point;
    // only moving fragments have contact damage in AdvancedCombat.
    if(b.type==='fragment'&&b.life>0&&
      segmentRadius(oldX,oldY,b.x,b.y,target.x,target.y)<=target.radius+8){
      previewEffect({type:'splitshot',radius:35,status:b.status},
        'impact',target.x,target.y,18);
      hitTarget(oldX,oldY);b.life=0;
    }
    if(t>=1)b.life=0;
    if(b.life<=0)bullets.splice(i,1);
    continue;
   }
   if(b.type==='homing'||b.a?.fusion?.homing&&b.type==='shot'){
    const a=Math.atan2(target.y-b.y,target.x-b.x);
    b.vx=b.vx*.93+Math.cos(a)*.42;b.vy=b.vy*.93+Math.sin(a)*.42;
   }
   for(const ring of rings)if(ring.pull&&ring.age<ring.life){
    const d=Math.hypot(ring.x-b.x,ring.y-b.y)||1;
    if(d<ring.r*2){b.vx+=(ring.x-b.x)/d*.13;b.vy+=(ring.y-b.y)/d*.13;}
   }
   b.x+=b.vx;b.y+=b.vy;b.life--;b.age++;
   // Existing time-fracture projectiles continue to split at 12 ticks.
   // Explicit contact-fracture projectiles remain whole until target impact.
   if(b.type==='shot'&&b.a?.fusion?.split&&
      b.a.fusion.splitTrigger!=='hit'&&!b._fusionChild&&b.age>=12){
    fractureFusion(b);
    bullets.splice(i,1);continue;
   }
   if((b.type==='splitshot'||b.type==='fragment'&&b.fractureRemaining>0)&&
       !b.split&&b.age>=17){
     fragment(b);
     if(b.life<=0){bullets.splice(i,1);continue;}
   }
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
    if(b.type==='splitshot'&&!b.split)fragment(b);
   }
   if(near(b,target)<target.radius+b.r){
    previewEffect({type:b.type==='fragment'?'splitshot':b.type,
      radius:35,status:b.status},'impact',target.x,target.y,18);
    hitTarget(b.x-b.vx,b.y-b.vy);
    const impact=b.a?.fusion?.impact||'none';
    if(impact!=='none'){
     const radius=clamp(Number(b.a.fusion.radius)||85,35,160);
     previewEffect({...b.a,type:impact==='burst'?'wave':impact==='vortex'?'vortex':'pull'},
       'impact',target.x,target.y,25);
     rings.push({x:target.x,y:target.y,r:Math.min(95,radius*.7),age:0,
       life:25,color:b.a.visual?.color||color});
     if(impact==='repulse'){target.vx*=1.3;target.vy*=1.3;}
     if(impact==='pull'){target.vx*=.72;target.vy*=.72;}
    }
    if(b.type==='shot'&&b.a?.fusion?.split&&
       b.a.fusion.splitTrigger==='hit'&&!b._fusionChild)
      fractureFusion(b);
    b.life=0;
   }
   if(b.reflects>3||b.life<=0){
    retireFusionPreview(b);
    bullets.splice(i,1);
   }
  }
  for(let i=rings.length-1;i>=0;i--){
   const ring=rings[i];ring.age++;
   if(ring.impactAt&&!ring.hit&&ring.age>=ring.impactAt){
    ring.hit=true;previewEffect(ring.attack,'impact',ring.x,ring.y,22);
    if(near(ring,target)<=ring.r+target.radius)hitTarget(ring.x,ring.y,true);
   }
   if(ring.age>=ring.life)rings.splice(i,1);
  }
  for(let i=activeEffects.length-1;i>=0;i--)
   if(frame-activeEffects[i].start>=activeEffects[i].life)activeEffects.splice(i,1);
  for(let i=sparks.length-1;i>=0;i--){sparks[i].t++;if(sparks[i].t>=sparks[i].life)sparks.splice(i,1);}
 }
 function advanceTo(time){
  const goal=clamp(Math.floor(Math.max(0,time)/FRAME),0,1200);
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
  for(const o of walls){
   ctx.strokeStyle='#f3c58e';ctx.lineWidth=4;
   ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,TAU);ctx.stroke();
  }
  for(const pair of portals)for(const pt of [pair.a,pair.b]){
   ctx.strokeStyle='#c1a4ff';ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(pt.x,pt.y,17,0,TAU);ctx.stroke();
  }
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
   ctx.globalAlpha=1;
   ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));
   ctx.fillStyle=b.color;ctx.strokeStyle='#253344';ctx.lineWidth=1.4;
   if(b.type==='splitshot'){
    ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(10,0);
    ctx.lineTo(0,11);ctx.lineTo(-10,0);ctx.closePath();
   }else if(b.type==='arcshot'){
    ctx.beginPath();ctx.arc(0,0,8,0,TAU);
   }else{
    ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-6,-5);
    ctx.lineTo(-3,0);ctx.lineTo(-6,5);ctx.closePath();
   }
   ctx.fill();ctx.stroke();ctx.restore();
  }
  for(const v of sparks){
   ctx.globalAlpha=(1-v.t/v.life)*.85;
   ctx.strokeStyle=v.color;ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(v.x,v.y,5+v.t*1.5,0,TAU);ctx.stroke();
  }
  ctx.globalAlpha=1;
  if(hero._semanticTetherUntil>frame){
   ctx.save();ctx.strokeStyle='#c7a7ff';ctx.lineWidth=3;
   ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(hero.x,hero.y);
   ctx.lineTo(target.x,target.y);ctx.stroke();ctx.restore();
  }
  if(hero._semanticVortexUntil>frame){
   ctx.save();ctx.strokeStyle='#93a0ff';ctx.globalAlpha=.62;ctx.lineWidth=3;
   for(let i=0;i<3;i++){
    ctx.beginPath();ctx.arc(hero.x,hero.y,36+i*21,
     frame*.075+i*2,frame*.075+i*2+Math.PI*1.55);ctx.stroke();
   }
   ctx.restore();
  }
  disk(ctx,target,'#dd7785','적');
  disk(ctx,hero,profile.color||'#69a8f7',(profile.name||'나').slice(0,1));
  // Reuse the REAL visual family's motif for every ACTUALLY performed
  // action. Never pick the first stored skill or future queue[0] instead.
  for(const fx of activeEffects){
   g.SkillVisuals?.previewFrame?.(ctx,{type:fx.a.type,phase:fx.phase,
    progress:clamp((frame-fx.start)/fx.life,0,1),
    x:fx.x,y:fx.y,radius:clamp(Number(fx.a.radius)||85,30,160),
    color,status:fx.a.status,link:fx.a.link,
    visual:fx.a.visual,
    angle:Math.atan2(target.y-hero.y,target.x-hero.x),
    length:Math.hypot(target.x-hero.x,target.y-hero.y)+55});
  }
  ctx.fillStyle='rgba(10,22,35,.89)';ctx.fillRect(29,27,W-58,32);
  ctx.textAlign='left';ctx.font='700 12px sans-serif';ctx.fillStyle='#fff';
  ctx.fillText('🎱 미니 핀볼 실험장  ·  스킬만 발동',38,47);
  const stored=ruleRuns.find(run=>!run.finished&&run.rules.some(r=>r.when==='wallStored'));
  if(stored){
   const index=stored.rules.findIndex(r=>r.when==='wallStored');
   ctx.fillStyle='#ffe2a4';ctx.font='700 12px sans-serif';
   ctx.fillText('벽 충격 축적 '+stored.wallCharge[index].count+' / '+stored.rules[index].wallHits,38,77);
  }
  ctx.fillStyle='rgba(9,22,36,.9)';ctx.fillRect(29,H-49,W-58,28);
  ctx.fillStyle='#233c57';ctx.fillRect(35,H-41,166,12);
  ctx.fillStyle='#8ad4ff';ctx.fillRect(35,H-41,166*(energy/100),12);
  ctx.fillStyle='#d9f2ff';ctx.font='700 11px sans-serif';
  ctx.fillText('⚡ 기세 '+Math.floor(energy)+' / 100',212,H-30);
  ctx.textAlign='right';ctx.fillText('스킬 '+casts+'회 · 적 기세 '+Math.floor(target.energy),W-35,H-30);
  ctx.restore();
 }
 return {advanceTo,render,fire:()=>{energy=100;},get frame(){return frame;},
  get energy(){return energy;},get casts(){return casts;},get title(){return frame<activity?active:'벽·공 충돌로 기세 충전 중';},
  get projectiles(){return bullets.length;},get walls(){return walls.length;},get portals(){return portals.length;},get balls(){return [hero,target];},
  get ruleActions(){return ruleRuns.reduce((n,r)=>n+r.actions,0)||ruleRun?.actions||0;},
  get splitEvents(){return previewActor._scratchEvents.split?.count||0;},
  get splitHistory(){return splitHistory.map(x=>({...x,positions:x.positions.map(p=>({...p}))}));},
  get splitProjectiles(){return bullets.filter(b=>b.type==='splitshot'||b.type==='fragment')
   .map(b=>({type:b.type,x:b.x,y:b.y,age:b.age,travel:b.travel,
    remaining:b.fractureRemaining}));},
  get landEvents(){return previewActor._scratchEvents.land?.count||0;},
  get wallEvents(){return previewActor._scratchEvents.wall?.count||0;},
  get storedWallImpacts(){return g.WallImpactStore?.serial?.(previewActor)||0;},
  get terminalBurstEvents(){return previewActor._scratchEvents.finalFragment?.count||0;},
  get terminalBurstHistory(){return terminalBurstHistory.map(x=>({...x}));}};
}
g.StudioPinballLab=Object.freeze({make,actionsFor,WIDTH:W,HEIGHT:H});
})(typeof window!=='undefined'?window:globalThis);

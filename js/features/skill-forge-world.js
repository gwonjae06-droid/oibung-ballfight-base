/* Authoritative simulation of authored projectiles, persistent zones and
 * orbiting strikes. Runs once per fighter per simulation tick, after the
 * existing charge, expansion and cast queue updates.
 *
 * Inject the SAME hit(), hitGround() and enemies() as SkillForge uses so
 * damage, invulnerability, statuses and target selection cannot diverge.
 * Do not schedule timers, modify saved profiles, or create render DOM here.
 */
(function(global){'use strict';
global.SkillForgeWorldFactory=function({hit,hitGround,enemies,execute}){
// Terminal bursts are bound to ONE real fracture family. The group lives
// only on its in-flight child objects: no global timers, map, or stale IDs.
// An expiry, shielded/blocked collision, or perimeter exit retires one child.
function finalFragmentEvent(p,group,x,y,z){
 if(group.finished||group.remaining!==0)return;
 group.finished=true;
 const frame=Number(p._forgeActionClock)||Number(p._forgeBalanceFrame)||0;
 const count=p._fusionFinalAt===frame?p._fusionFinalCount||0:0;
 if(count>=4)return; // per-fighter bound across independent families
 p._fusionFinalAt=frame;p._fusionFinalCount=count+1;
 const action=group.action||{},fusion=action.fusion||{};
 const radius=Math.max(35,Math.min(160,Number(group.radius)||85));
 const xx=Math.max(0,Math.min(canvas.width,Number(x)||0));
 const yy=Math.max(0,Math.min(canvas.height,Number(y)||0));
 const baseColor=p.forge?.effectColor||p.forge?.color||'#b4a3ff';
 const tint=fusion.finalColor||
  global.SkillColorPolicy?.resolve?.(action.visual,baseColor)?.color||
  action.visual?.color||baseColor;
 const registered=type=>!!global.ActionRegistry?.get?.(type);
 const create=(type,overrides)=>global.SignatureScratch?.safeAction?.({
  ...action,type,target:type==='heal'||type==='shield'?'self':'nearest',
  damage:0,count:1,knockback:0,status:'none',fusion:undefined,
  ...overrides
 })||{
  ...action,type,damage:0,count:1,knockback:0,status:'none',
  fusion:undefined,...overrides
 };
 function burst(){
  // Real spatial collision test, world height and real hit resolver.
  global.BattleFX?.cast?.(p,'wave',{x:xx,y:yy,radius,color:tint});
  global.BattleFX?.mark?.('wave',xx,yy,tint,radius);
  const damage=Math.min(52,Math.max(0,Math.round((Number(action.damage)||0)*.42)));
  let dealt=0;
  if(damage>0){
   const attack=create('wave',{target:'nearest',damage,radius});
   let contacts=0;
   for(const e of enemies(p)){
    if(!e||e===p||e.hp<=0||++contacts>24)continue;
    if(Math.hypot(e.x-xx,e.y-yy)<=radius+(Number(e.radius)||0)){
     const hp=e.hp;hit(p,e,attack,1,Number.isFinite(z)?z:0);
     dealt+=Math.max(0,hp-e.hp);
    }
   }
  }
  global.SignatureLive?.record?.(p,'finalFragment');
  return dealt>0;
 }
 function shield(){
  if(p.hp<=0||typeof execute!=='function'||!registered('shield'))return false;
  const defense=create('shield',{duration:Math.max(.4,Math.min(2,
   Number(action.duration)||1.3))});
  execute(p,defense,p);
  global.SignatureLive?.record?.(p,'finalShield');
  return true;
 }
 function heal(){
  if(p.hp<=0||typeof execute!=='function'||!registered('heal'))return false;
  const amount=Math.min(22,Math.max(1,Math.round((Number(action.damage)||0)*.32)));
  execute(p,create('heal',{damage:amount,duration:1}),p);
  global.SignatureLive?.record?.(p,'terminalHeal');
  return true;
 }
 const near=()=>{
  const r=Math.min(130,Math.max(55,radius));
  return (enemies(p)||[]).filter(e=>e&&e!==p&&e.hp>0&&
   Math.hypot(e.x-p.x,e.y-p.y)<=r+(Number(e.radius)||0))
   .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
 };
 function tether(){
  if(p.hp<=0||typeof execute!=='function'||!registered('tether'))return false;
  const enemy=near();if(!enemy)return false;
  execute(p,create('tether',{target:'nearest',
   damage:Math.min(14,Math.max(0,Math.round((Number(action.damage)||0)*.22))),
   radius:Math.min(130,Math.max(55,radius)),duration:1.2}),enemy);
  global.SignatureLive?.record?.(p,'terminalTether');
  return true;
 }
 // Declarative post-event steps are authoritative when present. Legacy
 // finalBurst/finalShield booleans stay intact for saved pre-chain skills,
 // and are NOT replayed on top of a valid newer graph.
 const chain=global.TerminalEventChain?.normalize?.(fusion.terminalChain);
 if(chain){
  const report=global.TerminalEventChain.evaluate(chain,{
   near:()=>!!near(),
   perform(type){
    if(type==='burst')return {performed:true,damaged:burst()};
    if(type==='heal')return {performed:heal(),damaged:false};
    if(type==='tether')return {performed:tether(),damaged:false};
    if(type==='shield')return {performed:shield(),damaged:false};
    return {performed:false,damaged:false};
   }
  });
  const history=p._terminalChainHistory||=([]);
  history.push({frame,executed:report.executed.slice(),stopped:report.stopped});
  if(history.length>16)history.shift();
  if(report.executed.length)global.SignatureLive?.record?.(p,'terminalChain');
  return;
 }
 if(fusion.finalBurst)burst();
 if(fusion.finalShield)shield();
}
function retire(p,b,index){
 p.forgeShots.splice(index,1);
 const group=b?._fusionTerminalGroup;
 if(!group||b._fusionTerminalRetired)return;
 b._fusionTerminalRetired=true;
 if(group.remaining<=0||group.finished)return;
 group.remaining--;
 if(group.remaining===0)finalFragmentEvent(p,group,b.x,b.y,b.z);
}
// The event source is the authoritative collision callback below. Merely
// displaying a burst VFX never counts as a hit or spawns fragment objects.
function fracture(p,b,concept,index,victim){
  const available=Math.max(0,100-p.forgeShots.length+1);
  const count=Math.min(concept.fragments,available);
  if(count<=0)return false;
  const foe=victim||enemies(p).find(e=>e.playerNum===b.targetNum&&e.hp>0);
  const direction=foe?Math.atan2(foe.y-b.y,foe.x-b.x):
    Math.atan2(b.vy,b.vx);
  const speed=Math.max(2,Math.min(14,Number(b.a.speed)||5));
  const childColor=concept.childColor;
  const action={...b.a,damage:Math.round((Number(b.a.damage)||0)*.55),
    ...(childColor&&b.a.visual?{visual:{...b.a.visual,
      color:childColor,colorMode:'explicit'}}:{}),
    fusion:{...concept,split:false,homing:concept.homing||concept.childHoming}};
  // A source orb is NOT one of the children. Its own retirement must
  // never decrement the family or trigger the explosion prematurely.
  const terminal=(concept.finalBurst||concept.finalShield||concept.terminalChain)?{remaining:count,finished:false,
   action:b.a,radius:concept.radius}:null;
  // Remove parent first; new children are visited on the NEXT world tick.
  p.forgeShots.splice(index,1);
  for(let n=0;n<count;n++){
    const theta=direction+(n-(count-1)/2)*.38;
    p.forgeShots.push({...b,a:action,_fusionChild:true,_fusionAge:0,
      targetNum:foe?.playerNum??b.targetNum,
      x:b.x,y:b.y,prevX:b.x,prevY:b.y,
      vx:Math.cos(theta)*speed,vy:Math.sin(theta)*speed,
      life:Math.min(Math.max(28,b.life),150),_reboundCount:0,
      ...(terminal?{_fusionTerminalGroup:terminal}:{} )});
  }
  global.BattleFX?.mark?.('shot',b.x,b.y,
    b.a.visual?.color||p.forge?.effectColor||'#a8b1ff',18);
  global.SignatureLive?.record?.(p,'split');
  return true;
}
function tick(p,target){
  // One current roster lookup per 60Hz simulation tick, no repeated sorts.
  const opponents=enemies(p)||[];
  for(let i=p.forgeShots.length-1;i>=0;i--){
    const b=p.forgeShots[i];
    const concept=global.ConceptFusion?.normalize?.(b.a?.fusion);
    if(concept?.homing&&b.a?.type==='shot'){
      let foe=opponents.find(e=>e.playerNum===b.targetNum&&e.hp>0);
      if(!foe){
        let nearestSq=Infinity;
        for(const enemy of opponents){
          if(!enemy||enemy.hp<=0)continue;
          const dx=enemy.x-b.x,dy=enemy.y-b.y,d2=dx*dx+dy*dy;
          if(d2<nearestSq){nearestSq=d2;foe=enemy;}
        }
      }
      if(foe){
        const dx=foe.x-b.x,dy=foe.y-b.y,d=Math.hypot(dx,dy)||1;
        const speed=Math.max(2,Math.min(14,Number(b.a.speed)||5));
        b.vx=b.vx*.90+dx/d*speed*.10;
        b.vy=b.vy*.90+dy/d*speed*.10;
        const magnitude=Math.hypot(b.vx,b.vy)||1;
        b.vx=b.vx/magnitude*speed;b.vy=b.vy/magnitude*speed;
      }
    }
    // Legacy split skills fracture after 12 frames; newer explicit
    // "명중하면 깨진다" payloads remain intact until a confirmed collision.
    if(concept?.split&&concept.splitTrigger!=='hit'&&
       b.a?.type==='shot'&&!b._fusionChild&&
       (b._fusionAge=(b._fusionAge||0)+1)>=12){
      if(fracture(p,b,concept,i))continue;
    }
    b.prevX=b.x;b.prevY=b.y;b.x+=b.vx;b.y+=b.vy;
    if(Number.isFinite(b.heightVelocity)){
      if(b.targetNum!==undefined){const victim=opponents.find(e=>e.playerNum===b.targetNum&&e.hp>0);
        if(victim){const alt=global.AdvancedCombat?.height?.(victim)||0;
          const distance=Math.hypot(victim.x-b.x,victim.y-b.y);
          const remain=Math.max(1,distance/Math.max(1,b.a?.speed||5));
          const ideal=(alt-(b.z||0))/remain,previous=b.heightVelocity;
          // Preserve the initial high-altitude aim. Only limit the change
          // in climb rate; clamping the absolute rate misses jumping targets.
          b.heightVelocity=Math.max(-30,Math.min(30,previous+
            Math.max(-.9,Math.min(.9,ideal-previous))));
        }
      }
      b.z=(b.z||0)+b.heightVelocity;
    }
    b.life--;
    // Authored '벽 반사' modifier uses the actual square arena perimeter.
    // Each shot reflects at most 3 times; legacy/basic shots stay unchanged.
    const maxRebounds=b.a?.type==='shot'?Math.max(0,Math.min(3,Math.round(b.a?.ricochet||0))):0;
    if(maxRebounds&&(b._reboundCount||0)<maxRebounds){
      const margin=global.ArenaTowerFlat?.enabled&&global.ArenaTower?.active?27:8;
      const left=margin,right=canvas.width-margin,top=margin,bottom=canvas.height-margin;
      let rebounded=false;
      if(b.x<=left||b.x>=right){
        b.x=Math.max(left,Math.min(right,b.x));b.vx=-b.vx;rebounded=true;
      }
      if(b.y<=top||b.y>=bottom){
        b.y=Math.max(top,Math.min(bottom,b.y));b.vy=-b.vy;rebounded=true;
      }
      if(rebounded){
        b._reboundCount=(b._reboundCount||0)+1;
        global.BattleFX?.mark?.('shot',b.x,b.y,p.forge.effectColor||p.forge.color,12);
      }
    }
    const flightZ=Number.isFinite(b.z)?b.z:0;
    const initialZ=Number.isFinite(b.z)?b.z-(b.heightVelocity||0):flightZ;
    const terrainBlock=global.ArenaTowerTerrain?.obstructsShot?.(
      b.prevX,b.prevY,initialZ,b.x,b.y,flightZ,7);
    const blocked=terrainBlock||global.AdvancedCombat?.blockSegment?.(
      b.prevX,b.prevY,b.x,b.y,b.a?.damage||10,flightZ,p.playerNum);
    if(blocked){retire(p,b,i);continue;}
    // Ground-level bullets use a ground-level hit check, not the firing
    // character's current jump height. Swept contact prevents tunneling.
    const e=opponents.find(e=>(global.ActionRegistry?.sweptCircle?.(
      b.prevX,b.prevY,b.x,b.y,e.x,e.y,e.radius+8)??
      Math.hypot(e.x-b.x,e.y-b.y)<=e.radius+8)&&hit(p,e,b.a,1,b.z||0));
    if(e&&concept?.split&&concept.splitTrigger==='hit'&&
       b.a?.type==='shot'&&!b._fusionChild&&
       fracture(p,b,concept,i,e))continue;
    if(e||b.life<=0||b.x<0||b.y<0||b.x>canvas.width||b.y>canvas.height)
      retire(p,b,i);
  }
  if(p.forgeZones.length>32)p.forgeZones.splice(0,p.forgeZones.length-32);
  for(let i=p.forgeZones.length-1;i>=0;i--){
    const z=p.forgeZones[i];z.timer--;z.ticks++;
    if(z.type==='bolt'&&z.timer<=0){
      if(global.BattleFX)BattleFX.cast(p,'lightning',{x:z.x,y:z.y,color:(p.forge.effectColor||p.forge.color)});
      opponents.filter(e=>Math.hypot(e.x-z.x,e.y-z.y)<z.a.radius*.4+e.radius).forEach(e=>hitGround(p,e,z.a));
    }
    if(z.type==='zone'&&z.timer>0&&z.ticks%30===0){
      const actualRadius=z.r??z.a.radius;
      opponents.filter(e=>Math.hypot(e.x-z.x,e.y-z.y)<actualRadius+e.radius).forEach(e=>hitGround(p,e,z.a,.4));
    }
    if(z.timer<=0)p.forgeZones.splice(i,1);
  }
  for(let i=p.forgeOrbs.length-1;i>=0;i--){
    const o=p.forgeOrbs[i];o.life--;o.phase+=.09;o.ticks++;
    if(o.ticks%28===0){
      // An orbit hit occurs only where one of the drawn eight-pixel orbs
      // actually touches an enemy; there is no invisible central AoE.
      const count=Math.max(1,Math.min(8,Math.round(o.a.count||1)));
      const orbitRadius=o.a.radius*.75;
      opponents.forEach(e=>{
        for(let j=0;j<count;j++){
          const theta=o.phase+j*2*Math.PI/count;
          const ox=p.x+Math.cos(theta)*orbitRadius,oy=p.y+Math.sin(theta)*orbitRadius;
          if(Math.hypot(e.x-ox,e.y-oy)<(e.radius||0)+8){hit(p,e,o.a,.4);break;}
        }
      });
    }
    if(o.life<=0)p.forgeOrbs.splice(i,1);
  }
  // Persistent semantic forces use the same clock and hit resolver as
  // projectiles, zones and all other authored combat actions.
  global.SemanticPhysics?.tick?.(p,opponents,hit);
  // Compose generated field equations in the authoritative 60Hz world.
  global.PhysicsLawEngine?.tick?.(p,opponents,hit);
  // Stateful storage/release is the one new primitive not representable by
  // existing one-shot attacks or stateless field algebra.
  global.ImaginationConcepts?.relayTick?.(p,opponents,hit);

}
return Object.freeze({tick});
};
})(typeof window!=='undefined'?window:globalThis);

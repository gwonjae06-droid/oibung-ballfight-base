/* Authoritative simulation of authored projectiles, persistent zones and
 * orbiting strikes. Runs once per fighter per simulation tick, after the
 * existing charge, expansion and cast queue updates.
 *
 * Inject the SAME hit(), hitGround() and enemies() as SkillForge uses so
 * damage, invulnerability, statuses and target selection cannot diverge.
 * Do not schedule timers, modify saved profiles, or create render DOM here.
 */
(function(global){'use strict';
global.SkillForgeWorldFactory=function({hit,hitGround,enemies}){
function tick(p,target){
  for(let i=p.forgeShots.length-1;i>=0;i--){
    const b=p.forgeShots[i];
    const concept=global.ConceptFusion?.normalize?.(b.a?.fusion);
    if(concept?.homing&&b.a?.type==='shot'){
      const foe=enemies(p).find(e=>e.playerNum===b.targetNum&&e.hp>0)||
        enemies(p).filter(e=>e.hp>0).sort((x,y)=>
          Math.hypot(x.x-b.x,x.y-b.y)-Math.hypot(y.x-b.x,y.y-b.y))[0];
      if(foe){
        const dx=foe.x-b.x,dy=foe.y-b.y,d=Math.hypot(dx,dy)||1;
        const speed=Math.max(2,Math.min(14,Number(b.a.speed)||5));
        b.vx=b.vx*.90+dx/d*speed*.10;
        b.vy=b.vy*.90+dy/d*speed*.10;
        const magnitude=Math.hypot(b.vx,b.vy)||1;
        b.vx=b.vx/magnitude*speed;b.vy=b.vy/magnitude*speed;
      }
    }
    // One projectile can physically divide into a bounded fan of
    // independently homing fragments. Child payloads disable further
    // splitting, so there is no exponential recursion.
    if(concept?.split&&b.a?.type==='shot'&&!b._fusionChild&&
       (b._fusionAge=(b._fusionAge||0)+1)>=12){
      const available=Math.max(0,100-p.forgeShots.length+1);
      const count=Math.min(concept.fragments,available);
      const victim=enemies(p).find(e=>e.playerNum===b.targetNum&&e.hp>0);
      const direction=victim?Math.atan2(victim.y-b.y,victim.x-b.x):
        Math.atan2(b.vy,b.vx);
      const speed=Math.max(2,Math.min(14,Number(b.a.speed)||5));
      const action={...b.a,damage:Math.round((Number(b.a.damage)||0)*.55),
        fusion:{...concept,split:false}};
      p.forgeShots.splice(i,1);
      for(let n=0;n<count;n++){
        const theta=direction+(n-(count-1)/2)*.38;
        p.forgeShots.push({...b,a:action,_fusionChild:true,_fusionAge:0,
          x:b.x,y:b.y,prevX:b.x,prevY:b.y,
          vx:Math.cos(theta)*speed,vy:Math.sin(theta)*speed,
          life:Math.min(Math.max(28,b.life),150),_reboundCount:0});
      }
      global.BattleFX?.mark?.('shot',b.x,b.y,
        b.a.visual?.color||p.forge?.effectColor||'#a8b1ff',18);
      global.SignatureLive?.record?.(p,'split');
      continue;
    }
    b.prevX=b.x;b.prevY=b.y;b.x+=b.vx;b.y+=b.vy;
    if(Number.isFinite(b.heightVelocity)){
      if(b.targetNum!==undefined){const victim=enemies(p).find(e=>e.playerNum===b.targetNum&&e.hp>0);
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
    if(blocked){p.forgeShots.splice(i,1);continue;}
    // Ground-level bullets use a ground-level hit check, not the firing
    // character's current jump height. Swept contact prevents tunneling.
    const e=enemies(p).find(e=>(global.ActionRegistry?.sweptCircle?.(
      b.prevX,b.prevY,b.x,b.y,e.x,e.y,e.radius+8)??
      Math.hypot(e.x-b.x,e.y-b.y)<=e.radius+8)&&hit(p,e,b.a,1,b.z||0));
    if(e||b.life<=0||b.x<0||b.y<0||b.x>canvas.width||b.y>canvas.height)p.forgeShots.splice(i,1);
  }
  if(p.forgeZones.length>32)p.forgeZones.splice(0,p.forgeZones.length-32);
  for(let i=p.forgeZones.length-1;i>=0;i--){
    const z=p.forgeZones[i];z.timer--;z.ticks++;
    if(z.type==='bolt'&&z.timer<=0){
      if(global.BattleFX)BattleFX.cast(p,'lightning',{x:z.x,y:z.y,color:(p.forge.effectColor||p.forge.color)});
      enemies(p).filter(e=>Math.hypot(e.x-z.x,e.y-z.y)<z.a.radius*.4+e.radius).forEach(e=>hitGround(p,e,z.a));
    }
    if(z.type==='zone'&&z.timer>0&&z.ticks%30===0){
      const actualRadius=z.r??z.a.radius;
      enemies(p).filter(e=>Math.hypot(e.x-z.x,e.y-z.y)<actualRadius+e.radius).forEach(e=>hitGround(p,e,z.a,.4));
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
      enemies(p).forEach(e=>{
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
  global.SemanticPhysics?.tick?.(p,enemies(p),hit);
  // Compose generated field equations in the authoritative 60Hz world.
  global.PhysicsLawEngine?.tick?.(p,enemies(p),hit);
  // Stateful storage/release is the one new primitive not representable by
  // existing one-shot attacks or stateless field algebra.
  global.ImaginationConcepts?.relayTick?.(p,enemies(p),hit);

}
return Object.freeze({tick});
};
})(typeof window!=='undefined'?window:globalThis);

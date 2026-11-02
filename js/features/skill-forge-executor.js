/* SkillForge action dispatcher. Reuses the authoritative injected hit and
 * enemy selectors; maintains the legacy action fallbacks and visual hooks.
 * Executes only after queue scheduling, without changing stored profiles.
 */
(function(global){'use strict';
global.SkillForgeExecutorFactory=function({MOVEMENT_ONLY,hit,enemies}){
function execute(p,a,target) {
  a=global.ArenaCharge?.consume?.(p,a)||a;
  // Keep target-selector semantics consistent across all three engines.
  const selected=global.AbilityAtlas?.choose?.(p,enemies(p),a.target)||target;
  target=selected;
  // Pure movement is a positioning state, never a contact attack. Keep a
  // small grace for instantaneous teleports, and full duration for dash.
  if(MOVEMENT_ONLY.has(a.type)){
    const grace=a.type==='dash'?Math.max(2,Math.round((a.duration||.15)*60)):
      a.type==='blink'||a.type==='swap'||a.type==='portal'?4:10;
    p.movementOnlyFrames=Math.max(p.movementOnlyFrames||0,Math.min(240,grace));
  }
  const visualReady=global.SkillVisuals?.cast(p,a,target);
  // A future user-authored action may have a valid executor but no VFX motif
  // yet. Never let it execute completely invisibly; render a safe generic cue.
  if(visualReady===false)global.BattleFX?.cast?.(p,'energy',{
    color:p.forge?.effectColor||p.forge?.color||'#8a9acb',
    radius:Math.max(35,Math.min(230,Number(a.radius)||90))
  });
  // In-world actions must dispatch through the same combat implementation
  // used by physics and visuals; they are not merely text menu entries.
  // Action Registry code-authored skills receive the same hit/enemy API as
  // built-in engine adapters. Preview and sound metadata are automatic.
  if(global.ActionRegistry?.run(p,a,target,{hit,enemies}))return;
  if(global.AdvancedCombat?.execute(p,a,target,{hit,enemies}))return;
  if(global.ForgeExpansion?.execute(p,a,target,{hit,enemies}))return;
  if(global.AbilityAtlas && AbilityAtlas.execute(p,a,target,{hit,enemies}))return;
  const c=(p.forge.effectColor||p.forge.color),near=target&&target.hp>0?target:getClosestAliveEnemy(p);
  const within=(x,y,r)=>enemies(p).filter(e=>Math.hypot(e.x-x,e.y-y)<r+e.radius);
  const visual=(kind,opts={})=>{if(global.BattleFX)BattleFX.cast(p,kind,Object.assign({color:c},opts));};
  if(a.type==='wave'){visual('wave',{radius:a.radius});within(p.x,p.y,a.radius).forEach(e=>hit(p,e,a));}
  else if(a.type==='shot'){
    if(!near)return;
    visual('shot');const angle=Math.atan2(near.y-p.y,near.x-p.x);
    for(let i=0;i<a.count;i++){const t=angle+(i-(a.count-1)/2)*.19;
      const originZ=global.AdvancedCombat?.height?.(p)||0;
      const aimZ=global.AdvancedCombat?.height?.(near)||0;
      const frames=Math.max(1,Math.hypot(near.x-p.x,near.y-p.y)/Math.max(1,a.speed));
      if(p.forgeShots.length>=100)break;
      p.forgeShots.push({x:p.x,y:p.y,z:originZ,heightVelocity:(aimZ-originZ)/frames,
        vx:Math.cos(t)*a.speed,vy:Math.sin(t)*a.speed,targetNum:near.playerNum,
        // A small authored AoE radius is NOT a maximum flight distance.
        // Keep shots alive long enough to cross the actual arena while
        // retaining the existing perimeter collision/ricochet rules.
        life:Math.min(240,Math.max(30,
          Math.ceil((Math.hypot(canvas.width,canvas.height)+40)/Math.max(2,a.speed||5)),
          a.ricochet>0?150:0)),a});
    }
    // Do not make existing shots suddenly disappear to admit a fresh volley.
    // Let already airborne shots complete. Bound per-owner concurrent shots.
    if(p.forgeShots.length>100)p.forgeShots.splice(100);
  } else if(a.type==='beam'){
    if(!near)return;
    const d=Math.hypot(near.x-p.x,near.y-p.y)||1,x=p.x+(near.x-p.x)/d*a.radius*2,y=p.y+(near.y-p.y)/d*a.radius*2;
    if(global.BattleFX)BattleFX.beam(p.x,p.y,x,y,c);
    visual('energy');
    enemies(p).forEach(e=>{const vx=x-p.x,vy=y-p.y,t=Math.max(0,Math.min(1,((e.x-p.x)*vx+(e.y-p.y)*vy)/(vx*vx+vy*vy||1)));
      const startZ=(global.AdvancedCombat?.height?.(p)||0)+12,endZ=(global.AdvancedCombat?.height?.(e)||0)+12;
      const occluded=global.ArenaTowerTerrain?.obstructsShot?.(p.x,p.y,startZ,e.x,e.y,endZ,7);
      if(!occluded&&Math.hypot(e.x-p.x-t*vx,e.y-p.y-t*vy)<e.radius+12)hit(p,e,a);
    });
  } else if(a.type==='bolt'){
    if(!near)return;
    visual('meteor',{x:near.x,y:near.y,radius:a.radius});
    for(let i=0;i<a.count;i++){const theta=i*2*Math.PI/a.count;p.forgeZones.push({type:'bolt',x:near.x+Math.cos(theta)*a.radius*.4,y:near.y+Math.sin(theta)*a.radius*.4,timer:30+i*5,a,ticks:0});}
  } else if(a.type==='dash'){
    if(!near)return;
    const dx=near.x-p.x,dy=near.y-p.y,d=Math.hypot(dx,dy)||1;
    p.vx=dx/d*a.speed;p.vy=dy/d*a.speed;p.forgeDash=Math.round(a.duration*60);p.forgeDashAction=a;visual('dash');
  } else if(a.type==='blink'){
    if(!near)return;
    visual('blink');const dx=near.x-p.x,dy=near.y-p.y,d=Math.hypot(dx,dy)||1;
    p.x=Math.max(p.radius,Math.min(canvas.width-p.radius,near.x-dx/d*68));
    p.y=Math.max(p.radius,Math.min(canvas.height-p.radius,near.y-dy/d*68));
    visual('blink'); // Reposition only: a separate attack block owns damage.
  } else if(a.type==='heal'){
    const oldHp=p.hp;
    if(global.ForgeExpansion)global.ForgeExpansion.heal(p,a.damage);
    else p.hp=Math.min(p.maxHp,p.hp+a.damage*(global.ArenaBalance?.defenseFactorOf?.(p)??1));
    visual('heal');addFloatingText('+'+Math.round(Math.max(0,p.hp-oldHp)),p.x,p.y-26,'#8bf2af',17);
  } else if(a.type==='shield'){
    const durationFrames=Math.max(1,Math.round(a.duration*60*(global.ArenaBalance?.defenseFactorOf?.(p)??1)));
   p.invincible=global.ArenaBalance?.shieldWindow?.(p,durationFrames)??Math.max(p.invincible,durationFrames);
   p._forgeImpactGrace=0; // Shields are defense, never impact grace.
   visual('shield');
  } else if(a.type==='pull'){
    visual('wave',{radius:a.radius});
    within(p.x,p.y,a.radius).forEach(e=>{
      const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
      e.vx+=dx/d*(a.knockback+2);e.vy+=dy/d*(a.knockback+2);
      hit(p,e,Object.assign({},a,{knockback:0}));
    });
  } else if(a.type==='orbit'){
    p.forgeOrbs.push({life:Math.round(a.duration*60),phase:0,ticks:0,a});
    if(p.forgeOrbs.length>3)p.forgeOrbs.shift();visual('shield');
  } else if(a.type==='zone'){
    if(!near)return;visual('meteor',{x:near.x,y:near.y,radius:a.radius});
    p.forgeZones.push({type:'zone',x:near.x,y:near.y,timer:Math.round(a.duration*60),a,ticks:0});
  }
}
return Object.freeze({execute});
};
})(typeof window!=='undefined'?window:globalThis);

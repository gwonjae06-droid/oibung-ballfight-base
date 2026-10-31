/* Six deterministic tower arenas: raised traversable islands, height and
 * lightweight terrain effects. Active only in Tower PvE; no PvP globals. */
(function(g){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),PI=Math.PI;
const C={
 time:{base:'#493923',side:'#6f542d',top:'#c6aa68',rim:'#ffe1a0',symbol:'◷'},
 space:{base:'#141933',side:'#363161',top:'#7774b2',rim:'#d5c8ff',symbol:'✧'},
 fire:{base:'#23171b',side:'#47262a',top:'#635052',rim:'#ff8955',symbol:'♨'},
 storm:{base:'#1b3046',side:'#2f5d74',top:'#81a4b5',rim:'#c5f7ff',symbol:'ϟ'},
 ice:{base:'#17334b',side:'#23647b',top:'#83cadf',rim:'#e1faff',symbol:'❄'},
 forest:{base:'#243629',side:'#3c613e',top:'#80a575',rim:'#d2f2a0',symbol:'♧'}
};
const NODES={
 fire:[[.5,.46,.21,47],[.19,.32,.14,23],[.81,.68,.14,28]],
 time:[[.5,.5,.27,39],[.22,.36,.16,25],[.78,.65,.16,31]],
 space:[[.49,.5,.22,58],[.18,.29,.15,32],[.81,.70,.16,39]],
 ice:[[.52,.43,.23,41],[.22,.7,.17,29],[.8,.32,.15,36]],
 storm:[[.5,.52,.23,50],[.16,.35,.14,30],[.84,.65,.14,32]],
 forest:[[.5,.48,.24,43],[.23,.67,.17,25],[.76,.28,.16,28]]
};
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
// The same floor field is sampled for rendering, actor footing, and projectiles.
// The only active context lives for a Tower encounter and is removed on exit.
let active=null;
const between=(a,b,t)=>a+(b-a)*t;
function phaseOf(t,period){return (Math.max(0,t)||0)%period;}
function ventPhase(t){return phaseOf(t,540);}
function ventLift(t){const q=ventPhase(t);return q<180?0:q<265?24*smooth((q-180)/85):q<350?24:q<425?24*(1-smooth((q-350)/75)):0;}

function nodes(realm,level=1,width=500,height=500,tick=0){
 const base=NODES[realm]||NODES.time,variance=((level-1)%4)*.018;
 return base.map(([x,y,r,z],i)=>{
  let px=x*width,py=(y+(i===0?0:i===1?variance:-variance))*height;
  let lift=z+(level>=6?5:0);
  // Clock gears rotate gently; satellites bob; roots grow; ice cracks
  // periodically. The same tick drives visible surfaces AND gameplay height.
  const t=Math.max(0,Number(tick)||0);
  if(realm==='time'&&i>0){
    const a=t*.004+i*2.6;
    px+=Math.cos(a)*Math.min(14,width*.026);
    py+=Math.sin(a)*Math.min(13,height*.024);
  }
  if(realm==='space')lift+=Math.sin(t*.023+i*1.3)*8;
  if(realm==='fire'&&i===0)lift+=ventLift(t);
  if(realm==='storm')lift+=Math.sin(t*.018+i*.9)*(i===0?8:5);
  if(realm==='forest'&&i===2)lift+=Math.sin(t*.016)*9;
  if(realm==='ice'&&i===2&&t%540>=410)lift=Math.max(6,lift*.24);
  return {x:px,y:py,r:r*Math.min(width,height)*(level%5===0?1.12:1),
   z:lift,index:i};
 });
}
function heightAt(realm,level,x,y,width=500,height=500,tick=0){
 let z=0;const platforms=nodes(realm,level,width,height,tick);
 for(const n of platforms){
   const distance=Math.hypot(x-n.x,y-n.y)/n.r;
   z=Math.max(z,n.z*(1-smooth((distance-.67)/.43)));
 }
 // Previously only painted bridges linked the islands: a fighter looked as
 // though it walked on a ramp, but its physics instantly fell to z=0.
 for(let i=1;i<platforms.length;i++){
   const a=platforms[0],b=platforms[i],dx=b.x-a.x,dy=b.y-a.y;
   const len2=dx*dx+dy*dy||1,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/len2,0,1);
   const dist=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
   const halfWidth=Math.min(width,height)*.042;
   const ridge=between(a.z,b.z,t)*.88*(1-smooth((dist-halfWidth*.65)/(halfWidth*.65)));
   z=Math.max(z,ridge);
 }
 return z;
}
function worldHeight(x,y){
 return active?heightAt(active.realm,active.level,x,y,active.width,active.height,active.tick):0;
}
// A raised island is solid cover. Sample the swept segment, not just its end,
// and compare terrain against the bullet's world-space altitude.
function obstructsShot(x0,y0,z0,x1,y1,z1,clearance=9){
 if(!active||![x0,y0,z0,x1,y1,z1].every(Number.isFinite))return false;
 const length=Math.hypot(x1-x0,y1-y0),steps=Math.max(1,Math.ceil(length/5));
 for(let i=1;i<=steps;i++){
   const t=i/steps;
   if(worldHeight(between(x0,x1,t),between(y0,y1,t))>between(z0,z1,t)+clearance)return true;
 }
 return false;
}

function paint(ctx,realm,level,width=500,height=500,frame=0){
 const theme=C[realm];if(!theme||!ctx)return false;
 const platforms=nodes(realm,level,width,height,frame);
 ctx.save();
  // The top physically sits z units above the ground footprint. Draw
  // the unprojected circular footprint here: ArenaDepth.projectWorld turns
  // it into the same perspective ellipse used for the fighter's feet.
 for(const n of platforms){
   const r=n.r,topY=n.y-n.z;
   ctx.fillStyle='#00000036';ctx.beginPath();ctx.ellipse(n.x+7,n.y+8,r*1.12,r*.94,0,0,PI*2);ctx.fill();
   ctx.fillStyle=theme.side;
   ctx.beginPath();ctx.arc(n.x,n.y,r,0,PI*2);ctx.fill();
   // Front wall exposes the full real elevation, not a decorative fraction.
   ctx.beginPath();ctx.moveTo(n.x+r,topY);ctx.arc(n.x,topY,r,0,PI);
   ctx.lineTo(n.x-r,n.y);ctx.arc(n.x,n.y,r,PI,0,true);ctx.closePath();ctx.fill();
   ctx.beginPath();ctx.arc(n.x,topY,r,0,PI*2);
   ctx.fillStyle=theme.top;ctx.globalAlpha=.84;ctx.fill();ctx.globalAlpha=1;
   ctx.strokeStyle=theme.rim;ctx.lineWidth=2.7;ctx.stroke();
   ctx.strokeStyle='#ffffff46';ctx.lineWidth=1.2;
   ctx.beginPath();ctx.arc(n.x,topY-r*.12,r*.72,PI*1.08,PI*1.92);ctx.stroke();
   // Theme glyph is a floor engraving, not a character sprite.
   ctx.fillStyle=theme.base;ctx.globalAlpha=.50;
   ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font='bold '+Math.round(r*.47)+'px system-ui';
   ctx.fillText(theme.symbol,n.x,topY-4);ctx.globalAlpha=1;
 }
 // Realm architecture painted behind combatants, without changing collision.
 ctx.save();ctx.lineWidth=2;ctx.globalAlpha=.68;
 for(let i=0;i<platforms.length;i++){
  const n=platforms[i],rad=n.r;
  ctx.strokeStyle=theme.rim;
  if(realm==='time'){
   for(let k=0;k<16;k++){const a=k*Math.PI/8;ctx.beginPath();ctx.moveTo(n.x+Math.cos(a)*rad*.65,n.y+Math.sin(a)*rad*.42);ctx.lineTo(n.x+Math.cos(a)*rad*.85,n.y+Math.sin(a)*rad*.54);ctx.stroke();}
  }else if(realm==='space'){
   ctx.beginPath();ctx.ellipse(n.x,n.y,rad*.75,rad*.19,-.38,0,PI*2);ctx.stroke();
   ctx.beginPath();ctx.ellipse(n.x,n.y,rad*.35,rad*.53,.55,0,PI*2);ctx.stroke();
  }else if(realm==='fire'){
   for(let k=-2;k<=2;k++){ctx.beginPath();ctx.moveTo(n.x+k*rad*.25,n.y-rad*.34);ctx.lineTo(n.x+(k+.22)*rad*.25,n.y+rad*.35);ctx.stroke();}
  }else if(realm==='storm'){
   for(let k=-2;k<=2;k++){const x=n.x+k*rad*.32;ctx.beginPath();ctx.moveTo(x,n.y-rad*.3);ctx.lineTo(x+rad*.12,n.y);ctx.lineTo(x-rad*.02,n.y+rad*.28);ctx.stroke();}
  }else if(realm==='ice'){
   for(let k=0;k<6;k++){const a=k*PI/3;ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(n.x+Math.cos(a)*rad*.66,n.y+Math.sin(a)*rad*.42);ctx.stroke();}
  }else if(realm==='forest'){
   for(let k=0;k<5;k++){const a=k*PI*2/5;ctx.beginPath();ctx.ellipse(n.x+Math.cos(a)*rad*.45,n.y+Math.sin(a)*rad*.27,rad*.28,rad*.12,a,0,PI*2);ctx.stroke();}
  }
 }
 ctx.restore();
 // Connecting slopes between islands ensure that a moving AI never gets stuck.
 ctx.lineCap='round';ctx.lineWidth=Math.max(11,Math.min(width,height)*.048);
 ctx.strokeStyle=theme.side;ctx.globalAlpha=.67;
 for(let i=1;i<platforms.length;i++){
   const a=platforms[0],b=platforms[i];
   ctx.beginPath();ctx.moveTo(a.x,a.y-a.z);ctx.lineTo(b.x,b.y-b.z);ctx.stroke();
   ctx.strokeStyle=theme.rim;ctx.lineWidth=Math.max(3,Math.min(width,height)*.009);ctx.stroke();
   ctx.strokeStyle=theme.side;ctx.lineWidth=Math.max(11,Math.min(width,height)*.048);
 }
 // Realm-specific height telegraphs are drawn at the exact raised surface.
 const t=phaseOf(frame,540),main=platforms[0];
 if(realm==='fire'&&t>=145&&t<425){
   ctx.save();ctx.translate(main.x,main.y-main.z);ctx.strokeStyle=t<265?'#ffd36b':'#ff512c';
   ctx.lineWidth=4+(t<265?3*Math.sin(frame*.24)**2:4);ctx.setLineDash(t<265?[9,5]:[]);
   ctx.beginPath();ctx.arc(0,0,main.r*.86,0,PI*2);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle='#ffe8a0';ctx.font='bold 15px system-ui';ctx.textAlign='center';
   ctx.fillText(t<265?'분화 예고':t<350?'분화 중':'용암 가라앉음',0,-main.r*.45);
   ctx.restore();
 }
 if(realm==='storm'&&phaseOf(frame,450)>=180&&phaseOf(frame,450)<290){
   ctx.save();ctx.strokeStyle='#c5faff';ctx.lineWidth=3;
   const center=platforms[0];
   for(let k=0;k<6;k++){const a=k*PI/3+frame*.016,r=center.r*.55;
     ctx.beginPath();ctx.moveTo(center.x+Math.cos(a)*r,center.y-center.z+Math.sin(a)*r);
     ctx.lineTo(center.x+Math.cos(a)*r*.35,center.y-center.z+Math.sin(a)*r*.35-28);ctx.stroke();}
   ctx.restore();
 }
 if(realm==='ice'&&phaseOf(frame,540)>=355&&phaseOf(frame,540)<480){
   const ice=platforms[2];ctx.save();ctx.strokeStyle='#f0ffff';ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(ice.x,ice.y-ice.z,ice.r*.76,0,PI*2);ctx.stroke();
   ctx.fillStyle='#e8feff';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText('빙판 붕괴',ice.x,ice.y-ice.z-ice.r*.32);ctx.restore();
 }
 ctx.globalAlpha=1;ctx.restore();return true;
}
// Called once after movement and once after encounter advancement. `sync` only
// updates footing, while `step` owns time-dependent hazards and movement buffs.
function sync(roster){
 if(!active)return;
 for(const p of roster||[])if(p&&p.hp>0)
   {p._towerPreviousFloor=Number(p.towerGroundZ)||0;
    p.towerGroundZ=worldHeight(p.x,p.y);}
}
function step(realm,level,roster,width=500,height=500,tick=0,damage){
 const prev=active;
 active={realm,level,width,height,tick};
 const curr=nodes(realm,level,width,height,tick),oldNodes=prev?.realm===realm?nodes(realm,level,width,height,prev.tick):null;
 for(const p of roster||[]){
  if(!p||p.hp<=0)continue;
  const before=Number.isFinite(p._towerPreviousFloor)?p._towerPreviousFloor:(Number(p.towerGroundZ)||0);
  delete p._towerPreviousFloor;
  // Moving gears carry grounded occupants a little; travel stays inside
  // real world XY coordinates and stays bounded by the small island motion.
  if(realm==='time'&&oldNodes&&!(p.z>2))for(let i=1;i<3;i++){
    const old=oldNodes[i],next=curr[i];
    if(Math.hypot(p.x-old.x,p.y-old.y)<old.r*.64){
      p.x+=clamp(next.x-old.x,-2,2);p.y+=clamp(next.y-old.y,-2,2);break;
    }
  }
  const ground=worldHeight(p.x,p.y);
  // A collapsing island removes the floor under an actor. Let gravity carry
  // them down instead of teleporting the sprite through the vertical wall.
  if(before-ground>5&&!(p.z>2)&&realm==='ice'){
    p.z=clamp(before-ground,0,52);
    p.vz=Math.min(Number(p.vz)||0,-1.5);
  }
  p.towerGroundZ=ground;
  p.towerGravity=realm==='space'?.34:realm==='storm'?.44:.55;
  p.towerTerrainSpeed=realm==='forest'&&ground>15?.9:realm==='fire'&&ventPhase(tick)>=265&&ventPhase(tick)<350&&ground>25?.87:1;
  p.towerHeightLabel=realm==='space'?'저중력':realm==='storm'?'상승기류':realm==='ice'?'붕괴 지형':realm==='fire'?'용암 승강대':realm==='time'?'회전 기어':'성장하는 뿌리';
  if(realm==='storm'&&p.z<2&&ground>20&&phaseOf(tick,450)===260){
    g.AdvancedCombat?.launch?.(p,7.5);
  }
  // Fire's magma lift has a warning and a single confirmed-hit pulse. It is
  // a boss arena hazard, never a hidden permanent damage aura or a PvP rule.
  if(realm==='fire'&&tick>0&&ventPhase(tick)===285&&p.towerHero&&ground>30&&p.z<18&&p._towerVentHitFrame!==tick){
    p._towerVentHitFrame=tick;
    damage?.(p,level>=5?27:17,{realm:'fire',kind:'terrain',label:'용암 분화'});
  }
 }
}
function clear(roster){
 active=null;
 for(const p of roster||[])if(p){
  for(const key of ['towerGroundZ','towerGravity','towerTerrainSpeed','towerHeightLabel','_towerPreviousFloor','_towerVentHitFrame'])delete p[key];
 }
}
g.ArenaTowerTerrain={nodes,heightAt,worldHeight,obstructsShot,paint,sync,step,clear,THEMES:C};
})(globalThis);

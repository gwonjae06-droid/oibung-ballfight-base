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
  if(realm==='forest'&&i===2)lift+=Math.sin(t*.016)*9;
  if(realm==='ice'&&i===2&&t%540>=410)lift=Math.max(6,lift*.24);
  return {x:px,y:py,r:r*Math.min(width,height)*(level%5===0?1.12:1),
   z:lift,index:i};
 });
}
function heightAt(realm,level,x,y,width=500,height=500,tick=0){
 let z=0;
 for(const n of nodes(realm,level,width,height,tick)){
   const distance=Math.hypot(x-n.x,y-n.y)/n.r;
   z=Math.max(z,n.z*(1-smooth((distance-.67)/.43)));
 }
 return z;
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
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 }
 ctx.globalAlpha=1;ctx.restore();return true;
}
function step(realm,level,roster,width=500,height=500,tick=0){
 for(const p of roster||[]){
  if(!p||p.hp<=0)continue;
  const goal=heightAt(realm,level,p.x,p.y,width,height,tick);
  // A single, authoritative world-space floor height powers collisions,
  // jump origins and the drawn raised platform. Smooth SDF ramps already
  // interpolate at the edges; a second lerp here made actors hover and miss.
  p.towerGroundZ=goal;
  // Terrain owns only height; the separate environment engine paints and
  // applies clearly telegraphed realm effects. No hidden passive debuffs.
 }
}
function clear(roster){
 for(const p of roster||[])if(p)delete p.towerGroundZ;
}
g.ArenaTowerTerrain={nodes,heightAt,paint,step,clear,THEMES:C};
})(globalThis);

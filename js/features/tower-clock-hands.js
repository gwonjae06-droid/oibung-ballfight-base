/* Time Tower pinball clock apparatus: deterministic physical geometry and render.
 * One source of truth for visible blades and their actual capsule hitboxes.
 * Rendering cannot advance or damage combat. Only active during Time Tower.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(x,a,b)=>Math.max(a,Math.min(b,x));
const PALETTE={gold:'#ffe7a4',brass:'#c9a477',ice:'#b6e8ff',ink:'#111b33'};
function create({width=500,height=500,hero,boss,damage,weakpoint}){
 let tick=0,spell=null,handHits=[-999,-999],coreHits=0,coreCooldown=0;
 const cx=width/2,cy=height/2,scale=Math.min(width,height)/500;
 function begin(tier=1,variant='hands'){
   // All clock variants are one-off spectacle actions; no independent timer.
   spell={tier,variant,start:tick,end:tick+(variant==='hands'?(tier===2?435:420):420),
     warning:tier===2?90:72,slowStart:variant==='stasis'?96:variant==='hands'?182:0,
     slowEnd:variant==='stasis'?252:variant==='hands'?252:0,
     rewind:variant==='rewind', core:0};
   handHits=[-999,-999];coreHits=0;coreCooldown=0;return spell;
 }
 function handAt(i){
   if(!spell)return null;
   const age=tick-spell.start;
   const second=i===1;
   const radius=(second?(spell.tier===2?142:132):(spell.tier===2?195:185))*scale;
   const omega=(second?(spell.tier===2?-.24:-.18):(spell.tier===2?.42:.32))/60;
   const angle=-Math.PI/2+(second?1.28:0)+Math.max(0,age-spell.warning)*omega;
   return {angle,omega,r:radius,thickness:(second?24:12)*scale,
     x1:cx,y1:cy,x2:cx+Math.cos(angle)*radius,y2:cy+Math.sin(angle)*radius};
 }
 function nearest(p,h){
   const dx=h.x2-h.x1,dy=h.y2-h.y1,mag=dx*dx+dy*dy;
   const t=cap(((p.x-h.x1)*dx+(p.y-h.y1)*dy)/(mag||1),0,1);
   const x=h.x1+t*dx,y=h.y1+t*dy;
   const dist=Math.hypot(p.x-x,p.y-y);
   let nx=dist>.001?(p.x-x)/dist:-Math.sin(h.angle);
   let ny=dist>.001?(p.y-y)/dist:Math.cos(h.angle);
   return {dist,nx,ny,t,x,y};
 }
 function step(){
   tick++;
   if(coreCooldown>0)coreCooldown--;
   if(!spell)return;
   const age=tick-spell.start;
   if(age>=spell.end-spell.start){spell=null;return;}
   if(age>=spell.slowStart&&age<spell.slowEnd){
     // Only affect the HERO, and only during the window announced by the
     // spectacle. Boss movement/attacks remain at their ordinary speed.
     hero._towerClockSlow=2;hero._towerClockSlowScale=spell.variant==='stasis'?.18:.35;
   }
   if(spell.variant==='rewind'||age<spell.warning||age>spell.end-spell.start-48)return;
   for(let i=0;i<2;i++){
     const h=handAt(i),p=hero;
     const q=nearest(p,h);
     const threshold=(p.radius||22)+h.thickness/2;
     if(q.dist>=threshold)continue;
     const overlap=threshold-q.dist;
     // Correct penetration first, without teleports or artificial aiming.
     p.x=cap(p.x+q.nx*(overlap+.15),(p.radius||22)+26,width-(p.radius||22)-26);
     p.y=cap(p.y+q.ny*(overlap+.15),(p.radius||22)+26,height-(p.radius||22)-26);
     // Moving surface velocity at contact point: omega cross radius.
     const rx=q.x-cx,ry=q.y-cy;
     const wallVX=-h.omega*ry,wallVY=h.omega*rx;
     const relative=(p.vx||0-wallVX)*q.nx+(p.vy||0-wallVY)*q.ny;
     const approaching=(p.vx||0)*q.nx+(p.vy||0)*q.ny-(wallVX*q.nx+wallVY*q.ny);
     // A rotating hand can sweep into stationary targets, so include its
     // surface velocity. Keep impulse bounded for high game speeds.
     const impulse=cap(-(1.78)*Math.min(approaching,-.7),0,9);
     p.vx=cap((p.vx||0)+q.nx*impulse,-12,12);
     p.vy=cap((p.vy||0)+q.ny*impulse,-12,12);
     g.ArenaBallSquash?.wall?.(p,q.nx,q.ny,impulse);
     g.BounceMomentum?.wall?.(p,impulse);
     p._pinballReboundHold=Math.max(p._pinballReboundHold||0,8);
     if(tick-handHits[i]>=78){
       handHits[i]=tick;
       const amount=i===0?(spell.tier===2?14:12):(spell.tier===2?20:17);
       // No bypass around invulnerability, no extra damage in draw().
       damage?.(p,amount,{realm:'time',kind:'boss',label:i?'분침의 압력':'초침의 심판'});
     }
   }
   // Mechanical weakness: collide with the exposed central cog while the
   // hands run. The player can approach via bouncing, not an input-only dodge.
   if(age>spell.warning+28&&age<spell.end-spell.start-48&&coreCooldown===0){
     const d=Math.hypot(hero.x-cx,hero.y-cy);
     if(d<(hero.radius||22)+28*scale&&Math.hypot(hero.vx||0,hero.vy||0)>2.2){
       coreHits++;coreCooldown=55;
       if(coreHits>=2){
         coreHits=0;
         weakpoint?.();
         spell.end=Math.min(spell.end,tick+55);
       }
     }
   }
 }
 function draw(ctx){
   if(!spell)return;
   const age=tick-spell.start,progress=cap(age/spell.warning,0,1);
   const fade=cap((spell.end-tick)/46,0,1);
   const R=213*scale,spin=tick*.0023;
   ctx.save();ctx.translate(cx,cy);
   // Rich metallic clock rings and bevel highlights are vector gradients,
   // not stackable translucent PNG sheets.
   ctx.globalAlpha=fade;
   const grad=ctx.createRadialGradient(0,0,20*scale,0,0,R);
   grad.addColorStop(0,'rgba(12,22,45,.07)');
   grad.addColorStop(.72,'rgba(21,30,56,.09)');
   grad.addColorStop(.88,'rgba(215,177,98,.18)');
   grad.addColorStop(1,'rgba(255,231,164,0)');
   ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,R*1.12,0,TAU);ctx.fill();
   for(let k=0;k<3;k++){
     ctx.save();ctx.rotate(k%2?-spin:spin*(k===2?1.45:1));
     ctx.beginPath();ctx.arc(0,0,(163+k*16)*scale,0,TAU);
     ctx.lineWidth=(k===0?5:1.8)*scale;
     ctx.strokeStyle=k===1?'rgba(182,232,255,.57)':'rgba(255,215,127,.72)';
     ctx.stroke();
     for(let j=0;j<12;j++){
       const a=j*TAU/12,rad=(163+k*16)*scale;
       ctx.beginPath();ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);
       ctx.lineTo(Math.cos(a)*(rad-((j%3)?7:13)*scale),Math.sin(a)*(rad-((j%3)?7:13)*scale));
       ctx.stroke();
     }
     ctx.restore();
   }
   // Fine gold gear teeth on a separate depth plane.
   ctx.save();ctx.rotate(-spin*.6);
   for(let i=0;i<36;i++){
     ctx.rotate(TAU/36);ctx.fillStyle=i%3?'rgba(240,197,116,.44)':'rgba(255,239,183,.72)';
     ctx.fillRect(-3*scale,137*scale,6*scale,10*scale);
   }
   ctx.restore();ctx.restore();
   if(spell.variant!=='rewind')for(let i=0;i<2;i++){
     const h=handAt(i),ready=age>=spell.warning;
     ctx.save();ctx.globalAlpha=fade*(ready?1:.35+.65*progress);
     ctx.translate(cx,cy);ctx.rotate(h.angle);
     const length=h.r,width=h.thickness;
     ctx.shadowColor=i===0?'#ffd27f':'#a4dfff';
     ctx.shadowBlur=ready?16*scale:5*scale;
     const line=ctx.createLinearGradient(0,-width/2,0,width/2);
     line.addColorStop(0,'#fff6d0');line.addColorStop(.38,i===0?'#e9ba66':'#b6e8ff');
     line.addColorStop(1,i===0?'#7d542d':'#436886');
     ctx.fillStyle=line;ctx.strokeStyle='#fff0c4';ctx.lineWidth=1.4*scale;
     ctx.beginPath();ctx.moveTo(-18*scale,-width*.45);
     ctx.lineTo(length-12*scale,-width*.35);
     ctx.lineTo(length,0);ctx.lineTo(length-12*scale,width*.35);
     ctx.lineTo(-18*scale,width*.45);ctx.closePath();ctx.fill();ctx.stroke();
     ctx.restore();
   }
   ctx.save();ctx.translate(cx,cy);ctx.globalAlpha=fade;
   ctx.shadowColor='#ffe2a0';ctx.shadowBlur=16*scale;
   ctx.fillStyle='#573d29';ctx.strokeStyle='#fff1b9';ctx.lineWidth=3*scale;
   ctx.beginPath();ctx.arc(0,0,19*scale,0,TAU);ctx.fill();ctx.stroke();
   ctx.shadowBlur=0;ctx.strokeStyle='#b6e8ff';ctx.lineWidth=1.5*scale;
   ctx.beginPath();ctx.arc(0,0,27*scale,0,TAU);ctx.stroke();
   ctx.restore();ctx.restore();
 }
 function clear(){spell=null;hero._towerClockSlow=0;}
 return {begin,step,draw,clear,handAt,nearest,get active(){return !!spell;},get spell(){return spell;},get coreHits(){return coreHits;},get tick(){return tick;}};
}
g.ArenaClockHands=Object.freeze({create,PALETTE});
})(globalThis);

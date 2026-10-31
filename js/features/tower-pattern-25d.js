/* Height-aware 2.5D tower ability columns, only for ALREADY active damage zones. */
(function(g){
'use strict';
const PI=Math.PI,T=PI*2;
const COLOR={fire:'#ff9a53',time:'#ffd67c',space:'#af93ff',
 storm:'#b2f7ff',ice:'#c5f5ff',forest:'#b4ee83'};
function draw(ctx,zone,realm,tick,width=500,height=500){
 if(!ctx||!zone)return;
 const col=COLOR[realm]||'#ffffff',live=tick>=zone.fire;
 if(!live)return;
 const points=[];
 if(zone.shape==='line'){
  const a=zone.angle||0;
  for(const shift of [-.23,0,.23])points.push({x:zone.x+Math.cos(a)*zone.length*shift,
   y:zone.y+Math.sin(a)*zone.length*shift});
 }else points.push({x:zone.x,y:zone.y});
 for(const pt of points){
  const rise=realm==='space'?92:realm==='storm'?106:realm==='ice'?75:realm==='forest'?58:realm==='time'?70:85;
  // The attack zone stays on the floor; this is a vertically standing
  // visual continuation. Only the zone's existing hit logic applies damage.
  const render=c=>{
   const y=pt.y-rise,t=tick-zone.fire,rad=zone.shape==='line'?12:21;
   c.save();c.globalAlpha=.86;c.lineWidth=3;
   c.strokeStyle=col;c.fillStyle=col;
   if(realm==='fire'||realm==='forest'||realm==='ice'){
    c.beginPath();c.moveTo(pt.x-rad,pt.y);
    c.quadraticCurveTo(pt.x-rad*.9,y+28,pt.x,y-10-Math.sin(t*.12)*5);
    c.quadraticCurveTo(pt.x+rad*.9,y+30,pt.x+rad,pt.y);c.closePath();
    c.globalAlpha=.27;c.fill();c.globalAlpha=.95;c.stroke();
   }else if(realm==='storm'){
    c.beginPath();c.moveTo(pt.x-12,y-17);c.lineTo(pt.x+9,y+22);
    c.lineTo(pt.x-5,y+25);c.lineTo(pt.x+12,pt.y);c.stroke();
   }else{
    c.beginPath();c.ellipse(pt.x,y+15,rad,rad*.65,t*.02,0,T);c.stroke();
    c.beginPath();c.moveTo(pt.x,y+15);c.lineTo(pt.x,pt.y);c.stroke();
   }
   c.restore();
  };
  if(g.ArenaDepth?.air)g.ArenaDepth.air(ctx,pt,rise,render,zone.kind==='boss'?14:8);
  else render(ctx);
 }
}
// Raised warning gantry: 2.5D posts float ABOVE the projected footprint.
// Hit detection always stays in world-space; only the presentation changes.
function warning(ctx,z,realm,tick,width=500,height=500){
 if(!ctx||!z||tick>=z.fire||tick>=z.end)return false;
 const remaining=Math.max(0,z.fire-tick),
   total=Math.max(1,z.fire-(z.born||0)),charge=1-Math.min(1,remaining/total);
 const col=COLOR[realm]||'#ffebbd',poles=[];
 if(z.shape==='line'){
   for(const t of [-.43,-.15,.15,.43]){
     const a=z.angle||0,d=(z.length||Math.max(width,height))*t;
     poles.push({x:z.x+Math.cos(a)*d,y:z.y+Math.sin(a)*d});
   }
 }else{
   const r=z.shape==='ring'?z.r:Math.max(20,z.r||60);
   for(let i=0;i<6;i++){
     const a=i*Math.PI/3+(z.shape==='ring'?.18:0);
     poles.push({x:z.x+Math.cos(a)*r,y:z.y+Math.sin(a)*r});
   }
 }
 const lift=26+charge*19,glowAlpha=.30+charge*.55;
 for(const [i,p] of poles.entries()){
   const height=lift+(i%2)*6;
   const paint=c=>{
     c.save();c.globalAlpha=glowAlpha;
     // Each post is a TRUE upright sprite in the depth-sorted air pass.
     c.fillStyle='rgba(8,14,34,.76)';
     c.strokeStyle=col;c.lineWidth=2.1;
     c.beginPath();c.moveTo(p.x-6,p.y);c.lineTo(p.x-6,p.y-height*.84);
     c.lineTo(p.x,p.y-height-7);c.lineTo(p.x+6,p.y-height*.84);
     c.lineTo(p.x+6,p.y);c.closePath();c.fill();c.stroke();
     c.lineWidth=1.1;c.strokeStyle='#ffffff';
     c.beginPath();c.moveTo(p.x,p.y-height-4);c.lineTo(p.x,p.y-8);c.stroke();
     c.beginPath();c.arc(p.x,p.y-height-4,3.8+Math.sin(tick*.18+i)*1.8,0,T);c.fillStyle=col;c.fill();
     c.restore();
   };
   if(g.ArenaDepth?.air)g.ArenaDepth.air(ctx,p,height,paint,0);
   else paint(ctx);
 }
 // The countdown stands upright in world depth instead of being squashed
 // into the flat world texture alongside the warning disk.
 const anchor={x:z.x,y:z.y};
 const paintLabel=c=>{
  const text=(z.label||'위험 예고')+' '+(remaining/60).toFixed(1)+'s';
  c.save();c.font='bold 13px system-ui';c.textAlign='center';c.textBaseline='middle';
  c.lineWidth=4;c.strokeStyle='#0c1726';c.fillStyle='#ffffff';
  c.strokeText(text,anchor.x,anchor.y-lift-21);
  c.fillText(text,anchor.x,anchor.y-lift-21);c.restore();
 };
 if(g.ArenaDepth?.air)g.ArenaDepth.air(ctx,anchor,lift+12,paintLabel,0);
 else paintLabel(ctx);
 return true;
}
g.ArenaTowerPattern3D={draw,warning};
})(globalThis);

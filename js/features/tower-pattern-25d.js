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
g.ArenaTowerPattern3D={draw};
})(globalThis);

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
 if(zone.signature)drawUltimate(ctx,zone,realm,tick);
}

/* 10F ultimate sigils live above the real hit zone. Per-realm silhouettes are
 * different (clockwork, orbital, caldera, thunder, crystalline, roots). */
function drawUltimate(ctx,z,realm,tick){
 const age=Math.max(0,tick-z.fire),col=COLOR[realm]||'#fff',
   rad=Math.max(24,Math.min(65,(z.r||z.width||60)*.7)),
   pt={x:z.x,y:z.y},lift=realm==='storm'?82:realm==='space'?65:realm==='fire'?60:54;
 const painter=c=>{
  c.save();c.translate(pt.x,pt.y-lift);
  c.globalAlpha=.82;c.strokeStyle=col;c.fillStyle=col;
  c.lineWidth=2.2;c.shadowBlur=12;c.shadowColor=col;
  const line=(x,y,X,Y)=>{c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();};
  const arc=(r,start=0,end=T)=>{c.beginPath();c.arc(0,0,r,start,end);c.stroke();};
  if(realm==='time'){
   arc(rad*.75);arc(rad*.43);
   for(let k=0;k<12;k++){
    const a=k*T/12;line(Math.cos(a)*rad*.59,Math.sin(a)*rad*.59,
      Math.cos(a)*rad*.75,Math.sin(a)*rad*.75);
   }
   const a=age*.14;line(0,0,Math.cos(a)*rad*.64,Math.sin(a)*rad*.64);
   line(0,0,Math.cos(-a*.3)*rad*.4,Math.sin(-a*.3)*rad*.4);
  }else if(realm==='space'){
   c.save();c.rotate(age*.035);c.scale(1,.45);
   for(let i=0;i<3;i++){arc(rad*(.5+i*.19),i*T/3,i*T/3+T*.73);}
   for(let i=0;i<3;i++){const a=i*T/3;
    c.beginPath();c.arc(Math.cos(a)*rad*.86,Math.sin(a)*rad*.86,4,0,T);c.fill();}
   c.restore();arc(7);
  }else if(realm==='fire'){
   arc(rad*.56);
   for(let i=0;i<9;i++){const a=i*T/9,
     inner=rad*.57,outer=rad*(.85+Math.sin(age*.18+i)*.16);
    line(Math.cos(a)*inner,Math.sin(a)*inner,Math.cos(a)*outer,Math.sin(a)*outer);}
   for(let i=0;i<4;i++){
    const x=(i-1.5)*rad*.3,h=12+Math.sin(age*.21+i)*8;
    line(x,rad*.2,x+5,-h-rad*.45);
   }
  }else if(realm==='storm'){
   arc(rad*.65);
   for(let i=0;i<5;i++){
    const a=i*T/5,tx=Math.cos(a)*rad*.76,ty=Math.sin(a)*rad*.76,
      jitter=Math.sin(age*.9+i*7)*7;
    line(0,0,tx*.55+jitter,ty*.55-8);
    line(tx*.55+jitter,ty*.55-8,tx,ty);
   }
  }else if(realm==='ice'){
   for(let i=0;i<8;i++){const a=i*T/8,dx=Math.cos(a),dy=Math.sin(a);
    line(0,0,dx*rad*.83,dy*rad*.83);
    line(dx*rad*.48,dy*rad*.48,dx*rad*.35-dy*rad*.13,dy*rad*.35+dx*rad*.13);
    line(dx*rad*.48,dy*rad*.48,dx*rad*.35+dy*rad*.13,dy*rad*.35-dx*rad*.13);
   }arc(9);
  }else if(realm==='forest'){
   for(let i=0;i<6;i++){
    const a=i*T/6+age*.003,dx=Math.cos(a),dy=Math.sin(a),
      sway=Math.sin(age*.12+i)*rad*.1;
    line(0,0,dx*rad*.53+sway,dy*rad*.53);
    line(dx*rad*.53+sway,dy*rad*.53,dx*rad*.85,dy*rad*.86);
    c.beginPath();c.ellipse(dx*rad*.87,dy*rad*.87,7,3,a,0,T);c.fill();
   }arc(9);
  }
  c.restore();
 };
 if(g.ArenaDepth?.air)g.ArenaDepth.air(ctx,pt,lift,painter,12);
 else painter(ctx);
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

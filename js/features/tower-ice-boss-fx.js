/* Ice Tower page atmosphere: translucent crystalline borders and frost bloom.
 * Pure Canvas 2D presentation, pointer-safe and reduced-motion friendly.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const seed=i=>{const v=Math.sin(i*127.1+78.233)*43758.5453;return v-Math.floor(v);};
function page(c,event,t,w,h,reduced=false){
 if(event?.realm!=='ice')return;
 const p=cap(Number(event.progress)||0,0,1),fade=cap(Math.min(p*7,(1-p)*8),0,1);
 const alpha=fade*(reduced?.19:.57),size=Math.min(w,h),phase=reduced?0:t-(event.start||0);
 const cx=w*.5,cy=h*.46;
 c.save();
 const glow=c.createRadialGradient(cx,cy,size*.14,cx,cy,Math.max(w,h)*.72);
 glow.addColorStop(0,'rgba(17,52,102,0)');
 glow.addColorStop(.48,'rgba(65,140,191,.025)');
 glow.addColorStop(1,'rgba(142,226,255,.32)');
 c.globalAlpha=alpha;c.fillStyle=glow;c.fillRect(0,0,w,h);
 // Filigree on edges keeps text/controls unobstructed.
 c.lineCap='round';c.lineJoin='round';
 for(let side=0;side<4;side++){
  const vertical=side<2,sgn=side%2?-1:1;
  const points=vertical?Math.ceil(h/100):Math.ceil(w/105);
  for(let i=0;i<points;i++){
   const anchor=vertical?i*h/points:i*w/points;
   const x=vertical?(sgn>0?0:w):anchor,y=vertical?anchor:(sgn>0?0:h);
   const dx=vertical?sgn*(22+(i%3)*10):Math.sin(i*7)*10;
   const dy=vertical?Math.cos(i*5)*12:sgn*(22+(i%3)*10);
   c.globalAlpha=alpha*(.21+.18*(i%3));c.strokeStyle=i%2?'#d4faff':'#8edcff';
   c.lineWidth=i%4===0?2.3:1.1;c.beginPath();c.moveTo(x,y);
   c.lineTo(x+dx,y+dy);
   c.lineTo(x+dx*1.35+(vertical?sgn*6:0),y+dy*1.35+(vertical?0:sgn*6));c.stroke();
  }
 }
 c.translate(cx,cy);
 for(let i=0;i<4;i++){
  c.save();c.rotate(i*.44+phase*(i%2?-.0005:.0007));
  c.globalAlpha=alpha*(.18+.055*i);c.strokeStyle=i%2?'#f5ffff':'#b5f0ff';
  c.lineWidth=i===0?2.2:1.1;
  c.beginPath();c.ellipse(0,0,size*(.28+i*.105),size*(.13+i*.075),i*.16,0,Math.PI*1.83);
  c.stroke();c.restore();
 }
 // A sparse frozen-mist field: deterministic, no large full-screen blur.
 if(!reduced)for(let i=0;i<(w<650?22:64);i++){
  const q=seed(i),rr=size*(.21+seed(i+42)*.33),angle=q*TAU+phase*.00032*(i%2?-1:1);
  const x=Math.cos(angle)*rr,y=Math.sin(angle)*rr;
  c.globalAlpha=alpha*(.14+.42*(.5+.5*Math.sin(phase*.017+i)));
  c.fillStyle=i%3?'#efffff':'#91e6ff';
  c.beginPath();c.arc(x,y,.7+q*2.1,0,TAU);c.fill();
 }
 // During absolute zero a brief expanding crystal halo spans the viewport.
 if(event.variant===1){
  const radius=size*(.19+Math.sin(p*Math.PI)*.37);
  c.globalAlpha=alpha*.28;c.strokeStyle='#e7ffff';c.lineWidth=2.2;
  c.beginPath();c.arc(0,0,radius,0,TAU);c.stroke();
 }
 c.restore();
}
g.ArenaIceBossFX=Object.freeze({page});
})(globalThis);

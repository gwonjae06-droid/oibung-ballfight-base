/* Forest Tower world-scale bloom: pure additive-style vector page atmosphere.
 * Interactive DOM stays clickable. No simulated hits from viewport strokes.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(v,l,h)=>Math.max(l,Math.min(h,v));
const seed=n=>{const x=Math.sin(n*127.1+78.233)*43758.5453;return x-Math.floor(x);};
function page(c,event,t,w,h,reduced=false){
 if(event?.realm!=='forest')return;
 const p=cap(event.progress||0,0,1),a=cap(Math.min(p*8,(1-p)*8),0,1);
 const alpha=a*(reduced?.18:.54),size=Math.min(w,h),time=reduced?0:t-(event.start||0);
 const cx=w*.5,cy=h*.46;
 c.save();
 const glow=c.createRadialGradient(cx,cy,size*.18,cx,cy,Math.max(w,h)*.69);
 glow.addColorStop(0,'rgba(23,64,39,0)');
 glow.addColorStop(.58,'rgba(38,100,43,.025)');
 glow.addColorStop(1,'rgba(84,149,57,.33)');
 c.globalAlpha=alpha;c.fillStyle=glow;c.fillRect(0,0,w,h);
 // Art-nouveau leaves and roots reach inwards only from page edges,
 // never obscuring central controls.
 for(let edge=0;edge<4;edge++){
  const vert=edge<2,sign=edge%2?-1:1,anchors=vert?6:9;
  for(let i=0;i<anchors;i++){
   const coord=(i+.4)*(vert?h:w)/anchors;
   const x=vert?(sign>0?0:w):coord,y=vert?coord:(sign>0?0:h);
   const dx=vert?sign*(35+i%3*11):Math.sin(i*2.4)*12;
   const dy=vert?Math.cos(i*2.7)*9:sign*(30+i%3*10);
   c.globalAlpha=alpha*(.18+.07*(i%4));c.strokeStyle=i%3?'#92d47b':'#c8efa4';
   c.lineWidth=i%4===0?3:1.7;c.beginPath();c.moveTo(x,y);
   c.quadraticCurveTo(x+dx*.64,y+dy*.31,x+dx,y+dy);c.stroke();
   const rotation=Math.atan2(dy,dx);
   c.save();c.translate(x+dx*.7,y+dy*.7);c.rotate(rotation);
   c.fillStyle=i%2?'#80bd6d':'#bce4a0';c.beginPath();
   c.ellipse(0,0,8,3.5,.5,0,TAU);c.fill();c.restore();
  }
 }
 // A restrained ring of foliage or poisonous spore clouds.
 c.translate(cx,cy);
 for(let i=0;i<4;i++){
  c.save();c.rotate(i*.54+(i%2?-1:1)*time*.0008);
  c.globalAlpha=alpha*(.12+.06*i);
  c.strokeStyle=event.variant===1?(i%2?'#c6b0ef':'#aece95'):'#b5e6a0';
  c.lineWidth=i===0?2.3:1.2;c.beginPath();
  c.ellipse(0,0,size*(.24+i*.1),size*(.16+i*.07),i*.18,0,Math.PI*1.8);
  c.stroke();c.restore();
 }
 if(!reduced)for(let i=0;i<(w<640?24:68);i++){
  const n=seed(i),ang=n*TAU+time*(.00035+seed(i+90)*.0007),rad=size*(.14+seed(i+211)*.42);
  const x=Math.cos(ang)*rad,y=Math.sin(ang)*rad;
  c.globalAlpha=alpha*(.15+.45*Math.abs(Math.sin(time*.013+i*.73)));
  c.fillStyle=event.variant===1&&i%3===0?'#e6c6ff':i%2?'#d3f4a9':'#9fda7e';
  c.beginPath();c.arc(x,y,.9+n*2.2,0,TAU);c.fill();
 }
 c.restore();
}
g.ArenaForestBossFX=Object.freeze({page});
})(globalThis);

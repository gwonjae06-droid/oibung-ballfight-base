/* Storm Tower viewport: pure pointer-safe cinematics, no gameplay mutations.
 * Layered cloud walls, charged lightning, rain and delicate luminous arcs.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(n,l,h)=>Math.max(l,Math.min(h,n));
const seed=i=>{const q=Math.sin(i*127.1+78.233)*43758.5453;return q-Math.floor(q);};
function page(c,event,t,w,h,reduced=false){
 if(event?.realm!=='storm')return;
 const p=cap(event.progress||0,0,1),alpha=cap(Math.min(p*8,(1-p)*8),0,1);
 const strength=alpha*(reduced?.17:.51),size=Math.min(w,h),phase=reduced?0:(t-(event.start||0));
 const cx=w*.5,cy=h*.48; c.save();
 const sky=c.createRadialGradient(cx,cy,size*.15,cx,cy,Math.max(w,h)*.75);
 sky.addColorStop(0,'rgba(8,20,45,0)');
 sky.addColorStop(.45,'rgba(30,58,96,.035)');
 sky.addColorStop(1,'rgba(40,79,124,.38)');
 c.globalAlpha=strength;c.fillStyle=sky;c.fillRect(0,0,w,h);
 // The vortex stays close to the screen perimeter and never masks gameplay.
 c.translate(cx,cy);
 for(let i=0;i<5;i++){
  c.save();c.rotate((i%2?-1:1)*phase*.0007+i*.35);
  c.globalAlpha=strength*(.18+i*.065);c.strokeStyle=i%2?'#b4d7ff':'#a1f2ff';
  c.lineWidth=i===0?3.1:1.15;
  c.beginPath();c.ellipse(0,0,size*(.27+i*.105),size*(.11+i*.068),
   i*.17,.13,Math.PI*1.87);c.stroke();c.restore();
 }
 // Sparse lightning forks are drawn as coherent connected paths, not sprites.
 if(event.variant===1||event.variant===2){
  const flashes=reduced?1:Math.floor(phase/28)%5===0?3:1;
  for(let k=0;k<flashes;k++){
   const q=seed(k+Math.floor(phase/28)),x=(q-.5)*w*.76;
   c.save();c.globalAlpha=strength*(k? .12:.31);c.strokeStyle=k?'#80d9ff':'#e0faff';
   c.lineWidth=k===0?2.3:1;
   c.beginPath();c.moveTo(x,-h*.51);
   let lastX=x;
   for(let j=1;j<=9;j++){
    lastX+=Math.sin((j+k*17+Math.floor(phase/28))*2.31)*15;
    c.lineTo(lastX,-h*.51+j*h*.056);
   }
   c.stroke();c.restore();
  }
 }
 // Bounded rain/spray for mobile; respect reduced-motion preferences.
 if(!reduced)for(let i=0;i<(w<650?34:95);i++){
  const q=seed(i),x=((i*53.7+phase*(.9+q*1.5))%(w+90))-w*.5-45;
  const y=((i*109+phase*(2.2+q*1.2))%(h+50))-h*.5-25;
  c.globalAlpha=strength*(.18+q*.31);c.strokeStyle=i%4?'#c4eaff':'#f6ffff';
  c.lineWidth=.85+q*.6;c.beginPath();c.moveTo(x,y);c.lineTo(x+10+q*7,y-14-q*12);c.stroke();
 }
 c.restore();
}
g.ArenaStormBossFX=Object.freeze({page});
})(globalThis);

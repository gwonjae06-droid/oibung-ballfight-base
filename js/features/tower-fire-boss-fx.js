/* Fire tower page layer: vector-only embers, molten cracks and pressure rings.
 * No DOM transforms, hit boxes, state clocks or screen-blocking composites.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(n,l,h)=>Math.max(l,Math.min(h,n));
const seed=n=>{const q=Math.sin(n*127.1+78.233)*43758.5453;return q-Math.floor(q);};
function page(c,event,t,w,h,reduced=false){
 if(event?.realm!=='fire')return;
 const progress=cap(event.progress||0,0,1),alpha=cap(Math.min(progress*8,(1-progress)*8),0,1);
 const strength=alpha*(reduced?.22:.62),size=Math.min(w,h),phase=reduced?0:(t-(event.start||0));
 const cx=w*.5,cy=h*.47;
 c.save();
 // Page edges heat up first. Gameplay and controls remain readable.
 const haze=c.createRadialGradient(cx,cy,size*.18,cx,cy,Math.max(w,h)*.75);
 haze.addColorStop(0,'rgba(46,13,15,0)');
 haze.addColorStop(.67,'rgba(133,37,24,.018)');
 haze.addColorStop(1,'rgba(255,73,18,.34)');
 c.fillStyle=haze;c.globalAlpha=strength;c.fillRect(0,0,w,h);
 // Molten fissures grow inward from corners, never through buttons.
 c.globalAlpha=strength*.55;c.lineCap='round';c.lineJoin='round';
 for(let corner=0;corner<4;corner++){
  const side=corner%2?1:0,top=corner<2?1:0;
  const x=side?w:0,y=top?0:h,dx=side?-1:1,dy=top?1:-1;
  for(let j=0;j<3;j++){
   const base=(j+1)*.09,spread=(.6+base)*size;
   c.strokeStyle=j%2?'#ffb365':'#ff5529';c.lineWidth=(j===0?3.8:1.5);
   c.beginPath();c.moveTo(x,y+dy*j*26);
   c.bezierCurveTo(x+dx*spread*.17,y+dy*size*.06,
    x+dx*spread*.25,y+dy*size*(.15+.02*Math.sin(phase*.012+j)),
    x+dx*spread*.65,y+dy*size*.21);
   c.stroke();
  }
 }
 // Spark particles are deterministic and bounded on mobile.
 if(!reduced)for(let i=0;i<(w<640?25:68);i++){
  const q=seed(i),x=(i*97.23+Math.sin(phase*.022+i)*27+w)%w;
  const y=(h-(phase*(.38+q*.98)+i*53)%(h+60)+h+60)%(h+60)-30;
  c.globalAlpha=strength*(.23+.58*(.5+.5*Math.sin(phase*.035+i)));
  c.fillStyle=i%3?'#ff9c4a':'#fff2ba';
  c.beginPath();c.ellipse(x,y,1+q*1.6,2+q*3.7,-.2,0,TAU);c.fill();
 }
 if(event.variant===1||event.variant===2){
  // Atmospheric pressure rings synchronize to the declared boss variant.
  c.translate(cx,cy);
  for(let i=0;i<4;i++){
   c.save();c.rotate(phase*.0008*(i%2?-1:1)+i*.64);
   c.globalAlpha=strength*(.19+i*.045);c.strokeStyle=i%2?'#ffbe76':'#ff5b32';
   c.lineWidth=i===0?3:1.3;
   c.beginPath();c.ellipse(0,0,size*(.22+i*.11),size*(.12+i*.06),i*.15,0,Math.PI*1.83);c.stroke();
   c.restore();
  }
 }
 c.restore();
}
g.ArenaFireBossFX=Object.freeze({page});
})(globalThis);

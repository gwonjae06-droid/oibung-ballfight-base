/* Cinematic Time Tower viewport atmosphere. Visual-only, pointer-safe, low-cost.
 * Refined vector gradients and coherent rings; no opaque PNG composites.
 */
(function(g){'use strict';
const TAU=Math.PI*2;
function page(c,event,t,w,h,reduced=false){
 if(!event||event.realm!=='time')return;
 const p=Math.max(0,Math.min(1,event.progress||0));
 const a=Math.min(1,p*7,(1-p)*8);
 const size=Math.min(w,h),cx=w*.5,cy=h*.43;
 const slow=event.variant===2,rewind=event.variant===1;
 c.save();
 // Edge vignette stays away from the battle HUD and interactive controls.
 const vignette=c.createRadialGradient(cx,cy,size*.16,cx,cy,size*.78);
 vignette.addColorStop(0,'rgba(9,17,37,0)');
 vignette.addColorStop(.55,rewind?'rgba(70,64,133,.035)':'rgba(143,110,58,.025)');
 vignette.addColorStop(1,rewind?'rgba(58,46,109,.25)':'rgba(141,100,43,.22)');
 c.fillStyle=vignette;c.globalAlpha=a*.75;c.fillRect(0,0,w,h);
 const tick=Math.max(0,t-(event.start||0));
 // Perimeter fine arcs: elegant, not visually dense across the center field.
 c.translate(cx,cy);
 for(let k=0;k<3;k++){
  const r=size*(.42+k*.07);
  c.strokeStyle=rewind?'rgba(181,168,255,.26)':slow?'rgba(182,232,255,.30)':'rgba(255,216,142,.27)';
  c.lineWidth=k===0?2:1;
  c.globalAlpha=a*(k===0?.8:.45);
  c.beginPath();c.arc(0,0,r,(reduced?0:tick*.0018)+(k*.44),
    (reduced?0:tick*.0018)+Math.PI*1.15+k*.44);c.stroke();
 }
 c.globalAlpha=a*.4;c.strokeStyle='#e7c88f';c.lineWidth=1;
 for(let i=0;i<12;i++){
  const ang=i*TAU/12+(rewind?(reduced?0:-tick*.0007):0),r=size*.47;
  const x=Math.cos(ang)*r,y=Math.sin(ang)*r;
  c.beginPath();c.moveTo(x,y);c.lineTo(x*.96,y*.96);c.stroke();
 }
 if(rewind){
  c.globalAlpha=a*.35;c.strokeStyle='#c8bbff';
  c.lineWidth=1.5;
  for(let i=0;i<3;i++){
   c.save();c.rotate((reduced?0:-tick*.0025)-i*.21);
   c.beginPath();c.ellipse(0,0,size*(.28+i*.055),size*.16,Math.PI*.23,0,TAU);
   c.stroke();c.restore();
  }
 }
 if(slow){
  c.globalAlpha=a*.28;c.strokeStyle='#b6e8ff';c.lineWidth=1;
  c.beginPath();c.arc(0,0,size*.21,0,TAU);c.stroke();
  if(!reduced){
   const pos=tick*.015;const ang=pos%TAU;
   c.globalAlpha=a*.38;c.beginPath();c.arc(0,0,size*.21,ang,ang+.4);c.lineWidth=3;c.stroke();
  }
 }
 c.restore();
}
g.ArenaTimeBossFX=Object.freeze({page});
})(globalThis);

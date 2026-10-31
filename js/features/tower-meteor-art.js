/* Extinction meteor: one immense world-scale body descends across the entire
 * browser viewport. Visual-only. Simulation clock and boss HP own the outcome. */
(function(g){'use strict';
const T=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function rock(c,r,t){
 // Silhouette uses deterministic jagged edges, not a smooth ball.
 c.beginPath();
 for(let i=0;i<=64;i++){
  const a=i*T/64,noise=1+.039*Math.sin(i*2.7)+.025*Math.sin(i*6.4);
  const x=Math.cos(a)*r*noise,y=Math.sin(a)*r*noise;
  i?c.lineTo(x,y):c.moveTo(x,y);
 }
 c.closePath();
 const fill=c.createRadialGradient(-r*.35,-r*.42,r*.02,0,0,r*1.1);
 fill.addColorStop(0,'#8c6250');fill.addColorStop(.29,'#543a36');
 fill.addColorStop(.69,'#251d27');fill.addColorStop(1,'#110f1d');
 c.fillStyle=fill;c.fill();c.strokeStyle='#ff7b35';c.lineWidth=Math.max(3,r*.013);c.stroke();
 // Lava plates and fissures are anchored to the rock, moving with it.
 c.lineCap='round';c.lineJoin='round';
 for(let i=0;i<16;i++){
  const angle=i*2.399963+t*.0004,r0=r*(.12+(i%4)*.13),
   x=Math.cos(angle)*r0,y=Math.sin(angle)*r0;
  c.beginPath();c.moveTo(x-r*.09,y-r*.065);
  c.lineTo(x,y);c.lineTo(x+r*.055,y-r*.014);
  c.lineTo(x+r*.095,y+r*.058);
  c.strokeStyle=i%3?'#dc5429':'#ffd58d';c.lineWidth=Math.max(1.4,r*(i%3?.006:.010));c.stroke();
  c.beginPath();c.arc(x+r*.07,y-r*.07,r*(.013+(i%3)*.006),0,T);
  c.fillStyle=i%3?'#b43c25':'#ffc267';c.fill();
 }
 for(let i=0;i<10;i++){
  const a=i*T/10+t*.0006,rr=r*(.75+.05*(i%3));
  c.beginPath();c.arc(Math.cos(a)*rr,Math.sin(a)*rr,r*(.05+.015*(i%3)),0,T);
  c.strokeStyle='#f07835';c.lineWidth=Math.max(2,r*.004);c.stroke();
 }
}
function draw(c,event,t,w,h,reduced=false){
 if(event?.realm!=='fire'||!event.deadline)return;
 const progress=clamp(Number(event.progress)||0,0,1),eased=Math.pow(progress,2.35);
 const radius=Math.max(250,w*.46,h*.77);
 const size=radius*(.72+.28*eased),centerX=w*.5,
  centerY=-radius*1.03+(h*.51+radius*1.03)*eased;
 c.save();
 if(!event.exploded){
  // Entire giant moon remains on-screen until the timer reaches zero.
  c.translate(centerX,centerY);
  if(!reduced){
   const halo=c.createRadialGradient(0,0,size*.45,0,0,size*1.36);
   halo.addColorStop(0,'#ff6a322a');halo.addColorStop(.73,'#ff772c55');halo.addColorStop(1,'#ff552000');
   c.fillStyle=halo;c.beginPath();c.arc(0,0,size*1.36,0,T);c.fill();
   for(let i=0;i<18;i++){const angle=i*T/18+t*.001,rr=size*(1.12+(i%4)*.06);
    c.strokeStyle=i%2?'#fa6a32':'#ffb15e';c.lineWidth=Math.max(2,size*.014);
    c.beginPath();c.moveTo(Math.cos(angle)*size*.85,Math.sin(angle)*size*.85);
    c.lineTo(Math.cos(angle)*rr,Math.sin(angle)*rr);c.stroke();
   }
  }
  rock(c,size,t);
  // The body grows hotter only as the timer nears zero.
  c.globalAlpha=progress*.48;c.fillStyle='#ff1e0b';c.beginPath();c.arc(0,0,size,0,T);c.fill();c.globalAlpha=1;
 }else{
  // Impact fills the PAGE, not only the small in-game canvas.
  const blast=clamp((t-event.deadline)/(event.impactTick-event.deadline),0,1);
  c.fillStyle=reduced?'#903f2755':'#ff9b42bb';
  c.fillRect(0,0,w,h);
  c.globalAlpha=reduced?.20:1-blast*.4;
  const shock=c.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,Math.hypot(w,h)*blast);
  shock.addColorStop(0,'#ffefbd');shock.addColorStop(.45,'#ff9c3c');shock.addColorStop(1,'#dc352b00');
  c.fillStyle=shock;c.fillRect(0,0,w,h);
  c.globalAlpha=1;
 }
 c.restore();
 if(!event.failed&&progress>.22){c.save();c.globalAlpha=(progress-.22)*.33;
  c.fillStyle='#f31e0b';c.fillRect(0,0,w,h);c.restore();}
 // Countdown remains legible and centered on the viewport even on mobile.
 c.save();
 const bar=Math.min(480,w-28),x=(w-bar)/2,y=24;
 c.fillStyle='rgba(18,12,18,.88)';c.fillRect(x-6,y-6,bar+12,51);
 c.fillStyle='#ffdc95';c.font='bold '+(w<480?13:16)+'px system-ui';
 c.textAlign='center';c.textBaseline='middle';
 c.fillText(event.failed?'종말의 폭발 · 전멸 확정':'화염탑 보스를 쓰러뜨리세요!',w/2,y+10);
 c.fillStyle='#482a2b';c.fillRect(x,y+32,bar,6);
 c.fillStyle=event.failed?'#fff0ca':'#ff762e';
 c.fillRect(x,y+32,bar*(event.failed?1:1-progress),6);
 c.fillStyle='#fff0cb';c.textAlign='right';c.font='bold 12px system-ui';
 c.fillText(event.failed?'폭발':Math.ceil(event.remaining)+'초',x+bar-4,y+10);
 c.restore();
}
g.ArenaTowerMeteorArt=Object.freeze({draw});
})(globalThis);

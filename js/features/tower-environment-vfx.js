/* Pure canvas visual system for the six Tower environmental mechanics.
 * Every visual is driven by a pre-existing visible zone; no gameplay damage
 * or extra RNG. Bounded loops keep 100x simulation visually lightweight. */
(function(g){
'use strict';
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const palette={
 time:['#ffe7a1','#f8bd46','#7d5835'],
 space:['#ebd2ff','#9c79ff','#3d3582'],
 fire:['#ffed9a','#ff721f','#9c2619'],
 storm:['#e6ffff','#40dff9','#2675cd'],
 ice:['#ffffff','#91e9ff','#3997c7'],
 forest:['#d3ff9b','#83db67','#316e4e']
};
const rnd=(n)=>{const x=Math.sin(n*127.13+1.97)*43758.5453;return x-Math.floor(x);};
function path(c,pts,color,width=2){
 c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
 for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.stroke();
}
function ring(c,r,color,w=2){c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();}
function polygon(c,points,fill,stroke){
 c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
 c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}
}
function glow(c,col,blur=12){c.shadowColor=col;c.shadowBlur=blur;}
function clock(c,z,t,live,P){
 const r=clamp(z.r||z.width*.65||85,44,125),cx=0;
 c.save();c.scale(1,.74);
 ring(c,r*.86,P[1],3);ring(c,r*.70,P[0],1.5);
 for(let i=0;i<60;i++){
   const a=i*TAU/60-Math.PI/2,from=i%5===0?.70:.77,to=.85;
   path(c,[[Math.cos(a)*r*from,Math.sin(a)*r*from],[Math.cos(a)*r*to,Math.sin(a)*r*to]],P[i%5===0?0:1],i%5===0?2.6:.8);
 }
 for(let i=0;i<8;i++){
   const a=i*TAU/8+t*.012*(i%2?1:-1);
   c.beginPath();c.arc(Math.cos(a)*r*.94,Math.sin(a)*r*.94,r*.055,0,TAU);c.fillStyle=P[1];c.fill();
 }
 const dir=z.mode==='reverse'?-1:1;
 const sec=(z.mode==='slow'?.012:.095)*t*dir,minute=(z.mode==='slow'?.002:.017)*t*dir;
 c.shadowBlur=0;
 path(c,[[0,0],[Math.cos(sec)*r*.79,Math.sin(sec)*r*.79]],P[0],4);
 path(c,[[0,0],[Math.cos(minute)*r*.52,Math.sin(minute)*r*.52]],P[1],6);
 c.beginPath();c.arc(0,0,5,0,TAU);c.fillStyle='#fff7d5';c.fill();
 if(live){ring(c,r*(.91+Math.sin(t*.16)*.035),P[0],2);}
 c.restore();
}
function cosmos(c,z,t,live,P){
 const r=clamp(z.r||90,45,125);
 c.save();c.scale(1,.75);c.rotate(t*(z.mode==='antigravity'?-.018:z.mode==='debris'?.045:.021));
 for(let i=0;i<3;i++){
   c.save();c.rotate(i*TAU/3);
   c.beginPath();c.ellipse(0,0,r*(.73+i*.08),r*(.28+i*.025),.4,0,TAU);
   c.strokeStyle=i===0?P[0]:P[1];c.lineWidth=2.3;c.stroke();c.restore();
 }
 for(let i=0;i<18;i++){
   const a=i*2.399+t*(live?.045:.009)*(z.mode==='gravity'?-1:1);
   const radius=r*(.14+.73*rnd(i*13));
   const x=Math.cos(a)*radius,y=Math.sin(a)*radius*.6;
   c.beginPath();c.arc(x,y,i%4===0?2.5:1.2,0,TAU);
   c.fillStyle=i%3===0?'#fff':P[0];c.fill();
 }
 glow(c,P[1],14);ring(c,r*.18,P[0],5);c.shadowBlur=0;c.restore();
}
function fire(c,z,t,live,P){
 const r=clamp(z.r||z.width*.85||64,35,115),burst=live?Math.min(1,(t-z.fire)/13):.12;
 c.save();c.scale(1,.74);
 for(let i=0;i<9;i++){
  const a=i*TAU/9;
  path(c,[[Math.cos(a)*r*.23,Math.sin(a)*r*.23],[Math.cos(a+.09)*r*.58,Math.sin(a+.09)*r*.58],[Math.cos(a)*r*.93,Math.sin(a)*r*.93]],i%2?P[1]:P[2],2.3);
 }
 ring(c,r*.38+Math.sin(t*.12)*4,P[1],3);c.restore();
 // Vertical lava columns and incandescent fragments, not mere floor marks.
 if(live){
   for(let i=0;i<(z.mode==='slag'?11:7);i++){
    const x=(i-(z.mode==='slag'?5:3))*r*.24+Math.sin(t*.07+i)*5;
    const h=burst*(30+r*.47)*(1+Math.sin(t*.11+i*1.8)*.19);
    polygon(c,[[x-9,0],[x-7,-h*.7],[x,-h-8],[x+8,-h*.58],[x+11,0]],
      i%3===0?'#ffe18a':i%2?'#ef4d1c':'#ff8a20',P[1]);
   }
   for(let i=0;i<18;i++){
    const x=(rnd(i*4)-.5)*r*1.7,
      y=-8-rnd(i*9)*(20+burst*75)-((t* (1+i%3)*.8+i*21)%25);
    c.beginPath();c.arc(x,y,1.3+(i%3),0,TAU);c.fillStyle=i%2?P[0]:P[1];c.fill();
   }
   ring(c,r*(.45+.23*Math.sin(t*.12)),P[0],3);
 }
}
function thunder(c,z,t,live,P){
 const r=clamp(z.r||z.width*.75||70,35,115);
 if(z.mode==='wind'){
  for(let j=0;j<8;j++){
    const y=(j-3.5)*13,dx=((t*2.3+j*37)%120)-60;
    c.beginPath();c.moveTo(dx-52,y);c.bezierCurveTo(dx-20,y-12,dx+14,y+10,dx+43,y-3);
    c.strokeStyle=j%2?P[0]:P[1];c.lineWidth=j%3?2.2:3.4;c.stroke();
  }
  return;
 }
 c.save();c.scale(1,.78);
 for(let j=0;j<9;j++){
  const a=j*TAU/9;
  path(c,[[Math.cos(a)*r*.2,Math.sin(a)*r*.2],[Math.cos(a)*r*.92,Math.sin(a)*r*.92]],P[1],2);
 }
 c.restore();
 if(live){
   const age=t-z.fire;glow(c,P[0],14);
   for(let k=0;k<(z.mode==='chainlightning'?8:5);k++){
     const offset=(k-2)*r*.22,pts=[[offset-12,-110]];
     for(let j=1;j<=6;j++){
       const py=-110+j*19,
             px=offset+((rnd(k*19+j*11+Math.floor(age/3))-.5)*22);
       pts.push([px,py]);
     }
     path(c,pts,k%2?P[1]:P[0],k===2?5:2.3);
   }
   c.shadowBlur=0;
   for(let i=0;i<12;i++){
    const a=i*TAU/12+t*.06,d=r*(.2+.6*rnd(i*21));
    path(c,[[Math.cos(a)*d,Math.sin(a)*d],[Math.cos(a+.4)*(d+14),Math.sin(a+.4)*(d+14)]],P[0],1.6);
   }
 }
}
function frost(c,z,t,live,P){
 const r=clamp(z.r||75,36,120);
 c.save();c.scale(1,.75);
 for(let i=0;i<12;i++){
  const a=i*TAU/12;
  path(c,[[0,0],[Math.cos(a)*r*.9,Math.sin(a)*r*.9]],P[i%2?1:0],1.8);
  for(const f of [.5,.7])for(const s of [-1,1]){
   const q=f*r;
   path(c,[[Math.cos(a)*q,Math.sin(a)*q],[Math.cos(a+s*.27)*(q-r*.13),Math.sin(a+s*.27)*(q-r*.13)]],P[0],1.3);
  }
 }
 ring(c,r*.78,P[1],2);c.restore();
 if(live&&(z.mode==='frost'||z.mode==='shatter')){
  const burst=Math.min(1,(t-z.fire)/20);
  for(let i=0;i<9;i++){
   const a=i*TAU/9,base=Math.cos(a)*r*.70,h=(23+i%3*17)*burst;
   polygon(c,[[base-8,0],[base-5,-h*.65],[base,-h],[base+7,-h*.5],[base+10,0]],'#a2eaff88',P[0]);
  }
 }
 for(let i=0;i<14;i++){
  const x=(rnd(i*7)-.5)*r*1.8,y=(rnd(i*19)-.5)*r*1.3-(live?t*.2%17:0);
  c.beginPath();c.arc(x,y,1+(i%3)*.5,0,TAU);c.fillStyle=P[0];c.fill();
 }
}
function forest(c,z,t,live,P){
 const r=clamp(z.r||z.width*.55||70,32,120);
 c.save();c.scale(1,.78);
 for(let i=0;i<8;i++){
  const a=i*TAU/8+t*.001,from=r*.18,to=r*.84;
  c.beginPath();c.moveTo(Math.cos(a)*from,Math.sin(a)*from);
  c.bezierCurveTo(Math.cos(a+.4)*r*.4,Math.sin(a+.4)*r*.4,
     Math.cos(a-.24)*r*.6,Math.sin(a-.24)*r*.6,
     Math.cos(a)*to,Math.sin(a)*to);
  c.strokeStyle=i%2?P[2]:P[1];c.lineWidth=live?5:2.5;c.stroke();
  if(live){
   c.save();c.translate(Math.cos(a)*r*.65,Math.sin(a)*r*.65);c.rotate(a);
   polygon(c,[[0,0],[13,-9],[21,0],[13,8]],P[1],P[0]);c.restore();
  }
 }
 c.restore();
 if(z.mode==='sapling'&&live){
  const grow=Math.min(1,(t-z.fire)/26);
  path(c,[[0,0],[4,-25*grow],[-7,-55*grow],[2,-77*grow]],P[2],7);
  for(let i=0;i<5;i++){
   const a=i*TAU/5+t*.009;
   c.beginPath();c.ellipse(Math.cos(a)*14,-66*grow+Math.sin(a)*9,13*grow,7*grow,a,0,TAU);
   c.fillStyle=i%2?P[1]:P[0];c.fill();
  }
 }
 if(z.mode==='spores'||z.mode==='sapling'){
  for(let i=0;i<22;i++){
    const a=rnd(i*7)*TAU,radius=r*rnd(i*17),
          x=Math.cos(a)*radius,y=Math.sin(a)*radius*.7-(live?(t*(.2+i%3*.13)+i*11)%33:0);
    c.beginPath();c.arc(x,y,1.7+i%3,0,TAU);
    c.fillStyle=i%3===0?'#e8fd9b':P[1];c.fill();
  }
 }
}
function draw(c,z,t,level=1){
 const P=palette[z.realm];if(!c||!P)return false;
 const live=t>=z.fire&&t<z.end,soon=clamp(1-(z.fire-t)/Math.max(1,z.fire-z.born),0,1);
 c.save();c.globalAlpha=live?.92:.35+.55*soon;
 // One modest glow per zone (not per particle) keeps mobile paint affordable.
 if(live)glow(c,P[1],level%5===0?14:8);
 if(z.realm==='time')clock(c,z,t,live,P);
 else if(z.realm==='space')cosmos(c,z,t,live,P);
 else if(z.realm==='fire')fire(c,z,t,live,P);
 else if(z.realm==='storm')thunder(c,z,t,live,P);
 else if(z.realm==='ice')frost(c,z,t,live,P);
 else forest(c,z,t,live,P);
 c.restore();return true;
}
g.ArenaTowerEnvironmentVFX=Object.freeze({draw});
})(globalThis);

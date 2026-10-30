/* Realm-specific cached Canvas decorations, with no external art or per-frame allocations. */
(function(g){
'use strict';
const themes={time:['#48371d','#bf9b51'],space:['#241d49','#9270c7'],fire:['#481c12','#d16a36'],
 storm:['#132b43','#59b3c9'],ice:['#173b55','#9bdff1'],forest:['#213e27','#80b267']};
const cache=new Map();
function randomFrom(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function raw(ctx,w,h,id,level){
 const [dark,light]=themes[id]||themes.time;const rand=randomFrom(level*411+id.length*929),cx=w/2,cy=h/2;
 ctx.save();const fill=ctx.createRadialGradient(cx,cy,10,cx,cy,Math.max(w,h)*.76);
 fill.addColorStop(0,light+'06');fill.addColorStop(.63,light+'13');fill.addColorStop(1,dark+'9c');
 ctx.fillStyle=fill;ctx.fillRect(0,0,w,h);
 ctx.lineWidth=Math.max(1,w/500);ctx.strokeStyle=light+'77';
 if(id==='time'){
   for(const r of [w*.2,w*.35,w*.45]){
     ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
     for(let j=0;j<12;j++){const a=j*Math.PI/6;
       ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.92,cy+Math.sin(a)*r*.92);
       ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();}
   }
   for(let i=0;i<3;i++){const a=(level+i*4)*Math.PI/12;ctx.beginPath();ctx.moveTo(cx,cy);
     ctx.lineTo(cx+Math.cos(a)*w*.42,cy+Math.sin(a)*h*.42);ctx.stroke();}
 }else if(id==='space'){
   for(let i=0;i<75;i++){ctx.fillStyle=i%4?'#e9dbff88':'#ffffffbb';ctx.beginPath();
     ctx.arc(rand()*w,rand()*h,.5+rand()*1.9,0,Math.PI*2);ctx.fill();}
   ctx.beginPath();ctx.ellipse(cx,cy,w*.4,h*.18,-.5,0,Math.PI*2);ctx.stroke();
   ctx.beginPath();ctx.ellipse(cx,cy,w*.3,h*.37,.7,0,Math.PI*2);ctx.stroke();
 }else if(id==='fire'){
   for(let i=0;i<15;i++){let x=rand()*w,y=rand()*h;ctx.beginPath();ctx.moveTo(x,y);
     for(let j=0;j<5;j++){x+=(rand()-.5)*w/13;y+=(rand()-.5)*h/13;ctx.lineTo(x,y);}
     ctx.strokeStyle='#ff813e99';ctx.lineWidth=1.5+rand()*2;ctx.stroke();}
   const heat=ctx.createLinearGradient(0,0,0,h);heat.addColorStop(0,'#ff552000');heat.addColorStop(1,'#ff552044');
   ctx.fillStyle=heat;ctx.fillRect(0,0,w,h);
 }else if(id==='storm'){
   for(let i=0;i<23;i++){const x=rand()*w,y=rand()*h;ctx.beginPath();
     ctx.moveTo(x,y);ctx.lineTo(x+w*.15,y-h*.09);ctx.strokeStyle=i%4?'#73d4f14b':'#bdf7ff9c';ctx.stroke();}
   ctx.beginPath();ctx.moveTo(w*.06,h*.73);ctx.lineTo(w*.37,h*.13);
   ctx.lineTo(w*.52,h*.47);ctx.lineTo(w*.89,h*.08);ctx.strokeStyle='#91dff27c';ctx.lineWidth=3;ctx.stroke();
 }else if(id==='ice'){
   for(let i=0;i<22;i++){const x=rand()*w,y=rand()*h,r=11+rand()*35;
     ctx.beginPath();for(let j=0;j<6;j++){const a=j*Math.PI/3;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}
     ctx.closePath();ctx.fillStyle='#c4f8ff10';ctx.fill();ctx.strokeStyle='#a2e7fa46';ctx.stroke();}
 }else if(id==='forest'){
   for(let i=0;i<22;i++){ctx.beginPath();ctx.arc(rand()*w,rand()*h,12+rand()*28,0,Math.PI*2);
     ctx.fillStyle='#9bdc651a';ctx.fill();}
   for(let i=0;i<8;i++){const x=rand()*w;ctx.beginPath();ctx.moveTo(x,-8);
     ctx.bezierCurveTo(x-w*.12,h*.3,x+w*.17,h*.6,x+w*.06,h+8);ctx.strokeStyle='#9bcf796e';ctx.lineWidth=3;ctx.stroke();}
 }
 ctx.restore();
}
function paint(ctx,w,h,id,level=1){
 if(!ctx||w<=0||h<=0)return false;
 const key=id+':'+level+':'+w+':'+h;let pict=cache.get(key);
 if(!pict&&g.document?.createElement){
   try{const cv=g.document.createElement('canvas');cv.width=w;cv.height=h;
     const c=cv.getContext('2d');if(c){raw(c,w,h,id,level);pict=cv;
       if(cache.size>=8)cache.clear();cache.set(key,cv);}}catch(_){}
 }
 if(pict)ctx.drawImage(pict,0,0,w,h);else raw(ctx,w,h,id,level);
 return true;
}
function particles(ctx,w,h,id,frame){
 if(!ctx||!themes[id])return;
 const t=(Number(frame)||0)/60;const color=themes[id][1];
 ctx.save();for(let i=0;i<9;i++){
   const x=((i*137+Math.sin(t*.35+i)*38)%w+w)%w,y=((i*73+(t*(id==='fire'?-9:5))*(i%3+1))%h+h)%h;
   const a=.1+.08*Math.sin(t*.8+i);
   ctx.globalAlpha=Math.max(0,a);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,i%3+1.3,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
g.ArenaTowerAtmosphere={paint,particles};
})(globalThis);

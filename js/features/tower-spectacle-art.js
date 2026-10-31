/* Semantic animation on the exact collision footprint, with upright spell bodies. */
(function(g){'use strict';const T=Math.PI*2;
function zone(c,z,realm,t){
 const live=t>=z.fire,age=t-z.born,charge=Math.min(1,age/Math.max(1,z.fire-z.born));
 const radius=z.shape==='line'?z.width/2:z.r;
 c.save();c.translate(z.x,z.y);if(z.shape==='line')c.rotate(z.angle);
 const extent=z.shape==='line'?Math.min(z.length/2,300):Math.min(radius,260);
 c.globalAlpha=live?.9:.3+charge*.25;c.lineWidth=2;
 if(realm==='time'){
  if(z.shape==='line'){c.fillStyle='#d4a342';c.strokeStyle='#fff0ba';c.beginPath();c.moveTo(-extent,0);c.lineTo(-extent+20,-z.width*.35);c.lineTo(extent-16,-z.width*.35);c.lineTo(extent+2,0);c.lineTo(extent-16,z.width*.35);c.lineTo(-extent+20,z.width*.35);c.closePath();c.fill();c.stroke();c.beginPath();c.arc(0,0,11,0,T);c.fillStyle='#fff2c9';c.fill();}
  else for(let i=0;i<12;i++){const a=i*T/12-t*.006;c.strokeStyle='#f6d689';c.beginPath();c.moveTo(Math.cos(a)*radius*.8,Math.sin(a)*radius*.8);c.lineTo(Math.cos(a)*radius,Math.sin(a)*radius);c.stroke();}
 }else if(realm==='space'){
  c.strokeStyle='#d4a2ff';
  if(z.pull){c.fillStyle='#04020b';c.beginPath();c.arc(0,0,radius*.85,0,T);c.fill();for(let k=0;k<5;k++){c.beginPath();c.ellipse(0,0,radius*(1+k*.12),radius*.4,t*.012+k*.1,0,T);c.stroke();}}
  for(let i=0;i<70;i++){const a=i*2.399+t*.004,r=z.shape==='ring'?z.inner+(z.r-z.inner)*(i%11)/11:extent*Math.sqrt((i+1)/70),x=z.shape==='line'?-extent+2*extent*i/70:Math.cos(a)*r,y=z.shape==='line'?Math.sin(i*1.7+t*.04)*z.width*.4:Math.sin(a)*r;c.fillStyle=i%3?'#d9c4ff':'#fff3ba';c.beginPath();c.arc(x,y,1+i%3,0,T);c.fill();}
 }else if(realm==='fire'){
  if(z.shape==='circle'&&z.tornado===undefined){c.fillStyle='#43262c';c.strokeStyle='#e85e33';c.beginPath();c.moveTo(-radius,0);c.lineTo(-radius*.28,-radius*.8*charge);c.lineTo(radius*.28,-radius*.8*charge);c.lineTo(radius,0);c.closePath();c.fill();c.stroke();}
  for(let i=0;i<22;i++){const a=i*2.4+t*.035,rad=z.shape==='ring'?z.inner+(z.r-z.inner)*.5:radius*.7,x=z.shape==='line'?-extent+2*extent*i/22:Math.cos(a)*rad,y=z.shape==='line'?0:Math.sin(a)*rad;const rise=live?15+((t*2+i*13)%65):charge*18;c.fillStyle=i%2?'#ffb83f':'#ff592e';c.beginPath();c.moveTo(x-5,y);c.quadraticCurveTo(x+Math.sin(t*.1+i)*14,y-rise*.6,x,y-rise);c.quadraticCurveTo(x+8,y-rise*.3,x+5,y);c.fill();}
 }else if(realm==='storm'){
  c.strokeStyle='#b5edff';
  if(z.shape==='ring'){for(let j=0;j<16;j++){c.beginPath();c.ellipse(0,-j*3,z.inner+(z.r-z.inner)*j/16,(z.inner+(z.r-z.inner)*j/16)*.75,t*.012,0,T*.8);c.stroke();}}
  else for(let i=0;i<5;i++){const x=z.shape==='line'?-extent+2*extent*i/4:Math.cos(i*T/5)*radius*.5;c.beginPath();c.moveTo(x,-90*charge);for(let j=1;j<7;j++)c.lineTo(x+Math.sin(i*7+j*3+Math.floor(t/5))*12,-90*charge+j*15*charge);c.lineWidth=live?3:1;c.stroke();}
 }else if(realm==='ice'){
  for(let i=0;i<10;i++){const a=i*T/10,x=z.shape==='line'?-extent+2*extent*i/9:Math.cos(a)*(z.inner||radius*.6),y=z.shape==='line'?0:Math.sin(a)*(z.inner||radius*.6),rise=(live?48:20*charge)+(i%3)*8;c.fillStyle=i%2?'#74c6e1':'#d0f8ff';c.strokeStyle='#f4ffff';c.beginPath();c.moveTo(x-7,y);c.lineTo(x-4,y-rise*.7);c.lineTo(x,y-rise);c.lineTo(x+8,y-rise*.5);c.lineTo(x+7,y);c.closePath();c.fill();c.stroke();}
 }else if(realm==='forest'){
  for(let i=0;i<8;i++){const a=i*T/8,x=z.shape==='line'?-extent+2*extent*i/7:Math.cos(a)*radius*.7,y=z.shape==='line'?0:Math.sin(a)*radius*.7,rise=(live?55:charge*18);c.strokeStyle=i%2?'#a6bf65':'#795b38';c.lineWidth=live?6:2;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+20,y-rise*.3,x-20,y-rise*.8,x+Math.sin(t*.03+i)*15,y-rise);c.stroke();c.fillStyle='#8fc651';c.beginPath();c.ellipse(x+9,y-rise*.55,13,5,-.7,0,T);c.fill();}
 }
 c.restore();
}
function viewport(c,event,t,w,h){
 const realm=event.realm,a=Math.sin(Math.PI*Math.min(1,event.progress));c.save();c.globalAlpha=.35*a;
 if(realm==='space'){for(let i=0;i<120;i++){const x=(i*137.5+t*.4)%w,y=(i*97.3+Math.sin(t*.005+i)*25)%h;c.fillStyle=i%3?'#d6c1ff':'#fff4b5';c.fillRect(x,y,1+i%3,1+i%3);}}
 if(realm==='ice'){c.strokeStyle='#b5f0ff';for(let i=0;i<20;i++){const x=i*w/19,down=i%2===0;c.beginPath();c.moveTo(x,down?0:h);for(let j=1;j<6;j++)c.lineTo(x+Math.sin(i*9+j)*25,(down?1:-1)*j*18*a+(down?0:h));c.stroke();}for(let i=0;i<60;i++){c.fillStyle='#f1ffff';c.beginPath();c.arc((i*73+t*.45)%w,(i*89+t*.8)%h,1+i%3,0,T);c.fill();}}
 if(realm==='storm'){c.strokeStyle='#bfeeff';for(let i=0;i<30;i++){const x=(i*71+t*3)%w,y=(i*127)%h;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+70,y-20,x+140,y-8);c.stroke();}for(let i=0;i<7;i++){c.fillStyle='#61728a';c.beginPath();c.ellipse(w*i/6,-15+Math.sin(t*.02+i)*10,130,70,0,0,T);c.fill();}}
 if(realm==='forest'){c.strokeStyle='#759754';for(let side=0;side<2;side++)for(let i=0;i<7;i++){const x=side?w:0,y=h*i/6;c.lineWidth=4+i%3;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+(side?-70:70)*a,y-40,x+(side?-120:120)*a,y+60,x+(side?-170:170)*a,y+Math.sin(t*.01+i)*45);c.stroke();}if(event.variant===2){c.strokeStyle='#b3d7b2';for(let i=0;i<60;i++){const x=i*91%w,y=(i*57+t*4)%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-6,y+18);c.stroke();}}}
 if(realm==='fire'){for(let i=0;i<45;i++){const x=i*w/44,y=h-(t*1.5+i*31)%150;c.fillStyle=i%2?'#ff9542':'#ffd273';c.beginPath();c.arc(x+Math.sin(t*.02+i)*14,y,2+i%3,0,T);c.fill();}}
 if(realm==='time'){c.strokeStyle='#f1ce8c';c.translate(w/2,h/2);for(let i=0;i<12;i++){const ang=i*T/12;c.beginPath();c.moveTo(Math.cos(ang)*w*.42,Math.sin(ang)*h*.42);c.lineTo(Math.cos(ang)*w*.46,Math.sin(ang)*h*.46);c.stroke();}}
 c.restore();
}
g.ArenaTowerSpectacleArt={zone,viewport};
})(globalThis);

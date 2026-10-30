/* Ancient One finale. Uses real combat HP/hitbox and the tower damage adapter. */
(function(g){
'use strict';
const names=['멸망의 손바닥','심연의 십자가','촉수 감옥','마안의 응시','파멸의 궤도','뒤틀린 회랑','삼중 압살','무한의 균열','인과 역전','종말의 별비','심장의 박동','창세의 차징','촉수의 나선','차원 절단','거짓 안전지대','최후의 심판'];
const hit=(z,p)=>{const dx=p.x-z.x,dy=p.y-z.y,r=p.radius||12;if(z.shape==='circle')return Math.hypot(dx,dy)<=z.r+r;if(z.shape==='ring'){const d=Math.hypot(dx,dy);return d+r>=z.inner&&d-r<=z.r;}return Math.abs(dx*Math.cos(z.a)+dy*Math.sin(z.a))<=z.len/2+r&&Math.abs(-dx*Math.sin(z.a)+dy*Math.cos(z.a))<=z.w/2+r;};
function create({width:w,height:h,hero,boss,damage}){
 let tick=0,turn=0,phase=1,upcoming=80,serial=0;
 const zones=[], clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const C=(x,y,r)=>({shape:'circle',x,y,r}),R=(x,y,inner,r)=>({shape:'ring',x,y,inner,r}),L=(x,y,a,w=45)=>({shape:'line',x,y,a,w,len:Math.hypot(w,h)*1.5});
 function add(s,label,delay=90,life=26,power=200){zones.push({...s,id:++serial,label,born:tick,fire:tick+delay,end:tick+delay+life,power,hit:false});}
 function pattern(){
  const x=clamp(hero.x,35,w-35),y=clamp(hero.y,50,h-35),cx=w/2,cy=h/2,mode=turn++%names.length,fast=phase===3,d=fast?52:phase===2?72:100;
  switch(mode){
   case 0:add(C(x,y,74),names[mode],d,34);break;
   case 1:add(L(cx,cy,0,48),names[mode],d);add(L(cx,cy,Math.PI/2,48),'교차 압살',d+46);break;
   case 2:for(let i=0;i<4;i++)add(L(i%2?cx:i?cx:cx,cy,i%2?0:Math.PI/2,36),names[mode],d+i*40,20);break;
   case 3:add(C(x,y,48),names[mode],d+45,32,200);add(R(cx,cy,115,173),'시선의 잔향',d+100);break;
   case 4:add(R(cx,cy,75,145),names[mode],d);add(C(cx,cy,69),'중심 붕괴',d+53);break;
   case 5:add(L(cx,cy,Math.PI/4,52),names[mode],d);add(L(cx,cy,-Math.PI/4,52),'공간 반전',d+54);break;
   case 6:for(let i=0;i<3;i++)add(C(clamp(x+(i-1)*95,40,w-40),y,57),names[mode],d+i*45);break;
   case 7:add(R(x,y,62,125),names[mode],d,40);add(C(x,y,55),'열린 심연',d+64,24,200);break;
   case 8:add(C(w-x,h-y,70),names[mode],d);add(C(x,y,65),'역인과',d+60);break;
   case 9:for(let i=0;i<5;i++)add(C(clamp(x+Math.sin(i*2)*105,34,w-34),clamp(y+Math.cos(i*3)*90,45,h-34),43),names[mode],d+i*32);break;
   case 10:add(R(cx,cy,30,100),names[mode],d);add(R(cx,cy,115,210),'심장의 두 번째 박동',d+64);break;
   case 11:add(L(cx,cy,Math.atan2(y-cy,x-cx),88),names[mode],d+95,60,200);break;
   case 12:for(let i=0;i<4;i++)add(L(cx,cy,Math.PI*i/4,38),names[mode],d+i*43);break;
   case 13:add(L(x,cy,Math.PI/2,55),names[mode],d);add(L(cx,y,0,55),'절단선의 메아리',d+64);break;
   case 14:add(R(cx,cy,68,220),names[mode],d,35,200);break;
   case 15:add(C(x,y,65),names[mode],d+110,40,200);add(R(cx,cy,100,180),'심판의 여진',d+150,35,200);break;
  }
 }
 function step(){
  if(hero.hp<=0||boss.hp<=0)return;
  tick++;
  const percent=boss.hp/Math.max(1,boss.maxHp);
  if(percent<=.32)phase=3;else if(percent<=.68)phase=2;
  if(tick>=upcoming){pattern();upcoming=tick+(phase===3?120:phase===2?160:205);}
  for(const z of zones)if(!z.hit&&tick>=z.fire&&tick<z.end&&hit(z,hero)){
   if(damage(hero,z.power,z)!==false)z.hit=true;
  }
  for(let i=zones.length-1;i>=0;i--)if(tick>=zones[i].end)zones.splice(i,1);
  // The targetable enemy fighter is the exposed central arm. Its health is the ancient body's health.
  boss.x=w/2;boss.y=Math.max(50,h*.18);boss.vx=0;boss.vy=0;
 }
 function draw(ctx){
  ctx.save();
  const cx=w/2,top=h*.02;
  // Giant silhouette appears beyond the rear rim of the battlefield.
  ctx.globalAlpha=.82;ctx.fillStyle='#170d2d';ctx.strokeStyle='#b37af6';ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(cx,top+30,w*.30,h*.24,0,Math.PI,0,true);ctx.fill();ctx.stroke();
  for(let i=0;i<7;i++){const x=cx+(i-3)*w*.095;ctx.beginPath();ctx.moveTo(cx,top+40);ctx.quadraticCurveTo(x,top+80+Math.sin(tick*.025+i)*16,x,top+125);ctx.strokeStyle='#7444a5';ctx.lineWidth=9;ctx.stroke();}
  ctx.fillStyle='#f17cff';for(const offset of [-30,30]){ctx.beginPath();ctx.ellipse(cx+offset,top+45,10,5,0,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  for(const z of zones){
   const live=tick>=z.fire,remain=Math.max(0,z.fire-tick);
   ctx.save();ctx.translate(z.x,z.y);ctx.rotate(z.a||0);ctx.beginPath();
   if(z.shape==='line')ctx.rect(-z.len/2,-z.w/2,z.len,z.w);
   else{ctx.arc(0,0,z.r,0,Math.PI*2);if(z.shape==='ring')ctx.arc(0,0,z.inner,0,Math.PI*2,true);}
   ctx.fillStyle=live?'#f5386977':'#ab5aff28';ctx.strokeStyle=live?'#fff2db':'#ee93ff';ctx.lineWidth=live?4:2;ctx.setLineDash(live?[]:[7,6]);ctx.fill();ctx.stroke();ctx.restore();
   ctx.fillStyle='#fff';ctx.strokeStyle='#180d26';ctx.lineWidth=4;ctx.font='bold 12px sans-serif';ctx.textAlign='center';
   const label=live?'강력한 공격 · 200 HP!':z.label+' '+(remain/60).toFixed(1)+'초';
   ctx.strokeText(label,clamp(z.x,84,w-84),clamp(z.y,25,h-20));ctx.fillText(label,clamp(z.x,84,w-84),clamp(z.y,25,h-20));
  }
  ctx.textAlign='center';ctx.font='bold 15px sans-serif';ctx.fillStyle='#ffe3ff';
  ctx.fillText('고대의 존재 · '+Math.ceil(boss.hp)+' / 3000 · PHASE '+phase,cx,h-12);
  ctx.restore();
 }
 return {step,draw,get tick(){return tick;},get phase(){return phase;},get zones(){return zones;}};
}
g.ArenaAncientOne={create,names};
})(globalThis);

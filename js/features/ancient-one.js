/* Ancient One finale. Uses real combat HP/hitbox and the tower damage adapter. */
(function(g){
'use strict';
const names=['멸망의 손바닥','심연의 십자가','촉수 감옥','마안의 응시','파멸의 궤도','뒤틀린 회랑','삼중 압살','무한의 균열','인과 역전','종말의 별비','심장의 박동','창세의 차징','촉수의 나선','차원 절단','거짓 안전지대','최후의 심판'];
const hit=(z,p)=>{const dx=p.x-z.x,dy=p.y-z.y,r=p.radius||12;if(z.shape==='circle')return Math.hypot(dx,dy)<=z.r+r;if(z.shape==='ring'){const d=Math.hypot(dx,dy);return d+r>=z.inner&&d-r<=z.r;}return Math.abs(dx*Math.cos(z.a)+dy*Math.sin(z.a))<=z.len/2+r&&Math.abs(-dx*Math.sin(z.a)+dy*Math.cos(z.a))<=z.w/2+r;};
function create({width:w,height:h,hero,boss,damage}){
 let tick=0,turn=0,phase=1,upcoming=80,serial=0;
 const seals=g.ArenaAncientSixSeals?.create({width:w,height:h,hero,boss,damage});
 const sealTurns=[0,0,0],phasePowers=[['time','space'],['fire','storm'],['ice','forest','convergence']];
 function clear(){seals?.clear();zones.length=0;g.ArenaAncientFinaleFX?.page?.(null);}
 const zones=[], clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const C=(x,y,r)=>({shape:'circle',x,y,r}),R=(x,y,inner,r)=>({shape:'ring',x,y,inner,r}),L=(x,y,a,w=45)=>({shape:'line',x,y,a,w,len:Math.hypot(w,h)*1.5});
 function add(s,label,delay=90,life=26,power=200){zones.push({...s,id:++serial,label,born:tick,fire:tick+delay,end:tick+delay+life,power,hit:false});}
 function pattern(){
  const x=clamp(hero.x,35,w-35),y=clamp(hero.y,50,h-35),cx=w/2,cy=h/2,mode=turn++%names.length,fast=phase===3,d=fast?76:phase===2?88:112;
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
  // The previous 16 attacks still use the boss's 100-energy budget.
  // Each opened seal is simulation-owned and runs only one at a time.
  if(seals&&!seals.event){
   const index=phase-1,powers=phasePowers[index],realm=powers[sealTurns[index]++%powers.length];
   seals.begin(realm,phase);
   g.addFloatingText?.('✦ '+({time:'시간',space:'우주',fire:'화염',
    storm:'폭풍',ice:'빙결',forest:'숲',convergence:'여섯 봉인 융합'}[realm])+
    ' 봉인 개방',cx,h*.31,'#dfd1ff',20);
  }
 }
 function step(){
  if(hero.hp<=0||boss.hp<=0){clear();return;}
  tick++;
  const percent=boss.hp/Math.max(1,boss.maxHp);
  const before=phase;
  if(percent<=.32)phase=3;else if(percent<=.68)phase=2;
  if(phase!==before)g.addFloatingText?.('고대의 존재 · '+phase+'페이즈 개방!',w/2,h*.23,'#e9d4ff',23);
  if(tick>=upcoming){
   const energy=g.BounceMomentum?.isBoss?.(boss);
   if(!energy||g.BounceMomentum.bossCan(boss,'pattern')){
    pattern();
    if(energy)g.BounceMomentum.bossSpend(boss,'pattern');
    // Preserves time to read each huge telegraph, but energy is mandatory.
    upcoming=tick+(phase===3?90:phase===2?110:125);
   }
  }
  for(const z of zones)if(!z.hit&&tick>=z.fire&&tick<z.end&&hit(z,hero)){
   if(damage(hero,z.power,z)!==false)z.hit=true;
  }
  for(let i=zones.length-1;i>=0;i--)if(tick>=zones[i].end)zones.splice(i,1);
  seals?.step();
  // The targetable enemy fighter is the exposed central arm. Its health is the ancient body's health.
  boss.x=w/2;boss.y=Math.max(50,h*.18);boss.vx=0;boss.vy=0;
 }
 function draw(ctx){
  ctx.save();
  const cx=w/2,top=h*.02;
  // The final boss is visually the same colossal multi-eyed void deity as
  // the six-seal challenge illustration. Keep its torso BEHIND the arena,
  // leaving the actual targetable arm/body and hitbox unchanged.
  const wide=Math.min(w*.30,170),headY=top+Math.min(72,h*.14);
  const sway=Math.sin(tick*.018),glow=phase===3?'#ff99da':'#74f6f5';
  ctx.globalAlpha=.82;
  for(let i=0;i<8;i++){
    const side=i%2?1:-1,a=Math.floor(i/2),from=cx+side*wide*.48,
      end=cx+side*(wide*.8+a*wide*.32),
      lift=Math.sin(tick*.022+i)*13;
    ctx.beginPath();ctx.moveTo(from,headY+28);
    ctx.bezierCurveTo(cx+side*(wide*.9+a*12),headY-72+lift,
      end+side*54,headY+65+lift,end,headY+145);
    ctx.strokeStyle='#070e21';ctx.lineWidth=24-a*3;ctx.lineCap='round';ctx.stroke();
    ctx.strokeStyle=i%3===0?'#50718a':'#493a67';
    ctx.lineWidth=15-a*2;ctx.stroke();
  }
  ctx.fillStyle='#12152c';ctx.strokeStyle='#4b4a7c';ctx.lineWidth=5;
  ctx.beginPath();ctx.ellipse(cx,headY+154,wide*1.08,h*.21,0,Math.PI,Math.PI*2);ctx.fill();ctx.stroke();
  // Non-human elongated cephalopod skull, not a standing humanoid fighter.
  ctx.beginPath();ctx.ellipse(cx,headY,wide*.65,h*.177,0,0,Math.PI*2);
  ctx.fillStyle='#22243b';ctx.strokeStyle='#8094ac';ctx.lineWidth=4;ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(cx-wide*.14,headY-h*.05,wide*.39,h*.074,-.4,0,Math.PI*2);
  ctx.fillStyle='#34465d';ctx.globalAlpha=.48;ctx.fill();ctx.globalAlpha=.91;
  ctx.beginPath();ctx.moveTo(cx,headY-h*.17);ctx.lineTo(cx,headY+h*.11);
  ctx.strokeStyle='#719bab';ctx.lineWidth=2;ctx.stroke();
  // Each eye is an illuminated aperture in the skull, not a separate attack.
  const eyes=[[0,.07,1.1],[-.33,.09,.68],[.33,.09,.68],
    [-.44,-.16,.62],[.44,-.16,.62],[-.18,-.25,.50],[.18,-.25,.50],
    [-.51,.29,.43],[.51,.29,.43],[-.22,.40,.63],[.22,.40,.63],
    [0,-.42,.52],[-.34,-.40,.39],[.34,-.40,.39]];
  ctx.shadowColor=glow;ctx.shadowBlur=7;
  for(const [ex,ey,scale] of eyes){
    const x=cx+ex*wide,y=headY+ey*h*.15,
      r=(4.5+phase*.9)*scale;
    ctx.beginPath();ctx.ellipse(x,y,r*.76,r*1.16,0,0,Math.PI*2);
    ctx.fillStyle='#a0fff8';ctx.fill();
    ctx.beginPath();ctx.ellipse(x,y,r*.28,r*.8,0,0,Math.PI*2);
    ctx.fillStyle='#06415a';ctx.fill();
  }
  ctx.shadowBlur=0;
  // Face tendrils curl visibly in front of the eyes and trail behind the rim.
  for(let i=0;i<9;i++){
    const offset=(i-4)*wide*.125,x=cx+offset,
      bend=Math.sin(tick*.024+i)*9;
    ctx.beginPath();ctx.moveTo(x,headY+h*.072);
    ctx.bezierCurveTo(x-offset*.35,headY+h*.16,x+offset*.36+bend,
      headY+h*.25,x+offset*.48+bend*1.8,headY+h*.34);
    ctx.strokeStyle='#0a1228';ctx.lineWidth=15-i%3*2;ctx.stroke();
    ctx.strokeStyle=i%2?'#5d637d':'#426e7f';ctx.lineWidth=8-i%3;ctx.stroke();
  }
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
  seals?.draw(ctx);
  ctx.textAlign='center';ctx.font='bold 15px sans-serif';ctx.fillStyle='#ffe3ff';
  ctx.fillText('고대의 존재 · '+Math.ceil(boss.hp)+' / 3000 · PHASE '+phase,cx,h-12);
  if(seals?.event){
   ctx.font='bold 12px sans-serif';ctx.fillStyle='#e8d7ff';
   const realm=seals.event.realm;
   ctx.fillText('봉인 · '+({time:'시간',space:'우주',fire:'화염',storm:'폭풍',ice:'빙결',
    forest:'숲',convergence:'여섯 봉인의 융합'}[realm])+
    ' · '+(seals.event.active?'발동':'예고 중'),cx,26);
  }
  ctx.restore();
  g.ArenaAncientFinaleFX?.page?.(seals?.event,phase,tick);
 }
 return {step,draw,clear,seals,get tick(){return tick;},get phase(){return phase;},get zones(){return zones;}};
}
g.ArenaAncientOne={create,names};
})(globalThis);

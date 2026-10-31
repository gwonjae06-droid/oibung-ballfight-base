/* Six real Tower-only environment systems. Visual warnings and gameplay share
 * their zone geometry/timing. Never used by PvP or the Ancient One arena.
 * Keep damage routed through the normal Tower hit adapter. */
(function(g){
'use strict';
const TWO=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLORS={time:'#ffe09c',space:'#c9a6ff',fire:'#ff854e',storm:'#a5f2ff',ice:'#bdefff',forest:'#aceda4'};
const LABELS={
 time:['가속 시계판','시간 정체대'],
 space:['특이점 중력 우물','역중력 궤도'],
 fire:['용암 균열','분화하는 화구'],
 storm:['순환 돌풍','낙뢰 전선'],
 ice:['얼음 미끄럼판','동결 빙정'],
 forest:['맹독 포자숲','덩굴 파수목','뿌리 속박']
};
function contains(z,p){
 const dX=p.x-z.x,dY=p.y-z.y,r=p.radius||0;
 if(z.shape==='line'){
  const c=Math.cos(z.angle),s=Math.sin(z.angle);
  return Math.abs(dX*c+dY*s)<=z.length/2+r&&Math.abs(-dX*s+dY*c)<=z.width/2+r;
 }
 if(z.shape==='ring'){
  const d=Math.hypot(dX,dY);
  return d+r>=z.inner&&d-r<=z.r;
 }
 return Math.hypot(dX,dY)<=z.r+r;
}
function create({realm,level,width=500,height=500,roster=[],damage}){
 if(!COLORS[realm])return null;
 const boss=level%5===0,period=Math.max(218,298-level*6),units=Math.min(width,height);
 let tick=0,turn=0,serial=0;
 const zones=[];
 const circle=(x,y,r)=>({shape:'circle',x,y,r});
 const line=(x,y,a,w,len)=>({shape:'line',x,y,angle:a,width:w,length:len});
 const ring=(x,y,inner,r)=>({shape:'ring',x,y,inner,r});
 const within=(p,ms)=>clamp(p,ms,ms===width?width:height-ms);
 function spawn(){
  const kind=turn++% (realm==='forest'?3:2),flip=turn%2===0;
  const px=width*(flip?.65:.35),py=height*(kind===1?.60:.39);
  let shape,mode,notice=72,duration=110,amount=0;
  switch(realm){
   case 'time':
    mode=kind===0?'fast':'slow';
    shape=circle(px,py,units*.165);duration=148;break;
   case 'space':
    mode=kind===0?'gravity':'antigravity';
    shape=circle(px,py,units*.205);notice=84;duration=132;break;
   case 'fire':
    mode=kind===0?'lava':'eruption';
    shape=kind===0?line(px,height*.52,Math.PI/2,units*.1,height*.69):
      circle(px,py,units*.136);
    notice=100;duration=kind===0?46:36;amount=Math.round(18+level*3.3);break;
   case 'storm':
    mode=kind===0?'wind':'lightning';
    shape=kind===0?line(width*.50,py,0,units*.23,width*.78):
      circle(px,py,units*.145);
    notice=kind===0?66:85;duration=kind===0?130:30;
    amount=Math.round(14+level*2.2);break;
   case 'ice':
    mode=kind===0?'slip':'frost';
    shape=kind===0?circle(px,py,units*.19):ring(width*.5,height*.50,units*.11,units*.27);
    notice=80;duration=136;break;
   case 'forest':
    mode=['spores','sapling','roots'][kind];
    shape=kind===1?circle(px,py,units*.10):kind===2?
      line(width*.5,py,0,units*.12,width*.64):circle(px,py,units*.17);
    notice=kind===1?88:76;duration=kind===1?160:120;break;
  }
  const z={...shape,mode,kind:'environment',realm,label:LABELS[realm][kind],
    id:++serial,born:tick,fire:tick+notice,end:tick+notice+duration,
    amount,hits:new Set(),affected:new Map()};
  zones.push(z);if(zones.length>3)zones.shift();
 }
 function active(z){return tick>=z.fire&&tick<z.end;}
 function status(p,key,frames){
  if(g.ForgeExpansion?.applyStatus){
   g.ForgeExpansion.applyStatus(null,p,{status:key,duration:frames/60});
  }else if(key==='root'){p.slowTimer=Math.max(p.slowTimer||0,frames);p.slowMultiplier=.35;}
 }
 function poison(p,frames){
  // The existing normal status/DOT timer owns the damage; no hidden hits.
  p.bfDot=Math.max(p.bfDot||0,frames);
  p.bfDotDamage=Math.max(p.bfDotDamage||0,Math.min(4,1+Math.ceil(level/5)));
 }
 function touch(z,p){
  // Avoid movement/CC on the stationary pattern bosses; the hero still sees
  // environment mechanics, but no extra lethal hazards coincide with a boss.
  if(boss&&p!==roster[0])return;
  const age=tick-z.fire;
  switch(z.mode){
   case 'fast':
    if(p.forgeTicks&&tick%2===0)p.forgeTicks=p.forgeTicks.map(t=>Math.min(5000,t+.8));
    break;
   case 'slow':
    p.slowTimer=Math.max(p.slowTimer||0,5);
    p.slowMultiplier=Math.min(p.slowMultiplier||1,boss?.91:.78);
    if(p.forgeTicks&&tick%2===0)p.forgeTicks=p.forgeTicks.map(t=>Math.max(0,t-.7));
    break;
   case 'gravity':
   case 'antigravity':{
    const dx=z.x-p.x,dy=z.y-p.y,d=Math.max(8,Math.hypot(dx,dy));
    const force=(z.mode==='gravity'?1:-1)*(boss?.075:.14);
    p.vx=clamp((p.vx||0)+dx/d*force,-8,8);
    p.vy=clamp((p.vy||0)+dy/d*force,-8,8);
    break;
   }
   case 'lava':
   case 'eruption':
   case 'lightning':
    if(!boss&&!z.hits.has(p)&&damage?.(p,z.amount,z)!==false){
      z.hits.add(p);
      if(z.mode!=='lightning')poison(p,60); // heat burn using the existing bounded DOT
    }
    break;
   case 'wind':
    p.vx=clamp((p.vx||0)+(turn%2?-.14:.14),-8,8);
    p.vy=clamp((p.vy||0)+(age%24<12?.025:-.025),-8,8);
    break;
   case 'slip':
    // Smooth persistent gliding and a light slow, not an abrupt teleport.
    p.vx=clamp((p.vx||0)*1.012,-8,8);
    p.vy=clamp((p.vy||0)*1.012,-8,8);
    p.slowTimer=Math.max(p.slowTimer||0,4);
    p.slowMultiplier=Math.min(p.slowMultiplier||1,boss?.94:.86);
    break;
   case 'frost':
    p.slowTimer=Math.max(p.slowTimer||0,6);
    p.slowMultiplier=Math.min(p.slowMultiplier||1,boss?.89:.58);
    if(!boss&&age>6&&tick%90===0)status(p,'root',12);
    break;
   case 'spores':{
    p.slowTimer=Math.max(p.slowTimer||0,5);
    p.slowMultiplier=Math.min(p.slowMultiplier||1,boss?.92:.84);
    const last=z.affected.get(p)||-1000;
    if(!boss&&tick-last>=70){poison(p,110);z.affected.set(p,tick);}
    break;
   }
   case 'sapling':{
    // Periodic seed-projectile bursts, drawn as radial pulses. Real impact
    // uses the same radius and is once-per-target per burst.
    if(!boss&&age>=20&&age%56<=8&&z.affected.get(p)!==Math.floor(age/56)){
      if(damage?.(p,Math.round(7+level*1.5),z)!==false){
        z.affected.set(p,Math.floor(age/56));poison(p,65);
      }
    }
    break;
   }
   case 'roots':
    p.slowTimer=Math.max(p.slowTimer||0,6);
    p.slowMultiplier=Math.min(p.slowMultiplier||1,boss?.90:.45);
    if(!boss&&age>8&&tick%115===0)status(p,'root',13);
    break;
  }
 }
 function step(){
  tick++;
  if(tick===1||(tick-1)%period===0)spawn();
  for(const z of zones){
   if(!active(z))continue;
   for(const p of roster||[]){
    if(!p||p.hp<=0||!contains(z,p))continue;
    // Ground hazards can be jumped. Passive time, space and wind fields are
    // volume effects and therefore affect airborne fighters as well.
    if(['lava','eruption','lightning','frost','spores','sapling','roots'].includes(z.mode)&&
       (p.z||p.jumpHeight||0)>38)continue;
    touch(z,p);
   }
  }
  for(let i=zones.length-1;i>=0;i--)if(tick>=zones[i].end)zones.splice(i,1);
 }
 function draw(ctx){
  if(!ctx)return;
  const color=COLORS[realm];ctx.save();
  for(const z of zones){
   const live=active(z),remaining=Math.max(0,z.fire-tick),pulse=(Math.sin(tick*.13)+1)*.5;
   ctx.save();ctx.translate(z.x,z.y);ctx.globalAlpha=live?.82:.42;
   if(z.shape==='line')ctx.rotate(z.angle);
   ctx.beginPath();
   if(z.shape==='line')ctx.rect(-z.length/2,-z.width/2,z.length,z.width);
   else{ctx.arc(0,0,z.r,0,TWO);if(z.shape==='ring')ctx.arc(0,0,z.inner,0,TWO,true);}
   ctx.fillStyle=live?(realm==='fire'?'#ff6b3470':realm==='storm'?'#73f2ff45':color+'48'):color+'23';
   ctx.fill();ctx.strokeStyle=live?'#ffffff':color;ctx.lineWidth=live?3.8:2.2;
   ctx.setLineDash(live?[]:[8,5]);ctx.stroke();ctx.setLineDash([]);
   // Distinct animated geometry: not only a label or a danger outline.
   // The layer is projected together with the existing Tower floor.
   g.ArenaTowerEnvironmentVFX?.draw?.(ctx,z,tick,level);
   if(live){
    ctx.globalAlpha=.75;ctx.strokeStyle=color;ctx.lineWidth=1.5;
    if(z.shape==='circle'){
     ctx.beginPath();ctx.arc(0,0,z.r*(.55+.17*pulse),0,TWO);ctx.stroke();
    }
    if(realm==='time'){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(tick*.07)*28,Math.sin(tick*.07)*28);ctx.stroke();}
    if(realm==='space')for(let j=0;j<3;j++){const a=tick*.025+j*TWO/3;
      ctx.beginPath();ctx.arc(Math.cos(a)*z.r*.73,Math.sin(a)*z.r*.73,4,0,TWO);ctx.fillStyle=color;ctx.fill();}
    if(realm==='fire')for(let j=0;j<5;j++){const x=(j-2)*11,y=-13-(tick+j*13)%24;ctx.beginPath();ctx.moveTo(x,y+9);ctx.lineTo(x+5,y);ctx.stroke();}
    if(realm==='storm'){ctx.beginPath();ctx.moveTo(-28,-9);ctx.lineTo(-6,4);ctx.lineTo(3,-8);ctx.lineTo(22,8);ctx.stroke();}
    if(realm==='ice')for(let j=0;j<6;j++){const a=j*TWO/6;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*24,Math.sin(a)*24);ctx.stroke();}
    if(realm==='forest')for(let j=0;j<5;j++){const a=j*TWO/5;ctx.beginPath();ctx.arc(Math.cos(a)*20,Math.sin(a)*20,5,0,TWO);ctx.stroke();}
   }
   ctx.restore();
   // Warning posts and countdown are rendered as upright elevated objects,
   // depth-sorted with the fighters (not flattened into the floor texture).
   const raised=!live&&g.ArenaTowerPattern3D?.warning?.(ctx,z,realm,tick,width,height);
   if(!live&&!raised){
     const x=clamp(z.x,65,width-65),y=clamp(z.y-16,20,height-18);
     ctx.font='bold 12px system-ui';ctx.textAlign='center';
     ctx.lineWidth=3;ctx.strokeStyle='#07111d';ctx.fillStyle='#fff';
     ctx.strokeText(z.label+' '+(remaining/60).toFixed(1)+'s',x,y);
     ctx.fillText(z.label+' '+(remaining/60).toFixed(1)+'s',x,y);
   }
  }
  ctx.restore();
 }
 function clear(){zones.length=0;}
 return {step,draw,clear,get tick(){return tick;},get zones(){return zones;},realm,boss,period};
}
g.ArenaTowerEnvironment=Object.freeze({create,contains,LABELS,COLORS});
})(globalThis);

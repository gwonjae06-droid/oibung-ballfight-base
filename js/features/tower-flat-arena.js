/* Six tower-specific FLAT pinball arenas.
 * A single seamless zero-elevation floor replaces disconnected islands,
 * narrow stairs, void gaps and climb restrictions. Four small illustrated
 * edge bumpers and the solid perimeter are the only map geometry.
 * Boss attacks/environment hazards remain separate and authoritative.
 * All measurements are in the existing 500x500 world, scaled with the arena.
 */
(function(g){
'use strict';
const TWO=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const LEFT=26,RIGHT=474,BUMPERS=[[124,124],[376,124],[124,376],[376,376]];
const THEMES=Object.freeze({
 time:{name:'시간의 탑',back:'#110c1a',floor:'#493c37',tile:'#80634c',line:'#c9a477',edge:'#e6bb6a',bright:'#ffe7a4',dark:'#241820',glow:'#ffc568'},
 space:{name:'우주의 탑',back:'#100725',floor:'#252047',tile:'#4e367b',line:'#7c65ac',edge:'#b586ef',bright:'#e7c5ff',dark:'#0d102e',glow:'#9c57f4'},
 fire:{name:'화염의 탑',back:'#1f070c',floor:'#37262b',tile:'#654147',line:'#8c5052',edge:'#ff8142',bright:'#ffd28c',dark:'#240d15',glow:'#ff571f'},
 storm:{name:'폭풍의 탑',back:'#06172b',floor:'#24364f',tile:'#3d5b79',line:'#6795b9',edge:'#48c4ff',bright:'#d0faff',dark:'#0a1b39',glow:'#55caff'},
 ice:{name:'빙설의 탑',back:'#071a2d',floor:'#426f91',tile:'#71aecb',line:'#a7e2ed',edge:'#c4f6ff',bright:'#f0ffff',dark:'#174563',glow:'#76eaff'},
 forest:{name:'숲의 탑',back:'#091b12',floor:'#344b37',tile:'#63764e',line:'#8da776',edge:'#97c97b',bright:'#e6f7b6',dark:'#1a3626',glow:'#a6db79'}
});
const names=Object.keys(THEMES);
const floor={id:'flat-arena-floor',kind:'deck',z:0,cx:250,cy:250,vertices:[]};
let cached=null;
function getMap(realm,level=1,w=500,h=500,tick=0){
 const name=THEMES[realm]?realm:'time',key=[name,w,h].join(':');
 if(cached?.key===key)return cached.value;
 const sx=w/500,sy=h/500,dim=Math.min(sx,sy);
 const vertices=[{x:LEFT*sx,y:LEFT*sy},{x:RIGHT*sx,y:LEFT*sy},
  {x:RIGHT*sx,y:RIGHT*sy},{x:LEFT*sx,y:RIGHT*sy}];
 const surface={...floor,vertices,cx:w/2,cy:h/2,bbox:{minX:vertices[0].x,minY:vertices[0].y,maxX:vertices[2].x,maxY:vertices[2].y}};
 const obstacles=BUMPERS.map(([x,y],i)=>({id:'bounce-bumper-'+i,x:x*sx,y:y*sy,r:13*dim,kind:'bumper'}));
 const value={realm:name,level,width:w,height:h,tick,surfaces:[surface],
  nav:[{id:surface.id,x:w/2,y:h/2,z:0,kind:'deck'}],obstacles};
 cached={key,value};return value;
}
function at(realm,level,x,y,w=500,h=500,tick=0){
 const m=getMap(realm,level,w,h,tick),sx=w/500,sy=h/500;
 const clearance=Math.min(x-LEFT*sx,RIGHT*sx-x,y-LEFT*sy,RIGHT*sy-y);
 return {height:0,surface:clearance>=0?m.surfaces[0]:null,clearance,
  nearest:null};
}
const heightAt=()=>0;
function clearance(realm,x,y,w=500,h=500,tick=0,level=1){
 const m=getMap(realm,level,w,h,tick);
 let d=at(realm,level,x,y,w,h,tick).clearance;
 for(const o of m.obstacles)d=Math.min(d,Math.hypot(x-o.x,y-o.y)-o.r);
 return d;
}
function isWalkable(realm,x,y,w=500,h=500,radius=0,level=1,tick=0){
 return clearance(realm,x,y,w,h,tick,level)>=Math.max(0,radius*.5);
}
function rebound(p,nx,ny,speed){
 // nx/ny points INTO free space, not through the bumper or perimeter.
 const dot=(p.vx||0)*nx+(p.vy||0)*ny;
 if(!(dot<-.06))return;
 const power=-dot;
 const elasticity=.91,drag=.985;
 p.vx=((p.vx||0)-(1+elasticity)*dot*nx)*drag;
 p.vy=((p.vy||0)-(1+elasticity)*dot*ny)*drag;
 g.ArenaBallSquash?.wall?.(p,nx,ny,power);
 g.BounceMomentum?.wall?.(p,power);
 if(g.BounceMomentum?.enabled?.(p))
  p._pinballReboundHold=Math.max(p._pinballReboundHold||0,9);
 p._towerRimBounce=(p._towerRimBounce||0)+1;
}
function bounce(p,realm,w=500,h=500,level=1,tick=0){
 if(!p||p.hp<=0||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
 const radius=Math.max(3,Number(p.radius)||22),m=getMap(realm,level,w,h,tick);
 const sx=w/500,sy=h/500;
 const l=LEFT*sx+radius,r=RIGHT*sx-radius,t=LEFT*sy+radius,b=RIGHT*sy-radius;
 let hit=false;
 if(p.x<l){p.x=l;rebound(p,1,0);hit=true;}
 else if(p.x>r){p.x=r;rebound(p,-1,0);hit=true;}
 if(p.y<t){p.y=t;rebound(p,0,1);hit=true;}
 else if(p.y>b){p.y=b;rebound(p,0,-1);hit=true;}
 // Small well-separated round bumpers near corners do not obstruct the
 // wide centre or create dead ends. They match the glowing art exactly.
 for(const o of m.obstacles){
  const dx=p.x-o.x,dy=p.y-o.y,d=Math.hypot(dx,dy),limit=o.r+radius;
  if(d>=limit)continue;
  const nx=d>.0001?dx/d:1,ny=d>.0001?dy/d:0;
  p.x=o.x+nx*(limit+.1);p.y=o.y+ny*(limit+.1);
  rebound(p,nx,ny);hit=true;
 }
 if(hit){p._towerSafeX=p.x;p._towerSafeY=p.y;}
 return hit;
}
const nextWaypoint=()=>null;
function pathCircle(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,TWO);}
function star(ctx,x,y,r,points=4){
 ctx.beginPath();for(let k=0;k<points*2;k++){
  const a=k*Math.PI/points-Math.PI/2,rr=k%2?r*.32:r;
  const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;
  if(!k)ctx.moveTo(px,py);else ctx.lineTo(px,py);
 }ctx.closePath();
}
function line(ctx,x,y,x2,y2,col,width=2){
 ctx.strokeStyle=col;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();
}
function ring(ctx,x,y,r,c,width=2){
 ctx.strokeStyle=c;ctx.lineWidth=width;pathCircle(ctx,x,y,r);ctx.stroke();
}
function disc(ctx,x,y,r,c){
 ctx.fillStyle=c;pathCircle(ctx,x,y,r);ctx.fill();
}
function centerDesign(ctx,theme,frame){
 const t=frame/60;
 ctx.save();ctx.translate(250,250);
 if(theme==='time'){
  ring(ctx,0,0,77,'#b99460',8);ring(ctx,0,0,59,'#392f34',7);
  ring(ctx,0,0,73,'#fae2a1',1);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;line(ctx,Math.cos(a)*64,Math.sin(a)*64,Math.cos(a)*71,Math.sin(a)*71,'#f3d19a',2);}
  ctx.rotate(t*.11);
  line(ctx,0,0,53,0,'#f6c579',7);line(ctx,0,0,0,-39,'#ffefc1',5);disc(ctx,0,0,10,'#eec681');
 }else if(theme==='space'){
  const glow=ctx.createRadialGradient(0,0,3,0,0,101);
  glow.addColorStop(0,'#f7d4ff');glow.addColorStop(.22,'#ab6be6aa');glow.addColorStop(1,'#7f42f000');
  disc(ctx,0,0,101,glow);
  for(let k=0;k<3;k++){ctx.beginPath();ctx.strokeStyle=['#dcbcffb0','#8278ffb0','#8c46dfa0'][k];ctx.lineWidth=6-k;
   for(let n=0;n<115;n++){const a=n*.13+t*(k%2?-.15:.15)+k*2,r=4+n*.61;
    const x=Math.cos(a)*r,y=Math.sin(a)*r*.70;if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
   ctx.stroke();}
  star(ctx,0,-24,34,4);ctx.fillStyle='#dbaaff';ctx.fill();ctx.strokeStyle='#f2dcff';ctx.lineWidth=2;ctx.stroke();
 }else if(theme==='fire'){
  ring(ctx,0,0,83,'#ff7b3c88',9);ring(ctx,0,0,61,'#4b2228',16);
  const lava=ctx.createRadialGradient(0,0,0,0,0,64);lava.addColorStop(0,'#ffd078');lava.addColorStop(.4,'#ff652d');lava.addColorStop(1,'#8a2e2780');
  disc(ctx,0,0,62,lava);
  for(let i=0;i<9;i++){const a=i*TWO/9+t*.08,rr=25+(i%3)*11;
   line(ctx,Math.cos(a)*rr,Math.sin(a)*rr,Math.cos(a)*75,Math.sin(a)*75,'#ff9843',2);}
 }else if(theme==='storm'){
  ring(ctx,0,0,88,'#54c6eb80',4);ring(ctx,0,0,59,'#a5f5ff99',2);
  for(let i=0;i<4;i++){ctx.beginPath();ctx.strokeStyle=['#63d6ff','#c2f9ff'][i%2];ctx.lineWidth=6-i;
   for(let j=0;j<46;j++){const a=i*Math.PI/2+j*.092+t*.7,r=8+j*1.6;
    const x=Math.cos(a)*r,y=Math.sin(a)*r*.66;
    if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
   ctx.stroke();}
  disc(ctx,0,0,11,'#e7ffff');
 }else if(theme==='ice'){
  ring(ctx,0,0,75,'#c7f8ff99',3);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;
   line(ctx,0,0,Math.cos(a)*67,Math.sin(a)*67,'#c1f0ff',3);
   const x=Math.cos(a)*56,y=Math.sin(a)*56;star(ctx,x,y,8,4);ctx.fillStyle='#def9ff';ctx.fill();}
  ctx.fillStyle='#8feaff';star(ctx,0,0,43,5);ctx.fill();
  ctx.strokeStyle='#ecffff';ctx.lineWidth=2;ctx.stroke();
 }else if(theme==='forest'){
  ring(ctx,0,0,76,'#799b58',9);ring(ctx,0,0,59,'#c4d99b99',2);
  for(let k=0;k<7;k++){const a=k*TWO/7;ctx.beginPath();ctx.strokeStyle=k%2?'#acc77a':'#557f45';ctx.lineWidth=9;
   ctx.moveTo(Math.cos(a)*68,Math.sin(a)*68);
   ctx.quadraticCurveTo(Math.cos(a+.5)*40,Math.sin(a+.5)*40,Math.cos(a+1.1)*13,Math.sin(a+1.1)*13);ctx.stroke();}
  star(ctx,0,0,29,6);ctx.fillStyle='#efb9d1';ctx.fill();disc(ctx,0,0,9,'#ffe9b8');
 }
 ctx.restore();
}
function decorations(ctx,realm,tick,pal){
 const t=tick/60;
 ctx.save();
 if(realm==='time'){
  for(const [x,y] of [[76,76],[424,76],[76,424],[424,424]]){
   ring(ctx,x,y,24,'#9d7747',7);ring(ctx,x,y,15,'#e8c388',3);
   for(let k=0;k<10;k++){const a=k*TWO/10+t*.16;line(ctx,x+Math.cos(a)*22,y+Math.sin(a)*22,x+Math.cos(a)*31,y+Math.sin(a)*31,'#8e6b44',4);}
  }
 }else if(realm==='space'){
  for(let k=0;k<28;k++){const x=57+(k*109)%382,y=55+(k*173)%390;
   disc(ctx,x,y,(k%3===0?1.9:.9),'#dec7ff');}
  for(const [x,y] of [[80,240],[420,250],[235,78],[265,424]]){
   ctx.fillStyle='#b88bfb77';star(ctx,x,y,10,4);ctx.fill();}
 }else if(realm==='fire'){
  for(let k=0;k<11;k++){
   const x=55+(k*119)%385,y=65+(k*93)%370;
   line(ctx,x,y,x+18,y+7,'#ff7b37a8',2);line(ctx,x+18,y+7,x+25,y-8,'#f84928a9',2);
  }
 }else if(realm==='storm'){
  for(let k=0;k<9;k++){const x=63+(k*59)%370,y=66+(k*91)%370;
   line(ctx,x,y,x+9,y-18,'#83e4ff88',2);line(ctx,x+9,y-18,x+2,y-12,'#c5ffff88',2);}
 }else if(realm==='ice'){
  for(let k=0;k<14;k++){const x=61+(k*117)%360,y=68+(k*73)%358;
   star(ctx,x,y,k%4+4,6);ctx.fillStyle='#e5ffff60';ctx.fill();}
 }else{
  for(let k=0;k<22;k++){const x=54+(k*53)%390,y=70+(k*79)%360;
   ctx.fillStyle=k%4===0?'#c3e6aa55':'#345c3b88';
   ctx.beginPath();ctx.ellipse(x,y,6+k%3,3+k%3,(k%5)*.6,0,TWO);ctx.fill();}
  for(const [x,y] of [[60,84],[443,104],[83,426],[413,409]]){
   ctx.strokeStyle='#8aac6f';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x,y);
   ctx.bezierCurveTo(x+20,y-16,x-15,y-44,x+14,y-56);ctx.stroke();}
 }
 ctx.restore();
}
function drawBumper(ctx,o,pal,tick){
 const x=o.x*500/o._w,y=o.y*500/o._h,r=o.r/o._scale;
 ctx.save();ctx.shadowColor=pal.glow;ctx.shadowBlur=13;disc(ctx,x,y,r+6,pal.dark);
 ring(ctx,x,y,r+5,pal.glow,3);ctx.shadowBlur=0;
 disc(ctx,x,y,r,pal.edge);disc(ctx,x,y,r*.65,pal.dark);
 star(ctx,x,y,r*.58,4);ctx.fillStyle=pal.bright;ctx.fill();
 ctx.restore();
}
function paint(ctx,realm,level,w=500,h=500,tick=0){
 const pal=THEMES[realm];if(!ctx||!pal)return false;
 const sx=w/500,sy=h/500;ctx.save();ctx.scale(sx,sy);
 const back=ctx.createLinearGradient(0,0,500,500);
 back.addColorStop(0,pal.back);back.addColorStop(1,'#070b16');
 ctx.fillStyle=back;ctx.fillRect(0,0,500,500);
 ctx.save();ctx.shadowColor='#000c';ctx.shadowBlur=26;ctx.shadowOffsetY=10;
 ctx.fillStyle=pal.dark;ctx.fillRect(18,24,464,460);ctx.restore();
 const floorPaint=ctx.createLinearGradient(0,28,500,470);
 floorPaint.addColorStop(0,pal.tile);floorPaint.addColorStop(.46,pal.floor);floorPaint.addColorStop(1,pal.dark);
 ctx.fillStyle=floorPaint;ctx.fillRect(26,26,448,448);
 ctx.save();ctx.beginPath();ctx.rect(27,27,446,446);ctx.clip();
 ctx.globalAlpha=.46;ctx.lineWidth=1;ctx.strokeStyle=pal.line;
 for(let k=50;k<474;k+=36){
  line(ctx,k,26,k,474,pal.line,1);
  line(ctx,26,k,474,k,pal.line,1);
 }
 // Subtle alternating square tiles, kept under all combatants.
 for(let i=0;i<12;i++)for(let j=0;j<12;j++)if((i+j)%2===0){
  ctx.fillStyle=pal.bright;ctx.globalAlpha=.027;
  ctx.fillRect(27+i*36,27+j*36,35,35);
 }
 ctx.globalAlpha=.88;
 decorations(ctx,realm,tick,pal);
 centerDesign(ctx,realm,tick);
 ctx.restore();
 // Raised-looking architectural trim outside the flat physical playfield;
 // its drawing does not add a separate vertical collision tier.
 ctx.fillStyle=pal.dark;ctx.fillRect(18,19,464,9);ctx.fillRect(18,473,464,10);
 ctx.fillRect(18,19,10,464);ctx.fillRect(472,19,10,464);
 ctx.strokeStyle=pal.edge;ctx.lineWidth=5;ctx.strokeRect(26,26,448,448);
 ctx.strokeStyle=pal.bright;ctx.globalAlpha=.58;ctx.lineWidth=1.5;ctx.strokeRect(31,31,438,438);ctx.globalAlpha=1;
 for(const [x,y] of [[26,26],[474,26],[26,474],[474,474]]){
  disc(ctx,x,y,11,pal.dark);ring(ctx,x,y,10,pal.edge,3);star(ctx,x,y,6,4);ctx.fillStyle=pal.bright;ctx.fill();
 }
 const map=getMap(realm,level,w,h,tick);
 for(const o of map.obstacles){drawBumper(ctx,{...o,_w:w,_h:h,_scale:Math.min(sx,sy)},pal,tick);}
 ctx.restore();return true;
}
function reset(){cached=null;}
const flat={getMap,at,heightAt,isWalkable,clearance,bounce,nextWaypoint,paint,reset,style:THEMES};
g.ArenaTowerArchitecture=Object.freeze(flat);
g.ArenaTowerFlat=Object.freeze({enabled:true,THEMES,LEFT,RIGHT,BUMPERS,getMap,at,bounce,paint});
})(typeof window!=='undefined'?window:globalThis);

/* Six deterministic tower arenas: raised traversable islands, height and
 * lightweight terrain effects. Active only in Tower PvE; no PvP globals. */
(function(g){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),PI=Math.PI;
const C={
 time:{base:'#493923',side:'#6f542d',top:'#c6aa68',rim:'#ffe1a0',symbol:'◷'},
 space:{base:'#141933',side:'#363161',top:'#7774b2',rim:'#d5c8ff',symbol:'✧'},
 fire:{base:'#23171b',side:'#47262a',top:'#635052',rim:'#ff8955',symbol:'♨'},
 storm:{base:'#1b3046',side:'#2f5d74',top:'#81a4b5',rim:'#c5f7ff',symbol:'ϟ'},
 ice:{base:'#17334b',side:'#23647b',top:'#83cadf',rim:'#e1faff',symbol:'❄'},
 forest:{base:'#243629',side:'#3c613e',top:'#80a575',rim:'#d2f2a0',symbol:'♧'}
};
const NODES={
 fire:[[.5,.46,.21,47],[.19,.32,.14,23],[.81,.68,.14,28]],
 time:[[.5,.5,.27,39],[.22,.36,.16,25],[.78,.65,.16,31]],
 space:[[.49,.5,.22,58],[.18,.29,.15,32],[.81,.70,.16,39]],
 ice:[[.52,.43,.23,41],[.22,.7,.17,29],[.8,.32,.15,36]],
 storm:[[.5,.52,.23,50],[.16,.35,.14,30],[.84,.65,.14,32]],
 forest:[[.5,.48,.24,43],[.23,.67,.17,25],[.76,.28,.16,28]]
};
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
// Each realm owns a different *physical* silhouette, not just a color scheme.
// Coordinates are arena-world positions; the same polygons are painted,
// sampled for elevations and used for bouncy perimeter collisions.
const OUTLINES={
 fire:[[.08,.33],[.18,.15],[.40,.13],[.52,.07],[.79,.17],[.94,.34],[.85,.51],[.94,.72],[.72,.91],[.52,.87],[.33,.94],[.13,.77],[.22,.57],[.06,.49]],
 space:[[.49,.06],[.58,.17],[.92,.80],[.84,.90],[.19,.90],[.08,.80],[.42,.17]],
 storm:[[.06,.52],[.22,.38],[.33,.28],[.49,.08],[.63,.30],[.80,.32],[.95,.51],[.79,.66],[.65,.72],[.51,.92],[.34,.73],[.20,.68]],
 ice:[[.10,.10],[.38,.10],[.46,.19],[.58,.10],[.89,.12],[.89,.36],[.81,.46],[.91,.57],[.89,.90],[.63,.88],[.53,.79],[.41,.91],[.11,.88],[.11,.60],[.19,.51],[.10,.40]],
 forest:null,
 time:null
};
function outline(realm,width=500,height=500){
 let pts=OUTLINES[realm];
 if(!pts&&realm==='time')pts=Array.from({length:48},(_,i)=>{
  const a=i*Math.PI/24-Math.PI/2,r=i%4<2?.467:.421;
  return [.5+Math.cos(a)*r,.5+Math.sin(a)*r];
 });
 if(!pts)pts=Array.from({length:28},(_,i)=>{
  const a=i*Math.PI/14-Math.PI/2,r=(i%7===3?.82:i%7===4?.87:1)*(.90+.08*Math.sin(i*1.8));
  return [.5+Math.cos(a)*.49*r,.5+Math.sin(a)*.47*r];
 });
 return pts.map(([x,y])=>({x:x*width,y:y*height}));
}
function polygonMetrics(points,x,y){
 let inside=false,best=Infinity,foot=null,area=0;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[j],b=points[i],vx=b.x-a.x,vy=b.y-a.y,length2=vx*vx+vy*vy||1;
  const t=clamp(((x-a.x)*vx+(y-a.y)*vy)/length2,0,1),px=a.x+vx*t,py=a.y+vy*t;
  const d=Math.hypot(x-px,y-py);
  if(d<best){best=d;foot={x:px,y:py,vx,vy};}
  if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  area+=a.x*b.y-b.x*a.y;
 }
 const sign=area>=0?1:-1,edge=Math.hypot(foot.vx,foot.vy)||1;
 return {clearance:inside?best:-best,near:foot,inside,normalX:-foot.vy/edge*sign,normalY:foot.vx/edge*sign};
}
function polygonPath(ctx,points){ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();}
function footprint(realm,node){
 const {x,y,r,index}=node;
 let vertices=[];
 if(realm==='time'){const sides=index===0?40:28;vertices=Array.from({length:sides},(_,i)=>{
   const a=i*2*PI/sides-PI/2,rad=(i%4<2?1:.82)*r;return [Math.cos(a)*rad,Math.sin(a)*rad];});}
 else if(realm==='fire'){const sides=index===0?9:index===1?5:7;vertices=Array.from({length:sides},(_,i)=>{const a=i*2*PI/sides-.8,rad=r*(i%3===1?.79:1);return [Math.cos(a)*rad,Math.sin(a)*rad];});}
 else if(realm==='space'){const a=-PI/2+index*.33;vertices=Array.from({length:3},(_,i)=>[Math.cos(a+i*2*PI/3)*r*1.26,Math.sin(a+i*2*PI/3)*r*1.25]);}
 else if(realm==='storm'){vertices=[[-1.18,0],[-.20,-.55],[.08,-1.13],[1.14,-.06],[.24,.59],[-.06,1.07]].map(([a,b])=>[a*r,b*r]);}
 else if(realm==='ice'){vertices=[[-.95,-.95],[.18,-.95],[.29,-.73],[.94,-.91],[.92,.82],[.38,.91],[.12,.72],[-.93,.92]].map(([a,b])=>[a*r,b*r]);}
 else {vertices=Array.from({length:18},(_,i)=>{const a=i*PI/9,rad=r*(i%6===2?.73:i%6===3?.87:1.12);return [Math.cos(a)*rad,Math.sin(a)*rad*.82];});}
 return vertices.map(([px,py])=>({x:x+px,y:y+py}));
}
function arenaClearance(realm,x,y,width=500,height=500){
 const a=g.ArenaTowerArchitecture;return a?a.clearance(realm,x,y,width,height,active?.tick||0,active?.level||1):polygonMetrics(outline(realm,width,height),x,y).clearance;
}
function isWalkable(realm,x,y,width=500,height=500,radius=0){
 const a=g.ArenaTowerArchitecture;return a?a.isWalkable(realm,x,y,width,height,radius,active?.level||1,active?.tick||0):arenaClearance(realm,x,y,width,height)>=radius;
}
function boundaryBounce(p,realm,width,height){
 if(g.ArenaTowerArchitecture)return g.ArenaTowerArchitecture.bounce(p,realm,width,height,active?.level||1,active?.tick||0);
 const polygon=outline(realm,width,height),pad=Math.max(5,Math.min(30,Number(p.radius)||20)*.65);
 let hit=false;
 for(let k=0;k<3;k++){
  const m=polygonMetrics(polygon,p.x,p.y);
  if(m.clearance>=pad)break;
  const displacement=pad-m.clearance;
  p.x=m.near.x+m.normalX*(pad+1);
  p.y=m.near.y+m.normalY*(pad+1);
  if(!hit){
   const towardWall=(p.vx||0)*m.normalX+(p.vy||0)*m.normalY;
   if(towardWall<0){const elasticity=.71;
    p.vx-=(1+elasticity)*towardWall*m.normalX;
    p.vy-=(1+elasticity)*towardWall*m.normalY;
    p._towerRimBounce=(p._towerRimBounce||0)+1;
    g.BounceMomentum?.wall?.(p,Math.abs(towardWall));
   }
  }
  hit=true;
 }
 return hit;
}

// The same floor field is sampled for rendering, actor footing, and projectiles.
// The only active context lives for a Tower encounter and is removed on exit.
let active=null;
const between=(a,b,t)=>a+(b-a)*t;
function phaseOf(t,period){return (Math.max(0,t)||0)%period;}
function ventPhase(t){return phaseOf(t,540);}
function ventLift(t){const q=ventPhase(t);return q<180?0:q<265?24*smooth((q-180)/85):q<350?24:q<425?24*(1-smooth((q-350)/75)):0;}

function nodes(realm,level=1,width=500,height=500,tick=0){
 const base=NODES[realm]||NODES.time,variance=((level-1)%4)*.018;
 return base.map(([x,y,r,z],i)=>{
  let px=x*width,py=(y+(i===0?0:i===1?variance:-variance))*height;
  let lift=z+(level>=6?5:0);
  // Clock gears rotate gently; satellites bob; roots grow; ice cracks
  // periodically. The same tick drives visible surfaces AND gameplay height.
  const t=Math.max(0,Number(tick)||0);
  if(realm==='time'&&i>0){
    const a=t*.004+i*2.6;
    px+=Math.cos(a)*Math.min(14,width*.026);
    py+=Math.sin(a)*Math.min(13,height*.024);
  }
  if(realm==='space')lift+=Math.sin(t*.023+i*1.3)*8;
  if(realm==='fire'&&i===0)lift+=ventLift(t);
  if(realm==='storm')lift+=Math.sin(t*.018+i*.9)*(i===0?8:5);
  if(realm==='forest'&&i===2)lift+=Math.sin(t*.016)*9;
  if(realm==='ice'&&i===2&&t%540>=410)lift=Math.max(6,lift*.24);
  return {x:px,y:py,r:r*Math.min(width,height)*(level%5===0?1.12:1),
   z:lift,index:i};
 });
}
// Cache one geometry snapshot per simulation frame so high-speed multi-shot
// encounters do not reconstruct 3D meshes for every swept bullet sample.
let geometryCache=null;
function geometry(realm,level,width,height,tick){
 const key=[realm,level,width,height,tick].join(':');
 if(geometryCache?.key===key)return geometryCache;
 const platforms=nodes(realm,level,width,height,tick);
 return (geometryCache={key,platforms,peak:Math.max(22,...platforms.map(n=>n.z)),polygons:platforms.map(n=>footprint(realm,n))});
}
function heightAt(realm,level,x,y,width=500,height=500,tick=0){
 if(g.ArenaTowerArchitecture)return 0; // All tower walkable islands share the same level.
 if(g.ArenaTowerArchitecture)return g.ArenaTowerArchitecture.heightAt(realm,level,x,y,width,height,tick);
 let z=0;const geo=geometry(realm,level,width,height,tick),platforms=geo.platforms;
 for(let i=0;i<platforms.length;i++){
   const n=platforms[i];
   // All platform vertex coordinates are at most 1.26 radii from the
   // center. Skip expensive polygon edge tests for points clearly outside
   // the bounding box. The resulting height is exactly unchanged (zero).
   if(Math.abs(x-n.x)>n.r*1.32||Math.abs(y-n.y)>n.r*1.32)continue;
   const shape=polygonMetrics(geo.polygons[i],x,y);
   // Flat tops and narrow, tangible slopes instead of three soft circles.
   let plateau=smooth(shape.clearance/Math.max(5,n.r*.17));
   if(realm==='fire'&&n.index===0){const radial=Math.hypot(x-n.x,y-n.y)/n.r;
     if(radial<.32)plateau*=.88; // recessed crater; rim remains elevated
   }
   z=Math.max(z,n.z*plateau);
 }
 // Previously only painted bridges linked the islands: a fighter looked as
 // though it walked on a ramp, but its physics instantly fell to z=0.
 for(let i=1;i<platforms.length;i++){
   const a=platforms[0],b=platforms[i],dx=b.x-a.x,dy=b.y-a.y;
   const len2=dx*dx+dy*dy||1,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/len2,0,1);
   const dist=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
   const halfWidth=Math.min(width,height)*.042;
   const ridge=between(a.z,b.z,t)*.88*(1-smooth((dist-halfWidth*.65)/(halfWidth*.65)));
   z=Math.max(z,ridge);
 }
 // Distinct terrain cross-sections exist BETWEEN the major terraces.
 // They affect actor elevation and low-flying projectiles, not just color.
 const nx=x/Math.max(1,width),ny=y/Math.max(1,height);
 const segment=(x1,y1,x2,y2)=>{
   const dx=x2-x1,dy=y2-y1,u=clamp(((nx-x1)*dx+(ny-y1)*dy)/(dx*dx+dy*dy||1),0,1);
   return Math.hypot(nx-x1-u*dx,ny-y1-u*dy);
 };
 if(realm==='time'){
   const ring=Math.hypot(nx-.5,ny-.5),gear=smooth((.055-Math.abs(ring-.345))/.04);
   z=Math.max(z,13*gear); // external clock track: a raised circular rail
 }else if(realm==='space'){
   const pit=smooth((.105-Math.hypot(nx-.35,ny-.59))/.072);
   z=Math.max(0,z-18*pit); // gravitational sink beside the triangular spine
 }else if(realm==='storm'){
   const crest=smooth((.062-segment(.15,.63,.83,.34))/.05);
   z=Math.max(z,22*crest); // long diagonal ridge, not isolated disks
 }else if(realm==='ice'){
   const fault=smooth((.031-segment(.11,.52,.87,.47))/.027);
   z=Math.max(0,z-17*fault); // fissure in the rectangular ice shelf
 }else if(realm==='forest'){
   const root=smooth((.072-segment(.16,.71,.80,.30))/.055);
   z=Math.max(z,17*root); // thick ridgeline across the living ground
 }else if(realm==='fire'){
   const rim=smooth((.055-Math.abs(Math.hypot(nx-.5,ny-.46)-.30))/.049);
   z=Math.max(z,14*rim); // basalt rim surrounds the recessed caldera
 }
 return z;
}
function worldHeight(x,y){
 return active?heightAt(active.realm,active.level,x,y,active.width,active.height,active.tick):0;
}
// A raised island is solid cover. Sample the swept segment, not just its end,
// and compare terrain against the bullet's world-space altitude.
function obstructsShot(x0,y0,z0,x1,y1,z1,clearance=9){
 if(!active||![x0,y0,z0,x1,y1,z1].every(Number.isFinite))return false;
 // A projectile entirely above the highest terrain cannot hit a platform.
 // Platform tops dominate the cross-section ridges (all <=22 world units).
 const snapshot=geometry(active.realm,active.level,active.width,active.height,active.tick);
 if(Math.min(z0,z1)>=snapshot.peak-clearance)return false;
 const length=Math.hypot(x1-x0,y1-y0),steps=Math.max(1,Math.ceil(length/5));
 for(let i=1;i<=steps;i++){
   const t=i/steps;
   if(worldHeight(between(x0,x1,t),between(y0,y1,t))>between(z0,z1,t)+clearance)return true;
 }
 return false;
}

function paint(ctx,realm,level,width=500,height=500,frame=0){
 if(g.ArenaTowerArchitecture)return g.ArenaTowerArchitecture.paint(ctx,realm,level,width,height,frame);
 const theme=C[realm];if(!theme||!ctx)return false;
 const platforms=nodes(realm,level,width,height,frame);
 ctx.save();
 // The arena silhouette is the actual collision perimeter (including indents).
 // Color the void outside it distinctly so the rebound edge is readable.
 const rim=outline(realm,width,height);
 ctx.save();polygonPath(ctx,rim);ctx.fillStyle=theme.base;ctx.globalAlpha=.78;ctx.fill();
 ctx.globalAlpha=1;ctx.strokeStyle=theme.rim;ctx.lineWidth=5;ctx.lineJoin='round';ctx.stroke();
 ctx.strokeStyle=theme.side;ctx.lineWidth=15;ctx.globalAlpha=.47;ctx.stroke();ctx.restore();
 // Low-lying ridges and fissures are physically sampled in heightAt.
 ctx.save();ctx.lineCap='round';ctx.globalAlpha=.74;
 if(realm==='storm'||realm==='forest'||realm==='ice'){
   const a=realm==='storm'?[.15,.63,.83,.34]:realm==='forest'?[.16,.71,.80,.30]:[.11,.52,.87,.47];
   ctx.beginPath();ctx.moveTo(a[0]*width,a[1]*height);ctx.lineTo(a[2]*width,a[3]*height);
   ctx.lineWidth=Math.min(width,height)*(realm==='ice'?.027:.038);
   ctx.strokeStyle=realm==='ice'?'#071725':realm==='storm'?'#b5f0ff':'#446f37';ctx.stroke();
 }else if(realm==='time'||realm==='fire'){
   ctx.beginPath();ctx.ellipse(width*.5,height*(realm==='fire'?.46:.5),width*(realm==='fire'?.30:.345),height*(realm==='fire'?.30:.345),0,0,PI*2);
   ctx.strokeStyle=theme.rim;ctx.lineWidth=Math.min(width,height)*.025;ctx.stroke();
 }else if(realm==='space'){
   ctx.beginPath();ctx.arc(width*.35,height*.59,Math.min(width,height)*.085,0,PI*2);
   ctx.strokeStyle='#281d54';ctx.lineWidth=Math.min(width,height)*.045;ctx.stroke();
 }
 ctx.restore();
  // The top physically sits z units above the ground footprint. Draw
  // the unprojected circular footprint here: ArenaDepth.projectWorld turns
  // it into the same perspective ellipse used for the fighter's feet.
 for(const n of platforms){
   const r=n.r,topY=n.y-n.z,upper=footprint(realm,n);
   const base=upper.map(p=>({x:p.x,y:p.y}));
   const top=upper.map(p=>({x:p.x,y:p.y-n.z}));
   ctx.fillStyle='#0000004a';polygonPath(ctx,base);ctx.fill();
   // Front-facing side walls expose actual world elevation. Irregular
   // polygons, triangle edges, gear teeth and square corners stay visible.
   ctx.fillStyle=theme.side;
   for(let i=0;i<upper.length;i++){
     const a=upper[i],b=upper[(i+1)%upper.length];
     if(b.x-a.x<0){ctx.beginPath();ctx.moveTo(a.x,a.y-n.z);ctx.lineTo(b.x,b.y-n.z);
       ctx.lineTo(b.x,b.y);ctx.lineTo(a.x,a.y);ctx.closePath();ctx.fill();}
   }
   ctx.fillStyle=theme.top;ctx.globalAlpha=.91;
   polygonPath(ctx,top);ctx.fill();ctx.globalAlpha=1;
   ctx.strokeStyle=theme.rim;ctx.lineWidth=2.8;polygonPath(ctx,top);ctx.stroke();
   ctx.strokeStyle='#ffffff55';ctx.lineWidth=1.2;
   ctx.beginPath();ctx.moveTo(top[0].x,top[0].y);
   ctx.lineTo(top[Math.floor(top.length/2)].x,top[Math.floor(top.length/2)].y);ctx.stroke();
   ctx.save();ctx.translate(n.x,topY);
   if(realm==='fire'){
     ctx.strokeStyle='#ff7042';ctx.lineWidth=n.index===0?6:3;
     ctx.beginPath();ctx.arc(0,0,r*(n.index===0?.29:.20),0,PI*2);ctx.stroke();
     for(let k=0;k<6;k++){const a=k*PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.32,Math.sin(a)*r*.32);
       ctx.lineTo(Math.cos(a+.12)*r*.78,Math.sin(a+.12)*r*.78);ctx.stroke();}
   }else if(realm==='time'){
     ctx.strokeStyle='#382b1d';ctx.lineWidth=6;
     ctx.beginPath();ctx.arc(0,0,r*.49,0,PI*2);ctx.stroke();
     ctx.beginPath();ctx.arc(0,0,r*.12,0,PI*2);ctx.stroke();
   }else if(realm==='space'){
     ctx.strokeStyle='#d9c3ff';ctx.lineWidth=3;
     for(let i=0;i<3;i++){const a=i*2*PI/3-PI/2;ctx.beginPath();ctx.moveTo(0,0);
       ctx.lineTo(Math.cos(a)*r*.85,Math.sin(a)*r*.85);ctx.stroke();}
   }else if(realm==='storm'){
     ctx.strokeStyle='#c1f6ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-r*.8,0);
     ctx.lineTo(-r*.1,-r*.3);ctx.lineTo(r*.15,r*.3);ctx.lineTo(r*.87,0);ctx.stroke();
   }else if(realm==='ice'){
     ctx.strokeStyle='#e8fcff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-r*.83,r*.08);
     ctx.lineTo(-r*.14,-r*.27);ctx.lineTo(r*.33,r*.07);ctx.lineTo(r*.83,-r*.54);ctx.stroke();
   }else{
     ctx.strokeStyle='#3f6237';ctx.lineWidth=5;for(let i=-2;i<=2;i++){
       ctx.beginPath();ctx.moveTo(-r*.8,i*r*.25);ctx.bezierCurveTo(-r*.2,i*r*.09,r*.1,i*r*.32,r*.85,i*r*.10);ctx.stroke();}
   }
   ctx.fillStyle=theme.base;ctx.globalAlpha=.75;
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+Math.round(r*.30)+'px system-ui';
   ctx.fillText(theme.symbol,0,-4);ctx.restore();
 }
 // Realm architecture painted behind combatants, without changing collision.
 ctx.save();ctx.lineWidth=2;ctx.globalAlpha=.68;
 for(let i=0;i<platforms.length;i++){
  const n=platforms[i],rad=n.r;
  ctx.strokeStyle=theme.rim;
  if(realm==='time'){
   for(let k=0;k<16;k++){const a=k*Math.PI/8;ctx.beginPath();ctx.moveTo(n.x+Math.cos(a)*rad*.65,n.y+Math.sin(a)*rad*.42);ctx.lineTo(n.x+Math.cos(a)*rad*.85,n.y+Math.sin(a)*rad*.54);ctx.stroke();}
  }else if(realm==='space'){
   ctx.beginPath();ctx.ellipse(n.x,n.y,rad*.75,rad*.19,-.38,0,PI*2);ctx.stroke();
   ctx.beginPath();ctx.ellipse(n.x,n.y,rad*.35,rad*.53,.55,0,PI*2);ctx.stroke();
  }else if(realm==='fire'){
   for(let k=-2;k<=2;k++){ctx.beginPath();ctx.moveTo(n.x+k*rad*.25,n.y-rad*.34);ctx.lineTo(n.x+(k+.22)*rad*.25,n.y+rad*.35);ctx.stroke();}
  }else if(realm==='storm'){
   for(let k=-2;k<=2;k++){const x=n.x+k*rad*.32;ctx.beginPath();ctx.moveTo(x,n.y-rad*.3);ctx.lineTo(x+rad*.12,n.y);ctx.lineTo(x-rad*.02,n.y+rad*.28);ctx.stroke();}
  }else if(realm==='ice'){
   for(let k=0;k<6;k++){const a=k*PI/3;ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(n.x+Math.cos(a)*rad*.66,n.y+Math.sin(a)*rad*.42);ctx.stroke();}
  }else if(realm==='forest'){
   for(let k=0;k<5;k++){const a=k*PI*2/5;ctx.beginPath();ctx.ellipse(n.x+Math.cos(a)*rad*.45,n.y+Math.sin(a)*rad*.27,rad*.28,rad*.12,a,0,PI*2);ctx.stroke();}
  }
 }
 ctx.restore();
 // Connecting slopes between islands ensure that a moving AI never gets stuck.
 ctx.lineCap='round';ctx.lineWidth=Math.max(11,Math.min(width,height)*.048);
 ctx.strokeStyle=theme.side;ctx.globalAlpha=.67;
 for(let i=1;i<platforms.length;i++){
   const a=platforms[0],b=platforms[i];
   ctx.beginPath();ctx.moveTo(a.x,a.y-a.z);ctx.lineTo(b.x,b.y-b.z);ctx.stroke();
   ctx.strokeStyle=theme.rim;ctx.lineWidth=Math.max(3,Math.min(width,height)*.009);ctx.stroke();
   ctx.strokeStyle=theme.side;ctx.lineWidth=Math.max(11,Math.min(width,height)*.048);
 }
 // Realm-specific height telegraphs are drawn at the exact raised surface.
 const t=phaseOf(frame,540),main=platforms[0];
 if(realm==='fire'&&t>=145&&t<425){
   ctx.save();ctx.translate(main.x,main.y-main.z);ctx.strokeStyle=t<265?'#ffd36b':'#ff512c';
   ctx.lineWidth=4+(t<265?3*Math.sin(frame*.24)**2:4);ctx.setLineDash(t<265?[9,5]:[]);
   ctx.beginPath();ctx.arc(0,0,main.r*.86,0,PI*2);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle='#ffe8a0';ctx.font='bold 15px system-ui';ctx.textAlign='center';
   ctx.fillText(t<265?'분화 예고':t<350?'분화 중':'용암 가라앉음',0,-main.r*.45);
   ctx.restore();
 }
 if(realm==='storm'&&phaseOf(frame,450)>=180&&phaseOf(frame,450)<290){
   ctx.save();ctx.strokeStyle='#c5faff';ctx.lineWidth=3;
   const center=platforms[0];
   for(let k=0;k<6;k++){const a=k*PI/3+frame*.016,r=center.r*.55;
     ctx.beginPath();ctx.moveTo(center.x+Math.cos(a)*r,center.y-center.z+Math.sin(a)*r);
     ctx.lineTo(center.x+Math.cos(a)*r*.35,center.y-center.z+Math.sin(a)*r*.35-28);ctx.stroke();}
   ctx.restore();
 }
 if(realm==='ice'&&phaseOf(frame,540)>=355&&phaseOf(frame,540)<480){
   const ice=platforms[2];ctx.save();ctx.strokeStyle='#f0ffff';ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(ice.x,ice.y-ice.z,ice.r*.76,0,PI*2);ctx.stroke();
   ctx.fillStyle='#e8feff';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText('빙판 붕괴',ice.x,ice.y-ice.z-ice.r*.32);ctx.restore();
 }
 ctx.globalAlpha=1;ctx.restore();return true;
}
// Called once after movement and once after encounter advancement. `sync` only
// updates footing, while `step` owns time-dependent hazards and movement buffs.
function sync(roster){
 if(!active)return;
 for(const p of roster||[])if(p&&p.hp>0){
   const oldX=p._towerSafeX,oldY=p._towerSafeY,oldZ=Number(p.towerGroundZ)||0;
   const entered=g.ArenaTowerArchitecture?.at?.(active.realm,active.level,p.x,p.y,
     active.width,active.height,active.tick);
   if(!entered?.surface){
     // Walking into a ledge still rebounds; only already-airborne fighters
     // can cross it. A timed flight/hover can maintain lift, others fall.
     const inAir=(p.z||0)>0||(p.vz||0)>1||(p.hoverTime||0)>0||(p.glideTime||0)>0;
     if(!p._towerOverVoid&&inAir&&oldZ>0)p.z=Math.max(p.z||0,(p.z||0)+oldZ);
     const wasOverVoid=!!p._towerOverVoid;
     p._towerOverVoid=inAir;
     if(!inAir){
       if(wasOverVoid){
         // A previously flying fighter has now hit the abyss, not just
         // wandered against its wall: schedule the realm's fall hazard.
         p._towerVoidFallPending=true;p._towerOverVoid=false;
       }
       boundaryBounce(p,active.realm,active.width,active.height);
     }else if((p.z||0)<=0&&(p.hoverTime||0)<=0){
       p._towerVoidFallPending=true;
       p.x=Number.isFinite(oldX)?oldX:(entered?.nearest?.point?.x||250);
       p.y=Number.isFinite(oldY)?oldY:(entered?.nearest?.point?.y||250);
       p.z=0;p.vz=0;p._towerOverVoid=false;
     }
   }else{
     if(p._towerOverVoid){
       p.z=Math.max(0,(p.z||0)-entered.height);
       p._towerOverVoid=false;
     }
   }
   if(!p._towerOverVoid)boundaryBounce(p,active.realm,active.width,active.height);
   const current=g.ArenaTowerArchitecture?.at?.(active.realm,active.level,p.x,p.y,
     active.width,active.height,active.tick);
   const goal=worldHeight(p.x,p.y);
   // A low fighter cannot climb a high vertical wall by simply walking
   // across the top-down silhouette; ramps/steps are the physical route.
   if(g.ArenaTowerArchitecture&&goal-oldZ>16&&p.z<4&&
      current?.surface&&!current.surface.from&&
      Number.isFinite(oldX)&&Number.isFinite(oldY)&&!(p.movementOnlyFrames>0)){
     // A steep step is a pinball wall, not a speed-killing reset.
     const dx=p.x-oldX,dy=p.y-oldY,dist=Math.hypot(dx,dy)||1;
     const nx=dx/dist,ny=dy/dist;
     const vx=Number(p.vx)||0,vy=Number(p.vy)||0;
     const incoming=Math.max(0,vx*nx+vy*ny);
     p.x=oldX;p.y=oldY;
     if(incoming>.08){
       p.vx=(vx-1.87*incoming*nx)*.97;
       p.vy=(vy-1.87*incoming*ny)*.97;
       g.ArenaBallSquash?.wall?.(p,-nx,-ny,incoming);
       g.BounceMomentum?.wall?.(p,incoming);
     }
   }
   p._towerPreviousFloor=oldZ;
   p.towerGroundZ=worldHeight(p.x,p.y);
 }
}
function step(realm,level,roster,width=500,height=500,tick=0,damage){
 const prev=active;
 active={realm,level,width,height,tick};
 const curr=nodes(realm,level,width,height,tick),oldNodes=prev?.realm===realm?nodes(realm,level,width,height,prev.tick):null;
 for(const p of roster||[]){
  if(!p||p.hp<=0)continue;
  if(!p._towerOverVoid)boundaryBounce(p,realm,width,height);
  const before=Number.isFinite(p._towerPreviousFloor)?p._towerPreviousFloor:(Number(p.towerGroundZ)||0);
  delete p._towerPreviousFloor;
  // Moving gears carry grounded occupants a little; travel stays inside
  // real world XY coordinates and stays bounded by the small island motion.
  if(realm==='time'&&oldNodes&&!(p.z>2))for(let i=1;i<3;i++){
    const old=oldNodes[i],next=curr[i];
    if(Math.hypot(p.x-old.x,p.y-old.y)<old.r*.64){
      p.x+=clamp(next.x-old.x,-2,2);p.y+=clamp(next.y-old.y,-2,2);break;
    }
  }
  const ground=worldHeight(p.x,p.y);
  // A collapsing island removes the floor under an actor. Let gravity carry
  // them down instead of teleporting the sprite through the vertical wall.
  if(before-ground>5&&!(p.z>2)&&realm==='ice'){
    p.z=clamp(before-ground,0,52);
    p.vz=Math.min(Number(p.vz)||0,-1.5);
  }
  p.towerGroundZ=ground;
  p.towerGravity=realm==='space'?.34:realm==='storm'?.44:.55;
  p.towerTerrainSpeed=realm==='forest'&&ground>15?.9:realm==='fire'&&ventPhase(tick)>=265&&ventPhase(tick)<350&&ground>25?.87:1;
  p.towerHeightLabel=realm==='space'?'저중력':realm==='storm'?'상승기류':realm==='ice'?'붕괴 지형':realm==='fire'?'용암 승강대':realm==='time'?'회전 기어':'성장하는 뿌리';
  if(realm==='storm'&&p.z<2&&ground>20&&phaseOf(tick,450)===260){
    g.AdvancedCombat?.launch?.(p,7.5);
  }
  // Falling off a broken bridge recoils before a mild, once-per-event penalty.
  if(p._towerVoidFallPending){p._towerVoidFallPending=false;
    if(p.towerHero){
      const damageRatio=realm==='fire'?.09:realm==='space'?.075:realm==='storm'?.055:.04;
      damage?.(p,Math.max(4,Math.round((p.maxHp||100)*damageRatio)),
       {realm,kind:'terrain',label:realm==='fire'?'용암 추락':realm==='space'?'우주 심연':realm==='ice'?'빙하 추락':'지형 추락'});
    }
  }
  // Fire's magma lift has a warning and a single confirmed-hit pulse. It is
  // a boss arena hazard, never a hidden permanent damage aura or a PvP rule.
  if(realm==='fire'&&tick>0&&ventPhase(tick)===285&&p.towerHero&&p.z<18&&p._towerVentHitFrame!==tick&&
     (g.ArenaTowerArchitecture?.at?.(realm,level,p.x,p.y,width,height,tick).surface?.id==='caldera'||ground>30)){
    p._towerVentHitFrame=tick;
    damage?.(p,level>=5?27:17,{realm:'fire',kind:'terrain',label:'용암 분화'});
  }
 }
}
function clear(roster){
 active=null;geometryCache=null;g.ArenaTowerArchitecture?.reset?.();
 for(const p of roster||[])if(p){
  for(const key of ['towerGroundZ','towerGravity','towerTerrainSpeed','towerHeightLabel','_towerPreviousFloor','_towerVentHitFrame','_towerRimBounce','_towerVoidFallPending','_towerVoidCooldown','_towerSafeX','_towerSafeY','_towerOverVoid'])delete p[key];
 }
}
g.ArenaTowerTerrain={nodes,heightAt,worldHeight,obstructsShot,paint,sync,step,clear,
  outline,footprint,arenaClearance,isWalkable,boundaryBounce,getMap:(...args)=>g.ArenaTowerArchitecture?.getMap?.(...args),
  nextWaypoint:(realm,from,to,w,h,level,tick)=>g.ArenaTowerArchitecture?.nextWaypoint?.(realm,from,to,w,h,level,tick),THEMES:C};
})(globalThis);

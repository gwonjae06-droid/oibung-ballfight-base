/* 6 independent 2.5D tower architectures. One source for rendered decks,
 * climbable ramps, AI navigation, real elevation and void collision.
 * Coordinates below are the authored 500x500 world in the map specification. */
(function(g){
'use strict';
const PI=Math.PI,TAU=2*PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round=(cx,cy,r,sides=12,offset=-PI/2)=>Array.from({length:sides},(_,i)=>[cx+Math.cos(offset+i*TAU/sides)*r,cy+Math.sin(offset+i*TAU/sides)*r]);
const poly=(id,z,pts,kind='deck')=>({id,z,points:pts,kind});
const bridge=(id,a,b,width,z0,z1,kind='ramp')=>({id,kind,from:a,to:b,width,z0,z1,z:(z0+z1)/2});
function shapes(realm,tick=0,level=1){
 const t=Math.max(0,Number(tick)||0),hi=level>=6?4:0;
 if(realm==='time'){
  const gear=(cx,cy,r,teeth)=>Array.from({length:teeth*4},(_,i)=>{const a=i*TAU/(teeth*4)-PI/2,rr=r*(i%4<2?1:.86);return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr];});
  const xw=104+Math.cos(t*.004+2.6)*13,yw=220+Math.sin(t*.004+2.6)*12;
  const xe=399+Math.cos(t*.004+5.2)*13,ye=291+Math.sin(t*.004+5.2)*12;
  return [poly('clock-ring',15,gear(250,250,213,30),'ring'),
   poly('clock-core',68+hi,round(250,248,87,8,PI/8)),
   poly('west-gear',42+hi,gear(xw,yw,55,12)),poly('east-gear',47+hi,gear(xe,ye,58,12)),
   bridge('north-stairs',[250,94],[250,169],44,15,68+hi,'stairs'),
   bridge('south-stairs',[250,404],[250,325],46,15,68+hi,'stairs'),
   bridge('west-wheel',[94,218],[167,229],31,15,42+hi),
   bridge('east-wheel',[335,277],[403,300],31,15,47+hi),
   bridge('core-west',[157,226],[202,244],40,42+hi,68+hi),
   bridge('gear-crosspath',[161,228],[335,282],43,42+hi,47+hi)];
 }
 if(realm==='space'){
  const lift=Math.sin(t*.021+1.3)*12;
  return [poly('central-crystal',57+hi,[[164,197],[347,190],[271,363],[188,332]]),
   poly('northwest-isle',39+hi,[[43,108],[182,95],[208,217],[63,248]]),
   poly('northeast-isle',72+hi+lift,[[356,107],[463,167],[424,288],[310,214]]),
   poly('southern-isle',21+hi,[[149,370],[287,337],[363,405],[305,480],[157,470]]),
   bridge('nebula-bridge-west',[154,186],[199,245],32,39+hi,57+hi,'energy'),
   bridge('nebula-bridge-east',[317,249],[357,204],30,57+hi,72+hi+lift,'energy'),
   bridge('nebula-bridge-south',[264,324],[271,377],49,57+hi,21+hi,'energy'),
   bridge('nebula-bypass-west',[161,214],[181,373],42,39+hi,21+hi,'energy'),
   bridge('nebula-bypass-east',[362,245],[338,393],42,72+hi+lift,21+hi,'energy')];
 }
 if(realm==='fire'){
  const q=t%540,lift=q<180?0:q<265?24*(q-180)/85:q<350?24:q<425?24*(425-q)/75:0;
  return [poly('western-rim',56+hi,[[40,170],[128,126],[172,174],[151,327],[73,353]]),
   poly('eastern-fortress',75+hi,[[338,134],[447,172],[453,344],[367,363],[319,258]]),
   poly('southern-basalt',22+hi,[[157,353],[278,340],[355,405],[302,467],[138,451]]),
   poly('caldera',Math.max(0,lift),round(248,265,88,14),'crater'),
   poly('crossing-stone-west',14+hi,round(176,268,32,7)),
   poly('crossing-stone-east',27+hi,round(327,303,28,6)),
   bridge('west-to-caldera',[139,290],[182,270],35,56+hi,14+hi),
   bridge('south-to-caldera',[240,379],[246,334],38,22+hi,Math.max(0,lift)),
   bridge('east-to-caldera',[332,301],[293,268],32,75+hi,Math.max(0,lift)),
   bridge('eastern-basalt-steps',[319,406],[380,325],43,22+hi,75+hi,'stairs'),
   bridge('western-basalt-steps',[187,398],[119,317],45,22+hi,56+hi,'stairs'),
   bridge('basalt-rim-crossing',[126,155],[363,162],44,56+hi,75+hi,'stairs')];
 }
 if(realm==='storm'){
  const sway=Math.sin(t*.02)*4;
  return [poly('storm-citadel',88+hi,[[285,55],[439,88],[476,227],[313,241]]),
   poly('wind-court',44+hi+sway,[[135,192],[325,157],[388,315],[180,365]]),
   poly('fallen-bridgehead',18+hi,[[34,326],[163,283],[205,404],[112,479],[24,429]]),
   bridge('gorge-pass-one',[139,344],[200,316],37,18+hi,44+hi+sway),
   bridge('gorge-pass-two',[325,214],[364,191],48,44+hi+sway,88+hi),
   bridge('gorge-bypass',[139,363],[329,209],45,18+hi,88+hi),
   bridge('wind-spur',[244,340],[320,285],28,44+hi+sway,44+hi+sway)];
 }
 if(realm==='ice'){
  const collapse=(t%540>=410&&t%540<480),iceZ=collapse?4:12;
  return [poly('ice-lake',iceZ,[[88,293],[398,291],[439,417],[346,469],[107,455],[56,379]]),
   poly('ice-sanctuary',83+hi,[[166,58],[361,58],[361,210],[166,210]]),
   poly('western-ice-shelf',45+hi,[[48,145],[173,151],[203,257],[64,281]]),
   poly('eastern-ice-shelf',55+hi,[[337,155],[449,137],[455,275],[343,279]]),
   bridge('western-ice-stair-lower',[137,342],[122,253],43,iceZ,45+hi,'stairs'),
   bridge('western-ice-stair-upper',[179,202],[222,164],38,45+hi,83+hi,'stairs'),
   bridge('eastern-ice-stair-lower',[370,345],[392,269],43,iceZ,55+hi,'stairs'),
   bridge('eastern-ice-stair-upper',[351,197],[322,166],44,55+hi,83+hi,'stairs'),
   bridge('frozen-crosspass',[174,245],[337,246],46,45+hi,55+hi,'ice')];
 }
 if(realm==='forest'){
  const root=18+hi+Math.max(0,Math.sin(t*.016))*24;
  return [poly('ancient-ruins',15,[[87,305],[348,306],[411,409],[351,469],[103,452],[50,383]]),
   poly('great-tree',80+hi,round(346,171,105,13)),
   poly('western-moss',35+hi,[[74,177],[150,156],[205,258],[146,290],[63,258]]),
   poly('spore-basin',7,round(235,365,63,12),'swamp'),
   bridge('western-moss-stairs',[173,309],[154,259],45,15,35+hi,'stairs'),
   bridge('root-stair-one',[182,330],[218,229],39,15,50+hi,'roots'),
   bridge('root-stair-two',[218,229],[307,196],37,50+hi,80+hi,'roots'),
   bridge('tree-moss-bridge',[184,196],[284,185],46,35+hi,80+hi,'roots'),
   bridge('forest-bypass',[143,286],[284,260],44,35+hi,80+hi,'roots'),
   poly('rising-root',root,[[140,226],[174,230],[188,251],[161,270],[133,254]])];
 }
 return [];
}
const OBSTACLES={
 time:[[250,208,12]],space:[[249,219,15]],fire:[[411,182,16]],
 storm:[[423,123,17]],ice:[[213,101,13]],forest:[[385,145,17]]
};
const style={
 time:{void:'#17121b',base:'#5d4733',top:'#c4a16c',edge:'#ffe3aa',side:'#4f382a',symbol:'◷',name:'시계 장치'},
 space:{void:'#08061b',base:'#343050',top:'#7560b2',edge:'#d8b9ff',side:'#22213e',symbol:'✧',name:'성운 부유섬'},
 fire:{void:'#310e0c',base:'#39292c',top:'#695052',edge:'#ff9863',side:'#26191e',symbol:'♨',name:'붕괴 화산'},
 storm:{void:'#111c31',base:'#334d62',top:'#81a6b6',edge:'#c5f2ff',side:'#253749',symbol:'ϟ',name:'천공의 성채'},
 ice:{void:'#0b273d',base:'#29627a',top:'#a2d8e3',edge:'#e6fbff',side:'#1d4b63',symbol:'❄',name:'빙정 성소'},
 forest:{void:'#132015',base:'#355037',top:'#7eaa76',edge:'#d6f0aa',side:'#253b2a',symbol:'♧',name:'고대 거목'}
};
function geometry(s,w,h){
 if(s.kind==='deck'||s.kind==='ring'||s.kind==='crater'||s.kind==='swamp')return s.points.map(([x,y])=>({x:x*w/500,y:y*h/500}));
 const [ax,ay]=s.from,[bx,by]=s.to,dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1;
 const nx=-dy/len*s.width*.5,ny=dx/len*s.width*.5;
 return [[ax+nx,ay+ny],[bx+nx,by+ny],[bx-nx,by-ny],[ax-nx,ay-ny]].map(([x,y])=>({x:x*w/500,y:y*h/500}));
}
function metrics(pts,x,y){
 let inside=false,nearest=Infinity,point=null,normal={x:0,y:0};
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const a=pts[j],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,ll=dx*dx+dy*dy||1;
  const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/ll,0,1),cx=a.x+dx*t,cy=a.y+dy*t,dist=Math.hypot(x-cx,y-cy);
  if(dist<nearest){nearest=dist;point={x:cx,y:cy};const d=Math.hypot(dx,dy)||1;normal={x:-dy/d,y:dx/d};}
  if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 // Inward normal is chosen from the edge to the polygon centroid.
 const center={x:0,y:0};for(const q of pts){center.x+=q.x/pts.length;center.y+=q.y/pts.length;}
 if((center.x-point.x)*normal.x+(center.y-point.y)*normal.y<0){normal.x*=-1;normal.y*=-1;}
 return {inside,clearance:inside?nearest:-nearest,point,normal,nearest};
}
let cache=null;
function getMap(realm,level=1,w=500,h=500,tick=0){
 if(!style[realm])return {realm,level,width:w,height:h,tick,surfaces:[],nav:[]};
 const key=[realm,level,w,h,tick].join(':');if(cache?.key===key)return cache.map;
 const surfaces=shapes(realm,tick,level).map(shape=>{const s={...shape,z:0,z0:0,z1:0};return {...s,vertices:geometry(s,w,h),
  bbox:(()=>{const vs=geometry(s,w,h);return {minX:Math.min(...vs.map(v=>v.x)),maxX:Math.max(...vs.map(v=>v.x)),minY:Math.min(...vs.map(v=>v.y)),maxY:Math.max(...vs.map(v=>v.y))};})(),
  cx:(s.from?s.from[0]+s.to[0]:s.points.reduce((a,p)=>a+p[0]*2,0)/s.points.length)*w/1000,
  cy:(s.from?s.from[1]+s.to[1]:s.points.reduce((a,p)=>a+p[1]*2,0)/s.points.length)*h/1000};});
 const nav=surfaces.map(s=>({id:s.id,x:s.cx,y:s.cy,z:s.z,kind:s.kind}));
 const obstacles=(OBSTACLES[realm]||[]).map(([x,y,r])=>({x:x*w/500,y:y*h/500,r:r*Math.min(w,h)/500}));
 return (cache={key,map:{realm,level,width:w,height:h,tick,surfaces,nav,obstacles}}).map;
}
function floorOnSurface(s,x,y,w,h){
 if(!s.from)return s.z;
 const a=s.from,b=s.to,dx=(b[0]-a[0])*w/500,dy=(b[1]-a[1])*h/500;
 const u=clamp(((x-a[0]*w/500)*dx+(y-a[1]*h/500)*dy)/(dx*dx+dy*dy||1),0,1);
 return s.z0+(s.z1-s.z0)*u;
}
function at(realm,level,x,y,w=500,h=500,tick=0){
 const m=getMap(realm,level,w,h,tick);let best=null,inside=null;
 for(const s of m.surfaces){
  const b=s.bbox,dx=Math.max(b.minX-x,0,x-b.maxX),dy=Math.max(b.minY-y,0,y-b.maxY);
  if(Math.hypot(dx,dy)>65)continue; // Avoid high-vertex gear polygons for distant bullets.
  const poly=metrics(s.vertices,x,y);
  if(s.kind==='ring'){const r=Math.hypot(x-250*w/500,y-250*h/500);
    const inner=142*Math.min(w,h)/500;if(r<inner){poly.inside=false;poly.clearance=-Math.max(0,inner-r);}}
  if(!best||poly.clearance>best.clearance)best={...poly,surface:s};
  if(poly.inside){const z=floorOnSurface(s,x,y,w,h);
   if(!inside||z>inside.z)inside={z,surface:s,clearance:poly.clearance};}
 }
 if(!best&&m.surfaces.length){const s=m.surfaces.reduce((best,s)=>{
    const b=s.bbox,d=Math.hypot(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minY-y,0,y-b.maxY));
    return !best||d<best.d?{s,d}:best;},null).s;
    best={...metrics(s.vertices,x,y),surface:s};
  }
 return {height:inside?.z||0,surface:inside?.surface||null,
  clearance:best?.clearance??-Infinity,nearest:best};
}
function heightAt(realm,level,x,y,w=500,h=500,t=0){return at(realm,level,x,y,w,h,t).height;}
function isWalkable(realm,x,y,w=500,h=500,radius=0,level=1,tick=0){
 const map=getMap(realm,level,w,h,tick);
 if(map.obstacles.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+Math.min(radius,8)))return false;
 const q=at(realm,level,x,y,w,h,tick);
 return q.clearance>=Math.min(radius,7)||q.surface!==null;
}
function clearance(realm,x,y,w=500,h=500,tick=0,level=1){
 let value=at(realm,level,x,y,w,h,tick).clearance;
 for(const o of getMap(realm,level,w,h,tick).obstacles)value=Math.min(value,Math.hypot(x-o.x,y-o.y)-o.r);
 return value;
}
// Tower ledges are pinball bumpers, not heavy friction brakes. The movement
// speed stays bounded by the normal arena solver, and bounce never deals damage.
function ricochet(p,nx,ny,dot){
 if(dot>=-.08)return false;
 const vx=Number(p.vx)||0,vy=Number(p.vy)||0;
 const restitution=.87,drag=.97;
 p.vx=(vx-(1+restitution)*dot*nx)*drag;
 p.vy=(vy-(1+restitution)*dot*ny)*drag;
 g.ArenaBallSquash?.wall?.(p,nx,ny,-dot);
 g.BounceMomentum?.wall?.(p,-dot);
 return true;
}
const bounce=(p,realm,w,h,level=1,tick=0)=>{
 const map=getMap(realm,level,w,h,tick),q=at(realm,level,p.x,p.y,w,h,tick),pad=2.5;
 // Immovable scenery blocks walking and projectiles independently of the
 // elevation field. Rebound only; do not add contact damage.
 for(const o of map.obstacles){const dx=p.x-o.x,dy=p.y-o.y,dist=Math.hypot(dx,dy),limit=o.r+Math.min(25,(p.radius||20)*.8);
   if(dist>=limit)continue;
   const nx=dist>.001?dx/dist:1,ny=dist>.001?dy/dist:0;
   p.x=o.x+nx*(limit+1);p.y=o.y+ny*(limit+1);
   const dot=(p.vx||0)*nx+(p.vy||0)*ny;
   ricochet(p,nx,ny,dot);
   p._towerRimBounce=(p._towerRimBounce||0)+1;return true;
 }
 if(q.surface&&q.clearance>=pad){p._towerSafeX=p.x;p._towerSafeY=p.y;return false;}
 let nearest=q.nearest;if(!nearest)return false;
 // Resolve to the nearest walkable deck edge; if it is disconnected,
 // return to the last safe surface instead of teleporting across void.
 const prior=Number.isFinite(p._towerSafeX)?{x:p._towerSafeX,y:p._towerSafeY}:null;
 if(prior&&Math.hypot(prior.x-p.x,prior.y-p.y)<80){p.x=prior.x;p.y=prior.y;}
 else {p.x=nearest.point.x+nearest.normal.x*(pad+2);
       p.y=nearest.point.y+nearest.normal.y*(pad+2);}
 const vx=Number(p.vx)||0,vy=Number(p.vy)||0;
 const nx=nearest.normal.x,ny=nearest.normal.y,dot=vx*nx+vy*ny;
 ricochet(p,nx,ny,dot);
 p._towerRimBounce=(p._towerRimBounce||0)+1;
 if(Math.hypot(vx,vy)>8&&(!p._towerVoidCooldown||p._towerVoidCooldown<tick)){
  p._towerVoidCooldown=tick+100;p._towerVoidFallPending=true;
 }
 return true;
};
function pointInLine(s,x,y,w,h){const dx=(s.to[0]-s.from[0])*w/500,dy=(s.to[1]-s.from[1])*h/500;
 const rx=x-s.from[0]*w/500,ry=y-s.from[1]*h/500,t=clamp((rx*dx+ry*dy)/(dx*dx+dy*dy||1),0,1);
 return Math.hypot(rx-t*dx,ry-t*dy);
}
function nextWaypoint(realm,from,to,w=500,h=500,level=1,tick=0){
 const map=getMap(realm,level,w,h,tick),a=at(realm,level,from.x,from.y,w,h,tick),b=at(realm,level,to.x,to.y,w,h,tick);
 if(!a.surface||!b.surface||a.surface===b.surface)return null;
 if(a.surface.from){
   const s=a.surface,pt0={x:s.from[0]*w/500,y:s.from[1]*h/500},
       pt1={x:s.to[0]*w/500,y:s.to[1]*h/500};
   const dist0=Math.hypot(pt0.x-to.x,pt0.y-to.y),dist1=Math.hypot(pt1.x-to.x,pt1.y-to.y);
   const chosen=dist0<dist1?pt0:pt1;
   return {...chosen,z:dist0<dist1?s.z0:s.z1};
 }
 const ramps=map.surfaces.filter(s=>s.from),start=a.surface.id,end=b.surface.id;
 const links=[];
 for(const ramp of ramps){let ends=map.surfaces.filter(s=>s!==ramp&&!s.from&&
   ([ramp.from,ramp.to].some(([x,y])=>metrics(s.vertices,x*w/500,y*h/500).clearance>-15)));
  if(ends.length<2)ends=map.surfaces.filter(s=>s!==ramp&&!s.from).sort((u,v)=>{
    const dist=z=>Math.min(Math.hypot(z.cx-ramp.from[0]*w/500,z.cy-ramp.from[1]*h/500),Math.hypot(z.cx-ramp.to[0]*w/500,z.cy-ramp.to[1]*h/500));return dist(u)-dist(v);
  }).slice(0,2);
  if(ends.length>=2)links.push([ends[0].id,ends[1].id,ramp]);
 }
 const visited=new Set([start]),queue=[{id:start,path:[]}];
 while(queue.length){const q=queue.shift();if(q.id===end){
   const next=q.path[0];if(!next)return null;
   const a={x:next.from[0]*w/500,y:next.from[1]*h/500,z:next.z0},
         b={x:next.to[0]*w/500,y:next.to[1]*h/500,z:next.z1};
   const dA=Math.hypot(a.x-from.x,a.y-from.y),dB=Math.hypot(b.x-from.x,b.y-from.y);
   const entry=dA<=dB?a:b,exit=dA<=dB?b:a;
   // Approach the real entry instead of steering straight into the caldera
   // to reach the mathematical midpoint. Once entered, cross to the far end.
   return (Math.hypot(entry.x-from.x,entry.y-from.y)<22)?exit:entry;
  }
  for(const [u,v,ramp] of links){const id=q.id===u?v:q.id===v?u:null;
   if(!id||visited.has(id))continue;visited.add(id);queue.push({id,path:[...q.path,ramp]});}
 }
 return null;
}
function drawPoly(ctx,pts){ctx.beginPath();for(let i=0;i<pts.length;i++)i?ctx.lineTo(pts[i].x,pts[i].y):ctx.moveTo(pts[i].x,pts[i].y);ctx.closePath();}
function paintVoid(ctx,realm,w,h,tick){
 // Everything outside walkable surfaces has an identity. Decorations never
 // alter walkability, target selection, damage or collision geometry.
 const time=tick/60,dim=Math.min(w,h),seed=(i,a=1)=>((i*73+a*137)%997)/997;
 const backdrop=ctx.createLinearGradient(0,0,w,h);
 const tones={space:['#020413','#12102e','#28194b'],fire:['#210808','#7a1f0b','#e14b14'],storm:['#071123','#26435d','#58798e'],ice:['#061625','#1c4f74','#4b9db1'],forest:['#09150e','#213b1f','#4d7640'],time:['#100f19','#362a28','#58442e']};
 const t=tones[realm]||tones.time;backdrop.addColorStop(0,t[0]);backdrop.addColorStop(.66,t[1]);backdrop.addColorStop(1,t[2]);
 ctx.fillStyle=backdrop;ctx.fillRect(0,0,w,h);ctx.save();
 if(realm==='space'){
   for(let i=0;i<62;i++){const x=seed(i,2)*w,y=seed(i,9)*h,r=.6+seed(i,5)*2.1;
     ctx.globalAlpha=.3+.6*seed(i,4)*(0.8+.2*Math.sin(time*.6+i));ctx.fillStyle=i%6?'#b8cafa':'#de9bfa';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
   for(const [x,y,r] of [[.16,.65,.34],[.72,.34,.25]]){const haze=ctx.createRadialGradient(x*w,y*h,0,x*w,y*h,r*dim);haze.addColorStop(0,'#8e54df55');haze.addColorStop(1,'#6f42bb00');ctx.fillStyle=haze;ctx.globalAlpha=.85;ctx.fillRect(0,0,w,h);}
 }else if(realm==='fire'){
   const glow=ctx.createRadialGradient(w*.5,h*.56,0,w*.5,h*.56,dim*.65);glow.addColorStop(0,'#ff8a27aa');glow.addColorStop(.7,'#c92b0855');glow.addColorStop(1,'#3f090900');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
   for(let i=0;i<29;i++){const x=(seed(i,1)*w+time*(i%2?8:-6))%w,y=seed(i,3)*h;ctx.strokeStyle=i%3?'#ff8d38':'#ffcb73';ctx.globalAlpha=.16+.27*seed(i,8);ctx.lineWidth=2+seed(i,6)*4;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+17,y+6,x-14,y+24,x+10,y+34);ctx.stroke();}
 }else if(realm==='storm'){
   for(let i=0;i<17;i++){const x=seed(i,3)*w,y=seed(i,2)*h;ctx.strokeStyle='#9ac5e3';ctx.globalAlpha=.12;ctx.lineWidth=12+seed(i,5)*24;ctx.beginPath();ctx.moveTo(x-w*.1,y);ctx.quadraticCurveTo(x,y-13,x+w*.3,y+8);ctx.stroke();}
 }else if(realm==='ice'){
   for(let i=0;i<28;i++){const x=seed(i,5)*w,y=seed(i,2)*h;ctx.globalAlpha=.16;ctx.strokeStyle='#b9edff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+8,y-14);ctx.lineTo(x+3,y-27);ctx.stroke();}
 }else if(realm==='forest'){
   for(let i=0;i<36;i++){const x=seed(i,3)*w,y=seed(i,7)*h;ctx.fillStyle=i%3?'#406b35':'#6e9854';ctx.globalAlpha=.2;ctx.beginPath();ctx.ellipse(x,y,8+seed(i,4)*19,5+seed(i,2)*13,i*.7,0,Math.PI*2);ctx.fill();}
 }else{
   ctx.lineWidth=2;ctx.strokeStyle='#d9b875';ctx.globalAlpha=.13;
   for(let i=0;i<9;i++){ctx.beginPath();ctx.arc(w*.5,h*.5,dim*(.17+i*.055),0,Math.PI*2);ctx.stroke();}
 }
 ctx.restore();
}
function paint(ctx,realm,level,w=500,h=500,tick=0){
 const st=style[realm];if(!st||!ctx)return false;const map=getMap(realm,level,w,h,tick);ctx.save();
 // Crucial: replace the old square battleground with each tower's abyss.
 paintVoid(ctx,realm,w,h,tick);
 const terrain=map.surfaces.slice().sort((a,b)=>a.z-b.z);
 for(const s of terrain){const pts=s.vertices;
  const meanZ=0,down=3;
  ctx.save();ctx.globalAlpha=.25;ctx.fillStyle='#000';drawPoly(ctx,pts.map(p=>({x:p.x+7,y:p.y+down+9})));ctx.fill();ctx.restore();
  const top=pts.map(p=>({x:p.x,y:p.y}));
  // Level ground: no elevated sides. Draw a narrow decorative edge only.
  ctx.fillStyle=st.side;
  for(let i=0;i<pts.length;i++){
   const j=(i+1)%pts.length,a=pts[i],b=pts[j],A=top[i],B=top[j];
   if(b.x>=a.x||meanZ===0)continue;ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);
   ctx.lineTo(b.x,b.y);ctx.lineTo(a.x,a.y);ctx.closePath();ctx.fill();
  }
  ctx.fillStyle=s.kind==='energy'?'#64558f':s.kind==='swamp'?'#526f45':s.kind==='crater'?'#a44229':st.top;
  ctx.globalAlpha=s.kind==='energy'?.80:.94;drawPoly(ctx,top);ctx.fill();ctx.globalAlpha=1;
  if(s.kind==='ring'){ctx.fillStyle=st.void;ctx.beginPath();
   ctx.arc(250*w/500,250*h/500-s.z,Math.min(w,h)*.283,0,TAU);ctx.fill();}
  ctx.strokeStyle=st.edge;ctx.lineWidth=s.kind==='ring'?4:2.5;ctx.lineJoin='round';drawPoly(ctx,top);ctx.stroke();
  // Crossbars are terrain, not flat floor tiling. They emphasize stairs/ramps.
  if(s.from){const count=s.kind==='stairs'?6:3;ctx.lineWidth=1.4;ctx.strokeStyle='#fff8';
    for(let k=1;k<count;k++){const a=top[0],b=top[1],c=top[2],d=top[3],t=k/count;
      const u={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},v={x:d.x+(c.x-d.x)*t,y:d.y+(c.y-d.y)*t};
      ctx.beginPath();ctx.moveTo(u.x,u.y);ctx.lineTo(v.x,v.y);ctx.stroke();}
  }
  if(s.kind==='ring'&&realm==='time'){
    // Layer a transparent clock engraving; the ring remains one traversable deck.
    ctx.save();ctx.translate(250*w/500,250*h/500-meanZ);ctx.strokeStyle=st.edge;ctx.lineWidth=2;
    for(let k=0;k<12;k++){const a=k*TAU/12;ctx.beginPath();ctx.moveTo(Math.cos(a)*80,Math.sin(a)*80);
      ctx.lineTo(Math.cos(a)*114,Math.sin(a)*114);ctx.stroke();}ctx.restore();
  }
  if(s.kind==='crater'||s.kind==='swamp'){
    ctx.save();ctx.globalAlpha=.6;ctx.fillStyle=s.kind==='crater'?'#ef4d17':'#173927';
    const pt={x:s.cx,y:s.cy-meanZ};ctx.beginPath();ctx.arc(pt.x,pt.y,Math.min(w,h)*.065,0,TAU);ctx.fill();ctx.restore();
  }
 }
 // Upright scenery occupies real collision circles, not decorative pixels.
 for(const o of map.obstacles){const z=heightAt(realm,level,o.x,o.y,w,h,tick),y=o.y-z;
   ctx.save();ctx.fillStyle=st.side;ctx.globalAlpha=.88;
   ctx.beginPath();ctx.moveTo(o.x-o.r,y);ctx.lineTo(o.x-o.r,y-28);
   ctx.lineTo(o.x+o.r,y-28);ctx.lineTo(o.x+o.r,y);ctx.closePath();ctx.fill();
   ctx.fillStyle=st.edge;ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(o.x,y-28,o.r,o.r*.47,0,0,TAU);ctx.fill();ctx.restore();
 }
 // Realm architecture uses lightweight vector geometry in the same world
 // coordinates as the physical surfaces. No heavy sprite sheets or particle
 // allocation; 2.5D layering comes from real Z-dependent drawing.
 ctx.save();ctx.lineWidth=3;ctx.strokeStyle=st.edge;ctx.fillStyle=st.side;
 const X=x=>x*w/500,Y=y=>y*h/500;
 if(realm==='time'){
   // Hands and inner cog on the 68-unit clock sanctuary.
   const x=X(250),y=Y(248)-heightAt(realm,level,x,Y(248),w,h,tick);
   ctx.beginPath();ctx.arc(x,y,33*w/500,0,TAU);ctx.stroke();
   for(let i=0;i<12;i++){const a=i*TAU/12;
     ctx.beginPath();ctx.moveTo(x+Math.cos(a)*25*w/500,y+Math.sin(a)*25*h/500);
     ctx.lineTo(x+Math.cos(a)*30*w/500,y+Math.sin(a)*30*h/500);ctx.stroke();}
   ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y);
   ctx.lineTo(x+Math.cos(tick*.009)*21*w/500,y+Math.sin(tick*.009)*21*h/500);ctx.stroke();
 }else if(realm==='space'){
   // Jagged crystals float above different decks, never flat floor circles.
   for(const [xx,yy,z,r] of [[258,272,61,18],[401,180,76,12],[113,164,42,10]]){
     const x=X(xx),y=Y(yy)-z;ctx.beginPath();ctx.moveTo(x,y-r);
     ctx.lineTo(x+r*.48,y);ctx.lineTo(x,y+r*1.4);ctx.lineTo(x-r*.48,y);ctx.closePath();
     ctx.fillStyle='#b682ec';ctx.globalAlpha=.78;ctx.fill();ctx.globalAlpha=1;ctx.stroke();}
 }else if(realm==='fire'){
   // Glowing cracks across the actual caldera surface and stone stair edge.
   const x=X(248),y=Y(265)-heightAt(realm,level,X(248),Y(265),w,h,tick);
   ctx.strokeStyle='#ff6d29';ctx.lineWidth=4;
   for(let i=0;i<6;i++){const a=i*TAU/6;
     ctx.beginPath();ctx.moveTo(x+Math.cos(a)*17,y+Math.sin(a)*13);
     ctx.lineTo(x+Math.cos(a+.1)*45,y+Math.sin(a+.1)*39);ctx.stroke();}
 }else if(realm==='storm'){
   // Battlements make the tall northeast fortress visibly architectural.
   const z=heightAt(realm,level,X(378),Y(165),w,h,tick);
   for(let i=0;i<5;i++){const x=X(325+i*23),y=Y(151)-z;
     ctx.fillStyle=st.side;ctx.fillRect(x,y-16,16,22);
     ctx.strokeRect(x,y-16,16,22);}
 }else if(realm==='ice'){
   // Ice spires emerge from terraces with faceted, outlined sidewalls.
   for(const [xx,yy,r] of [[102,205,26],[390,193,33],[257,112,37]]){
     const x=X(xx),z=heightAt(realm,level,x,Y(yy),w,h,tick),y=Y(yy)-z;
     ctx.beginPath();ctx.moveTo(x-r*.35,y);ctx.lineTo(x-r*.12,y-r);
     ctx.lineTo(x,y-r*1.55);ctx.lineTo(x+r*.3,y-r*.36);
     ctx.lineTo(x+r*.38,y);ctx.closePath();ctx.fillStyle='#9cd9f2';ctx.fill();ctx.stroke();}
 }else if(realm==='forest'){
   // Trunk and canopy belong to the background, not to a humanoid enemy.
   const x=X(385),y=Y(145)-heightAt(realm,level,X(385),Y(145),w,h,tick);
   ctx.strokeStyle='#765d39';ctx.lineWidth=13;
   ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x-5,y-35,x+17,y-65,x-12,y-100);ctx.stroke();
   ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y-63);ctx.bezierCurveTo(x-34,y-69,x-26,y-96,x-46,y-100);ctx.stroke();
   for(let i=0;i<6;i++){const a=i*TAU/6,x1=x-13+Math.cos(a)*30,y1=y-105+Math.sin(a)*18;
     ctx.beginPath();ctx.ellipse(x1,y1,24,16,a,0,TAU);
     ctx.fillStyle=i%2?'#4e9b57':'#327d49';ctx.globalAlpha=.88;ctx.fill();}
   ctx.globalAlpha=1;
 }
 ctx.restore();
 // A unique label is painted on the raised floor, not on an invisible square.
 ctx.save();ctx.strokeStyle='#000a';ctx.fillStyle=st.edge;ctx.lineWidth=3;
 ctx.textAlign='center';ctx.font='bold 18px system-ui';const main=terrain.find(s=>!s.from&&s.kind!=='ring')||terrain[0];
 const x=main?.cx||w/2,y=(main?.cy||h/2)-(main?.z||0);
 ctx.strokeText(st.symbol,x,y);ctx.fillText(st.symbol,x,y);
 ctx.font='bold 9px system-ui';ctx.fillText(st.name,x,y+14);
 ctx.font='9px system-ui';ctx.fillText(realm==='space'?'중력 이상':realm==='fire'?'분화 경고':realm==='storm'?'상승 기류':realm==='ice'?'빙판 균열':realm==='forest'?'뿌리 고지':'시간 기어',x,y+26);
 ctx.restore();ctx.restore();return true;
}
function reset(){cache=null;}
g.ArenaTowerArchitecture=Object.freeze({getMap,at,heightAt,isWalkable,clearance,bounce,nextWaypoint,paint,reset,style});
})(globalThis);

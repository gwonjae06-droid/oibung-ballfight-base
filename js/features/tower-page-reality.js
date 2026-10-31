/* Boss ultimates breach the arena into the page. Presentation only: no hitboxes, input capture or timers. */
(function(g){'use strict';
const TAU=Math.PI*2,realms=new Set(['time','space','fire','storm','ice','forest']);
const palette={time:'#f7d896',space:'#bf9aff',fire:'#ff7436',storm:'#a3edff',ice:'#cdf6ff',forest:'#a4e47c'};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
let active=false,rects=[],sample=-1;
function stop(){
 if(!active)return;active=false;rects=[];sample=-1;
 const root=g.document?.documentElement;if(!root)return;
 delete root.dataset.towerReality;delete root.dataset.towerRealityVariant;delete root.dataset.towerRealityMuted;
 for(const key of ['--tr-power','--tr-x','--tr-y','--tr-turn','--tr-gravity','--tr-glow','--tr-shadow','--tr-opacity','--tr-scale'])root.style.removeProperty(key);
}
function elements(t){
 if(Math.floor(t/12)===sample)return rects;
 sample=Math.floor(t/12);
 rects=[];
 const nodes=g.document?.querySelectorAll?.('#container .page-header, #container .arena-category-nav, #screen-tower .tower-doorway, #screen-tower .tower-head, #tower-arena-slot .canvas-wrapper')||[];
 for(const el of nodes){const r=el.getBoundingClientRect?.();if(r&&r.width>15&&r.height>12&&r.bottom>0&&r.top<g.innerHeight)rects.push({x:r.left,y:r.top,w:r.width,h:r.height});}
 return rects;
}
function path(c,coords,color,width){c.strokeStyle=color;c.lineWidth=width;c.beginPath();coords.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function arc(c,x,y,r,a,b,color,width){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,r,a,b);c.stroke();}
function seeded(i){const x=Math.sin(i*127.1+78.2)*43758.5453;return x-Math.floor(x);}
function frozen(c,x,y,r,depth){if(depth<=0)return;const color=depth===3?'#f2ffff':'#b5eeff';path(c,[[x-r*.65,y-r*.35],[x,y],[x+r*.6,y+r*.38]],color,Math.max(1,depth));for(const sign of [-1,1]){const px=x+sign*r*.26,py=y+sign*r*.14;path(c,[[px-r*.16,py-r*.32],[px,py],[px+r*.22,py-r*.17]],color,Math.max(.8,depth*.65));}if(depth>1)frozen(c,x+r*.53,y+r*.34,r*.37,depth-1);}
function roots(c,x,y,dx,dy,t,power){
 c.strokeStyle='#6e512f';c.lineWidth=4+power*6;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+dx*.2,y+dy*.25,x+dx*.65+Math.sin(t*.016)*16,y+dy*.65,x+dx,y+dy);c.stroke();
 c.strokeStyle='#a5e079';c.lineWidth=2;c.beginPath();c.moveTo(x+dx*.4,y+dy*.4);c.quadraticCurveTo(x+dx*.45+dy*.2,y+dy*.6,x+dx*.55,y+dy*.72);c.stroke();
 for(let i=0;i<3;i++){const px=x+dx*(.28+i*.23),py=y+dy*(.29+i*.23);c.fillStyle=i%2?'#d4f59b':'#82c46e';c.beginPath();c.ellipse(px+Math.sin(t*.012+i)*4,py,9+power*7,3+power*3,-.7+i*.2,0,TAU);c.fill();}
}
function render(c,event,t,w,h,muted){
 if(!realms.has(event?.realm)){stop();return;}
 const root=g.document?.documentElement;if(!root)return;
 const realm=event.realm,variant=event.variant||0,raw=clamp(Number(event.progress)||0,0,1),pulse=Math.sin(Math.PI*raw);
 const power=muted?.14:clamp(pulse*.85+.08,0,1),phase=t*.016;
 active=true;
 if(root.dataset.towerReality!==realm){root.dataset.towerReality=realm;sample=-1;}
 root.dataset.towerRealityVariant=String(variant);
 if(muted)root.dataset.towerRealityMuted='true';else delete root.dataset.towerRealityMuted;
 const drift=realm==='storm'?Math.sin(t*.15)*9:realm==='space'?Math.sin(phase)*5:realm==='time'&&variant===1?Math.sin(t*.19)*3:realm==='forest'?Math.sin(phase)*2:0;
 root.style.setProperty('--tr-power',power.toFixed(3));
 root.style.setProperty('--tr-x',(muted?0:drift*power).toFixed(2)+'px');
 root.style.setProperty('--tr-y',(muted?0:(realm==='storm'?Math.cos(t*.21)*5:realm==='space'?Math.cos(phase)*4:0)*power).toFixed(2)+'px');
 root.style.setProperty('--tr-turn',(muted?0:realm==='storm'?Math.sin(t*.09)*.7*power:realm==='space'?Math.sin(phase)*.4*power:0).toFixed(2)+'deg');
 root.style.setProperty('--tr-gravity', (realm==='space'?power:0).toFixed(3));
 root.style.setProperty('--tr-shadow',Math.round(20*power)+'px');
 root.style.setProperty('--tr-opacity',(power*.34).toFixed(3));
 root.style.setProperty('--tr-scale',(1-.015*(realm==='space'?power:0)).toFixed(4));
 root.style.setProperty('--tr-glow',palette[realm]);
 if(muted)return;
 const a=Math.min(.6,power*.6),centerX=w*.5,centerY=h*.47;
 c.save();c.globalAlpha=a;c.lineCap='round';c.lineJoin='round';
 const panels=elements(t);
 if(realm==='time'){
  // The whole web page becomes a clock face; reversed time leaves translucent history echoes.
  c.translate(centerX,centerY);const radius=Math.max(w,h)*.48;
  for(let ring=0;ring<3;ring++)arc(c,0,0,radius*(.5+ring*.25),0,TAU,'#d6b776',1.5);
  for(let i=0;i<60;i++){const angle=i*TAU/60,r=radius*(i%5===0?.96:.987);path(c,[[Math.cos(angle)*r,Math.sin(angle)*r],[Math.cos(angle)*radius,Math.sin(angle)*radius]],'#f7e1ab',i%5===0?2:1);}
  for(let k=0;k<3;k++){const angle=(variant===1?-1:1)*t*(k===0?.015:.004)+k*.5;path(c,[[0,0],[Math.cos(angle)*radius*(.55-k*.12),Math.sin(angle)*radius*(.55-k*.12)]],k===2?'#fff4c7':'#f4c775',k===0?5:3);}
  if(variant===1){for(let i=0;i<6;i++){const y=((i*127+t*1.5)%h)-h*.5;path(c,[[-w*.5,y],[w*.5,y]],'#ffe6a8',.8);}}
 }else if(realm==='space'){
  const arena=g.document?.getElementById?.('arena')?.getBoundingClientRect?.(),cx=arena?arena.left+arena.width*.5:centerX,cy=arena?arena.top+arena.height*.45:centerY;
  const r=Math.max(55,Math.min(w,h)*(.12+.07*power));
  c.fillStyle='#060215';c.beginPath();c.arc(cx,cy,r*.64,0,TAU);c.fill();
  for(let k=0;k<5;k++){c.beginPath();c.strokeStyle=k%2?'#ecd4ff':'#9d76e6';c.lineWidth=2+k*.3;c.ellipse(cx,cy,r*(1+k*.22),r*(.45+k*.12),phase+k*.65,0,TAU);c.stroke();}
  for(let i=0;i<(w<600?40:110);i++){const seed=seeded(i),angle=seed*TAU+t*.003*(1+seed),rad=42+(seeded(i+200)*Math.hypot(w,h)*.56)*(1-power*.4),x=cx+Math.cos(angle)*rad,y=cy+Math.sin(angle)*rad;c.fillStyle=i%3?'#c9acff':'#fff3c0';c.fillRect(x,y,1+seed*3,1+seed*3);}
  for(const p of panels){path(c,[[p.x+p.w*.5,p.y+p.h*.5],[cx,cy]],'#aa8fd2',1);}
 }else if(realm==='fire'){
  // Heat runs across the UI cards; large molten fault-lines are independent of the arena.
  for(const p of panels){const x=p.x+p.w*.15,y=p.y+p.h;path(c,[[x,y],[x+p.w*.12,y-8],[x+p.w*.27,y+4],[x+p.w*.48,y-5],[x+p.w*.65,y]],'#ff572b',2+power*3);}
  for(let i=0;i<(w<600?32:85);i++){const q=seeded(i),x=(i*97.13+Math.sin(i+t*.07)*26)%w,y=h-(t*(1.1+q*2)+i*57)%h;c.fillStyle=i%3?'#ff8e37':'#ffdc83';c.beginPath();c.ellipse(x,y,1+q*3,3+q*9,-.17,0,TAU);c.fill();}
  for(let k=0;k<3;k++){c.beginPath();c.strokeStyle='#ff4d20';c.lineWidth=8+2*k;c.globalAlpha=.1+power*.09;c.moveTo(0,h*(.6+k*.13));c.bezierCurveTo(w*.3,h*.4+Math.sin(phase+k)*25,w*.65,h*.75,w,h*(.52+k*.13));c.stroke();}
 }else if(realm==='storm'){
  for(let i=0;i<(w<600?20:65);i++){const seed=seeded(i),x=(t*(3+seed*5)+i*83)%(w+200)-100,y=(i*67+Math.cos(t*.02+i)*24)%h;path(c,[[x,y],[x+110+seed*100,y-16]],'#b5f3ff',1+seed*2);}
  if(Math.floor(t/25)%4===0){for(let k=0;k<3;k++){const x=w*(.15+seeded(k+Math.floor(t/25))*.7);const points=[[x,-15]];for(let j=1;j<9;j++)points.push([x+Math.sin(j*7+k*3+Math.floor(t/25))*40,j*h/9]);path(c,points,'#e5faff',k===0?5:2);}}
  for(const p of panels)arc(c,p.x+p.w*.5,p.y+p.h*.5,Math.min(p.w,p.h)*.6,phase,phase+Math.PI,'#8ddeff',2);
 }else if(realm==='ice'){
  // Crystal branches crawl along card edges, not just the combat canvas border.
  for(const p of panels){c.strokeStyle='#baf1ff';c.lineWidth=3;c.strokeRect(p.x+2,p.y+2,p.w-4,p.h-4);frozen(c,p.x+Math.min(p.w*.25,90),p.y+12,36+30*power,3);frozen(c,p.x+p.w-Math.min(p.w*.2,60),p.y+p.h-7,30+35*power,3);}
  for(let i=0;i<(w<600?25:70);i++){const x=(i*137)%w,y=(i*89+t*(.2+seeded(i)))%h;c.fillStyle='#edfaff';c.beginPath();c.arc(x,y,1+seeded(i+5)*2,0,TAU);c.fill();}
 }else if(realm==='forest'){
  for(const p of panels){roots(c,p.x,p.y+p.h*.5,p.w*(.6+.2*power),p.h*.3,t,power);roots(c,p.x+p.w,p.y+p.h*.7,-p.w*(.6+.2*power),-p.h*.35,t+90,power);}
  for(let i=0;i<(w<600?15:35);i++){const x=(i*79+Math.sin(t*.02+i)*45)%w,y=(i*43+t*.5)%h;c.fillStyle=i%2?'#c0e784':'#79b84b';c.beginPath();c.ellipse(x,y,4+seeded(i)*5,2+seeded(i+8)*3,t*.02+i,0,TAU);c.fill();}
 }
 c.restore();
}
g.ArenaTowerPageReality={render,clear:stop};
})(globalThis);

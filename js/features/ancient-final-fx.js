/* Ancient One: viewport-sized cinematic atmosphere for six realm seals.
 * One transparent pointer-safe overlay. No HP, collider or DOM control changes.
 */
(function(g){'use strict';
const TAU=Math.PI*2,cap=(n,l,h)=>Math.max(l,Math.min(h,n));
const PALETTE={time:'#ffe0a0',space:'#b6a6ff',fire:'#ff8b68',
 storm:'#b7edff',ice:'#c6f7ff',forest:'#b9f3a0',convergence:'#f5ddff'};
const rand=n=>{const x=Math.sin(n*127.1+78.233)*43758.5453;return x-Math.floor(x);};
let overlay=null;
function clear(){if(overlay)overlay.hidden=true;}
function paint(c,event,phase,t,w,h,reduced=false){
 if(!event)return;
 const age=Math.max(0,t-(event.start||0)),progress=cap(event.progress||0,0,1);
 const opacity=cap(Math.min(progress*9,(1-progress)*7),0,1)*(reduced?.19:.51),
  realm=event.realm,col=PALETTE[realm]||'#eef';
 c.save();c.globalAlpha=opacity;
 const cx=w*.5,cy=h*.5,size=Math.min(w,h);
 const mist=c.createRadialGradient(cx,cy,size*.1,cx,cy,Math.max(w,h)*.8);
 mist.addColorStop(0,'rgba(5,8,27,0)');
 mist.addColorStop(.56,'rgba(21,19,49,.025)');
 mist.addColorStop(1,realm==='fire'?'rgba(150,43,23,.30)':
  realm==='forest'?'rgba(52,105,54,.28)':
  realm==='ice'?'rgba(52,119,156,.26)':
  realm==='time'?'rgba(147,106,39,.22)':
  realm==='storm'?'rgba(49,97,145,.26)':'rgba(76,52,132,.31)');
 c.fillStyle=mist;c.fillRect(0,0,w,h);
 c.translate(cx,cy);
 // Large dimensional sigils have clean line continuity, no pasted assets.
 for(let k=0;k<(realm==='convergence'?6:4);k++){
  const r=size*(.23+k*.114),theta=reduced?k*.23:age*.0009*(k%2?-1:1)+k*.3;
  c.save();c.rotate(theta);c.globalAlpha=opacity*(.11+k*.05);
  c.strokeStyle=realm==='convergence'?PALETTE[Object.keys(PALETTE)[k]]:col;
  c.lineWidth=k===0?2.6:1.3;
  c.beginPath();c.ellipse(0,0,r,r*(.48+k*.07),k*.14,.12,Math.PI*1.87);c.stroke();
  c.restore();
 }
 if(realm==='convergence'){
  for(let i=0;i<6;i++){
   const angle=i*TAU/6+age*(reduced?0:.0008),r=size*.36;
   c.globalAlpha=opacity*.67;c.fillStyle=PALETTE[Object.keys(PALETTE)[i]];
   c.beginPath();c.arc(Math.cos(angle)*r,Math.sin(angle)*r,3.2,0,TAU);c.fill();
  }
 }
 if(!reduced){
  const n=w<650?30:80;
  for(let i=0;i<n;i++){
   const angle=rand(i)*TAU+age*(.0003+rand(i+70)*.0008)*(i%2?-1:1);
   const r=size*(.17+rand(i+180)*.53);
   const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
   c.globalAlpha=opacity*(.15+.43*Math.abs(Math.sin(age*.009+i)));
   c.fillStyle=realm==='convergence'?PALETTE[Object.keys(PALETTE)[i%6]]:col;
   c.beginPath();c.arc(x,y,.6+rand(i+31)*1.9,0,TAU);c.fill();
  }
 }
 c.restore();
}
function page(event,phase,tick){
 if(!g.document)return;
 if(!event){clear();return;}
 if(!overlay){
  overlay=g.document.createElement('canvas');
  overlay.setAttribute('aria-hidden','true');
  overlay.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:899;';
  g.document.body.appendChild(overlay);
 }
 overlay.hidden=false;
 const w=g.innerWidth||1280,h=g.innerHeight||720;
 if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;}
 const c=overlay.getContext('2d');if(!c)return;
 c.clearRect(0,0,w,h);
 const reduced=!!g.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 paint(c,event,phase,tick,w,h,reduced);
}
g.ArenaAncientFinaleFX=Object.freeze({page,paint,clear});
})(globalThis);

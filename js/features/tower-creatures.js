/* Elemental silhouettes, shared by tower combatants and destructible summons. */
(function(g){'use strict';const T=Math.PI*2;
function draw(c,p,r){
 const realm=p.towerRealm;if(!realm||!p.towerEnemy)return false;
 const tier=p.towerBossTier||0,v=p.towerEnemyType||0,t=(p.forgeClock||0)/60;
 c.save();c.lineJoin='round';c.lineCap='round';c.lineWidth=2;
 const palette={time:['#5c361c','#efc86a'],space:['#161127','#b89aff'],fire:['#462329','#ff9b42'],storm:['#263950','#a6f4ff'],ice:['#367e9d','#d2ffff'],forest:['#4d3928','#9bd65f']}[realm];
 const dark=palette[0],light=palette[1];c.strokeStyle=light;c.fillStyle=dark;
 function poly(points,fill=dark){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*r,y*r):c.moveTo(x*r,y*r));c.closePath();c.fillStyle=fill;c.fill();c.stroke();}
 function orb(x,y,size,col){c.beginPath();c.arc(x*r,y*r,size*r,0,T);c.fillStyle=col;c.fill();}
 if(realm==='time'){
  c.save();c.rotate(t*.16);const teeth=tier?16:8;for(let i=0;i<teeth;i++){c.rotate(T/teeth);c.fillStyle=light;c.fillRect(-r*.1,-r*1.12,r*.2,r*.28);}c.restore();
  orb(0,0,.87,dark);c.beginPath();c.arc(0,0,r*.8,0,T);c.stroke();
  for(let i=0;i<12;i++){const a=i*T/12;c.beginPath();c.moveTo(Math.cos(a)*r*.63,Math.sin(a)*r*.63);c.lineTo(Math.cos(a)*r*.74,Math.sin(a)*r*.74);c.stroke();}
  for(let i=0;i<2;i++){c.save();c.rotate(t*(i?-.4:.9)+v);c.lineWidth=i?4:2;c.beginPath();c.moveTo(0,r*.12);c.lineTo(0,-r*(i?.45:.65));c.stroke();c.restore();}orb(0,0,.09,light);
  if(tier){c.beginPath();c.moveTo(0,r*.9);c.lineTo(Math.sin(t)*r*.38,r*1.45);c.stroke();orb(Math.sin(t)*.38,1.45,.15,light);}
 }else if(realm==='space'){
  orb(0,0,.72,'#070812');c.save();c.rotate(t*.3);for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,r*(1+i*.12),r*.32,i*T/3,0,T);c.stroke();}c.restore();
  for(let i=0;i<(tier?5:2);i++){const a=t*.8+i*T/(tier?5:2);orb(Math.cos(a)*1.1,Math.sin(a)*.6,.12+i*.012,i%2?'#ffcf91':light);}
  if(v===2||tier===2){c.shadowColor=light;c.shadowBlur=12;orb(0,0,.18,'#fff4ff');c.shadowBlur=0;}
 }else if(realm==='fire'){
  for(let i=0;i<7;i++){const x=(i-3)*.25,sway=Math.sin(t*4+i)*.12;poly([[x-.16,.3],[x-.2+sway,-.55],[x+sway,-1.25-Math.sin(t*3+i)*.2],[x+.2,-.3],[x+.16,.3]],i%2?'#f35f26':'#ffba52');}
  poly([[-.85,.6],[-.7,-.3],[-.35,-.7],[.2,-.8],[.75,-.2],[.9,.65],[.2,.9]],dark);
  c.strokeStyle='#ffb54b';c.lineWidth=3;c.beginPath();c.moveTo(-r*.4,-r*.4);c.lineTo(0,0);c.lineTo(-r*.2,r*.4);c.lineTo(r*.5,r*.65);c.stroke();
  if(tier){poly([[-.8,-.25],[-1.25,-1.1],[-.35,-.6]],dark);poly([[.8,-.25],[1.25,-1.1],[.35,-.6]],dark);}
 }else if(realm==='storm'){
  for(let i=0;i<5;i++){const y=(i-2)*r*.3;c.beginPath();c.ellipse(Math.sin(t*3+i)*r*.1,y,r*(.25+i*.18),r*.22,-.14,0,T);c.fillStyle=i%2?'#4a6d86':'#263c56';c.fill();c.stroke();}
  c.strokeStyle='#ecffff';c.lineWidth=3;c.beginPath();c.moveTo(-r*.1,-r*.65);c.lineTo(r*.2,-r*.15);c.lineTo(-r*.18,r*.05);c.lineTo(r*.14,r*.65);c.stroke();
  if(tier)for(const side of [-1,1])poly([[side*.65,-.35],[side*1.65,-.9],[side*1.25,-.15],[side*.7,.25]],'#405e78');
 }else if(realm==='ice'){
  for(let i=0;i<(tier?7:4);i++){const a=i*T/(tier?7:4);c.save();c.rotate(a);poly([[-.18,-.5],[0,-1.3],[.2,-.55]],'#8bd8ee');c.restore();}
  poly([[-.65,.7],[-.8,-.2],[-.3,-.85],[.45,-.65],[.8,.1],[.55,.8]],'#468eae');poly([[0,-.7],[.5,-.45],[.6,.1],[0,.5],[-.2,0]],'#b5f4ff');
  if(tier||v===1){poly([[-.7,-.1],[-1.2,.1],[-1.1,.75],[-.65,.5]],'#71bddb');poly([[.7,-.1],[1.2,.1],[1.1,.75],[.65,.5]],'#71bddb');}
 }else{
  for(let i=0;i<5;i++){const x=(i-2)*.32;c.beginPath();c.moveTo(0,r*.3);c.bezierCurveTo(x*r,r*.55,(x+Math.sin(t+i)*.1)*r,r*.9,x*r*1.4,r*1.25);c.lineWidth=tier?6:3;c.strokeStyle='#896344';c.stroke();}
  poly([[-.38,.65],[-.2,-.55],[.15,-.8],[.4,.65]],'#654a31');
  for(let i=0;i<7;i++){const a=i*T/7,x=Math.cos(a)*.6,y=-.4+Math.sin(a)*.45;c.save();c.translate(x*r,y*r);c.rotate(a+Math.sin(t*2+i)*.08);c.beginPath();c.ellipse(0,0,r*.45,r*.25,0,0,T);c.fillStyle=i%2?'#427c43':'#88b74a';c.fill();c.strokeStyle='#bdde81';c.lineWidth=1;c.stroke();c.restore();}
  if(v===1&&!tier){for(let i=0;i<4;i++)orb(Math.sin(t+i)*.7,Math.cos(t*.6+i)*.7,.08,'#e8a2ec');}
 }
 if(['fire','ice','forest','storm'].includes(realm)){orb(-.22,-.05,.075,'#fff4ba');orb(.22,-.05,.075,'#fff4ba');}
 if(tier===2){c.strokeStyle=light;c.lineWidth=2;poly([[-.55,-1.15],[-.65,-1.7],[-.2,-1.4],[0,-1.85],[.2,-1.4],[.65,-1.7],[.55,-1.15]],dark);}
 c.restore();return true;
}
g.ArenaTowerCreatures={draw};
})(globalThis);

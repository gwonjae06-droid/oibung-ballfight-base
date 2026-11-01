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
  if(tier){
   // Tier 1 is a cracked magma heart; tier 2 is a fully crowned obsidian
   // caldera. Both remain non-humanoid stones, without arms or legs.
   const facets=tier===2?12:8;
   c.save();c.rotate(t*(tier===2?-.13:.09));
   for(let i=0;i<facets;i++){
    const a=i*T/facets,tip=tier===2?1.36:1.14;
    c.save();c.rotate(a);
    poly([[-.12,-.73],[0,-tip],[.16,-.78]],i%3===0?'#4a2525':'#2c2028');
    c.strokeStyle=i%2?'#fa6b37':'#ffcf78';c.lineWidth=tier===2?2.6:1.8;
    c.beginPath();c.moveTo(0,-r*.79);c.lineTo(0,-r*(tip-.12));c.stroke();
    c.restore();
   }
   c.restore();
   const glow=c.createRadialGradient(-r*.19,-r*.21,1,0,0,r*.66);
   glow.addColorStop(0,'#ffefad');glow.addColorStop(.32,'#ffae4b');
   glow.addColorStop(.64,'#f34e28');glow.addColorStop(1,'#3a1e26');
   c.fillStyle=glow;c.beginPath();c.arc(0,0,r*(tier===2?.55:.42),0,T);c.fill();
   c.strokeStyle='#ffd59a';c.lineWidth=tier===2?3:2;
   for(let i=0;i<(tier===2?6:4);i++){
    const a=i*T/(tier===2?6:4)+.2;
    c.beginPath();c.moveTo(Math.cos(a)*r*.27,Math.sin(a)*r*.27);
    c.lineTo(Math.cos(a+.13)*r*.58,Math.sin(a+.13)*r*.58);
    c.lineTo(Math.cos(a+.25)*r*.8,Math.sin(a+.25)*r*.8);c.stroke();
   }
   if(tier===2){
    c.save();c.rotate(-t*.19);
    for(let j=0;j<3;j++){
     c.strokeStyle=j===1?'#ffe09c':'#fc6b34';c.lineWidth=j===0?4:1.5;
     c.beginPath();c.ellipse(0,0,r*(1.12+j*.11),r*(.4+j*.13),j*.48,.25,T-.35);c.stroke();
    }
    c.restore();
   }
  }
 }else if(realm==='storm'){
  for(let i=0;i<5;i++){const y=(i-2)*r*.3;c.beginPath();c.ellipse(Math.sin(t*3+i)*r*.1,y,r*(.25+i*.18),r*.22,-.14,0,T);c.fillStyle=i%2?'#4a6d86':'#263c56';c.fill();c.stroke();}
  c.strokeStyle='#ecffff';c.lineWidth=3;c.beginPath();c.moveTo(-r*.1,-r*.65);c.lineTo(r*.2,-r*.15);c.lineTo(-r*.18,r*.05);c.lineTo(r*.14,r*.65);c.stroke();
  if(tier){
   // 5F = layered cumulonimbus stone; 10F = charged supercell halo.
   // No humanoid wings/arms, even at the highest boss tier.
   const count=tier===2?14:9;
   c.save();c.rotate(t*(tier===2?-.23:.16));
   for(let i=0;i<count;i++){
    const a=i*T/count,dist=(tier===2?1.18:1.07)*r;
    c.save();c.rotate(a);
    c.fillStyle=i%2?'#344f6c':'#557d9a';
    c.beginPath();c.ellipse(0,-dist,r*(tier===2?.23:.18),
      r*(tier===2?.37:.26),0,0,T);c.fill();
    c.strokeStyle=i%3===0?'#ecffff':'#8ee7ff';c.lineWidth=tier===2?2.5:1.7;
    c.beginPath();c.moveTo(0,-dist+r*.02);c.lineTo(0,-dist-r*(tier===2?.27:.15));c.stroke();
    c.restore();
   }
   c.restore();
   c.save();c.rotate(t*(tier===2?-.37:.25));
   for(let j=0;j<(tier===2?4:2);j++){
    c.strokeStyle=j%2?'#d7faff':'#85b9ff';c.lineWidth=j===0?3:1.5;
    c.beginPath();c.ellipse(0,0,r*(.85+j*.14),r*(.42+j*.085),j*.43,0,T);c.stroke();
   }
   c.restore();
   const electric=c.createRadialGradient(-r*.16,-r*.18,1,0,0,r*.6);
   electric.addColorStop(0,'#f5ffff');electric.addColorStop(.36,'#abf4ff');
   electric.addColorStop(.72,'#538ebd');electric.addColorStop(1,'#263950');
   c.fillStyle=electric;c.beginPath();c.arc(0,0,r*(tier===2?.51:.39),0,T);c.fill();
   c.strokeStyle='#e6ffff';c.lineWidth=tier===2?3.2:2;
   c.beginPath();c.moveTo(-r*.11,-r*.3);c.lineTo(r*.03,-r*.03);
   c.lineTo(-r*.07,r*.01);c.lineTo(r*.13,r*.3);c.stroke();
  }
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

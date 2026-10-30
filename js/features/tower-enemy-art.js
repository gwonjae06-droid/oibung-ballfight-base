/* Tower opponent skin: hemispherical go-stones, never humanoid. */
(function(g){
'use strict';
const TAU=Math.PI*2,SKINS={
 fire:['#26222a','#943e2c','#ff9243'],
 time:['#53412c','#b99857','#fff3bd'],
 space:['#18132f','#6255a2','#d5b6ff'],
 ice:['#366581','#9ce4f0','#f6ffff'],
 storm:['#253b51','#548fae','#b5f2ff'],
 forest:['#30442b','#779453','#dcf5a2']
};
function draw(ctx,p,r){
 const colors=SKINS[p?.towerRealm];if(!ctx||!colors||!p?.towerEnemy)return false;
 const variant=(Number(p.towerEnemyType)||0)%3,boss=Number(p.towerBossTier)||0;
 const [dark,main,shine]=colors,now=(Number(p.forgeClock)||0)*.04;
 ctx.save();
 ctx.lineWidth=boss?2.6:1.8;ctx.lineJoin='round';
 // Important: drawn inside the existing go-stone dome clip.
 if(variant===0){ // Surface seams / clock hands / snowflakes.
   ctx.strokeStyle=shine;ctx.globalAlpha=.82;
   for(let j=0;j<(boss?7:4);j++){
     const angle=j*TAU/(boss?7:4)+.18;
     ctx.beginPath();ctx.moveTo(Math.cos(angle)*r*.16,Math.sin(angle)*r*.12);
     ctx.lineTo(Math.cos(angle)*r*.78,Math.sin(angle)*r*.63);ctx.stroke();
   }
 }else if(variant===1){ // Armoured concentric shell.
   ctx.strokeStyle=dark;ctx.lineWidth=r*.13;
   ctx.beginPath();ctx.arc(0,0,r*.74,-2.9,-.12);ctx.stroke();
   ctx.strokeStyle=shine;ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(0,0,r*.72,.14,2.7);ctx.stroke();
 }else{ // Translucent core / rotating orbit.
   const gr=ctx.createRadialGradient(-r*.15,-r*.23,1,0,0,r*.7);
   gr.addColorStop(0,shine);gr.addColorStop(.52,main);gr.addColorStop(1,dark);
   ctx.globalAlpha=.73;ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,r*.58,0,TAU);ctx.fill();
   ctx.globalAlpha=1;ctx.strokeStyle=shine;
   ctx.beginPath();ctx.ellipse(0,0,r*.84,r*.26,now*.20,0,TAU);ctx.stroke();
 }
 // Each realm's boss has its own non-humanoid silhouette and ornament.
 if(boss){
  ctx.save();ctx.strokeStyle=shine;ctx.fillStyle=dark;ctx.lineWidth=boss===2?4:2;
  if(p.towerRealm==='time'){
   for(let i=0;i<12;i++){const a=i*TAU/12+now*.10;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.82,Math.sin(a)*r*.82);ctx.lineTo(Math.cos(a)*r*1.13,Math.sin(a)*r*1.13);ctx.stroke();}
   for(let i=0;i<3;i++){const a=now*(i+1)*.12;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*r*(.42+i*.15),Math.sin(a)*r*(.42+i*.15));ctx.stroke();}
  }else if(p.towerRealm==='space'){
   for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,r*(.96+i*.14),r*(.32+i*.12),now*.15+i*Math.PI/3,0,TAU);ctx.stroke();}
   ctx.beginPath();ctx.arc(0,0,r*.27,0,TAU);ctx.fillStyle='#08051c';ctx.fill();
  }else if(p.towerRealm==='fire'){
   for(let i=0;i<9;i++){const a=i*TAU/9;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.75,Math.sin(a)*r*.75);ctx.lineTo(Math.cos(a+.11)*r*1.24,Math.sin(a+.11)*r*1.24);ctx.lineTo(Math.cos(a+.27)*r*.83,Math.sin(a+.27)*r*.83);ctx.closePath();ctx.fillStyle=i%2?'#ff5c27':shine;ctx.fill();}
  }else if(p.towerRealm==='storm'){
   for(let i=0;i<7;i++){const a=i*TAU/7+now*.3;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.7,Math.sin(a)*r*.7);ctx.lineTo(Math.cos(a+.2)*r*1.1,Math.sin(a+.2)*r*1.1);ctx.lineTo(Math.cos(a-.12)*r*.92,Math.sin(a-.12)*r*.92);ctx.stroke();}
  }else if(p.towerRealm==='ice'){
   for(let i=0;i<8;i++){const a=i*TAU/8;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8);ctx.lineTo(Math.cos(a)*r*1.2,Math.sin(a)*r*1.2);ctx.lineTo(Math.cos(a+.15)*r*.98,Math.sin(a+.15)*r*.98);ctx.closePath();ctx.fillStyle='#d3faff';ctx.fill();ctx.stroke();}
  }else if(p.towerRealm==='forest'){
   for(let i=0;i<9;i++){const a=i*TAU/9+Math.sin(now*.2+i)*.1;ctx.beginPath();ctx.ellipse(Math.cos(a)*r*.93,Math.sin(a)*r*.93,r*.27,r*.12,a,0,TAU);ctx.fillStyle=i%2?'#5c8d42':shine;ctx.fill();}
   for(let i=0;i<5;i++){const a=i*TAU/5+now*.06;ctx.beginPath();ctx.arc(Math.cos(a)*r*.52,Math.sin(a)*r*.52,r*.07,0,TAU);ctx.fillStyle='#ccff7e';ctx.fill();}
  }
  ctx.restore();
 }
 // Distinct theme marks; no limbs, head or face.
 ctx.globalAlpha=.9;ctx.fillStyle=shine;ctx.textAlign='center';ctx.textBaseline='middle';
 const ICON={fire:'◆',time:'◷',space:'✧',ice:'❄',storm:'ϟ',forest:'♧'};
 ctx.font='bold '+Math.round(r*(boss?.72:.52))+'px system-ui';
 ctx.fillText(ICON[p.towerRealm],0,r*.07);
 if(boss){
  ctx.strokeStyle=shine;ctx.lineWidth=boss===2?4:2.4;
  ctx.beginPath();ctx.arc(0,0,r*.92,now*.15,now*.15+Math.PI*.82);ctx.stroke();
 }
 ctx.restore();return true;
}
g.ArenaTowerArt={draw,SKINS};
})(globalThis);

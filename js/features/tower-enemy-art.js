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

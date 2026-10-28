/* High-impact physical response, triggered ONLY by actual direct damage.
 * No HP changes, cooldown edits, movement-skill damage or physics time freezes.
 * Each separate confirmed hit gets its own directional pulse and knockback. */
(function(global){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pulses=[];
let frame=0,lastSound=-8,reduced=false;
function hit(attacker,defender,damage,options={}){
  if(!attacker||!defender||attacker===defender||!(Number(damage)>0))return false;
  const x=defender.x,y=defender.y;
  const sourceX=Number.isFinite(options.x)?options.x:attacker.x;
  const sourceY=Number.isFinite(options.y)?options.y:attacker.y;
  let dx=x-sourceX,dy=y-sourceY,d=Math.hypot(dx,dy);
  if(d<.001){
    dx=defender.vx-attacker.vx;dy=defender.vy-attacker.vy;d=Math.hypot(dx,dy);
  }
  if(d<.001){dx=(defender.playerNum||0)>=(attacker.playerNum||0)?1:-1;dy=0;d=1;}
  const nx=dx/d,ny=dy/d,amount=clamp(Number(damage),1,200);
  const heavy=options.heavy===true||amount>=22;
  // Powerful but bounded to avoid tunneling, runaway speed or 10-player piles.
  const impulse=clamp(7.5+Math.sqrt(amount)*1.15+(heavy?2.5:0)+
    clamp(Number(options.knockback)||0,0,9)*.4,9,18);
  const tangent=clamp((defender.vx||0)*-ny+(defender.vy||0)*nx,-4,4);
  defender.impactFrames=Math.max(defender.impactFrames||0,heavy?9:7);
  defender.impactSpeed=impulse;
  defender.impactDirX=nx;defender.impactDirY=ny;
  defender.impactTangent=tangent*.25;
  defender.vx=nx*impulse-ny*tangent*.25;
  defender.vy=ny*impulse+nx*tangent*.25;
  // Immediate visible separation, then the fixed-step engine carries momentum.
  const nudge=clamp(impulse*.43,4,8);
  const arena=global.canvas;
  if(arena?.width&&arena?.height){
    defender.x=clamp(defender.x+nx*nudge,defender.radius||0,arena.width-(defender.radius||0));
    defender.y=clamp(defender.y+ny*nudge,defender.radius||0,arena.height-(defender.radius||0));
  }
  // Small attacker recoil makes the blow read as a two-body interaction.
  if(options.recoil!==false){
    attacker.vx=(attacker.vx||0)-nx*(heavy?2.7:1.8);
    attacker.vy=(attacker.vy||0)-ny*(heavy?2.7:1.8);
  }
  const color=options.color||attacker.forge?.effectColor||attacker.themeColor||
    attacker.borderColor||'#45586a';
  pulses.push({x,y,nx,ny,color,heavy,age:0,life:heavy?17:13,impulse});
  if(pulses.length>80)pulses.splice(0,pulses.length-80);
  if(!reduced&&typeof global.screenShake==='number'){
    global.screenShake=Math.max(global.screenShake,
      clamp((heavy?6:3)+Math.sqrt(amount)*1.0,4,15));
  }
  if(frame-lastSound>=2){
    global.BattleFX?.sound?.(heavy?'heavy':'hit',heavy?1.1:.95);
    lastSound=frame;
  }
  return true;
}
function integrate(p){
  if(!(p?.impactFrames>0))return;
  const speed=p.impactSpeed||0,nx=p.impactDirX||0,ny=p.impactDirY||0;
  const tangent=p.impactTangent||0;
  // Preserve knockback despite the fighter AI updating its own movement.
  const blend=clamp(p.impactFrames/9,.25,.88);
  p.vx=(p.vx||0)*(1-blend)+(nx*speed-ny*tangent)*blend;
  p.vy=(p.vy||0)*(1-blend)+(ny*speed+nx*tangent)*blend;
  p.impactSpeed=speed*.86;
  p.impactFrames--;
}
function tick(){frame++;for(let i=pulses.length-1;i>=0;i--)if(++pulses[i].age>=pulses[i].life)pulses.splice(i,1);}
function draw(ctx){
  if(!pulses.length)return;
  ctx.save();ctx.globalCompositeOperation='source-over';
  for(const p of pulses){
    const t=p.age/p.life,fade=1-t,r=8+p.impulse*(.6+1.45*t);
    ctx.save();ctx.globalAlpha=fade*(reduced?.45:.85);
    ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(1,5.5*fade);
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#243443';ctx.lineWidth=Math.max(1,2.2*fade);
    ctx.beginPath();ctx.arc(p.x,p.y,r*.72,0,Math.PI*2);ctx.stroke();
    if(!reduced){
      // Directional speed cuts point AWAY from the attacking body.
      ctx.lineCap='round';
      for(let j=-2;j<=2;j++){
        const tangent=j*(p.heavy?10:7),front=6+Math.pow(t,.6)*p.impulse*2.8;
        const x=p.x+p.nx*front-p.ny*tangent,y=p.y+p.ny*front+p.nx*tangent;
        ctx.strokeStyle=j===0?'#fff':p.color;
        ctx.lineWidth=j===0?3:1.8;
        ctx.beginPath();ctx.moveTo(x-p.nx*(p.heavy?24:15),y-p.ny*(p.heavy?24:15));
        ctx.lineTo(x+p.nx*(p.heavy?23:15),y+p.ny*(p.heavy?23:15));ctx.stroke();
      }
      ctx.globalAlpha=fade*fade*.28;ctx.fillStyle='#fff';
      ctx.beginPath();ctx.arc(p.x,p.y,(p.heavy?25:17)*(1-t*.3),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
function reset(){pulses.length=0;frame=0;lastSound=-8;}
global.ImpactPhysics={hit,integrate,tick,draw,reset,setReduced(value){reduced=!!value;},
  get pulseCount(){return pulses.length;}};
})(window);

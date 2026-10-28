/* High-impact physical response, triggered ONLY by actual direct damage.
 * No HP changes, cooldown edits, movement-skill damage or physics time freezes.
 * Each separate confirmed hit gets its own directional pulse and knockback. */
(function(global){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pulses=[],trails=[];
const MOVEMENT_ONLY=new Set(['dash','blink','leap','hover','glide','swap','retreat','portal']);
const PROJECTILES=new Set(['projectile','shot','homing','pierce','boomerang',
  'arcshot','splitshot','bolt','dung','meteor','starfall','summon','turret']);
let frame=0,lastSound=-8,reduced=false;
function hit(attacker,defender,damage,options={}){
  if(!attacker||!defender||attacker===defender||!(Number(damage)>0))return false;
  if(global.ActionRegistry?.isMovement(options.type)||MOVEMENT_ONLY.has(String(options.type||'')))return false;
  const x=defender.x,y=defender.y;
  const sourceX=Number.isFinite(options.x)?options.x:attacker.x;
  const sourceY=Number.isFinite(options.y)?options.y:attacker.y;
  let dx=x-sourceX,dy=y-sourceY,d=Math.hypot(dx,dy);
  if(d<.001){
    dx=defender.vx-attacker.vx;dy=defender.vy-attacker.vy;d=Math.hypot(dx,dy);
  }
  if(d<.001){dx=(defender.playerNum||0)>=(attacker.playerNum||0)?1:-1;dy=0;d=1;}
  const nx=dx/d,ny=dy/d,amount=clamp(Number(damage),1,200);
  const type=String(options.type||'');
  const kind=type==='contact'?'contact':global.ActionRegistry?.get(type)?.physics==='projectile'||PROJECTILES.has(type)?'projectile':'strike';
  // Strong hand-to-hand strikes remain explosive; body-to-body collisions
  // are slightly softer and ranged missiles carry a FRACTION of the force.
  const heavy=kind!=='projectile'&&(options.heavy===true||amount>=22);
  const raw=26+Math.sqrt(amount)*3.2+(heavy?4:0)+
    clamp(Number(options.knockback)||0,0,9)*.95;
  const impulse=kind==='projectile'?clamp(raw*.17,5,11):
    kind==='contact'?clamp(raw*.48,13,32):clamp(raw*.62,19,44);
  // A subsequent hit refreshes the burst without unboundedly adding forces.
  // Mostly follow the newest attacking direction, keeping a hint of momentum.
  let ix=nx*impulse+clamp(Number(defender.impactVX)||0,-72,72)*.16;
  let iy=ny*impulse+clamp(Number(defender.impactVY)||0,-72,72)*.16;
  const resultant=Math.hypot(ix,iy);
  if(resultant>48){ix*=48/resultant;iy*=48/resultant;}
  defender.impactVX=ix;defender.impactVY=iy;
  defender.impactFrames=kind==='projectile'?8:11;
  defender.impactSpeed=Math.hypot(ix,iy);
  defender.impactColor=options.color||attacker.forge?.effectColor||attacker.themeColor||
    attacker.borderColor||'#45586a';
  // The initial flash reacts immediately; real travel then eases to normal
  // motion over a series of fixed simulation ticks.
  const nudge=kind==='projectile'?clamp(impulse*.12,.5,1.5):
    kind==='contact'?clamp(impulse*.12,1.5,3.5):clamp(impulse*.15,2.5,6);
  const arena=typeof canvas!=='undefined'?canvas:global.canvas;
  if(arena?.width&&arena?.height){
    defender.x=clamp(defender.x+nx*nudge,defender.radius||0,arena.width-(defender.radius||0));
    defender.y=clamp(defender.y+ny*nudge,defender.radius||0,arena.height-(defender.radius||0));
  }
  // Small attacker recoil makes the blow read as a two-body interaction.
  if(options.recoil!==false&&kind!=='projectile'){
    const recoil=(heavy?2.2:1.5)*(kind==='contact'?.7:1);
    attacker.vx=(attacker.vx||0)-nx*recoil;
    attacker.vy=(attacker.vy||0)-ny*recoil;
  }
  const color=options.color||attacker.forge?.effectColor||attacker.themeColor||
    attacker.borderColor||'#45586a';
  pulses.push({x,y,nx,ny,color,heavy,age:0,life:heavy?15:11,impulse});
  if(pulses.length>80)pulses.splice(0,pulses.length-80);
  if(!reduced&&typeof screenShake==='number'){
    screenShake=Math.max(screenShake,
      clamp(((heavy?6:3)+Math.sqrt(amount))*(
        kind==='projectile'?.28:kind==='contact'?.75:1),1,15));
  }
  if(frame-lastSound>=2){
    global.BattleFX?.sound?.(heavy?'heavy':'hit',kind==='projectile'?.5:heavy?1.1:.95);
    lastSound=frame;
  }
  return true;
}
function integrate(p){
  if(!(p?.impactFrames>0))return;
  let vx=Number(p.impactVX)||0,vy=Number(p.impactVY)||0;
  const speed=Math.hypot(vx,vy);
  if(!Number.isFinite(speed)||speed<.45){p.impactFrames=0;p.impactSpeed=0;p.impactVX=0;p.impactVY=0;return;}
  const arena=typeof canvas!=='undefined'?canvas:global.canvas;
  if(!arena||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
  const r=Math.max(0,Number(p.radius)||0);
  const left=r,right=Math.max(r,arena.width-r);
  const top=r,bottom=Math.max(r,arena.height-r);
  const oldX=p.x,oldY=p.y;
  // Substeps keep high-speed bodies inside the arena; bounce off walls
  // rather than accelerating forever or teleporting outside the map.
  const steps=Math.max(1,Math.ceil(speed/11));
  let wallX=false,wallY=false;
  for(let i=0;i<steps;i++){
    const nextX=p.x+vx/steps,nextY=p.y+vy/steps;
    const boundedX=clamp(nextX,left,right),boundedY=clamp(nextY,top,bottom);
    wallX=wallX||boundedX!==nextX;wallY=wallY||boundedY!==nextY;
    p.x=boundedX;p.y=boundedY;
  }
  if(!reduced&&frame%2===0&&speed>7){
    trails.push({x:oldX,y:oldY,toX:p.x,toY:p.y,
      color:p.impactColor||'#45586a',age:0,life:7});
    if(trails.length>72)trails.splice(0,trails.length-72);
  }
  // Short punchy response: ~60% of the previous impulse each tick,
  // releasing back to normal AI movement within about 0.15s.
  // The original AI's p.vx/p.vy remain untouched by this extra force.
  if(wallX)vx=-vx*.1;
  if(wallY)vy=-vy*.1;
  p.impactVX=vx*.60;p.impactVY=vy*.60;
  p.impactSpeed=Math.hypot(p.impactVX,p.impactVY);
  p.impactFrames--;
  if(p.impactSpeed<.45||p.impactFrames<=0){
    p.impactFrames=0;p.impactSpeed=0;p.impactVX=0;p.impactVY=0;
  }
}
function tick(){
  frame++;
  for(let i=pulses.length-1;i>=0;i--)if(++pulses[i].age>=pulses[i].life)pulses.splice(i,1);
  for(let i=trails.length-1;i>=0;i--)if(++trails[i].age>=trails[i].life)trails.splice(i,1);
}
function draw(ctx){
  if(!pulses.length)return;
  ctx.save();ctx.globalCompositeOperation='source-over';
  // Travel streaks make the initial throw look fast, then naturally vanish.
  // They're visual only and disabled with reduced effects.
  if(!reduced)for(const t of trails){
    const fade=1-t.age/t.life,dx=t.toX-t.x,dy=t.toY-t.y;
    ctx.save();ctx.globalAlpha=fade*.68;ctx.lineCap='round';
    for(let i=-1;i<=1;i++){
      const size=Math.max(1,Math.hypot(dx,dy)),ox=-dy/size*i*7,oy=dx/size*i*7;
      ctx.strokeStyle=i===0?'#64748b':t.color;ctx.lineWidth=i===0?2.5:1.5;
      ctx.beginPath();ctx.moveTo(t.x+ox-dx*.4,t.y+oy-dy*.4);
      ctx.lineTo(t.toX+ox-dx*.7,t.toY+oy-dy*.7);ctx.stroke();
    }
    ctx.restore();
  }
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
function reset(){pulses.length=0;trails.length=0;frame=0;lastSound=-8;}
global.ImpactPhysics={hit,integrate,tick,draw,reset,setReduced(value){reduced=!!value;},
  get pulseCount(){return pulses.length;}};
})(window);

// Keep effect hues, but darken pale/custom colors to at least 4.5:1 on white.
const arenaColorCache=new Map();
function arenaEffectColor(value){
  const input=String(value||'#475569');
  // Tower battlefields are dark: don't darken effects for the white PvE canvas.
  // The cache below belongs to the white-background palette only.
  if(globalThis.ArenaTower?.active&&globalThis.ArenaScreenRouter?.active==='tower'){
    if(/^#[0-9a-f]{3,8}$/i.test(input)||/^rgba?\(/i.test(input))return input;
    return '#b9d9ed';
  }
  if(arenaColorCache.has(input))return arenaColorCache.get(input);
  let hex=input.replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i,'#$1$1$2$2$3$3');
  let rgb=/^#[0-9a-f]{6}$/i.test(hex)?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)):null;
  if(!rgb){const match=input.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);rgb=match?match.slice(1,4).map(Number):[71,85,105];}
  const luminance=()=>rgb.map(n=>{const v=n/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  while(luminance()>.183)rgb=rgb.map(n=>Math.floor(n*.94));
  const result='#'+rgb.map(n=>Math.max(0,Math.min(255,n)).toString(16).padStart(2,'0')).join('');
  if(arenaColorCache.size>=256)arenaColorCache.clear();arenaColorCache.set(input,result);return result;
}
/* Photo-free renderer; optional photos are loaded only through js/photos.js. */
function drawCharacter(p){
if(!p.forge)globalThis.ForgeExpansion?.draw(p);
const img=p.getImage(),radius=p.radius,dead=p.hp<=0;
const z=globalThis.AdvancedCombat?.visibleHeight(p) ?? (p.jumpHeight||0);
const pose=globalThis.AdvancedCombat?.pose(p)||{sx:1,sy:1,tilt:0};
const scale=globalThis.AdvancedCombat?.size(p) ?? (1+Math.max(0,z)/140);
const offset=-z;
// Manual Tower fighter: a subtle ground reticle and motion trail make it
// instantly clear which character the player is steering, even in an effect storm.
if(p.manualTower&&p.hp>0&&globalThis.ArenaTower?.active&&globalThis.ArenaTower?.mode==='manual'){
  ctx.save();
  const motion=Math.hypot(p.vx||0,p.vy||0);
  ctx.strokeStyle='#367bc0';ctx.lineWidth=2.3;ctx.globalAlpha=.82;
  ctx.beginPath();ctx.arc(p.x,p.y,p.radius+8,0,Math.PI*2);ctx.stroke();
  if(motion>.5){
    const vx=p.vx/motion,vy=p.vy/motion;
    ctx.strokeStyle='#3fa8db';ctx.lineWidth=4;ctx.globalAlpha=.46;
    ctx.beginPath();ctx.moveTo(p.x-vx*(p.radius+5),p.y-vy*(p.radius+5));
    ctx.lineTo(p.x-vx*(p.radius+27),p.y-vy*(p.radius+27));ctx.stroke();
  }
  ctx.restore();
}
// Ground coordinates stay fixed: the shadow always remains beneath the body.
if(Math.abs(z)>1){
  ctx.save();
  ctx.fillStyle='rgba(25,31,38,'+Math.max(.06,.24-Math.abs(z)*.001)+')';
  ctx.beginPath();ctx.ellipse(p.x,p.y,radius*(1+Math.max(0,z)/250),radius*.28,0,0,Math.PI*2);ctx.fill();
  if(z>20&&p.slam){ctx.setLineDash([6,6]);ctx.strokeStyle='#a44136';ctx.lineWidth=2;ctx.beginPath();
    ctx.arc(p.x,p.y,Math.max(40,p.slam.a.radius*.65),0,2*Math.PI);ctx.stroke();}
  if(z<0){ctx.strokeStyle='#786349';ctx.lineWidth=2;ctx.setLineDash([3,5]);ctx.beginPath();
    ctx.ellipse(p.x,p.y,radius*.9,radius*.36,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
if(p.id==='choi'&&p.suneungState==='success'&&!dead){ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,radius+12+Math.sin(p.bullChargePulse)*4,0,Math.PI*2);ctx.strokeStyle='rgba(244,63,94,0.7)';ctx.lineWidth=4;ctx.shadowColor='#e11d48';ctx.shadowBlur=12;ctx.stroke();ctx.restore();}
globalThis.ArenaCharge?.draw?.(p,ctx);
const chargeJitter=globalThis.ArenaCharge?.jitter?.(p)||{x:0,y:0};
ctx.save();ctx.translate(p.x+chargeJitter.x,p.y+offset+chargeJitter.y);ctx.scale(scale*pose.sx,scale*pose.sy);ctx.rotate(pose.tilt);if(dead)ctx.globalAlpha=0.3;if(z<0)ctx.globalAlpha*=.32;
ctx.save();ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.clip();
if(img&&img.complete&&img.naturalWidth!==0)ctx.drawImage(img,-radius,-radius,radius*2,radius*2);
else{
  // Original clean, flat 2D silhouette (no spherical lighting).
  ctx.fillStyle=p.themeColor||p.borderColor||'#546777';ctx.fill();
  ctx.fillStyle='#fff';ctx.strokeStyle='rgba(14,22,29,.68)';ctx.lineWidth=1.9;
  ctx.font='800 '+Math.round(radius*.65)+'px "Noto Sans KR",system-ui,sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.strokeText(p.name[0],0,0);ctx.fillText(p.name[0],0,0);
}
ctx.restore();ctx.save();ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.lineWidth=globalThis.CosmeticArcade?.borderColor?.(p)?5:4;ctx.strokeStyle=globalThis.CosmeticArcade?.borderColor?.(p)||'#000';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=globalThis.CosmeticArcade?.borderGlow?.(p)||0;ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.setLineDash([]);ctx.stroke();ctx.restore();globalThis.CosmeticArcade?.drawBorder?.(ctx,p,radius);ctx.restore();
if(p.id==='lee'&&p.pokeAnim>0&&!dead){ctx.save();const a=Math.atan2(p.pokeTargetY-p.y,p.pokeTargetX-p.x),dist=Math.hypot(p.pokeTargetX-p.x,p.pokeTargetY-p.y),max=Math.min(p.pokeRange,Math.max(p.radius+40,dist)),reach=p.radius+(max-p.radius)*Math.sin(p.pokeAnim*Math.PI),x=p.x+Math.cos(a)*reach,y=p.y+Math.sin(a)*reach;ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*p.radius,p.y+Math.sin(a)*p.radius);ctx.lineTo(x,y);ctx.strokeStyle='#9a6500';ctx.lineWidth=5;ctx.lineCap='round';ctx.stroke();ctx.font='bold 24px -apple-system, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('👉',x,y);ctx.restore();}
globalThis.SkillVisuals?.drawAction?.(ctx,p,z);
ctx.save();const labelY=p.y+offset-radius*scale-12;
ctx.font='700 14px "Noto Sans KR",system-ui,sans-serif';
const display=getArenaFighterName(p),name=dead?`${display} · 탈락`:display;
const width=ctx.measureText(name).width,tagWidth=width+16;
const labelX=Math.min(Math.max(tagWidth/2+3,p.x),Math.max(tagWidth/2+3,canvas.width-tagWidth/2-3));
ctx.fillStyle=dead?'rgba(55,62,69,.82)':'rgba(22,31,39,.92)';
drawRoundedRect(ctx,labelX-tagWidth/2,labelY-16,tagWidth,23,6);
ctx.strokeStyle='rgba(250,252,253,.38)';ctx.lineWidth=.8;ctx.stroke();
ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
ctx.fillText(name,labelX,labelY-4);ctx.restore();
}
function draw(){
ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
// One world transform for scenery, fighters, hazards, and ALL skill effects.
const manualCamera=globalThis.ArenaTowerControls?.camera?.(canvas.width,canvas.height);
if(manualCamera)globalThis.ArenaTowerControls?.applyView?.(ctx,manualCamera);
if(screenShake>0.5){const x=(Math.random()-0.5)*screenShake,y=(Math.random()-0.5)*screenShake;ctx.translate(x,y);}
globalThis.ArenaTower?.paintBackground?.(ctx,canvas);
shockwaves.forEach(w=>{ctx.beginPath();ctx.arc(w.x,w.y,w.radius,0,Math.PI*2);ctx.strokeStyle=`rgba(4,120,87,${w.alpha})`;ctx.lineWidth=6;ctx.stroke();ctx.beginPath();ctx.arc(w.x,w.y,w.radius*0.7,0,Math.PI*2);ctx.fillStyle=`rgba(5,150,105,${w.alpha*0.2})`;ctx.fill();});
players.forEach(p=>{
if(p.id==='bae'&&p.waves)p.waves.forEach(w=>{ctx.beginPath();ctx.arc(w.x,w.y,w.currentRadius,0,Math.PI*2);ctx.strokeStyle=`rgba(234,88,12,${w.alpha})`;ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.arc(w.x,w.y,w.currentRadius*0.85,0,Math.PI*2);ctx.fillStyle=`rgba(249,115,22,${w.alpha*0.12})`;ctx.fill();});
if(p.id==='oh'&&p.mode==='menhera'&&p.hp>0){const r=p.auraRadius+Math.sin(p.auraPulse)*8,g=ctx.createRadialGradient(p.x,p.y,10,p.x,p.y,r);g.addColorStop(0,'rgba(126,34,206,0.4)');g.addColorStop(0.7,'rgba(168,85,247,0.15)');g.addColorStop(1,'rgba(126,34,206,0)');ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.strokeStyle='rgba(168,85,247,0.6)';ctx.setLineDash([5,5]);ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
p.projectiles.forEach(b=>{ctx.save();ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.fillStyle='#a855f7';ctx.shadowColor='#c084fc';ctx.shadowBlur=8;ctx.fill();ctx.restore();});
p.poisonTears.forEach(b=>{ctx.save();const g=ctx.createRadialGradient(b.x-2,b.y-2,1,b.x,b.y,b.radius);g.addColorStop(0,'#f3e8ff');g.addColorStop(0.45,'#c084fc');g.addColorStop(1,'#581c87');ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.fillStyle=g;ctx.shadowColor='#7e22ce';ctx.shadowBlur=12;ctx.fill();ctx.restore();});}
});
globalThis.AdvancedCombat?.draw(ctx);
globalThis.ArenaTower?.drawEncounter?.(ctx);
globalThis.CosmeticArcade?.drawUnder?.(ctx,players);
players.forEach(p=>{
  if(globalThis.ArenaMotion?.drawFighter)ArenaMotion.drawFighter(ctx,p,drawCharacter);
  else drawCharacter(p);
});
globalThis.CosmeticArcade?.drawOver?.(ctx,players);
globalThis.ImpactPhysics?.draw?.(ctx);
// Render secondary VFX before world transform is restored. The effect layer
// never applies a second camera or a different random screenshake.
globalThis.ArenaFXLayer?.draw?.(ctx);
particles.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fillStyle=arenaEffectColor(p.color);ctx.globalAlpha=p.alpha;ctx.fill();ctx.globalAlpha=1;});
floatingTexts.forEach(f=>{ctx.save();
  ctx.font=`900 ${Math.min(22,Math.max(15,f.size))}px "Noto Sans KR",system-ui,sans-serif`;
  ctx.fillStyle=arenaEffectColor(f.color);ctx.globalAlpha=f.alpha;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=2.8;ctx.lineJoin='round';
  ctx.strokeText(f.text,f.x,f.y);ctx.fillText(f.text,f.x,f.y);ctx.restore();});
// Pause/win labels stay screen-centred rather than tracking the hero.
ctx.restore();ctx.save();
if(!isPlaying&&!isGameOver){ctx.fillStyle='rgba(255,255,255,.45)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='700 23px "Noto Sans KR", sans-serif';ctx.fillStyle='#252525';ctx.textAlign='center';ctx.fillText(roundStarted?'일시정지':'대기 중',canvas.width/2,canvas.height/2);}
if(isGameOver){ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(0,0,canvas.width,canvas.height);const alive=players.filter(p=>p.hp>0);ctx.font='750 28px "Noto Sans KR", sans-serif';ctx.fillStyle='#202020';ctx.textAlign='center';ctx.fillText(roundStopped?'경기 중단 · 무승부':alive.length===1?`${getArenaFighterName(alive[0])} 승리`:'무승부',canvas.width/2,canvas.height/2-10);}
ctx.restore();
}

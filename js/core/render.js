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
// Ground shadows are painted in a dedicated pass beneath every character.
if(Math.abs(z)>1){
  ctx.save();
  if(z>20&&p.slam){ctx.setLineDash([6,6]);ctx.strokeStyle='#a44136';ctx.lineWidth=2;ctx.beginPath();
    ctx.arc(p.x,p.y,Math.max(40,p.slam.a.radius*.65),0,2*Math.PI);ctx.stroke();}
  if(z<0){ctx.strokeStyle='#786349';ctx.lineWidth=2;ctx.setLineDash([3,5]);ctx.beginPath();
    ctx.ellipse(p.x,p.y,radius*.9,radius*.36,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
if(p.id==='choi'&&p.suneungState==='success'&&!dead){ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,radius+12+Math.sin(p.bullChargePulse)*4,0,Math.PI*2);ctx.strokeStyle='rgba(244,63,94,0.7)';ctx.lineWidth=4;ctx.shadowColor='#e11d48';ctx.shadowBlur=12;ctx.stroke();ctx.restore();}
globalThis.ArenaCharge?.draw?.(p,ctx);
const chargeJitter=globalThis.ArenaCharge?.jitter?.(p)||{x:0,y:0};
ctx.save();ctx.translate(p.x+chargeJitter.x,p.y+offset+chargeJitter.y);
ctx.scale(scale*pose.sx,scale*pose.sy);
ctx.rotate(pose.tilt);if(dead)ctx.globalAlpha=0.3;if(z<0)ctx.globalAlpha*=.32;
globalThis.ArenaDepth?.underlay?.(ctx,p,radius);
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
globalThis.ArenaDepth?.lightSurface?.(ctx,radius);
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
ctx.save();
ctx.clearRect(0,0,canvas.width,canvas.height);
const depth=globalThis.ArenaDepth;
const isTower=globalThis.ArenaScreenRouter?.active==='tower';
ctx.fillStyle=isTower?'#263443':'#cbd9e1';
ctx.fillRect(0,0,canvas.width,canvas.height);
depth?.paintBackdrop?.(ctx,canvas,isTower);
// A perspective ground plane is rendered to a logical-resolution buffer.
// Every effect and floor object shares the SAME projective mapping. Actors
// are upright billboards, not artwork flattened with ctx.scale(1,.74).
const layer=depth?.layer?.(canvas,'world');
const worldCtx=layer?.ctx||ctx;
const shakeX=screenShake>0.5?(Math.random()-.5)*screenShake:0;
const shakeY=screenShake>0.5?(Math.random()-.5)*screenShake:0;
ctx.translate(shakeX,shakeY);
worldCtx.save();
if(layer)worldCtx.clearRect(0,0,canvas.width,canvas.height);
// All coordinates in worldCtx are real battle coordinates, not screen coords.
const painted=globalThis.ArenaTower?.paintBackground?.(worldCtx,canvas)===true;
depth?.paintFloor?.(worldCtx,canvas,painted);
shockwaves.forEach(w=>{worldCtx.beginPath();worldCtx.arc(w.x,w.y,w.radius,0,Math.PI*2);worldCtx.strokeStyle=`rgba(4,120,87,${w.alpha})`;worldCtx.lineWidth=6;worldCtx.stroke();worldCtx.beginPath();worldCtx.arc(w.x,w.y,w.radius*0.7,0,Math.PI*2);worldCtx.fillStyle=`rgba(5,150,105,${w.alpha*0.2})`;worldCtx.fill();});
players.forEach(p=>{
if(p.id==='bae'&&p.waves)p.waves.forEach(w=>{worldCtx.beginPath();worldCtx.arc(w.x,w.y,w.currentRadius,0,Math.PI*2);worldCtx.strokeStyle=`rgba(234,88,12,${w.alpha})`;worldCtx.lineWidth=3;worldCtx.stroke();worldCtx.beginPath();worldCtx.arc(w.x,w.y,w.currentRadius*0.85,0,Math.PI*2);worldCtx.fillStyle=`rgba(249,115,22,${w.alpha*0.12})`;worldCtx.fill();});
if(p.id==='oh'&&p.mode==='menhera'&&p.hp>0){const r=p.auraRadius+Math.sin(p.auraPulse)*8,g=worldCtx.createRadialGradient(p.x,p.y,10,p.x,p.y,r);g.addColorStop(0,'rgba(126,34,206,0.4)');g.addColorStop(0.7,'rgba(168,85,247,0.15)');g.addColorStop(1,'rgba(126,34,206,0)');worldCtx.beginPath();worldCtx.arc(p.x,p.y,r,0,Math.PI*2);worldCtx.fillStyle=g;worldCtx.fill();worldCtx.beginPath();worldCtx.arc(p.x,p.y,r,0,Math.PI*2);worldCtx.strokeStyle='rgba(168,85,247,0.6)';worldCtx.setLineDash([5,5]);worldCtx.lineWidth=2;worldCtx.stroke();worldCtx.setLineDash([]);
p.projectiles.forEach(b=>{worldCtx.save();worldCtx.beginPath();worldCtx.arc(b.x,b.y,b.radius,0,Math.PI*2);worldCtx.fillStyle='#a855f7';worldCtx.shadowColor='#c084fc';worldCtx.shadowBlur=8;worldCtx.fill();worldCtx.restore();});
p.poisonTears.forEach(b=>{worldCtx.save();const g=worldCtx.createRadialGradient(b.x-2,b.y-2,1,b.x,b.y,b.radius);g.addColorStop(0,'#f3e8ff');g.addColorStop(0.45,'#c084fc');g.addColorStop(1,'#581c87');worldCtx.beginPath();worldCtx.arc(b.x,b.y,b.radius,0,Math.PI*2);worldCtx.fillStyle=g;worldCtx.shadowColor='#7e22ce';worldCtx.shadowBlur=12;worldCtx.fill();worldCtx.restore();});}
});

globalThis.AdvancedCombat?.draw(worldCtx);
globalThis.ArenaTower?.drawEncounter?.(worldCtx);
globalThis.CosmeticArcade?.drawUnder?.(worldCtx,players);

// Separate ground-footprint pass: shadows never darken another fighter's face.
players.forEach(p=>{
  const altitude=globalThis.AdvancedCombat?.visibleHeight?.(p)??(p.jumpHeight||0);
  const paintShadow=()=>globalThis.ArenaDepth?.shadow?.(worldCtx,p,altitude);
  if(globalThis.ArenaMotion?.drawFighter)ArenaMotion.drawFighter(worldCtx,p,paintShadow);
  else paintShadow();
});

globalThis.CosmeticArcade?.drawOver?.(worldCtx,players);
globalThis.ImpactPhysics?.draw?.(worldCtx);
// Render secondary VFX before world transform is restored. The effect layer
// never applies a second camera or a different random screenshake.
globalThis.ArenaFXLayer?.draw?.(worldCtx);
particles.forEach(p=>{worldCtx.beginPath();worldCtx.arc(p.x,p.y,p.radius,0,Math.PI*2);worldCtx.fillStyle=arenaEffectColor(p.color);worldCtx.globalAlpha=p.alpha;worldCtx.fill();worldCtx.globalAlpha=1;});

// Custom projectiles, persistent zones and summon effects occupy world
// coordinates, not the owner's billboard plane.
if(layer)players.forEach(p=>{if(p.forge)globalThis.SkillForge?.drawFighter?.(p,worldCtx);});
worldCtx.restore();
if(layer)depth?.projectWorld?.(ctx,layer.canvas,canvas);
// Painter sorting only reorders pixels, never the actual simulation roster.
const depthOrder=players.slice().sort((a,b)=>
  (a.y-(globalThis.AdvancedCombat?.visibleHeight?.(a)||0)*.28)-
  (b.y-(globalThis.AdvancedCombat?.visibleHeight?.(b)||0)*.28));
depthOrder.forEach(p=>{
  const visual=globalThis.ArenaMotion?.position?.(p)||p;
  const projected=depth?.screenPoint?.(visual.x,visual.y,canvas)||
    {x:visual.x,y:visual.y};
  const size=depth?.spriteScale?.(visual,canvas)||1;
  ctx.save();
  if(layer){
    ctx.translate(projected.x,projected.y);
    ctx.scale(size,size); // sprite billboard retains correct x:y proportions
    ctx.translate(-visual.x,-visual.y);
  }
  if(globalThis.ArenaMotion?.drawFighter)ArenaMotion.drawFighter(ctx,p,drawCharacter);
  else drawCharacter(p);
  ctx.restore();
});
floatingTexts.forEach(f=>{
  const point=globalThis.ArenaDepth?.screenPoint?.(f.x,f.y,canvas)||{x:f.x,y:f.y};
  ctx.save();
  ctx.font=`900 ${Math.min(22,Math.max(15,f.size))}px "Noto Sans KR",system-ui,sans-serif`;
  ctx.fillStyle=arenaEffectColor(f.color);ctx.globalAlpha=f.alpha;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=2.8;ctx.lineJoin='round';
  ctx.strokeText(f.text,point.x,point.y);ctx.fillText(f.text,point.x,point.y);ctx.restore();
});
// Pause/win labels stay screen-centred rather than tracking the hero.
ctx.restore();ctx.save();
if(!isPlaying&&!isGameOver){ctx.fillStyle='rgba(255,255,255,.45)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='700 23px "Noto Sans KR", sans-serif';ctx.fillStyle='#252525';ctx.textAlign='center';ctx.fillText(roundStarted?'일시정지':'대기 중',canvas.width/2,canvas.height/2);}
if(isGameOver){ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(0,0,canvas.width,canvas.height);const alive=players.filter(p=>p.hp>0);ctx.font='750 28px "Noto Sans KR", sans-serif';ctx.fillStyle='#202020';ctx.textAlign='center';ctx.fillText(roundStopped?'경기 중단 · 무승부':alive.length===1?`${getArenaFighterName(alive[0])} 승리`:'무승부',canvas.width/2,canvas.height/2-10);}
ctx.restore();
}

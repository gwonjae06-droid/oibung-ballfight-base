/* Arena-wide combo celebration, intentionally separated from simulation rules.
 * One reusable pointer-safe overlay; no HP, energy, velocity or timer writes.
 * Only ArenaCombatV2's accepted player-owned combo events may trigger it.
 */
(function(g){
'use strict';
const ID='arena-combo-screen-fx';
const TITLES=Object.freeze({
  3:'CHAIN HIT',5:'COMBO RUSH',8:'FURY RUSH',
  12:'UNSTOPPABLE',20:'OVERDRIVE'
});
function tier(n){
  if(n>=20)return 5;
  if(n>=12)return 4;
  if(n>=8)return 3;
  if(n>=5)return 2;
  if(n>=3)return 1;
  return 0;
}
function field(){
  return g.document?.querySelector?.('.battle-screen .canvas-wrapper')||null;
}
function ensure(){
  const host=field(),doc=g.document;
  if(!host?.append||!doc?.createElement)return null;
  let layer=doc.getElementById?.(ID);
  if(layer){
    if(layer.parentElement&&layer.parentElement!==host)host.append(layer);
    return layer;
  }
  layer=doc.createElement('div');
  layer.id=ID;layer.className='combo-screen-fx';
  layer.hidden=true;layer.setAttribute('aria-hidden','true');
  // All children are decorative; dynamic wording is assigned with textContent.
  layer.innerHTML='<span class="combo-screen-aura"></span>'+
    '<span class="combo-screen-flash"></span>'+
    '<span class="combo-screen-rays"></span>'+
    '<span class="combo-screen-shock"></span>'+
    '<span class="combo-screen-announcement"></span>';
  host.append(layer);
  return layer;
}
function position(p,layer){
  const w=Number(g.canvas?.width)||500,h=Number(g.canvas?.height)||500;
  const x=Number.isFinite(p?.x)?p.x:w/2;
  const y=Number.isFinite(p?.y)?p.y:h/2;
  // Bounded percentage coordinates work with responsive CSS canvas sizing.
  layer.style?.setProperty?.('--combo-hit-x',Math.max(6,Math.min(94,x/w*100)).toFixed(2)+'%');
  layer.style?.setProperty?.('--combo-hit-y',Math.max(8,Math.min(92,y/h*100)).toFixed(2)+'%');
}
function pulse(p,count){
  const n=Math.max(0,Math.min(99,Math.floor(Number(count)||0)));
  if(n<3)return false;
  const layer=ensure();if(!layer)return false;
  layer.hidden=false;layer.dataset.tier=String(tier(n));
  layer.dataset.combo=String(n);
  const milestone=Object.hasOwn(TITLES,n);
  layer.dataset.milestone=milestone?'true':'false';
  position(p,layer);
  const announce=layer.querySelector?.('.combo-screen-announcement');
  if(announce)announce.textContent=milestone?TITLES[n]:'';
  // Accepted collisions are at least 18 simulation ticks apart. Restarting
  // only here avoids repeated animation restarts during render/update ticks.
  layer.classList?.remove?.('combo-screen-burst');
  void layer.offsetWidth;
  layer.classList?.add?.('combo-screen-burst');
  return true;
}
function clear(){
  const layer=g.document?.getElementById?.(ID);
  if(!layer)return;
  layer.hidden=true;
  layer.classList?.remove?.('combo-screen-burst');
  if(layer.dataset){layer.dataset.tier='0';layer.dataset.combo='0';layer.dataset.milestone='false';}
  const announce=layer.querySelector?.('.combo-screen-announcement');
  if(announce)announce.textContent='';
}
function sync(p,active){
  if(!active||tier(p?._combat2Combo?.chain||0)===0){clear();return;}
  const layer=g.document?.getElementById?.(ID);
  // The render loop never creates nodes; pulse() is the only mount point.
  if(layer&&!layer.hidden&&p?._combat2Combo)
    layer.dataset.tier=String(tier(p._combat2Combo.chain));
}
g.ComboScreenFX=Object.freeze({tier,pulse,clear,sync});
})(typeof window!=='undefined'?window:globalThis);

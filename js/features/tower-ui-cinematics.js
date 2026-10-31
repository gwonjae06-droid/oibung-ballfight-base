/* Tower interior decorations are DOM-only and do not touch physics or AI. */
(function(g){'use strict';
function install(){
 const tower=g.document?.getElementById?.('screen-tower');if(!tower)return false;
 const doorway=tower.querySelector('.tower-doorway');if(!doorway)return false;
 if(!doorway.querySelector('.tower-ui-particles')){
  const host=g.document.createElement('div');host.className='tower-ui-particles';host.setAttribute('aria-hidden','true');
  for(let i=0;i<16;i++){
   const particle=g.document.createElement('i');
   particle.style.setProperty('--particle-index',i);
   particle.style.setProperty('--particle-delay',(-i*.43)+'s');
   particle.style.setProperty('--particle-left',((i*37+13)%95)+'%');
   particle.style.setProperty('--particle-size',(4+i%4*3)+'px');host.append(particle);
  }
  doorway.insertBefore(host,doorway.querySelector('.tower-doorway-text')||null);
 }
 const anc=tower.querySelector('.ancient-unlock');
 if(anc&&!anc.querySelector('.ancient-void-waves')){
  const aura=g.document.createElement('div');aura.className='ancient-void-waves';aura.setAttribute('aria-hidden','true');anc.prepend(aura);
 }
 return true;
}
if(!install()&&g.document?.addEventListener)g.document.addEventListener('DOMContentLoaded',install,{once:true});
g.ArenaTowerUICinematics=Object.freeze({install});
})(typeof window!=='undefined'?window:globalThis);

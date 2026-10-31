/* Lightweight panorama/ancient portrait motion, separate from battle physics.
 * The six towers share ONE SVG panorama: overlay each fixed tower column.
 * Repeated installs are idempotent (tower UI may rebuild its DOM).
 */
(function(g){'use strict';
 const REALMS=['time','space','fire','storm','ice','forest'];
 function addNode(doc,parent,tag,cls){
  const e=doc.createElement(tag);e.className=cls;e.setAttribute('aria-hidden','true');parent.appendChild(e);return e;
 }
 function install(){
  const doc=g.document;
  const tower=doc?.getElementById?.('screen-tower');if(!tower)return false;
  const doorway=tower.querySelector('.tower-doorway');if(!doorway)return false;
  if(!doorway.querySelector('.tower-ui-particles')){
   const host=doc.createElement('div');host.className='tower-ui-particles';host.setAttribute('aria-hidden','true');
   for(let i=0;i<16;i++){
    const particle=doc.createElement('i');
    particle.style.setProperty('--particle-index',i);
    particle.style.setProperty('--particle-delay',(-i*.43)+'s');
    particle.style.setProperty('--particle-left',((i*37+13)%95)+'%');
    particle.style.setProperty('--particle-size',(4+i%4*3)+'px');host.appendChild(particle);
   }
   doorway.insertBefore(host,doorway.querySelector('.tower-doorway-text')||null);
  }
  const world=tower.querySelector('.tower-panorama-world');
  if(world&&!world.querySelector('.tower-panorama-animations')){
   const layer=doc.createElement('div');layer.className='tower-panorama-animations';layer.setAttribute('aria-hidden','true');
   REALMS.forEach((realm,i)=>{
    const scene=addNode(doc,layer,'span','tower-image-motion');
    scene.dataset.realm=realm;
    scene.style.setProperty('--tower-x',((i+.5)/REALMS.length*100).toFixed(4)+'%');
    addNode(doc,scene,'i','tower-image-halo');
    addNode(doc,scene,'i','tower-image-trace');
    addNode(doc,scene,'i','tower-image-particles');
   });
   const target=world.querySelector('.tower-panorama-targets');
   if(target)world.insertBefore(layer,target);else world.appendChild(layer);
  }
  const anc=tower.querySelector('.ancient-unlock');
  if(anc&&!anc.querySelector('.ancient-void-waves')){
   const aura=doc.createElement('div');aura.className='ancient-void-waves';aura.setAttribute('aria-hidden','true');anc.prepend(aura);
  }
  const portrait=anc?.querySelector('.ancient-portrait');
  if(portrait&&!portrait.querySelector('.ancient-portrait-motions')){
   const motion=doc.createElement('div');motion.className='ancient-portrait-motions';motion.setAttribute('aria-hidden','true');
   addNode(doc,motion,'i','ancient-seal-ring');
   addNode(doc,motion,'i','ancient-gaze-glimmer');
   addNode(doc,motion,'i','ancient-tentacle-haze');
   const copy=portrait.querySelector('.ancient-portrait-copy');
   if(copy)portrait.insertBefore(motion,copy);else portrait.appendChild(motion);
  }
  // Keep decorative motion in sync with the existing in-game effects toggle.
  const effectsToggle=doc.querySelector?.('.bf-preference input');
  if(effectsToggle){
   const sync=()=>tower.classList?.toggle?.('tower-motion-reduced',!!effectsToggle.checked);
   if(effectsToggle.dataset.towerMotionBound!=='1'){
    effectsToggle.dataset.towerMotionBound='1';
    effectsToggle.addEventListener('change',sync);
   }
   sync();
  }
  return true;
 }
 if(!install()&&g.document?.addEventListener)g.document.addEventListener('DOMContentLoaded',install,{once:true});
 g.ArenaTowerUICinematics=Object.freeze({install,REALMS});
})(typeof window!=='undefined'?window:globalThis);

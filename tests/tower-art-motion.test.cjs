'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');

class Node {
 constructor(tag='div',name='') { this.tagName=tag;this.className=name;this.children=[];this.parentNode=null;this.dataset={};this.style={properties:{},setProperty:(k,v)=>{this.style.properties[k]=String(v);}};this.attrs={};this.listeners={}; }
 setAttribute(key,value){this.attrs[key]=value;}
 appendChild(el){el.parentNode=this;this.children.push(el);return el;}
 prepend(el){el.parentNode=this;this.children.unshift(el);return el;}
 insertBefore(el,ref){el.parentNode=this;const idx=this.children.indexOf(ref);if(idx<0)this.children.push(el);else this.children.splice(idx,0,el);return el;}
 querySelector(selector){
  const cls=selector.startsWith('.')?selector.slice(1):null;
  if(!cls)return null;
  const search=node=>{for(const item of node.children){if(item.className.split(' ').includes(cls))return item;const nested=search(item);if(nested)return nested;}return null;};
  return search(this);
 }
 querySelectorAll(selector){const cls=selector.slice(1),arr=[];const walk=n=>n.children.forEach(x=>{if(x.className.split(' ').includes(cls))arr.push(x);walk(x);});walk(this);return arr;}
}
function setup(){
 const tower=new Node('main','screen-tower'),doorway=tower.appendChild(new Node('div','tower-doorway'));
 doorway.appendChild(new Node('div','tower-doorway-text'));
 const world=tower.appendChild(new Node('div','tower-panorama-world'));
 world.appendChild(new Node('img','tower-panorama-art'));
 world.appendChild(new Node('div','tower-panorama-targets'));
 const anc=tower.appendChild(new Node('div','ancient-unlock'));
 const portrait=anc.appendChild(new Node('div','ancient-portrait'));
 portrait.appendChild(new Node('img','ancient-portrait-art'));
 portrait.appendChild(new Node('div','ancient-portrait-copy'));
 const doc={getElementById:id=>id==='screen-tower'?tower:null,createElement:tag=>new Node(tag),addEventListener:()=>{}};
 const win={document:doc};
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/features/tower-ui-cinematics.js'),'utf8'),{window:win,document:doc});
 return {tower,world,anc,portrait,win};
}
test('six overlays align in tower order, preserve click targets, and are decorative',()=>{
 const {world,win}=setup();
 const host=world.querySelector('.tower-panorama-animations');
 assert.ok(host);
 assert.equal(host.attrs['aria-hidden'],'true');
 const scenes=host.querySelectorAll('.tower-image-motion');
 assert.equal(scenes.length,6);
 assert.equal(scenes.map(x=>x.dataset.realm).join(','),'time,space,fire,storm,ice,forest');
 assert.equal(scenes[0].style.properties['--tower-x'],'8.3333%');
 assert.equal(scenes[5].style.properties['--tower-x'],'91.6667%');
 for(const s of scenes){assert.equal(s.children.length,3);assert.equal(s.attrs['aria-hidden'],'true');}
 assert.equal(world.children.at(-1).className,'tower-panorama-targets');
 assert.equal(win.ArenaTowerUICinematics.install(),true);
 assert.equal(world.querySelectorAll('.tower-panorama-animations').length,1);
});
test('ancient portrait layered fx is idempotent and cannot cover text controls',()=>{
 const {anc,portrait,win,tower}=setup();
 const motions=portrait.querySelector('.ancient-portrait-motions');
 assert.ok(motions);
 assert.equal(motions.attrs['aria-hidden'],'true');
 assert.equal(motions.children.length,3);
 assert.equal(portrait.children.at(-1).className,'ancient-portrait-copy');
 assert.equal(anc.querySelectorAll('.ancient-void-waves').length,1);
 assert.equal(tower.querySelector('.tower-ui-particles').children.length,16);
 win.ArenaTowerUICinematics.install();
 assert.equal(portrait.querySelectorAll('.ancient-portrait-motions').length,1);
 assert.equal(anc.querySelectorAll('.ancient-void-waves').length,1);
});
test('all realms and Ancient effects have dedicated animation and reduced-motion support',()=>{
 const css=fs.readFileSync(path.join(root,'css/tower-art-motion.css'),'utf8');
 for(const r of ['time','space','fire','storm','ice','forest'])assert.match(css,new RegExp('data-realm='+r));
 for(const type of ['tower-art-clock','tower-art-orbit','tower-art-ember','tower-art-storm-flash','tower-art-snow','tower-art-leaf-drift','tower-art-ancient-gaze'])assert.ok(css.includes('@keyframes '+type),type);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/ancient-portrait-motions/);
});

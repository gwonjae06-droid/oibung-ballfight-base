'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness(store=new Map(),denyStorage=false){
  const ids=new Map(),listeners=new Map(),actions=new Map();
  const node=(tag='div')=>{
    const n={tag,open:false,hidden:false,children:[],attributes:new Map(),classList:{
      items:new Set(),add(v){this.items.add(v)},remove(v){this.items.delete(v)},
      contains(v){return this.items.has(v)}},
      addEventListener(name,fn){this.listeners.set(name,fn)},
      listeners:new Map(),dispatch(name,arg={}){this.listeners.get(name)?.(arg)},
      setAttribute(k,v){this.attributes.set(k,v)},removeAttribute(k){this.attributes.delete(k)},
      focus(){this.focused=true},
      appendChild(x){this.children.push(x);x.parentNode=this;if(x.id)ids.set(x.id,x)},
      querySelector(sel){
        if(!this.controls)this.controls=new Map();
        if(!this.controls.has(sel))this.controls.set(sel,node(sel));
        return this.controls.get(sel);
      },
      showModal(){this.open=true;this.opens=(this.opens||0)+1;},
      close(){this.open=false;this.dispatch('close')},
    };return n;
  };
  const nav=node('nav');ids.set('arena-category-nav',nav);
  const doc={body:node('body'),createElement:node,getElementById:id=>ids.get(id)||null};
  const storage={
    getItem:key=>store.get(key)||null,
    setItem:(key,value)=>{store.set(key,value);}
  };
  const world={document:doc,window:null,console};
  Object.defineProperty(world,'localStorage',{get(){if(denyStorage)throw Error('denied');return storage}});
  world.window=world;
  vm.createContext(world);
  vm.runInContext(read('js/features/welcome-guide.js'),world);
  const dialog=doc.body.children.find(x=>x.tag==='dialog');
  return {world,store,nav,doc,dialog};
}
test('first browser visit opens the supplied onboarding image; confirmation persists once',()=>{
  const store=new Map(),x=harness(store);
  assert.equal(x.dialog.open,true);
  assert.equal(x.dialog.opens,1);
  assert.ok(x.dialog.innerHTML.includes('assets/welcome-guide.webp'));
  assert.ok(x.dialog.innerHTML.includes('가챠'));
  assert.equal(x.dialog.getAttribute,undefined);
  assert.equal(store.has(x.world.ArenaWelcomeGuide.KEY),false,'do not mark until confirmed');
  x.dialog.querySelector('#arena-welcome-confirm').dispatch('click');
  assert.equal(x.dialog.open,false);
  assert.equal(store.get(x.world.ArenaWelcomeGuide.KEY),'seen');
  assert.equal(x.doc.body.classList.contains('arena-welcome-open'),false);
  const repeat=harness(store);
  assert.equal(repeat.dialog.open,false,'reload on same browser does not re-open');
  assert.equal(repeat.dialog.opens,undefined);
  const reopen=repeat.nav.children.find(x=>x.className==='arena-guide-reopen');
  assert.ok(reopen,'manual help button remains visible');
  reopen.dispatch('click');
  assert.equal(repeat.dialog.open,true,'manual re-open works even after seen flag');
});
test('ESC dismisses and persists, while unavailable localStorage never crashes',()=>{
  const x=harness(new Map());
  let prevented=false;
  x.dialog.dispatch('cancel',{preventDefault(){prevented=true}});
  assert.equal(prevented,true);
  assert.equal(x.dialog.open,false);
  assert.equal(x.store.get(x.world.ArenaWelcomeGuide.KEY),'seen');
  const denied=harness(new Map(),true);
  assert.equal(denied.dialog.open,true);
  assert.doesNotThrow(()=>denied.dialog.querySelector('#arena-welcome-confirm').dispatch('click'));
});
test('image errors retain a concise accessible HTML fallback for the first visit',()=>{
  const x=harness();
  const poster=x.dialog.querySelector('img');
  const fallback=x.dialog.querySelector('.arena-welcome-fallback');
  poster.dispatch('error');
  assert.equal(poster.hidden,true);
  assert.equal(fallback.hidden,false);
  assert.ok(x.dialog.innerHTML.includes('커스텀 캐릭터 만들기'));
  assert.ok(x.dialog.innerHTML.includes('GitHub'));
});
test('uploaded user guide image is a genuine optimized WebP committed with the UI',()=>{
  const file=fs.readFileSync(path.join(__dirname,'..','assets/welcome-guide.webp'));
  assert.equal(file.toString('ascii',0,4),'RIFF');
  assert.equal(file.toString('ascii',8,12),'WEBP');
  assert.ok(file.length>20000&&file.length<120000,'keep quick loading even on mobile');
});
test('existing public share browser moves below ranking without cloning or breaking existing actions',()=>{
  const ranking=read('js/features/community-power-rank.js');
  const shared=read('js/features/community-forge.js');
  const html=read('index.html'),css=read('css/style.css');
  assert.match(ranking,/const gallery=global\.document\.querySelector\('\.community-section'\)/);
  assert.match(ranking,/aside\.insertBefore\(gallery,afterRanking\)/);
  assert.match(ranking,/aside\.querySelector\('\.power-ranking-issues'\)/);
  assert.equal((shared.match(/summary\.textContent='공유 캐릭터 둘러보기'/g)||[]).length,1);
  for(const action of ["community-publish","community-refresh","community-items","SkillForge.register(cfg)"]){
    assert.ok(shared.includes(action),'existing action preserved: '+action);
  }
  assert.ok(css.includes('.community-power-ranking .power-ranking-gallery'));
  assert.ok(css.includes('body.has-power-ranking > .community-power-ranking'));
  assert.ok(css.includes('@media(max-width:1199px)'));
  assert.ok(html.indexOf('js/features/community-forge.js')<html.indexOf('js/features/community-power-rank.js'));
  assert.ok(html.indexOf('js/features/community-power-rank.js')<html.indexOf('js/features/welcome-guide.js'));
  assert.ok(html.includes('js/features/welcome-guide.js'));
  assert.ok(css.includes('.arena-welcome-guide::backdrop'));
  assert.ok(css.includes('(prefers-reduced-motion:reduce)'));
});

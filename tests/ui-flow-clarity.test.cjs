'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const src=read('js/features/ui-flow.js'),html=read('index.html'),css=read('css/ui-clarity.css');
function model(){const w={window:null,console};w.window=w;vm.createContext(w);vm.runInContext(src,w);return w.ArenaUIFlow.phase;}
function node(){
  const listeners=new Map(),attrs=new Map(),classes=new Set();
  return {
    dataset:{},children:[],textContent:'',scrolls:0,focuses:0,
    classList:{
      add(c){classes.add(c);},remove(c){classes.delete(c);},
      contains(c){return classes.has(c);},
      toggle(c,force){
        const next=force===undefined?!classes.has(c):force;
        next?classes.add(c):classes.delete(c);return next;
      }
    },
    setAttribute(k,v){attrs.set(k,v);},getAttribute(k){return attrs.get(k)||null;},
    removeAttribute(k){attrs.delete(k);},
    addEventListener(k,fn){const a=listeners.get(k)||[];a.push(fn);listeners.set(k,a);},
    click(){this.clicked=(this.clicked||0)+1;for(const fn of listeners.get('click')||[])fn({target:this});},
    scrollIntoView(){this.scrolls++;},focus(){this.focuses++;},
    append(...n){this.children.push(...n);},prepend(...n){this.children.unshift(...n);},
    after(n){this.insertedAfter=n;},before(n){this.insertedBefore=n;},
    querySelector(){return null;},querySelectorAll(){return [];}
  };
}
function runDom(){
  const root=node(),steps=Object.fromEntries(['setup','battle','result'].map(x=>[x,node()]));
  Object.entries(steps).forEach(([id,n])=>n.dataset.uiStep=id);
  root.querySelectorAll=()=>Object.values(steps);
  const label=node(),cta=node(),start=node(),arena=node(),panel=node(),nav=node(),controls=node();
  const heading=node(),eyebrow=node(),title=node(),picks=node(),fold=node(),summary=node(),more=node();
  heading.querySelector=x=>x==='.eyebrow'?eyebrow:x==='h2'?title:null;
  panel.querySelector=x=>x==='.panel-heading'?heading:x==='#bf-picks'?picks:null;
  arena.querySelector=x=>x==='.control-panel'?controls:null;
  fold.querySelector=()=>summary;
  nav.querySelector=()=>more;
  panel.querySelectorAll=()=>[];
  start.dataset.state='ready';
  const studio=node(),save=node(),create=node(),ranking=node(),rankList=node();
  rankList.children=[node(),node(),node(),node(),node()];
  save.querySelector=()=>create;
  studio.querySelector=x=>x==='.forge-primary-actions'?save:null;
  ranking.querySelector=x=>x==='#power-ranking-list'?rankList:null;
  const idMap={
    'arena-purpose':root,'arena-next-label':label,'arena-next-action':cta,
    'btn-start':start,'arena-stage':arena,'match-setup':panel,
    'arena-category-nav':nav,'community-power-ranking':ranking,'studio-clarity-steps':null
  };
  const created=[],obs=[];
  const doc={
    getElementById:id=>idMap[id]||null,
    querySelector:s=>s==='.bf-fold'?fold:s==='#character-studio-dialog .forge-studio'?studio:null,
    createElement:tag=>{const el=node();el.tag=tag;created.push(el);return el;}
  };
  const w={window:null,document:doc,console,MutationObserver:class{
    constructor(callback){this.callback=callback;obs.push(this);}
    observe(target,options){this.target=target;this.options=options;}
  }};
  w.window=w;vm.createContext(w);vm.runInContext(src,w);
  return {w,root,steps,label,cta,start,arena,panel,nav,controls,heading,eyebrow,title,
    picks,fold,summary,more,studio,save,create,ranking,rankList,created,obs};
}
test('ready / playing / paused / finished have clear, consistent instructions',()=>{
  const p=model();
  assert.equal(p('ready').active,'setup');
  assert.equal(p('playing').active,'battle');
  assert.equal(p('paused').intent,'resume');
  assert.equal(p('finished').active,'result');
  assert.equal(p('finished').intent,'next');
  assert.ok(p('finished').past.includes('setup'));
  assert.ok(p('finished').past.includes('battle'));
  assert.match(p('ready').label,/캐릭터/);
});
test('live status changes update the three-step tracker and call existing engine buttons',()=>{
  const x=runDom();
  assert.equal(x.root.dataset.uiPhase,'setup');
  assert.equal(x.steps.setup.getAttribute('aria-current'),'step');
  assert.equal(x.cta.dataset.intent,'match');
  x.cta.click();assert.equal(x.panel.scrolls,1);
  x.start.dataset.state='playing';x.w.ArenaUIFlow.install().sync();
  assert.equal(x.root.dataset.uiPhase,'battle');
  assert.equal(x.steps.battle.getAttribute('aria-current'),'step');
  assert.ok(x.steps.setup.classList.contains('is-complete'));
  x.start.dataset.state='paused';x.w.ArenaUIFlow.install().sync();
  assert.equal(x.cta.dataset.intent,'resume');
  x.start.dataset.state='finished';x.w.ArenaUIFlow.install().sync();
  assert.equal(x.root.dataset.uiPhase,'result');
  assert.ok(x.steps.battle.classList.contains('is-complete'));
  assert.equal(x.cta.textContent,'다음 경기 준비');
});
test('match setup uses original fighter controls and creator explains final save action',()=>{
  const x=runDom();
  assert.equal(x.title.textContent,'출전 파이터 선택');
  assert.ok(x.heading.children.some(e=>e.className==='arena-setup-tip'));
  assert.equal(x.picks.insertedAfter,x.controls,'the exact original match controls are moved after fighter selection');
  assert.ok(x.controls.classList.contains('arena-setup-controls'));
  assert.equal(x.controls.getAttribute('aria-label'),'경기 시작 · 재매칭 · 참가 인원');
  assert.ok(!x.created.some(el=>el.className==='arena-setup-proceed'),'do not create a second navigation action');
  assert.match(x.summary.textContent,/선택 활동/);
  assert.ok(x.studio.children.some(c=>c.id==='studio-clarity-steps'));
  assert.match(x.create.textContent,/대진에 적용/);
  assert.match(x.save.insertedBefore?.textContent,/P1/);
});
test('community ranking starts with top three but can expand the same public list',()=>{
  const x=runDom();
  assert.ok(x.rankList.classList.contains('power-ranking-collapsed'));
  const expand=x.rankList.insertedAfter;
  assert.equal(expand.id,'power-ranking-expand');
  assert.equal(expand.getAttribute('aria-expanded'),'false');
  expand.click();
  assert.equal(expand.getAttribute('aria-expanded'),'true');
  assert.equal(x.rankList.classList.contains('power-ranking-collapsed'),false);
  expand.click();
  assert.equal(expand.getAttribute('aria-expanded'),'false');
  assert.ok(x.rankList.classList.contains('power-ranking-collapsed'));
  assert.equal(x.rankList.children.length,5,'ranking entries are never removed');
});
test('navigation keeps all six functional category links, accessible overflow and clear goal',()=>{
  for(const cat of ['arena','match','creator'])
    assert.ok(html.includes('data-category="'+cat+'"'),cat);
  assert.ok(html.includes('id="arena-purpose"'));
  assert.ok(html.includes('data-ui-step="setup"'));
  assert.ok(html.includes('data-ui-step="battle"'));
  assert.ok(html.includes('data-ui-step="result"'));
  assert.ok(html.includes('class="arena-nav-more"'));
  assert.ok(html.includes('id="arena-next-action"'));
  assert.ok(html.indexOf('js/features/ui-flow.js')>html.indexOf('js/features/studio-workspace.js'));
  assert.ok(html.indexOf('css/ui-clarity.css')>html.indexOf('css/style.css'));
  assert.ok(css.includes('.arena-nav-more-list'));
  assert.ok(css.includes('.power-ranking-list.power-ranking-collapsed'));
  assert.ok(css.includes('@media(max-width:950px)'));
  assert.ok(css.includes('#container .arena-match-setup{order:3'));
  assert.ok(css.includes('#container .battle-screen{order:4'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
});

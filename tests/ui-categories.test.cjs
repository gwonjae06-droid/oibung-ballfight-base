'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('index.html');
const layout=read('js/features/ui-categories.js');
const natural=read('js/features/natural-forge.js');
const style=read('css/style.css');

test('six primary categories are clear, unique and readable with JS disabled',()=>{
  const links=[...html.matchAll(/<a href="#([^"]+)" data-category="([^"]+)"/g)];
  assert.deepEqual(links.map(m=>m[2]),['arena','match','creator','photo','economy','guide']);
  assert.equal(new Set(links.map(x=>x[1])).size,4,'three workspace tabs share one anchor');
  assert.match(html,/<nav class="arena-category-nav" id="arena-category-nav" aria-label="게임 카테고리">/);
  assert.ok(links.every(x=>x[1]&&x[2]));
  const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
  assert.ok(scripts.indexOf('js/features/community-forge.js')<scripts.indexOf('js/features/ui-categories.js'));
  assert.ok(scripts.indexOf('js/features/ui-categories.js')<scripts.indexOf('js/features/battle-effects.js'));
});

test('random studio button is inserted only after it is defined (fixes initialization crash)',()=>{
  const declaration=natural.indexOf("const randomNow=document.createElement('button')");
  const insertion=natural.indexOf("randomEntry.append(randomHead,randomNow)");
  assert.ok(declaration>0&&insertion>declaration,'uninitialized randomNow caused ReferenceError');
  assert.ok(natural.includes("body.insertBefore(randomEntry,nameLabel)"));
  assert.ok(natural.includes("randomNow.addEventListener('click'"));
  assert.ok(layout.includes("const ordered=[intro,random,name,prompt,create,basic,tuning,library,themes,saved]"));
  assert.ok(layout.includes("ordered.forEach(node=>studio.append(node))"));
});

test('category styles keep mobile scrolling and accessible focus, without hiding live arena',()=>{
  assert.match(style,/\.arena-category-nav\s*\{[^}]*overflow-x:auto/);
  assert.match(style,/\.arena-category-nav a\[aria-current="location"\]/);
  assert.match(style,/\.category-pane\[hidden\]\{display:none!important\}/);
  assert.match(style,/\.category-local-tab\[aria-selected="true"\]/);
  assert.ok(style.includes('@media(max-width:560px)'));
  assert.ok(layout.includes("tab.setAttribute('role','tab')"));
  assert.ok(layout.includes("pane.setAttribute('role','tabpanel')"));
  assert.ok(layout.includes("['ArrowLeft','ArrowRight','Home','End']"));
  assert.ok(!layout.includes("battle.hidden=true"),'arena should remain visible');
});

function fixture(){
  class Node{
    constructor(tag='div'){
      this.tagName=tag.toUpperCase();this.id='';this.className='';this.textContent='';
      this.children=[];this.parentElement=null;this.attrs={};this.handlers={};
      this.dataset={};this.open=false;this.hidden=false;this.tabIndex=0;this.scrolls=0;
      this.classList={add:(name)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),name])].join(' ');},
        contains:name=>this.className.split(/\s+/).includes(name)};
    }
    append(...nodes){
      for(const child of nodes){
        if(child.parentElement)child.parentElement.children=child.parentElement.children.filter(x=>x!==child);
        this.children.push(child);child.parentElement=this;
      }
    }
    appendChild(x){this.append(x);return x;}
    setAttribute(name,value){this.attrs[name]=String(value);}
    removeAttribute(name){delete this.attrs[name];}
    getAttribute(name){return this.attrs[name]??null;}
    addEventListener(type,fn){this.handlers[type]=fn;}
    scrollIntoView(){this.scrolls++;}
    focus(){this.focused=true;}
    contains(node){return this===node||this.children.some(x=>x.contains(node));}
    querySelector(){return null;}
    querySelectorAll(){return [];}
  }
  const panel=new Node('section'),nav=new Node('nav'),battle=new Node('section'),
    wager=new Node('details'),guide=new Node('details'),heading=new Node('div'),
    picks=new Node('div'),apply=new Node('div'),status=new Node('div'),
    photo=new Node('details'),creator=new Node('details');
  panel.className='bf-tools';panel.append(heading,picks,apply,status,photo,creator);
  const photoSummary=new Node('summary');photoSummary.textContent='사진 설정';
  const creatorSummary=new Node('summary');creatorSummary.textContent='커스텀 캐릭터';
  photo.append(photoSummary);creator.append(creatorSummary);
  const studio=new Node('div');studio.className='forge-studio';
  creator.append(studio);
  const categoryLinks=Object.fromEntries(['arena','match','creator','photo','economy','guide'].map(key=>{
    const link=new Node('a');link.dataset.category=key;
    link.closest=()=>link;nav.append(link);return [key,link];
  }));
  panel.querySelector=(sel)=>({
    ':scope > .panel-heading':heading,':scope > .bf-actions':apply
  })[sel]||null;
  panel.querySelectorAll=sel=>sel===':scope > details.bf-details'?[photo,creator]:[];
  photo.querySelector=sel=>sel==='summary'?photoSummary:null;
  creator.querySelector=sel=>sel==='summary'?creatorSummary:sel==='.forge-studio'?studio:null;
  nav.querySelectorAll=sel=>sel==='[data-category]'?Object.values(categoryLinks):[];
  const summary=new Node('h2');summary.textContent='아이템';
  const shopGrid=new Node('div'),reserved=new Node('div'),divider=new Node('div'),
    economy=new Node('section');
  economy.querySelector=sel=>({
    '.shop-grid':shopGrid,'.reserved-list':reserved,'.economy-divider':divider
  })[sel]||null;
  economy.querySelectorAll=sel=>sel===':scope > .economy-title'?[summary]:[];
  economy.append(divider,summary,shopGrid,reserved);
  wager.querySelector=sel=>sel==='.economy-card'?economy:null;
  const doc={
    createElement:tag=>new Node(tag),
    querySelector:sel=>({
      '.bf-tools':panel,'.battle-screen':battle,
      '.bf-fold':wager,'.roster-card':guide
    })[sel]||null,
    getElementById:id=>({'arena-category-nav':nav,'bf-picks':picks,'bf-status':status})[id]||null
  };
  const context={window:{},document:doc};
  vm.runInNewContext(layout,context,{filename:'ui-categories.js'});
  return {world:context.window,nav,links:categoryLinks,panel,photo,creator,studio,wager,guide,shopGrid,reserved};
}
test('runtime tabs move existing nodes without recreating functionality',()=>{
  const {world,panel,creator,photo,studio,nav,links,wager,guide,shopGrid,reserved}=fixture();
  assert.equal(world.ArenaCategories.active,'match');
  assert.deepEqual(Array.from(world.ArenaCategories.tabs),['match','creator','photo']);
  const panes=panel.children.filter(x=>x.attrs.role==='tabpanel');
  assert.equal(panes.length,3);
  assert.equal(panes.find(x=>x.id==='category-pane-match').hidden,false);
  assert.equal(panes.find(x=>x.id==='category-pane-creator').hidden,true);
  assert.equal(creator.parentElement.id,'category-pane-creator');
  assert.equal(creator.open,true);
  assert.equal(photo.open,true);
  assert.equal(creator.contains(studio),true,'original creator controls still present');
  world.ArenaCategories.activate('creator');
  assert.equal(world.ArenaCategories.active,'creator');
  assert.equal(panes.find(x=>x.id==='category-pane-creator').hidden,false);
  assert.equal(panes.find(x=>x.id==='category-pane-match').hidden,true);
  assert.equal(links.creator.getAttribute('aria-current'),'location');
  nav.handlers.click({target:links.economy,preventDefault(){}});
  assert.equal(wager.open,true);
  assert.ok(wager.scrolls>0);
  nav.handlers.click({target:links.guide,preventDefault(){}});
  assert.equal(guide.open,true);
  assert.equal(shopGrid.parentElement,reserved.parentElement,'shop nodes stay together');
});

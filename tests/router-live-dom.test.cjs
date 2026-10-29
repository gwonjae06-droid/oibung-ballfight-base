'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/features/screen-router.js'),'utf8');
function setup(){
  const byId=new Map(),events=[];
  class El{
    constructor(tag='div'){this.tag=tag;this.dataset={};this.children=[];this.hidden=false;
      this.attrs=new Map();this.queryMap={};this.listeners={};this.style={};this.textContent='';
      this.classes=new Set();this.classList={add:c=>this.classes.add(c),contains:c=>this.classes.has(c)};}
    set id(value){this._id=value;byId.set(value,this);}
    get id(){return this._id;}
    set innerHTML(text){
      this._html=text;
      for(const m of text.matchAll(/id="([^"]+)"/g)){
        const n=new El('generated');n.id=m[1];n.parent=this;
      }
    }
    get innerHTML(){return this._html||'';}
    querySelector(sel){return this.queryMap[sel]||byId.get(sel.slice(1))||null;}
    querySelectorAll(){return [];}
    append(...els){for(const el of els){el.parent=this;this.children.push(el);}}
    prepend(...els){for(const el of els){el.parent=this;}this.children.unshift(...els);}
    replaceChildren(...els){this.children=[];this.append(...els);}
    setAttribute(name,value){this.attrs.set(name,String(value));if(name==='open')this.open=true;}
    removeAttribute(name){this.attrs.delete(name);if(name==='open')this.open=false;}
    getAttribute(name){return this.attrs.get(name)||null;}
    addEventListener(type,fn){this.listeners[type]=fn;}
    scrollIntoView(){this.scrolled=true;}
  }
  const main=new El('main');main.id='container';
  const header=new El(),nav=new El(),purpose=new El(),arena=new El(),tools=new El(),finance=new El(),ranking=new El(),gallery=new El(),dialog=new El(),cosmetic=new El(),wager=new El(),market=new El(),mine=new El(),guide=new El();
  ranking.id='community-power-ranking';dialog.id='character-studio-dialog';
  const innerHeading=new El('header'),innerTabs=new El('nav');
  dialog.queryMap['.character-studio-head']=innerHeading;
  dialog.queryMap['.studio-category-tabs']=innerTabs;
  nav.queryMap['.arena-guide-reopen']=guide;
  finance.queryMap['.finance-market']=market;finance.queryMap['.finance-mine']=mine;
  ranking.queryMap['.community-section']=gallery;
  Object.assign(main.queryMap,{
    '.page-header':header,'.arena-category-nav':nav,'.arena-purpose':purpose,
    '.battle-screen':arena,'.bf-tools':tools,'.bf-fold':wager,
    '#point-finance':finance,'#cosmetic-arcade':cosmetic
  });
  const body={dataset:{}},doc={
    body,getElementById:id=>byId.get(id)||null,
    createElement:tag=>new El(tag),querySelector:()=>null,
    querySelectorAll:()=>[]
  };
  const game={window:null,document:doc,console,Math,
    location:{hash:''},Event:class{constructor(type){this.type=type;}},
    coins:1000,players:[{name:'기본 파이터'}],
    addEventListener(){},dispatchEvent:e=>events.push(e.type),
    scrollTo(){},
    formatGold:x=>x+' G',
    ArenaTowerModel:{read:()=>({last:null})}
  };
  game.window=game;vm.createContext(game);
  vm.runInContext(source,game,{filename:'screen-router.js'});
  return {game,main,header,arena,tools,ranking,gallery,market,mine,dialog,
    innerHeading,innerTabs,cosmetic,guide,events,byId};
}
test('actual router constructs all six routes and preserves original game widgets',()=>{
  const x=setup(),r=x.game.ArenaScreenRouter;
  assert.equal(r.enabled,true);
  assert.equal(r.active,'lobby');
  assert.equal(x.main.dataset.screenRouter,'ready');
  assert.equal(x.arena.parent.id,'tower-arena-slot');
  assert.equal(x.tools.parent.id,'pve-free-slot');
  assert.equal(x.ranking.parent.id,'ranking-power');
  assert.equal(x.gallery.parent.id,'ranking-shared');
  assert.equal(x.market.parent.id,'stock-screen-slot');
  assert.equal(x.mine.parent.id,'mine-screen-slot');
  assert.equal(x.cosmetic.parent.id,'screen-mine');
  assert.ok(x.cosmetic.classList.contains('mine-gacha'));
  assert.equal(x.dialog.parent.id,'character-design-slot');
  const visited=[];
  for(const id of ['tower','pve','character','ranking','mine','stock','lobby']){
    assert.equal(r.go(id),id);
    visited.push(r.active);
    assert.equal(x.byId.get('screen-'+id).hidden,false);
  }
  assert.deepEqual(visited,['tower','pve','character','ranking','mine','stock','lobby']);
  assert.equal(x.byId.get('screen-tower').hidden,true);
  assert.equal(x.events.includes('studio:open'),true);
  assert.equal(x.events.includes('studio:close'),true);
  assert.equal(x.dialog.open,false);
});
test('PvE is a standalone route; rankings keep their underlying data',()=>{
  const x=setup(),r=x.game.ArenaScreenRouter;
  r.go('tower');
  r.go('pve');
  assert.equal(r.active,'pve');
  assert.equal(x.arena.parent.id,'pve-arena-slot');
  assert.equal(x.tools.parent.id,'pve-free-slot');
  assert.equal(x.byId.get('screen-tower').hidden,true);
  r.go('tower');
  assert.equal(r.active,'tower');
  assert.equal(x.arena.parent.id,'tower-arena-slot');
  assert.equal(x.byId.get('tower-mode-slot').hidden,false);
  r.go('ranking');
  for(const [id,show] of [['power','ranking-power'],['tower','tower-record-panel'],
    ['shared','ranking-shared'],['personal','ranking-personal']]){
    r.setRankingTab(id);
    assert.equal(x.byId.get(show).hidden,false);
    assert.equal(x.ranking.parent.id,'ranking-power','original ranking persists');
  }
  r.go('mine');r.mineTab('gacha');
  assert.equal(x.cosmetic.hidden,false);
  assert.equal(x.byId.get('mine-screen-slot').hidden,true);
  r.mineTab('mine');
  assert.equal(x.cosmetic.hidden,true);
  assert.equal(x.byId.get('mine-screen-slot').hidden,false);
  r.go('character');
  r.characterTab('cosmetics');
  assert.equal(x.byId.get('character-cosmetic-slot').hidden,false);
  r.characterTab('design');
  assert.equal(x.byId.get('character-design-slot').hidden,false);
});

test('character route embeds a single editor without an inner duplicate heading or tabs',()=>{
  const x=setup(),r=x.game.ArenaScreenRouter;
  r.go('character');
  assert.equal(x.dialog.parent.id,'character-design-slot');
  assert.equal(x.dialog.classList.contains('character-studio-embedded'),true);
  assert.equal(x.innerHeading.hidden,true);
  assert.equal(x.innerTabs.hidden,true);
  assert.equal(x.innerHeading.attrs.get('aria-hidden'),'true');
  assert.equal(x.innerTabs.attrs.get('aria-hidden'),'true');
  assert.equal(r.active,'character');
  r.characterTab('cosmetics');
  r.characterTab('design');
  assert.equal(x.innerHeading.hidden,true,'switching design modes must not restore nested chrome');
  assert.equal(x.innerTabs.hidden,true);
});
test('embedded character layout removes modal frame and nested scroll area',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../css/app-shell.css'),'utf8');
  assert.match(css,/#screen-character #character-studio-dialog\.character-studio-embedded\{/);
  assert.match(css,/\.character-studio-embedded \.character-studio-head,/);
  assert.match(css,/\.character-studio-embedded \.studio-category-tabs\{/);
  assert.match(css,/\.character-studio-embedded \.character-studio-content\{[\s\S]*?overflow:visible!important/);
  assert.match(css,/#screen-character \.character-studio-embedded \.studio-motion-preview\{/);
  assert.match(css,/@media\(max-width:1100px\), \(max-height:640px\)/);
});

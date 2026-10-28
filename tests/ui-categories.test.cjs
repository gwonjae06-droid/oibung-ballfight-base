'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),main=read('js/main.js');
const categories=read('js/features/ui-categories.js'),art=read('js/features/studio-art.js');
const css=read('css/style.css');
test('main UI contains no fighter guide or second picture editor',()=>{
  assert.ok(!html.includes('roster-card'));
  assert.ok(!html.includes('data-category="guide"'));
  assert.ok(!html.includes('data-category="photo"'));
  assert.ok(!main.includes('id=\\\"bf-photo\\\"'));
  assert.ok(!main.includes("getElementById('bf-photo')"));
  assert.ok(html.includes('data-category="creator"'));
  assert.ok(categories.includes("document.createElement('dialog')"));
  assert.ok(categories.includes("dialog.setAttribute('aria-label','커스텀 캐릭터 제작')"));
});
test('custom fighter studio is the only location for name, picture, color, effects and skills',()=>{
  assert.match(main,/커스텀 캐릭터/);
  assert.match(categories,/content\.append\(creator\)/);
  assert.match(categories,/openButton\.textContent='\+ 커스텀 캐릭터 만들기'/);
  assert.match(categories,/creator\.open=true/);
  assert.match(art,/id="character-art-canvas"/);
  assert.match(art,/id="character-art-upload"/);
  assert.match(art,/pointerdown/);
  assert.match(art,/pointermove/);
  assert.match(art,/localStorage\.setItem\(key\(artKey\),src\)/);
  assert.match(read('js/features/skill-forge.js'),/forge-effect-color/);
  assert.match(read('js/features/skill-forge.js'),/CharacterStudioArt\?\.commit/);
  assert.match(css,/\.character-studio-dialog::backdrop/);
  assert.match(css,/@media\(max-width:700px\)/);
});
function harness(){
 class Node{
  constructor(tag='div'){
   this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;
   this.attrs={};this.dataset={};this.handlers={};this.className='';
   this.id='';this.open=false;this.focusCount=0;this.scrollCount=0;
  }
  append(...nodes){for(const n of nodes){
   if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(c=>c!==n);
   this.children.push(n);n.parentElement=this;
  }}
  appendChild(n){this.append(n);return n;}
  setAttribute(k,v){this.attrs[k]=v;if(k==='open')this.open=true;}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];if(k==='open')this.open=false;}
  addEventListener(k,cb){this.handlers[k]=cb;}
  focus(){this.focusCount++;}
  scrollIntoView(){this.scrollCount++;}
  showModal(){this.open=true;}
  close(){this.open=false;this.handlers.close?.();}
  contains(n){return this===n||this.children.some(c=>c.contains(n));}
  querySelector(){return null;}
  querySelectorAll(){return [];}
  get classList(){return {add:(v)=>this.className+=' '+v,contains:v=>this.className.split(' ').includes(v)}}
 }
 const root=new Node('body'),nav=new Node('nav'),battle=new Node('section'),
  panel=new Node('section'),creator=new Node('details'),
  intro=new Node('div'),summary=new Node('summary'),editor=new Node('div');
 summary.textContent='커스텀 캐릭터';editor.className='forge-studio';
 editor.children=[];creator.append(summary,editor);
 panel.append(creator);
 creator.querySelector=selector=>selector==='summary'?summary:selector==='.forge-studio'?editor:null;
 panel.querySelectorAll=selector=>selector===':scope > details.bf-details'?[creator]:[];
 const wager=new Node('details');
 const links={};
 for(const k of ['arena','match','creator','economy']){
  const a=new Node('a');a.dataset.category=k;a.closest=()=>a;nav.append(a);links[k]=a;
 }
 nav.querySelectorAll=selector=>selector==='[data-category]'?Object.values(links):[];
 const doc={body:root,activeElement:intro,
  createElement:tag=>new Node(tag),
  getElementById:id=>id==='arena-category-nav'?nav:null,
  querySelector:sel=>({'.bf-tools':panel,'.battle-screen':battle,'.bf-fold':wager})[sel]||null
 };
 const generated=[];const win={NaturalForge:{generate(themes){generated.push(themes);return true;}}};
 vm.runInNewContext(categories,{document:doc,window:win},{filename:'ui-categories.js'});
 return {win,nav,panel,creator,editor,root,links,wager,generated};
}
test('studio dialog reuses original editor, opens/closes, and navigates back to arena',()=>{
 const {win,nav,panel,creator,editor,root,links,wager,generated}=harness();
 assert.ok(win.ArenaCategories);
 const dialog=root.children.find(x=>x.tagName==='DIALOG');
 assert.ok(dialog);
 assert.equal(creator.open,true);
 assert.equal(creator.contains(editor),true);
 assert.equal(panel.contains(creator),false,'editor removed from main setup');
 assert.equal(dialog.contains(creator),true,'original editor was moved into dialog');
 win.ArenaCategories.showStudio();
 assert.equal(dialog.open,true);
 assert.equal(win.ArenaCategories.active,'creator');
 win.ArenaCategories.hideStudio();
 assert.equal(dialog.open,false);
 nav.handlers.click({target:links.creator,preventDefault(){}});
 assert.equal(dialog.open,true);
 nav.handlers.click({target:links.economy,preventDefault(){}});
 assert.equal(wager.open,true);
 assert.equal(links.economy.getAttribute('aria-current'),'location');
 const shortcuts=panel.children.find(n=>n.className==='arena-match-creator-shortcut');
 assert.ok(shortcuts,'main match setup must expose generation');
 const actionRow=shortcuts.children.find(n=>n.className==='arena-quick-generate');
 assert.ok(actionRow);
 const random=actionRow.children.find(n=>n.id==='quick-random-create');
 const theme=actionRow.children.find(n=>n.id==='open-theme-generator');
 assert.ok(random);assert.ok(theme);
 random.handlers.click();
 assert.equal(generated.length,1);
 assert.equal(generated[0].length,0,'full random ignores selected themes');
 win.ArenaCategories.hideStudio();
 theme.handlers.click();
 assert.equal(root.children.find(n=>n.tagName==='DIALOG').open,true);
});
test('same fighter is numbered consistently in HP HUD, canvas and win screen',()=>{
 const engine=read('js/core/engine.js'),render=read('js/core/render.js');
 assert.match(engine,/function getArenaFighterName\(p\)/);
 assert.match(engine,/group\.indexOf\(p\)\+1/);
 assert.match(engine,/el\.innerText=getArenaFighterName\(p\)/);
 assert.match(render,/const display=getArenaFighterName\(p\)/);
 assert.match(render,/getArenaFighterName\(alive\[0\]\)/);
 const f=engine.match(/function getArenaFighterName\(p\)\{[\s\S]*?\n\}/)[0];
 const p1={name:'동일'},p2={name:'동일'},p3={name:'다른'};
 const ctx={players:[p1,p2,p3]};vm.runInNewContext(f+';this.getName=getArenaFighterName;',ctx);
 assert.equal(ctx.getName(p1),'동일 1');
 assert.equal(ctx.getName(p2),'동일 2');
 assert.equal(ctx.getName(p3),'다른');
 ctx.players=[p1,p2,{name:'동일'}];
 assert.equal(ctx.getName(ctx.players[2]),'동일 3');
});

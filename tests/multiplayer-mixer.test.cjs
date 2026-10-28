'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function arenaHarness(){
  const defs=Array.from({length:5},(_,index)=>({
    id:'fighter_'+index,name:'기본'+index,
    createInstance(num){return {playerNum:num,name:'기본'+index,id:this.id,
      x:0,y:0,vx:0,vy:0,radius:28,hp:250,maxHp:250,invincible:0,
      getTag(){return {text:''};}};}
  }));
  const container={dataset:{}},wrapper={style:{}},select={value:'2'},
    title={innerText:''},btn={innerText:'',dataset:{}};
  const doc={getElementById(id){return ({
    container,'arena-player-count':select,'title-text':title,'btn-start':btn
  })[id]||null;},querySelector(name){return name==='.canvas-wrapper'?wrapper:null;}};
  const context={
    document:doc,canvas:{width:500,height:500},CHARACTER_DEFS:defs,CUSTOM_DEFS:[],
    BEHAVIORS:{},matchCount:2,gameMode:'1v1',roundStarted:false,isGameOver:false,
    roundStopped:false,roundSettled:false,selectedBetPlayerNum:null,activeBet:null,
    isPlaying:false,players:[],particles:[],floatingTexts:[],shockwaves:[],screenShake:0,
    reservedItems:{skillRush:[],vitality:[],speed:[]},Math,
    renderEconomyUI(){},draw(){},setEconomyMessage(){}
  };
  context.globalThis=context;vm.createContext(context);
  vm.runInContext(read('js/core/engine.js'),context);
  return {context,defs,container,wrapper,title,select};
}
test('2-to-10 fighter selection expands actual map dimensions and spawns ten independent slots',()=>{
  const {context:s,title,container,wrapper,select}=arenaHarness();
  assert.equal(s.setMatchCount(10),true);
  assert.equal(s.matchCount,10);
  assert.equal(s.players.length,10);
  assert.equal(s.canvas.width,1156);
  assert.ok(s.canvas.height>s.canvas.width);
  assert.equal(title.innerText,'10인 자유 대전');
  assert.equal(container.dataset.fighterCount,'10');
  assert.equal(select.value,'10');
  assert.ok(wrapper.style.aspectRatio.includes('/'));
  assert.deepEqual(Array.from(s.players,p=>p.playerNum),[1,2,3,4,5,6,7,8,9,10]);
  const positions=new Set(Array.from(s.players,p=>Math.round(p.x)+':'+Math.round(p.y)));
  assert.equal(positions.size,10,'spawn positions must not overlap');
});
test('ten players can all use the same character and receive unique labels',()=>{
  const {context:s,defs}=arenaHarness();
  s.setMatchCount(10);
  assert.equal(s.reRollMatch(Array(10).fill(defs[0])),true);
  assert.equal(s.players.length,10);
  assert.equal(s.getArenaFighterName(s.players[0]),'기본0 1');
  assert.equal(s.getArenaFighterName(s.players[9]),'기본0 10');
  assert.equal(s.setMatchCount(2),true);
  assert.equal(s.players.length,2);
  assert.equal(s.canvas.width,500);
});
test('participant selector and roster selectors apply without an extra button',()=>{
  const html=read('index.html'),main=read('js/main.js');
  assert.ok(html.includes('id="arena-player-count"'));
  assert.ok(html.includes('onchange="setMatchCount(Number(this.value))"'));
  for(let n=2;n<=10;n++)assert.ok(html.includes('<option value="'+n+'"'));
  assert.ok(!main.includes('id=\\\"bf-apply\\\"'));
  assert.ok(main.includes("select.addEventListener('change',applyPicks)"));
  assert.ok(main.includes('window.applyFighterPicks=applyPicks'));
  assert.ok(main.includes('originalRoll(defs)'));
  assert.ok(main.includes('length:matchCount'));
  assert.ok(read('js/features/skill-forge.js').includes('globalThis.applyFighterPicks?.()'));
});
test('natural language edits retain current name, visual colors and photo art key',()=>{
  const natural=read('js/features/natural-forge.js'),forge=read('js/features/skill-forge.js');
  assert.ok(natural.includes('const current=SkillForge.getDraft?.()'));
  for(const id of ['bf-name','forge-color','forge-effect-color','forge-hp','forge-speed','bf-text'])
    assert.ok(natural.includes("$id('"+id+"')"),id+' must survive parser');
  assert.ok(natural.includes('artKey:current.artKey'));
  assert.ok(natural.includes('SkillForge.setDraft({...out.profile,...appearance})'));
  assert.ok(forge.includes('getDraft:()=>normalize(draft)'));
});
test('every chosen random family contributes an action to the mixed character',()=>{
  const global={window:null,players:[],CUSTOM_DEFS:[],CHARACTER_PHOTOS:{},BEHAVIORS:{}};
  global.window=global;vm.createContext(global);
  for(const file of ['forge-expansion','advanced-combat','skill-forge'])
    vm.runInContext(read('js/features/'+file+'.js'),global);
  const keys=Object.keys(global.SkillForge.THEMES);
  for(const chosen of [keys.slice(0,2),keys.slice(0,4),keys]){
    for(let run=0;run<12;run++){
      const rolled=global.SkillForge.randomProfile(chosen);
      const actions=rolled.skills.flatMap(s=>s.actions).map(a=>a.type);
      for(const theme of chosen)
        assert.ok(actions.some(t=>global.SkillForge.THEMES[theme].types.includes(t)),
          theme+' missing from '+chosen.join(','));
      assert.ok(rolled.skills.length<=4);
    }
  }
});
test('map grows smoothly on desktop and retains mobile and reduced-motion rules',()=>{
  const css=read('css/style.css');
  assert.ok(css.includes('data-fighter-count="10"'));
  assert.ok(css.includes('transition:width .5s ease'));
  assert.ok(css.includes('aspect-ratio .5s ease'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes('grid-template-columns:repeat(auto-fit,minmax(134px,1fr))'));
});

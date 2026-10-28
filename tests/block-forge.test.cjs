'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function setup(){
 const h={window:null,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},getClosestAliveEnemy(p){return h.players.find(e=>e!==p&&e.hp>0)||null;}};
 h.window=h;vm.createContext(h);
 vm.runInContext(read('js/features/forge-expansion.js'),h);
 vm.runInContext(read('js/features/advanced-combat.js'),h);
 vm.runInContext(read('js/features/skill-forge.js'),h);
 vm.runInContext(read('js/features/block-forge.js'),h);
 return h;
}
const profile=()=>({name:'블록 파이터',skills:[{name:'콤보',trigger:'auto',cooldown:2,actions:[{type:'slash'}]}]});
test('Korean particles and connectors persist in skills',()=>{
 const b=setup().BlockForge;
 let d=b.modify(profile(),{kind:'add',skill:0,type:'heal'});
 assert.deepEqual(Array.from(d.skills[0].actions,a=>a.type),['slash','heal']);
 d=b.modify(d,{kind:'link',skill:0,index:1,value:'with'});
 assert.equal(d.skills[0].actions[1].link,'with');
 assert.match(b.phrase(d.skills[0]),/동시에 사용/);
 d=b.modify(d,{kind:'link',skill:0,index:1,value:'after'});
 assert.equal(d.skills[0].actions[1].link,'after');
 assert.match(b.phrase(d.skills[0]),/한 뒤/);
 d=b.modify(d,{kind:'link',skill:0,index:1,value:'and'});
 assert.match(b.phrase(d.skills[0]),/사용하고/);
 assert.equal(b.josa('회복','을','를'),'회복을');
 assert.equal(b.josa('낙뢰','을','를'),'낙뢰를');
});
test('split and merge really produce distinct cooldown clocks',()=>{
 const b=setup().BlockForge;
 let d=b.modify(profile(),{kind:'add',skill:0,type:'shield'});
 d=b.modify(d,{kind:'link',skill:0,index:1,value:'separate'});
 assert.equal(d.skills.length,2);
 assert.deepEqual(Array.from(d.skills,s=>s.actions[0].type),['slash','shield']);
 d=b.modify(d,{kind:'meta',skill:1,key:'cooldown',value:7.5});
 assert.equal(d.skills[1].cooldown,7.5);
 d=b.modify(d,{kind:'merge',skill:1});
 assert.equal(d.skills.length,1);assert.equal(d.skills[0].actions.length,2);
});
test('block drag move semantics, damage fields and caps',()=>{
 const b=setup().BlockForge;
 let d=b.modify(profile(),{kind:'add',skill:0,type:'shot'});
 d=b.modify(d,{kind:'add',skill:0,type:'bolt'});
 assert.throws(()=>b.modify(d,{kind:'add',skill:0,type:'heal'}),/최대 3개/);
 d=b.modify(d,{kind:'move',fromSkill:0,fromIndex:0,skill:0,at:3});
 assert.deepEqual(Array.from(d.skills[0].actions,a=>a.type),['shot','bolt','slash']);
 d=b.modify(d,{kind:'new-skill',type:'heal'});
 d=b.modify(d,{kind:'move',fromSkill:0,fromIndex:1,skill:1,at:1});
 assert.deepEqual(Array.from(d.skills[1].actions,a=>a.type),['heal','bolt']);
 assert.throws(()=>b.modify(d,{kind:'remove',skill:0,index:5}),/존재하지 않는/);
 d=b.modify(d,{kind:'param',skill:1,index:1,key:'damage',value:57});
 assert.equal(d.skills[1].actions[1].damage,57);
 d=b.modify(d,{kind:'new-skill',type:'shield'});
 d=b.modify(d,{kind:'new-skill',type:'dash'});
 assert.throws(()=>b.modify(d,{kind:'new-skill',type:'heal'}),/최대 4개/);
});
test('same-tick parallel skills and delayed chain have different live effects',()=>{
 const h=setup();
 const enemy={playerNum:2,x:160,y:100,vx:0,vy:0,hp:250,maxHp:250,radius:25,invincible:0};
 function simulate(link){
  const cfg={name:'시간 비교',hp:200,skills:[{name:'상태',trigger:'auto',cooldown:3,
   actions:[{type:'shield',duration:1},{type:'heal',damage:20,link}]}]};
  const id=h.SkillForge.register(cfg),p=h.CUSTOM_DEFS.at(-1).createInstance(1);
  p.x=100;p.y=100;p.hp=100;p.forgeLastHp=100;p.forgeTicks=[200];
  h.players=[p,enemy];
  h.BEHAVIORS[id].update(p,enemy);
  return {hp:p.hp,pending:p.forgeQueue.length};
 }
 const simultaneous=simulate('with'),ordered=simulate('after');
 assert.equal(simultaneous.hp,120,'at the same tick, shield and healing should both execute');
 assert.equal(ordered.hp,100,'after connector should defer second action');
 assert.ok(ordered.pending>0,'second action must remain in queue');
});
test('studio uses block UI above save with touch fallback; no prose input',()=>{
 const html=read('index.html'),ui=read('js/features/ui-categories.js'),code=read('js/features/block-forge.js');
 assert.match(html,/js\/features\/block-forge.js/);
 assert.ok(html.indexOf('js/features/natural-forge.js')<html.indexOf('js/features/block-forge.js'));
 assert.match(ui,/const ordered=\[intro,random,name,basics,blocks,create/);
 assert.match(code,/studio\.insertBefore\(root,target\)/);
 assert.match(code,/dataTransfer\.setData\('text\/plain'/);
 assert.match(code,/data-pick-type/);
 assert.match(code,/data-op="split"/);
 const natural=read('js/features/natural-forge.js'),install=natural.slice(natural.indexOf('function install(){'));
 assert.doesNotMatch(install,/forge-natural-text|forge-natural-build|forge-natural-mode/);
});

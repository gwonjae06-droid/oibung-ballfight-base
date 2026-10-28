'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function world(){
  const h={window:null,players:[],CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},
    canvas:{width:500,height:500},Math,createHitParticles(){},addFloatingText(){},
    document:{querySelector(){return null;}},
    getClosestAliveEnemy(p){return h.players.find(e=>e!==p&&e.hp>0)||null;}};
  h.window=h;vm.createContext(h);
  for(const name of ['ability-atlas','forge-expansion','advanced-combat','skill-forge','skill-visuals'])
    vm.runInContext(read('js/features/'+name+'.js'),h,{filename:name+'.js'});
  const calls=[];
  const ctx=new Proxy({},{
    get(obj,key){if(Object.hasOwn(obj,key))return obj[key];
      return (...args)=>calls.push([key,...args]);},
    set(obj,key,value){obj[key]=value;return true;}
  });
  return {h,calls,ctx};
}
function fighter(n,x,y){
  return {playerNum:n,x,y,vx:0,vy:0,z:0,radius:24,hp:300,maxHp:300,
    invincible:0,forge:{color:'#397997'},jumpState:'ground'};
}
test('all 55 supported mechanics receive exactly one distinct visual motif',()=>{
  const {h}=world();
  const types=Object.keys(h.SkillForge.TYPE),visualTypes=Object.keys(h.SkillVisuals.catalog);
  assert.equal(types.length,55);
  assert.equal(visualTypes.length,55);
  for(const key of types){
    assert.ok(visualTypes.includes(key),'missing visual for '+key);
    assert.match(read('js/features/skill-visuals.js'),new RegExp("case '"+key+"'"),
      'missing path drawing for '+key);
  }
  const shapes=visualTypes.map(x=>h.SkillVisuals.catalog[x][0]);
  assert.equal(new Set(shapes).size,55,'55 action types need unique silhouette recipes');
});
test('every one of the 55 silhouettes draws without mutating physics',()=>{
  const {h,ctx,calls}=world();
  const p=fighter(1,105,115),enemy=fighter(2,205,195);
  h.players.push(p,enemy);
  const visualSignatures=new Set();
  for(const type of Object.keys(h.SkillForge.TYPE)){
    h.SkillVisuals.clear();calls.length=0;
    assert.equal(h.SkillVisuals.cast(p,{type,radius:140},enemy),true,type);
    h.SkillVisuals.draw(ctx);
    assert.ok(calls.some(x=>x[0]==='stroke'),type+' missing recognizable stroke');
    assert.equal(p.x,105);assert.equal(p.y,115);
    assert.equal(enemy.hp,300);
    visualSignatures.add(JSON.stringify(calls.filter(c=>
      ['arc','lineTo','moveTo','ellipse'].includes(c[0]))));
  }
  assert.ok(visualSignatures.size>=50,'55 signatures should be visually distinct');
});
test('cast glyph and actual hit glyph appear at separate, correct physical events',()=>{
  const {h}=world(),p=fighter(1,105,115),enemy=fighter(2,145,115);
  h.players.push(p,enemy);
  assert.equal(h.SkillVisuals.active,0);
  h.SkillVisuals.cast(p,{type:'thrust',radius:120},enemy);
  assert.equal(h.SkillVisuals.active,1);
  enemy.invincible=9;
  assert.equal(h.SkillForge.hit(p,enemy,{type:'thrust',damage:40,knockback:0}),false);
  assert.equal(h.SkillVisuals.active,1,'invulnerability cannot create fake hit glyphs');
  enemy.invincible=0;enemy.z=20;
  assert.equal(h.SkillForge.hit(p,enemy,{type:'thrust',damage:40,knockback:0},1,20),true);
  assert.equal(enemy.hp,260);
  assert.equal(h.SkillVisuals.active,2);
  h.SkillVisuals.setReduced(true);
  h.SkillVisuals.tick();
  for(let i=0;i<30;i++)h.SkillVisuals.tick();
  assert.equal(h.SkillVisuals.active,0,'marks fade out on simulation ticks');
});
test('effects stay bounded when a full catalog character uses many skills',()=>{
  const {h,ctx}=world(),p=fighter(1,100,100),e=fighter(2,150,150);
  for(let i=0;i<200;i++){
    const type=Object.keys(h.SkillForge.TYPE)[i%55];
    h.SkillVisuals.cast(p,{type,radius:300},e);
    h.SkillVisuals.impact(p,e,{type,radius:300});
  }
  assert.ok(h.SkillVisuals.active<=68);
  h.SkillVisuals.draw(ctx);
  h.SkillVisuals.clear();assert.equal(h.SkillVisuals.active,0);
});
test('primary random button creates and deploys a fully random fighter directly',()=>{
  const natural=read('js/features/natural-forge.js');
  const forge=read('js/features/skill-forge.js');
  const html=read('index.html'),css=read('css/style.css'),battle=read('js/features/battle-effects.js');
  assert.ok(natural.includes("randomNow.id='forge-random-create'"));
  assert.ok(natural.includes("SkillForge.randomProfile('any')"));
  assert.ok(natural.includes('SkillForge.setDraft(profile)'));
  assert.ok(natural.includes('saveBtn.click()'));
  assert.ok(natural.includes('actions.replaceChildren(saveBtn,randomNow)'));
  assert.ok(natural.includes('roundStarted&&!isGameOver'));
  assert.ok(natural.includes('SkillForge.list().length>=6'));
  assert.ok(forge.includes('function randomProfile('));
  assert.ok(css.includes('.forge-studio .forge-primary-actions #forge-random-create'));
  const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
  assert.ok(scripts.indexOf('js/features/skill-forge.js')<
    scripts.indexOf('js/features/skill-visuals.js'));
  assert.ok(scripts.indexOf('js/features/skill-visuals.js')<
    scripts.indexOf('js/features/natural-forge.js'));
  assert.ok(battle.includes('window.SkillVisuals?.tick()'));
  assert.ok(battle.includes('window.SkillVisuals?.draw(ctx)'));
  assert.ok(battle.includes('window.SkillVisuals?.clear()'));
});

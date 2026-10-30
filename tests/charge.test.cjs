'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync('js/features/'+p+'.js','utf8');
function fixture(){
 const w={window:null,console,Math,Number,Date,Map,Set,document:{querySelector:()=>null},
  CUSTOM_DEFS:[],BEHAVIORS:{},CHARACTER_PHOTOS:{},players:[],
  canvas:{width:500,height:500},createHitParticles(){},addFloatingText(){},
  getClosestAliveEnemy(p){return w.players.find(e=>e!==p&&e.hp>0)||null;}};
 w.window=w;vm.createContext(w);
 for(const file of ['action-registry','arena-charge','arena-balance','skill-forge','block-forge'])
  vm.runInContext(read(file),w,{filename:file+'.js'});
 return w;
}
const base=(skills)=>({name:'차징 테스트',hp:240,speed:2,color:'#6684aa',effectColor:'#779dcc',skills});
const charge=(duration=1)=>({type:'charge',duration,link:'and',delay:0});
const wave=(damage=36)=>({type:'wave',damage,radius:160,count:1,status:'none',knockback:2,delay:0,link:'and'});
test('charge appears as a selectable, configurable Scratch skill block',()=>{
 const w=fixture(),d=w.ActionRegistry.get('charge');
 assert.equal(d.label,'차징 · 힘 모으기');
 assert.equal(d.category,'special');
 assert.equal(w.SkillForge.supportedParameter('charge','duration'),true);
 assert.equal(w.SkillForge.supportedParameter('charge','damage'),false);
 const profile=w.SkillForge.normalize(base([{name:'차징 베기',trigger:'auto',cooldown:2,actions:[charge(1.4),wave(35)]}]));
 assert.equal(profile.skills[0].actions[0].type,'charge');
 assert.equal(profile.skills[0].actions[0].duration,1.4);
 const changed=w.BlockForge.modify(profile,{kind:'param',skill:0,index:0,key:'duration',value:2.3});
 assert.equal(changed.skills[0].actions[0].duration,2.3);
});
test('charge trembles and glows, then increases one real attack, never stacking',()=>{
 const w=fixture(),p={hp:200,radius:28,x:120,y:140,forge:base([])};
 const c=w.ArenaCharge;
 assert.equal(c.start(p,charge(.5)),true);
 assert.equal(p.forgeCharge.phase,'charging');
 assert.notDeepEqual(Object.values(c.jitter(p)),[0,0]);
 assert.equal(c.start(p,charge(8)),true,'cannot recharge or stack while winding up');
 assert.equal(p.forgeCharge.total,30);
 for(let i=0;i<30;i++)c.tick(p);
 assert.equal(p.forgeCharge.phase,'ready');
 const input=wave(50),out=c.consume(p,input);
 assert.equal(input.damage,50,'original authored block is immutable');
 assert.ok(out.damage>input.damage);
 assert.ok(out.knockback>input.knockback);
 assert.equal(out.charged,true);
 assert.equal(c.consume(p,input),input,'cannot consume twice');
 assert.equal(p.forgeCharge.phase,'release');
 for(let i=0;i<24;i++)c.tick(p);
 assert.equal(p.forgeCharge,null,'release glow terminates');
});
test('charged attack in a single combo waits until charging animation has completed',()=>{
 const w=fixture();
 const pset=base([{name:'차징 강타',trigger:'auto',cooldown:3,actions:[charge(.6),wave(45)]}]);
 const id=w.SkillForge.register(pset),hero=w.CUSTOM_DEFS[0].createInstance(1);
 const foe={playerNum:2,x:150,y:100,vx:0,vy:0,hp:300,maxHp:300,invincible:0,radius:25};
 hero.x=100;hero.y=100;w.players=[hero,foe];hero.forgeTicks=[999];
 w.BEHAVIORS[id].update(hero,foe);
 assert.equal(hero.forgeCharge?.phase,'charging');
 assert.equal(foe.hp,300);
 for(let i=0;i<20;i++)w.BEHAVIORS[id].update(hero,foe);
 assert.equal(foe.hp,300,'no attack during wind-up');
 for(let i=0;i<24;i++)w.BEHAVIORS[id].update(hero,foe);
 assert.ok(foe.hp<255,'one boosted attack after charging');
 assert.equal(hero.forgeCharge?.phase,'release');
});
test('charge on its own skill can prepare next independently cast attack',()=>{
 const w=fixture();
 const pset=base([
  {name:'별도 차징',trigger:'auto',cooldown:7,actions:[charge(.5)]},
  {name:'다른 슬롯 공격',trigger:'auto',cooldown:7,actions:[wave(35)]}
 ]);
 const id=w.SkillForge.register(pset),hero=w.CUSTOM_DEFS[0].createInstance(1);
 const foe={playerNum:2,x:160,y:100,hp:250,maxHp:250,radius:24,vx:0,vy:0,invincible:0};
 hero.x=100;hero.y=100;hero.forgeTicks=[999,999];w.players=[hero,foe];
 w.BEHAVIORS[id].update(hero,foe);
 assert.equal(hero.forgeCharge?.phase,'charging');
 assert.equal(foe.hp,250,'independent attack waits for charge');
 for(let i=0;i<40;i++)w.BEHAVIORS[id].update(hero,foe);
 assert.ok(foe.hp<215,'attack from separate slot also gained power');
});
test('charge expires after five seconds without attacking and does not alter movement blocks',()=>{
 const w=fixture(),p={hp:200,forge:base([])},c=w.ArenaCharge;
 c.start(p,charge(.2));for(let i=0;i<12;i++)c.tick(p);
 const dash={type:'dash',damage:0};
 assert.equal(c.consume(p,dash),dash);
 assert.equal(p.forgeCharge.phase,'ready');
 for(let i=0;i<300;i++)c.tick(p);
 assert.equal(p.forgeCharge,null);

});
test('power budget charges cost and online clients include charge states',()=>{
 const w=fixture(),s={name:'조합',trigger:'auto',cooldown:1.2,actions:[charge(1),wave(70)]};
 const regular=base([{name:'그냥 강타',trigger:'auto',cooldown:1.2,actions:[wave(70)]}]);
 const combo=base([s]);
 assert.ok(w.ArenaBalance.summary(combo).pressure>w.ArenaBalance.summary(regular).pressure);
 const html=fs.readFileSync('index.html','utf8'),frame=fs.readFileSync('pvp-runtime.html','utf8');
 assert.ok(html.indexOf('arena-charge.js')<html.indexOf('skill-forge.js'));
 assert.ok(frame.indexOf('arena-charge.js')<frame.indexOf('skill-forge.js'));
 const net=fs.readFileSync('js/features/pvp-runtime.js','utf8');
 assert.match(net,/charge:p\.forgeCharge/);assert.match(net,/forgeCharge=p\.charge/);
});

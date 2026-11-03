/* Offline semantic -> bounded physical primitives.
 * Registered physics are trusted game code; user prompts create DATA only.
 * The authoritative SkillForge hit resolver remains in charge of HP/status.
 */
(function(g){'use strict';
const R=g.ActionRegistry;
const clamp=(n,lo,hi,fallback=lo)=>Number.isFinite(Number(n))?Math.min(hi,Math.max(lo,Number(n))):fallback;
const PHENOMENA=Object.freeze([
 {type:'tether',label:'탄성 속박',pattern:/(?:상대|적|적군|공).{0,16}(?:붙잡|잡아당|끌어당|포박|휘감아\s*묶|묶어|낚아채)|(?:밧줄|사슬|촉수|덩굴|갈고리|실타래).{0,17}(?:붙잡|묶|포박|끌어|잡아당|낚아채)/},
 {type:'repulse',label:'반발 충격',pattern:/(?:상대|적|적군|공).{0,15}(?:밀쳐|밀어내|밀어낸|밀어냈|날려버|튕겨내|쳐내)|(?:밀쳐|밀어내|밀어낸|밀어냈|날려버|튕겨내|쳐내).{0,15}(?:상대|적)|반발력|척력/},
 {type:'vortex',label:'소용돌이 역학',pattern:/(?:상대|적|공).{0,15}(?:빙빙|회전시키|돌려|공전시키|휘말리)|(?:소용돌이|회오리|태풍).{0,16}(?:휘말|끌어들이|가두|돌려|회전시키)/}
]);
function matchAll(phrase,types=R?.TYPE||{}){
 const s=String(phrase||'').normalize('NFC');
 return PHENOMENA.filter(x=>Object.hasOwn(types,x.type)&&x.pattern.test(s))
  .map(x=>({type:x.type,source:'physical-intent',meaning:x.label}));
}
function choose(phrase,types=R?.TYPE||{}){return matchAll(phrase,types)[0]||null;}
const fields=new WeakMap(),telemetry=new WeakMap();
function safeVelocity(e,x,y){
 const vx=clamp((Number(e.vx)||0)+x,-18,18,0);
 const vy=clamp((Number(e.vy)||0)+y,-18,18,0);
 e.vx=vx;e.vy=vy;
}
function aliveEnemies(p,api){
 const items=typeof api?.enemies==='function'?api.enemies(p):[];
 return Array.isArray(items)?items.filter(e=>e&&e!==p&&e.hp>0&&Number.isFinite(e.x)&&Number.isFinite(e.y)):[];
}
function within(p,e,r){return Math.hypot(e.x-p.x,e.y-p.y)<=r+Math.max(0,Number(e.radius)||0);}
function hitIfContact(p,e,a,api){return typeof api?.hit==='function'&&api.hit(p,e,a)===true;}
function installField(p,field){
 const existing=fields.get(p)||[];
 existing.push(field);
 if(existing.length>6)existing.shift();
 fields.set(p,existing);
 // Never persist simulation entities in saved/exported user profiles.
}
function castTether(p,a,target,api){
 const radius=clamp(a.radius,30,300,145);
 const enemies=aliveEnemies(p,api);
 const e=(target&&enemies.includes(target)&&within(p,target,radius)?target:null)||
  enemies.filter(e=>within(p,e,radius)).sort((a,b)=>
   Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
 if(!e)return true;
 installField(p,{kind:'tether',target:e,remaining:Math.round(clamp(a.duration,.2,8,1.5)*60),
  radius,clock:0,action:a});
 hitIfContact(p,e,a,api);
 return true;
}
function castRepulse(p,a,_target,api){
 const radius=clamp(a.radius,30,300,145);
 const force=clamp((Number(a.knockback)||2)*1.3+(Number(a.speed)||5)*.6,2,13,4);
 for(const e of aliveEnemies(p,api)){
  const d=Math.hypot(e.x-p.x,e.y-p.y);
  if(d>radius+(e.radius||0))continue;
  const nx=d>1e-5?(e.x-p.x)/d:1,ny=d>1e-5?(e.y-p.y)/d:0;
  const falloff=Math.max(.18,1-d/(radius+Math.max(1,e.radius||0)));
  safeVelocity(e,nx*force*falloff,ny*force*falloff);
  hitIfContact(p,e,a,api);
 }
 return true;
}
function castVortex(p,a,_target,api){
 const radius=clamp(a.radius,30,300,145);
 const field={kind:'vortex',remaining:Math.round(clamp(a.duration,.2,8,1.5)*60),
  radius,clock:0,action:a};
 installField(p,field);
 // A vortex damages only where the visible central core actually touches.
 for(const e of aliveEnemies(p,api))
  if(Math.hypot(e.x-p.x,e.y-p.y)<=radius*.40+(e.radius||0))
   hitIfContact(p,e,a,api);
 return true;
}
function tick(p,opponents,hit){
 const pool=fields.get(p);
 if(!pool?.length)return;
 const enemies=Array.isArray(opponents)?opponents:[];
 for(let i=pool.length-1;i>=0;i--){
  const field=pool[i];
  if(--field.remaining<=0){pool.splice(i,1);continue;}
  field.clock++;
  if(field.kind==='tether'){
   const e=field.target;
   if(!e||e.hp<=0||!enemies.includes(e)){pool.splice(i,1);continue;}
   const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
   if(d>field.radius+(e.radius||0)){pool.splice(i,1);continue;}
   const stretch=clamp((d-((p.radius||20)+(e.radius||20)+14))/field.radius,0,1,0);
   safeVelocity(e,dx/d*(.25+stretch*.62),dy/d*(.25+stretch*.62));
   safeVelocity(p,-dx/d*.07,-dy/d*.07);
   if(field.clock%28===0)hitIfContact(p,e,field.action,{hit});
  }else if(field.kind==='vortex'){
   for(const e of enemies){
    if(!e||e===p||e.hp<=0)continue;
    const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy)||1;
    if(d>field.radius+(e.radius||0))continue;
    const scale=clamp(1-d/(field.radius+Math.max(1,e.radius||0)),0,1,0);
    // Counterclockwise tangential force + inward attraction, bounded every tick.
    safeVelocity(e,(-dy/d*.40-dx/d*.19)*scale,(dx/d*.40-dy/d*.19)*scale);
    if(field.clock%28===0&&d<=field.radius*.4+(e.radius||0))
     hitIfContact(p,e,field.action,{hit});
   }
  }
 }
}
function noteCast(p,a){
 if(!p||!a?.type)return;
 const t=telemetry.get(p)||{casts:0,hits:0,damage:0,events:[]};
 t.casts++;t.events.push({type:a.type,kind:'cast'});
 if(t.events.length>24)t.events.shift();telemetry.set(p,t);
}
function noteHit(p,e,a,damage){
 if(!p||!a?.type||!(damage>0))return;
 const t=telemetry.get(p)||{casts:0,hits:0,damage:0,events:[]};
 t.hits++;t.damage+=damage;
 t.events.push({type:a.type,kind:'hit',damage,enemy:e?.playerNum??null});
 if(t.events.length>24)t.events.shift();telemetry.set(p,t);
}
function liveReport(p){
 const t=telemetry.get(p);
 return t?{casts:t.casts,hits:t.hits,damage:t.damage,events:t.events.slice()}:
  {casts:0,hits:0,damage:0,events:[]};
}
// Isolated non-rendering geometry/HP fixture. Runs registered production custom
// executors and physics ticks, but does NOT pretend to simulate tower defenses.
function probe(action){
 const a={...action,radius:clamp(action?.radius,30,300,145),
  duration:clamp(action?.duration,.2,8,1.5),damage:clamp(action?.damage,0,120,18)};
 if(!PHENOMENA.some(x=>x.type===a.type)||!R?.get(a.type))return null;
 function one(distance,shielded){
  const p={x:100,y:100,vx:0,vy:0,radius:20,hp:250,playerNum:1};
  const e={x:p.x+distance,y:100,vx:0,vy:0,radius:20,hp:250,invincible:shielded?999:0,playerNum:2};
  let hits=0;
  const hit=(_att,victim,attack)=>{
   if(victim.invincible>0||victim.hp<=0||!(attack.damage>0))return false;
   const d=Math.round(clamp(attack.damage,0,120,0));
   victim.hp=Math.max(0,victim.hp-d);hits++;return true;
  };
  const api={hit,enemies:()=>[e]};
  R.run(p,a,e,api);
  for(let j=0;j<58;j++){
   tick(p,[e],hit);
   // Bounded deterministic movement, not a full game-engine simulation.
   e.x+=e.vx*.17;e.y+=e.vy*.17;e.vx*=.94;e.vy*=.94;
  }
  const result={damage:250-e.hp,hits,displacement:Math.hypot(e.x-100-distance,e.y-100)};
  fields.delete(p);
  return result;
 }
 const near=one(Math.max(22,a.radius*.28),false);
 const far=one(a.radius+80,false);
 const shield=one(Math.max(22,a.radius*.28),true);
 return {type:a.type,near,far,shield,
  passed:a.damage<=0||near.damage>0&&far.damage===0&&shield.damage===0};
}
function verifyRecipe(recipe){
 const actions=[],seen=new Set();
 function walk(steps){
  for(const step of steps||[]){
   if(step.kind==='cast')push(step.action);
   walk(step.body);walk(step.then);walk(step.else);
  }
 }
 function push(a){if(!a||seen.has(a.type))return;seen.add(a.type);
  if(PHENOMENA.some(x=>x.type===a.type))actions.push(a);}
 for(const rule of recipe?.rules||[]){if(rule.steps?.length)walk(rule.steps);else push(rule.action);}
 const probes=actions.slice(0,8).map(probe).filter(Boolean);
 return {probes,passed:probes.every(p=>p.passed),sandboxOnly:true,
  note:'격리된 거리·보호막 시험입니다. 실제 경기의 명중은 전투 판정으로 별도 기록합니다.'};
}
if(R?.register){
 const common={category:'attacks',executor:'custom',
  parameters:['target','damage','radius','speed','duration','status','knockback'],
  family:'wave',physics:'contact',offense:true,audio:{cast:'energy',impact:'hit'}};
 for(const d of [
  {id:'tether',label:'탄성 속박',visual:{motif:'chains',color:'#8c67bf'},
   execute:castTether,preview:{duration:1100,pose:'wave',anchor:'caster'}},
  {id:'repulse',label:'반발 충격',visual:{motif:'ripples',color:'#80d5e8'},
   execute:castRepulse,preview:{duration:900,pose:'wave',anchor:'caster'}},
  {id:'vortex',label:'소용돌이 역학',visual:{motif:'swirl',color:'#655cc5'},
   execute:castVortex,preview:{duration:1400,pose:'wave',anchor:'caster'}}
 ])if(!R.get(d.id))R.register({...common,...d});
}
g.SemanticPhysics=Object.freeze({PHENOMENA,choose,matchAll,tick,probe,verifyRecipe,noteCast,noteHit,liveReport});
})(typeof window!=='undefined'?window:globalThis);

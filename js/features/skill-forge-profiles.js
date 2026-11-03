/* Authored fighter profile schema, normalization and random skill catalog.
 * Pure profile operations. No DOM, localStorage, combat tick or writes to
 * live fighters. Constants are injected by SkillForge runtime.
 */
(function(global){'use strict';
global.SkillForgeProfilesFactory=function({TYPE,TRIGGER,STATUS,ACTION_PARAMETERS,MOVEMENT_ONLY}){
const supportedParameter=(type,key)=>key==='delay'||(' '+(ACTION_PARAMETERS[type]||'')+' ').includes(' '+key+' ');
const number=(x,a,b,d=a)=>Number.isFinite(Number(x))?Math.max(a,Math.min(b,Number(x))):d;
const clean=(v,n)=>String(v==null?'':v).replace(/[<>]/g,'').slice(0,n).trim();
const color=(c)=>/^#[0-9a-f]{6}$/i.test(c)?c:'#a78bfa';
const stage=()=>({type:'shot',pattern:'fan',target:'nearest',damage:18,radius:120,count:5,speed:5,duration:1.5,status:'none',knockback:2,delay:0});
const skill=()=>({name:'새 스킬',trigger:'auto',cooldown:3,threshold:40,actions:[stage()]});
function normalize(value,{towerEnemy=false}={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('올바른 설정을 입력하세요.');
  if(!Array.isArray(value.skills)||value.skills.length<1)throw Error('스킬을 한 개 이상 추가하세요.');
  // Only opted-in new profiles gain class stats. Legacy saved fighters and
  // transient tower opponents keep their original authored HP/speed intact.
  const archetype=!towerEnemy&&global.ForgeArchetypes?.get?.(value.archetype)?value.archetype:'legacy';
  const base=global.ForgeArchetypes?.get?.(archetype);
  const signature=!towerEnemy&&Number(value.signatureVersion)===1;
  return {
    signatureVersion:signature?1:0,
    signatureTiming:signature&&['instant','contact','danger'].includes(value.signatureTiming)?
      value.signatureTiming:'instant',
    legacySkills:signature&&Array.isArray(value.legacySkills)?value.legacySkills.map(s=>({
      ...s,actions:(s.actions||[]).slice(0,3).map(a=>({...a}))
    })):undefined,
    legacyAllAbilities:signature&&value.legacyAllAbilities===true,
    name:clean(value.name,14)||'커스텀 파이터',blurb:clean(value.blurb,90),
    artKey:clean(value.artKey||'',52).replace(/[^a-zA-Z0-9_-]/g,''),
    archetype,
    // Legacy basicAttack data is intentionally ignored. All damage comes from
    // authored skills and their actual hit/collision effects, never passive attacks.
    color:color(value.color),effectColor:color(value.effectColor||value.color),
    hp:base?base.hp:Math.round(number(value.hp,140,towerEnemy?8000:500,250)),
    speed:base?base.speed:number(value.speed,.6,5,1.8),
    allAbilities:signature?false:value.allAbilities===true,
    // Signature fighters have one skill/program with up to twelve action blocks.
    // Legacy profiles and transient tower enemies retain their original slots.
    skills:(towerEnemy?value.skills.slice(0,6):value.skills).map((s,i)=>{
      if(!Array.isArray(s.actions)||!s.actions.length)throw Error((i+1)+'번 스킬에 동작이 없습니다.');
      return {name:clean(s.name,18)||'스킬 '+(i+1),
        promptText:signature?String(s.promptText||'').slice(0,300):undefined,
        // Block program is an inert, validated AST; saved and exported with the fighter.
        program:signature&&Array.isArray(s.program)?global.SignatureScratch?.normalize?.(s.program):undefined,
        ruleSet:signature&&s.ruleSet&&global.SignatureRuleSkill?.normalize?.(s.ruleSet)||undefined,
         ir:signature&&s.ir&&global.SkillIR?.normalize?.(s.ir)||undefined,
        trigger:signature?'auto':TRIGGER[s.trigger]?s.trigger:'auto',
        cooldown:number(s.cooldown,.2,30,3),threshold:number(s.threshold,5,95,40),
        actions:s.actions.slice(0,signature?global.SignatureProgram?.MAX_ACTIONS||12:3).map(a=>({
          type:TYPE[a.type]?a.type:'wave',
          pattern:global.AbilityAtlas?.PATTERNS[a.pattern]?a.pattern:'direct',
          target:global.AbilityAtlas?.TARGETS[a.target]?a.target:'nearest',
          damage:Math.round(number(a.damage,0,120,18)),
          radius:number(a.radius,30,300,120),count:Math.round(number(a.count,1,8,1)),
          speed:number(a.speed,2,14,5),duration:number(a.duration,.2,8,1.5),
          status:STATUS[a.status]?a.status:'none',
          knockback:number(a.knockback,0,9,2),delay:number(a.delay,0,2,0),
          visual:global.MetaphorVisuals?.normalize?.(a.visual),
          ricochet:a.type==='shot'?Math.round(number(a.ricochet,0,3,0)):0,
          link:['and','after','with'].includes(a.link)?a.link:'and',
          condition:signature?global.SignatureProgram?.validCondition?.(a.condition)||'always':'always'
        })).map(a=>MOVEMENT_ONLY.has(a.type)?{...a,damage:0,status:'none',knockback:0}:a)};
    })
  };
}
const THEMES={
  sky:{name:'공중',color:'#0369a1',types:['flight','homing','retreat'],status:'shock'},
  earth:{name:'지하',color:'#92400e',types:['burrow','mine','fortify'],status:'root'},
  cosmos:{name:'우주',color:'#6d28d9',types:['blackhole','starfall','shield'],status:'vulnerable'},
  dung:{name:'똥',color:'#854d0e',types:['dung','zone','retreat'],status:'poison'},
  life:{name:'생명',color:'#047857',types:['lifebloom','drain','regen'],status:'weak'},
  phoenix:{name:'부활',color:'#be123c',types:['resurrect','nova','homing'],status:'fire'},
  time:{name:'시간',color:'#4338ca',types:['timestop','rewind','timeburst'],status:'ice'}
};
const allTypes=()=>Object.keys(TYPE);
const randInt=(rng,min,max)=>min+Math.floor(Math.max(0,Math.min(.999999999,rng()))*(max-min+1));
const pickRandom=(rng,values)=>values[randInt(rng,0,values.length-1)];
const randomColor=rng=>'#'+[0,1,2].map(()=>randInt(rng,48,218).toString(16).padStart(2,'0')).join('');
const offense=global.ActionRegistry?.OFFENSE||new Set(['wave','shot','beam','bolt','pull','zone','homing','pierce','boomerang','chain','nova','meteor','mine','drain','blackhole','starfall','dung','uppercut','slash','spinslash','thrust','aircombo','arcshot','splitshot','dive','erupt','burrowdash','trap','turret','summon']);
const settings=(type,i=0)=>({
  type,pattern:'direct',target:'nearest',
  damage:18+i%5*3,radius:115+(i%4)*22,
  count:type==='starfall'?6:type==='splitshot'?4:type==='orbit'?3:1,
  speed:5+(i%3),duration:type==='starfall'?2.5:1.8+(i%3)*.3,
  status:'none',knockback:2,delay:0
});
// Full-catalog mode is not limited to four UI skill slots. Every supported
// move has an actual independent cast/cooldown, not a random subset.
function allSkillset(){
  return Object.entries(TYPE).map(([type,name],i)=>({
    name,trigger:'auto',cooldown:4+(i%8)*.85,threshold:40,
    actions:[settings(type,i)]
  }));
}
function allProfile(name='만능 파이터',description='모든 능력을 사용한다'){
  return normalize({name,blurb:description.slice(0,90),color:'#6f77a1',
    hp:360,speed:2.1,allAbilities:true,
    skills:[{name:'전체 스킬 사용',trigger:'auto',cooldown:4,actions:[settings('wave')]}]});
}
// A multi-theme roll draws every action from the UNION of selected families.
// At least one action from each family is guaranteed, even for seven choices.
function randomProfile(theme='any',rng=Math.random,exactCount=null){
  const selectedKeys=(Array.isArray(theme)?theme:theme==='any'?[]:[theme])
    .filter((key,index,items)=>!!THEMES[key]&&items.indexOf(key)===index);
  const selectedThemes=selectedKeys.map(key=>THEMES[key]);
  const selected=selectedThemes.length?selectedThemes[0]:pickRandom(rng,Object.values(THEMES));
  const pool=selectedThemes.length?
    [...new Set(selectedThemes.flatMap(t=>t.types).filter(type=>TYPE[type]))]:allTypes();
  const amount=exactCount===4?4:(Array.isArray(theme)?Math.max(2,Math.min(4,selectedKeys.length)):
    theme==='any'?randInt(rng,1,4):randInt(rng,3,4));
  const required=selectedKeys.slice();
  // Shuffle required families so their actions get mixed among skill slots.
  for(let i=required.length-1;i>0;i--){
    const j=randInt(rng,0,i);[required[i],required[j]]=[required[j],required[i]];
  }
  const used=new Set(),skills=[];
  const patterns=Object.keys(global.AbilityAtlas?.PATTERNS||{direct:1,fan:1,radial:1,line:1,cross:1,spiral:1,scatter:1});
  const targets=Object.keys(global.AbilityAtlas?.TARGETS||{nearest:1,farthest:1,lowest:1,highest:1,random:1,cluster:1});
  const statuses=Object.keys(STATUS),triggers=Object.keys(TRIGGER);
  for(let i=0;i<amount;i++){
    const actions=[];
    const needed=Math.ceil(required.length/Math.max(1,amount-i));
    const steps=selectedThemes.length?Math.min(3,Math.max(needed,randInt(rng,1,3))):randInt(rng,1,3);
    for(let j=0;j<steps;j++){
      const forced=required.shift();
      const candidates=forced?THEMES[forced].types.filter(type=>TYPE[type]):pool;
      let type=pickRandom(rng,candidates.length?candidates:pool);
      for(let tries=0;tries<12&&used.has(type);tries++)type=pickRandom(rng,candidates.length?candidates:pool);
      used.add(type);
      actions.push({type,pattern:pickRandom(rng,patterns),target:pickRandom(rng,targets),
        damage:randInt(rng,9,95),radius:randInt(rng,60,290),count:randInt(rng,1,8),
        speed:randInt(rng,2,14),duration:randInt(rng,3,70)/10,
        status:pickRandom(rng,statuses),knockback:randInt(rng,0,9),
        delay:j===0?0:randInt(rng,0,20)/10});
    }
    if(i===amount-1&&!skills.some(v=>v.actions.some(x=>offense.has(x.type)))&&!actions.some(x=>offense.has(x.type))){
      // Do not overwrite a mandatory theme's single representative action.
      const attack=pickRandom(rng,pool.filter(type=>offense.has(type)).length?
        pool.filter(type=>offense.has(type)):[...offense]);
      const add={...actions[0],type:attack,delay:.4};
      if(actions.length<3)actions.push(add);
      else{
        const extra=skills.find(skill=>skill.actions.length<3);
        if(extra)extra.actions.push(add);
        else actions[actions.length-1].type=attack;
      }
    }
    skills.push({name:TYPE[actions[0].type]+' '+pickRandom(rng,['연계','각성','변주','비기','파동']),
      trigger:pickRandom(rng,triggers),cooldown:randInt(rng,5,200)/10,
      threshold:randInt(rng,12,90),actions});
  }
  const subject=selectedThemes.length?selectedThemes.map(t=>t.name).join('·'):selected.name;
  const name=pickRandom(rng,['방랑하는','고요한','폭주하는','날렵한','사나운','빛나는','수상한','정교한'])+
    ' '+subject+' '+pickRandom(rng,['검사','마도사','소환사','모험가','수호자','괴짜','정령']);
  return normalize({name,blurb:selectedThemes.length?'선택한 '+subject+' 계열의 무작위 혼합':'전체 동작 풀 무작위 조합',
    color:randomColor(rng),effectColor:randomColor(rng),hp:randInt(rng,140,500),
    speed:randInt(rng,6,50)/10,skills});
}

return Object.freeze({supportedParameter,number,clean,color,stage,skill,normalize,THEMES,
 allSkillset,allProfile,randomProfile});
};
})(typeof window!=='undefined'?window:globalThis);

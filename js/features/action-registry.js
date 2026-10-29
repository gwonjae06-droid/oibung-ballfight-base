/* Unified Action Registry - single metadata source for 55 legacy moves and
 * future code-authored abilities. No executable user JSON is ever evaluated.
 * Existing combat engines remain authoritative for their respective hit logic.
 *
 * Example (after loading this module):
 * ActionRegistry.register({
 *   id:'test_pulse',label:'시험 펄스',category:'attacks',
 *   parameters:['damage','radius','target'],family:'wave',
 *   visual:{motif:'ripples',color:'#5289b6'},physics:'strike',
 *   preview:{duration:1100,pose:'wave',anchor:'caster'},
 *   audio:{cast:'energy',impact:'hit'},
 *   execute:(caster,action,target,api)=>{
 *     if(target)api.hit(caster,target,action);return true;
 *   }
 * });
 * Register functions only from trusted game JavaScript; share codes store data.
 */
(function(global){
'use strict';
const GROUP_NAMES=Object.freeze({attacks:'공격',mobility:'이동 · 피해 없음',
  defense:'보호 · 회복',special:'소환 · 제어'});
const FAMILIES=['fist','projectile','wave','movement','time','explosion','cosmos','generic'];
const EXECUTORS=['basic','atlas','advanced','expansion','custom'];
const PHYSICS=['none','projectile','contact','strike'];
const PARAMS=new Set('pattern target damage radius count speed duration status knockback delay'.split(' '));
const records=new Map(),types=Object.create(null),parameters=Object.create(null),
      visual=Object.create(null),order=[],movementOnly=new Set(),
      offensive=new Set(),familySets=Object.fromEntries(FAMILIES.map(f=>[f,new Set()]));
const groups=Object.fromEntries(Object.entries(GROUP_NAMES).map(([id,name])=>[id,{name,types:[]}]));
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9_]{0,39}$/.test(id);
function register(d){
  if(!d||!validId(d.id)||records.has(d.id))throw Error('이미 존재하거나 잘못된 동작 ID입니다.');
  if(typeof d.label!=='string'||!d.label.trim()||d.label.length>40)throw Error('동작 이름을 확인하세요.');
  if(!groups[d.category]||!FAMILIES.includes(d.family))throw Error('동작 카테고리나 이펙트 계열이 잘못됐습니다.');
  if(!EXECUTORS.includes(d.executor||'custom'))throw Error('알 수 없는 실행 엔진입니다.');
  if(!PHYSICS.includes(d.physics||'strike'))throw Error('잘못된 물리력 설정입니다.');
  if(d.execute!==undefined&&typeof d.execute!=='function')throw Error('실행 함수는 신뢰할 수 있는 게임 코드로만 등록합니다.');
  if(d.legacy!==true&&typeof d.execute!=='function')throw Error('새 동작은 실제 전투 실행 함수를 등록해야 합니다.');
  if(!Array.isArray(d.parameters)||d.parameters.some(p=>!PARAMS.has(p)))throw Error('알 수 없는 동작 설정입니다.');
  const v=d.visual||{},col=v.color||'#75839d';
  if(typeof v.motif!=='string'||!/^#[0-9a-f]{6}$/i.test(col))throw Error('이펙트 표시를 설정하세요.');
  const duration=Math.max(150,Math.min(8000,Number(d.preview?.duration)||950));
  const audio=d.audio||{cast:'cast',impact:'hit'};
  const movement=d.movementOnly===true;
  if(movement&&(d.category!=='mobility'||d.physics!=='none'||d.offense===true))
    throw Error('순수 이동 동작은 데미지/넉백/공격으로 분류할 수 없습니다.');
  const definition=Object.freeze({
    id:d.id,label:d.label,category:d.category,executor:d.executor||'custom',
    parameters:Object.freeze([...d.parameters]),family:d.family,
    physics:d.physics||'strike',movementOnly:movement,offense:d.offense===true,
    visual:Object.freeze({motif:v.motif,color:col}),
    audio:Object.freeze({cast:audio.cast||'cast',impact:audio.impact||'hit'}),
    preview:Object.freeze({duration,pose:d.preview?.pose||d.family,
      anchor:d.preview?.anchor||'caster'}),execute:d.execute||null,legacy:d.legacy===true
  });
  records.set(d.id,definition);order.push(d.id);
  types[d.id]=d.label;parameters[d.id]=definition.parameters.join(' ');
  visual[d.id]=Object.freeze([definition.visual.motif,definition.visual.color]);
  groups[d.category].types.push(d.id);familySets[d.family].add(d.id);
  if(movement)movementOnly.add(d.id);
  if(definition.offense)offensive.add(d.id);
  // Hot registration is optional. The built-ins load before the UI is mounted.
  if(typeof document!=='undefined'){
    global.SkillForge?.refreshEditor?.();
    global.BlockForge?.refresh?.();
    global.CharacterStudioWorkspace?.refresh?.();
  }
  return definition;
}
function registerBuiltin(d){return register({...d,legacy:true});}
function get(id){return records.get(id)||null;}
function ids(){return order.slice();}
function entries(){return order.map(id=>records.get(id));}
function byGroup(group){return (groups[group]?.types||[]).slice();}
function moduleTypes(executor){
  const out={};for(const entry of entries())if(entry.executor===executor)out[entry.id]=entry.label;
  return out;
}
function sound(type,stage='cast'){return get(type)?.audio?.[stage]||'cast';}
function isMovement(type){return movementOnly.has(type);}
// A fast moving bullet may cross a fighter between frames without ending
// its update inside the circular hitbox. Use the whole swept path instead.
function sweptCircle(x1,y1,x2,y2,cx,cy,radius){
  const dx=x2-x1,dy=y2-y1,denom=dx*dx+dy*dy;
  const t=denom>1e-10?Math.max(0,Math.min(1,((cx-x1)*dx+(cy-y1)*dy)/denom)):0;
  const px=x1+dx*t,py=y1+dy*t;
  return Math.hypot(cx-px,cy-py)<=Math.max(0,radius);
}
function isProjectile(type){return get(type)?.physics==='projectile';}
function duration(type){return get(type)?.preview.duration||950;}
function run(caster,action,target,api){
  const d=get(action?.type);
  if(!d||typeof d.execute!=='function')return false;
  return d.execute(caster,action,target,api)===true;
}
const API={register,get,ids,entries,byGroup,moduleTypes,sound,isMovement,isProjectile,
  duration,run,sweptCircle,TYPE:types,ACTION_PARAMETERS:parameters,
  GROUPS:groups,visualCatalog:visual,FAMILIES:familySets,MOVEMENT_ONLY:movementOnly,
  OFFENSE:offensive};
global.ActionRegistry=API;
const BUILTINS=[
 {
  "id": "wave",
  "label": "충격파",
  "executor": "atlas",
  "category": "attacks",
  "parameters": [
   "pattern",
   "target",
   "damage",
   "radius",
   "count",
   "status",
   "knockback"
  ],
  "family": "wave",
  "visual": {
   "motif": "ripples",
   "color": "#536d86"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "wave",
   "anchor": "caster"
  },
  "audio": {
   "cast": "energy",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "shot",
  "label": "투사체",
  "executor": "atlas",
  "category": "attacks",
  "parameters": [
   "pattern",
   "target",
   "damage",
   "radius",
   "count",
   "speed",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "arrow",
   "color": "#466b8b"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "beam",
  "label": "레이저",
  "executor": "atlas",
  "category": "attacks",
  "parameters": [
   "pattern",
   "target",
   "damage",
   "radius",
   "count",
   "status",
   "knockback"
  ],
  "family": "wave",
  "visual": {
   "motif": "laser",
   "color": "#466f9d"
  },
  "physics": "strike",
  "preview": {
   "duration": 1050,
   "pose": "wave",
   "anchor": "caster"
  },
  "audio": {
   "cast": "energy",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "bolt",
  "label": "낙뢰",
  "executor": "atlas",
  "category": "attacks",
  "parameters": [
   "pattern",
   "target",
   "damage",
   "radius",
   "count",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "lightning",
   "color": "#a47532"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "dash",
  "label": "돌진",
  "executor": "basic",
  "category": "mobility",
  "parameters": [
   "target",
   "speed",
   "duration"
  ],
  "family": "movement",
  "visual": {
   "motif": "speed",
   "color": "#3e7890"
  },
  "physics": "none",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": true
 },
 {
  "id": "blink",
  "label": "순간이동",
  "executor": "basic",
  "category": "mobility",
  "parameters": [
   "target"
  ],
  "family": "movement",
  "visual": {
   "motif": "fold",
   "color": "#6d5c9a"
  },
  "physics": "none",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": true
 },
 {
  "id": "heal",
  "label": "회복",
  "executor": "basic",
  "category": "defense",
  "parameters": [
   "damage"
  ],
  "family": "generic",
  "visual": {
   "motif": "cross",
   "color": "#36865f"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "shield",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "shield",
  "label": "방어막",
  "executor": "basic",
  "category": "defense",
  "parameters": [
   "duration"
  ],
  "family": "generic",
  "visual": {
   "motif": "hex",
   "color": "#416e9d"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "shield",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "pull",
  "label": "흡입",
  "executor": "basic",
  "category": "special",
  "parameters": [
   "damage",
   "radius",
   "status",
   "knockback"
  ],
  "family": "wave",
  "visual": {
   "motif": "vortex",
   "color": "#396f78"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "wave",
   "anchor": "caster"
  },
  "audio": {
   "cast": "energy",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "orbit",
  "label": "회전 소환체",
  "executor": "basic",
  "category": "special",
  "parameters": [
   "damage",
   "radius",
   "count",
   "duration",
   "status",
   "knockback"
  ],
  "family": "wave",
  "visual": {
   "motif": "satellites",
   "color": "#675e9d"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "wave",
   "anchor": "caster"
  },
  "audio": {
   "cast": "energy",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "zone",
  "label": "지속 장판",
  "executor": "atlas",
  "category": "special",
  "parameters": [
   "pattern",
   "target",
   "damage",
   "radius",
   "count",
   "duration",
   "status",
   "knockback"
  ],
  "family": "wave",
  "visual": {
   "motif": "field",
   "color": "#627752"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "wave",
   "anchor": "caster"
  },
  "audio": {
   "cast": "energy",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "homing",
  "label": "유도탄",
  "executor": "expansion",
  "category": "special",
  "parameters": [
   "target",
   "damage",
   "radius",
   "count",
   "speed",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "lock",
   "color": "#417c99"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "pierce",
  "label": "관통탄",
  "executor": "expansion",
  "category": "special",
  "parameters": [
   "target",
   "damage",
   "radius",
   "count",
   "speed",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "needle",
   "color": "#9b5869"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "boomerang",
  "label": "부메랑",
  "executor": "expansion",
  "category": "special",
  "parameters": [
   "target",
   "damage",
   "radius",
   "count",
   "speed",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "return",
   "color": "#6373a2"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "chain",
  "label": "연쇄 번개",
  "executor": "expansion",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "count",
   "status",
   "knockback"
  ],
  "family": "wave",
  "visual": {
   "motif": "branch",
   "color": "#7f68b0"
  },
  "physics": "strike",
  "preview": {
   "duration": 1050,
   "pose": "wave",
   "anchor": "caster"
  },
  "audio": {
   "cast": "energy",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "nova",
  "label": "주변 폭발",
  "executor": "expansion",
  "category": "attacks",
  "parameters": [
   "damage",
   "radius",
   "status",
   "knockback"
  ],
  "family": "explosion",
  "visual": {
   "motif": "rays",
   "color": "#93604b"
  },
  "physics": "strike",
  "preview": {
   "duration": 1120,
   "pose": "explosion",
   "anchor": "target"
  },
  "audio": {
   "cast": "blast",
   "impact": "blast"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "meteor",
  "label": "운석",
  "executor": "expansion",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "speed",
   "status",
   "knockback"
  ],
  "family": "explosion",
  "visual": {
   "motif": "rock",
   "color": "#ae6638"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "explosion",
   "anchor": "target"
  },
  "audio": {
   "cast": "blast",
   "impact": "blast"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "mine",
  "label": "지뢰",
  "executor": "expansion",
  "category": "special",
  "parameters": [
   "damage",
   "radius",
   "duration",
   "status",
   "knockback"
  ],
  "family": "explosion",
  "visual": {
   "motif": "hazard",
   "color": "#a2763f"
  },
  "physics": "strike",
  "preview": {
   "duration": 1120,
   "pose": "explosion",
   "anchor": "target"
  },
  "audio": {
   "cast": "blast",
   "impact": "blast"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "drain",
  "label": "흡혈",
  "executor": "expansion",
  "category": "special",
  "parameters": [
   "target",
   "damage",
   "radius",
   "status",
   "knockback"
  ],
  "family": "generic",
  "visual": {
   "motif": "link",
   "color": "#8f5275"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "swap",
  "label": "위치 교환",
  "executor": "expansion",
  "category": "mobility",
  "parameters": [
   "target"
  ],
  "family": "movement",
  "visual": {
   "motif": "swap",
   "color": "#6b66a5"
  },
  "physics": "none",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": true
 },
 {
  "id": "retreat",
  "label": "후퇴",
  "executor": "expansion",
  "category": "mobility",
  "parameters": [
   "target",
   "radius"
  ],
  "family": "movement",
  "visual": {
   "motif": "back",
   "color": "#467d86"
  },
  "physics": "none",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": true
 },
 {
  "id": "cleanse",
  "label": "정화",
  "executor": "expansion",
  "category": "defense",
  "parameters": [],
  "family": "generic",
  "visual": {
   "motif": "purify",
   "color": "#409286"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "shield",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "haste",
  "label": "가속",
  "executor": "expansion",
  "category": "defense",
  "parameters": [
   "duration"
  ],
  "family": "generic",
  "visual": {
   "motif": "wind",
   "color": "#479480"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "shield",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "regen",
  "label": "지속 재생",
  "executor": "expansion",
  "category": "defense",
  "parameters": [
   "damage",
   "duration"
  ],
  "family": "generic",
  "visual": {
   "motif": "sprout",
   "color": "#468e56"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "shield",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "fortify",
  "label": "피해 감소",
  "executor": "expansion",
  "category": "defense",
  "parameters": [
   "duration"
  ],
  "family": "generic",
  "visual": {
   "motif": "plates",
   "color": "#586b80"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "shield",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "flight",
  "label": "공중 강하",
  "executor": "expansion",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "duration",
   "status",
   "knockback"
  ],
  "family": "movement",
  "visual": {
   "motif": "wings",
   "color": "#4986a5"
  },
  "physics": "strike",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "burrow",
  "label": "지하 습격",
  "executor": "expansion",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "duration",
   "status",
   "knockback"
  ],
  "family": "generic",
  "visual": {
   "motif": "ground",
   "color": "#786447"
  },
  "physics": "strike",
  "preview": {
   "duration": 850,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "blackhole",
  "label": "블랙홀",
  "executor": "expansion",
  "category": "special",
  "parameters": [
   "target",
   "damage",
   "radius",
   "duration",
   "status"
  ],
  "family": "cosmos",
  "visual": {
   "motif": "spiral",
   "color": "#666099"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "cosmos",
   "anchor": "target"
  },
  "audio": {
   "cast": "cosmos",
   "impact": "cosmos"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "starfall",
  "label": "우주 별비",
  "executor": "expansion",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "count",
   "speed",
   "status",
   "knockback"
  ],
  "family": "cosmos",
  "visual": {
   "motif": "stars",
   "color": "#a68b3e"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "cosmos",
   "anchor": "target"
  },
  "audio": {
   "cast": "cosmos",
   "impact": "cosmos"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "dung",
  "label": "똥 폭탄",
  "executor": "expansion",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "speed",
   "duration",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "splat",
   "color": "#846443"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "lifebloom",
  "label": "생명의 꽃",
  "executor": "expansion",
  "category": "defense",
  "parameters": [
   "damage",
   "radius",
   "duration"
  ],
  "family": "generic",
  "visual": {
   "motif": "petals",
   "color": "#3a9259"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "shield",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "resurrect",
  "label": "부활",
  "executor": "expansion",
  "category": "defense",
  "parameters": [],
  "family": "generic",
  "visual": {
   "motif": "rise",
   "color": "#498d58"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "shield",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "timestop",
  "label": "시간 정지",
  "executor": "expansion",
  "category": "special",
  "parameters": [
   "radius",
   "duration"
  ],
  "family": "time",
  "visual": {
   "motif": "clock",
   "color": "#4b71a1"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "time",
   "anchor": "caster"
  },
  "audio": {
   "cast": "clock",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "rewind",
  "label": "시간 되감기",
  "executor": "expansion",
  "category": "defense",
  "parameters": [
   "duration"
  ],
  "family": "time",
  "visual": {
   "motif": "rewind",
   "color": "#6860a1"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "time",
   "anchor": "caster"
  },
  "audio": {
   "cast": "clock",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "timeburst",
  "label": "시간 가속",
  "executor": "expansion",
  "category": "special",
  "parameters": [
   "duration"
  ],
  "family": "time",
  "visual": {
   "motif": "fastclock",
   "color": "#5d87ac"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "time",
   "anchor": "caster"
  },
  "audio": {
   "cast": "clock",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "leap",
  "label": "도약",
  "executor": "advanced",
  "category": "mobility",
  "parameters": [],
  "family": "movement",
  "visual": {
   "motif": "spring",
   "color": "#4a8f9a"
  },
  "physics": "none",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": true
 },
 {
  "id": "hover",
  "label": "체공",
  "executor": "advanced",
  "category": "mobility",
  "parameters": [
   "duration"
  ],
  "family": "movement",
  "visual": {
   "motif": "levitate",
   "color": "#6389ae"
  },
  "physics": "none",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": true
 },
 {
  "id": "glide",
  "label": "활공",
  "executor": "advanced",
  "category": "mobility",
  "parameters": [
   "duration"
  ],
  "family": "movement",
  "visual": {
   "motif": "glider",
   "color": "#547ea1"
  },
  "physics": "none",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": true
 },
 {
  "id": "dive",
  "label": "급강하",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "damage",
   "radius",
   "speed",
   "status",
   "knockback"
  ],
  "family": "explosion",
  "visual": {
   "motif": "down",
   "color": "#a96746"
  },
  "physics": "strike",
  "preview": {
   "duration": 850,
   "pose": "explosion",
   "anchor": "target"
  },
  "audio": {
   "cast": "blast",
   "impact": "blast"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "uppercut",
  "label": "어퍼컷",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "status",
   "knockback"
  ],
  "family": "fist",
  "visual": {
   "motif": "punch",
   "color": "#a2624b"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "heavy",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "slash",
  "label": "베기",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "status",
   "knockback"
  ],
  "family": "generic",
  "visual": {
   "motif": "cut",
   "color": "#5e6d88"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "spinslash",
  "label": "회전베기",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "status",
   "knockback"
  ],
  "family": "generic",
  "visual": {
   "motif": "spin",
   "color": "#647a96"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "thrust",
  "label": "찌르기",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "status",
   "knockback"
  ],
  "family": "generic",
  "visual": {
   "motif": "spear",
   "color": "#8f708c"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "aircombo",
  "label": "공중 연속 공격",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "status",
   "knockback"
  ],
  "family": "fist",
  "visual": {
   "motif": "triple",
   "color": "#8d6a9b"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "heavy",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "arcshot",
  "label": "곡사탄",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "count",
   "speed",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "lob",
   "color": "#92724f"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "splitshot",
  "label": "분열탄",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "count",
   "speed",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "crystal",
   "color": "#6581a4"
  },
  "physics": "projectile",
  "preview": {
   "duration": 1050,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "wall",
  "label": "벽 설치",
  "executor": "advanced",
  "category": "special",
  "parameters": [
   "target",
   "radius",
   "damage",
   "duration"
  ],
  "family": "generic",
  "visual": {
   "motif": "bricks",
   "color": "#6a7784"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "portal",
  "label": "쌍방향 포탈",
  "executor": "advanced",
  "category": "mobility",
  "parameters": [
   "target",
   "radius",
   "duration"
  ],
  "family": "movement",
  "visual": {
   "motif": "gates",
   "color": "#68669e"
  },
  "physics": "none",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": true
 },
 {
  "id": "summon",
  "label": "추적 소환수",
  "executor": "advanced",
  "category": "special",
  "parameters": [
   "target",
   "damage",
   "radius",
   "speed",
   "duration",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "paw",
   "color": "#608b88"
  },
  "physics": "projectile",
  "preview": {
   "duration": 950,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "turret",
  "label": "자동 포탑",
  "executor": "advanced",
  "category": "special",
  "parameters": [
   "target",
   "damage",
   "radius",
   "speed",
   "duration",
   "status",
   "knockback"
  ],
  "family": "projectile",
  "visual": {
   "motif": "scope",
   "color": "#66758a"
  },
  "physics": "projectile",
  "preview": {
   "duration": 950,
   "pose": "arm",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "trap",
  "label": "덫",
  "executor": "advanced",
  "category": "special",
  "parameters": [
   "damage",
   "radius",
   "duration",
   "status",
   "knockback"
  ],
  "family": "generic",
  "visual": {
   "motif": "teeth",
   "color": "#956d50"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "grow",
  "label": "거대화",
  "executor": "advanced",
  "category": "special",
  "parameters": [
   "count",
   "duration"
  ],
  "family": "generic",
  "visual": {
   "motif": "expand",
   "color": "#488b72"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "shrink",
  "label": "소형화",
  "executor": "advanced",
  "category": "special",
  "parameters": [
   "count",
   "duration"
  ],
  "family": "generic",
  "visual": {
   "motif": "compress",
   "color": "#758c8f"
  },
  "physics": "strike",
  "preview": {
   "duration": 950,
   "pose": "generic",
   "anchor": "caster"
  },
  "audio": {
   "cast": "cast",
   "impact": "hit"
  },
  "offense": false,
  "movementOnly": false
 },
 {
  "id": "burrowdash",
  "label": "땅굴 돌진",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "target",
   "damage",
   "radius",
   "duration",
   "status",
   "knockback"
  ],
  "family": "movement",
  "visual": {
   "motif": "tunnel",
   "color": "#947749"
  },
  "physics": "strike",
  "preview": {
   "duration": 850,
   "pose": "movement",
   "anchor": "caster"
  },
  "audio": {
   "cast": "dash",
   "impact": "hit"
  },
  "offense": true,
  "movementOnly": false
 },
 {
  "id": "erupt",
  "label": "솟구치기",
  "executor": "advanced",
  "category": "attacks",
  "parameters": [
   "damage",
   "radius",
   "status",
   "knockback"
  ],
  "family": "explosion",
  "visual": {
   "motif": "fissure",
   "color": "#a56e3c"
  },
  "physics": "strike",
  "preview": {
   "duration": 1120,
   "pose": "explosion",
   "anchor": "target"
  },
  "audio": {
   "cast": "blast",
   "impact": "blast"
  },
  "offense": true,
  "movementOnly": false
 }
];
for(const d of BUILTINS)registerBuiltin(d);
})(window);

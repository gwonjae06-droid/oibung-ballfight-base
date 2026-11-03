/* Explainable semantic relationship graph for authored Korean abilities.
 * This is a bounded, declarative description of an already validated recipe.
 * Only registered actions and the authoritative ForgeWorld execute combat.
 * The graph never evaluates source text or grants runtime capabilities.
 */
(function(g){'use strict';
const MAX_ACTIONS=32,MAX_RELATIONS=72,MAX_ENTITIES=20;
const source=v=>String(v||'').normalize('NFC').trim().slice(0,300);
function build(input,recipe){
 const raw=source(input);
 if(!raw||!recipe?.rules?.length)return null;
 const entities=[{id:'caster',role:'caster',label:'시전자'},
  {id:'enemy',role:'enemy',label:'적'}];
 const actions=[],relations=[],conditions=[],references=[];
 const push=(from,type,to,meta={})=>{
  if(relations.length<MAX_RELATIONS)relations.push({from,type,to,...meta});
 };
 const entity=(role,label)=>{
  if(entities.length>=MAX_ENTITIES)return null;
  const id='entity_'+entities.length;
  entities.push({id,role,label});return id;
 };
 const steps=(list,rule,depth)=>{
  if(depth>3||actions.length>=MAX_ACTIONS)return;
  for(const node of list||[]){
   if(actions.length>=MAX_ACTIONS)break;
   if(node.kind==='cast')add(node.action,rule);
   if(node.kind==='if'){
    conditions.push({trigger:node.condition||'always',mode:'conditional'});
    steps(node.then,rule,depth+1);steps(node.else,rule,depth+1);
   }
   if(node.kind==='repeat'){
    conditions.push({trigger:'repeat',times:Math.max(1,Math.min(3,Number(node.times)||1))});
    steps(node.body,rule,depth+1);
   }
   if(node.kind==='wait')conditions.push({trigger:'wait',seconds:Number(node.seconds)||0});
  }
 };
 function add(action,rule){
  if(!action||actions.length>=MAX_ACTIONS)return;
  const idx=actions.length,id='action_'+idx,type=String(action.type||'unknown');
  const def=g.ActionRegistry?.get?.(type);
  const isProjectile=def?.physics==='projectile';
  const isSupport=def?.offense!==true;
  const theme=action.visual?.shape||null;
  const object=isProjectile?entity('projectile',theme||'투사체'):
   action.law?entity('field',theme||'물리장'):
   theme?entity('visual',theme):null;
  const target=['shield','heal','regen','fortify','lifebloom'].includes(type)?'caster':
   action.target==='self'?'caster':'enemy';
  const a={id,type,trigger:rule.when||'pulse',target,
   ...(object?{object}:{}),...(theme?{shape:theme}:{}),
   ...(action.visual?.colorMode?{colorMode:action.visual.colorMode}:{}),
   ...(isProjectile?{delivery:'projectile'}:isSupport?{delivery:'support'}:{delivery:'contact'})};
  actions.push(a);
  push('caster','performs',id);
  push(id,'affects',target);
  if(object)push(id,'creates',object);
  if(rule.when==='wallStored'){
   a.wallHits=rule.wallHits;
   push('caster','accumulates_wall_impulse',id,{on:'confirmed_wall_rebound'});
   push(id,'releases_on_count','enemy',{count:rule.wallHits,
    resource:'normal_collision_impulse'});
  }
  if(action.fusion?.homing&&object)push(object,'tracks','enemy');
  if(action.fusion?.impact&&action.fusion.impact!=='none')
   push(id,'on_confirmed_hit','enemy',{effect:action.fusion.impact});
  if(action.fusion?.split&&object){
   const fragments=entity('fragment','분열 파편');
   a.splitTrigger=action.fusion.splitTrigger==='hit'?'hit':'age';
   a.fragments=Math.max(2,Math.min(4,Number(action.fusion.fragments)||3));
   if(fragments){
    push(object,a.splitTrigger==='hit'?'fractures_on_hit':'fractures_after_time',fragments,
      {count:a.fragments});
    if(action.fusion.homing||action.fusion.childHoming)
     push(fragments,'tracks','enemy',{scope:'spawned_children_only'});
    if(action.fusion.childHoming)a.childOnlyHoming=true;
    if(action.fusion.childColor)a.childColor=action.fusion.childColor;
    if(action.fusion.finalColor)a.finalColor=action.fusion.finalColor;
    push(fragments,'may_hit','enemy');
    if(action.fusion.finalBurst){
     const burst=entity('terminal_effect','최종 폭발');
     a.finalBurst=true;
     if(burst){
      push(fragments,'when_all_retired',burst,{
       event:'last_fragment_retired',radius:action.fusion.radius});
      push(burst,'confirmed_area_damage','enemy',{
       damageMultiplier:.42,maxDamage:52});
     }
    }
   }
  }
  if(action.law?.terms)for(const t of action.law.terms.slice(0,5))
   push(id,'applies_force','enemy',{operator:t.op,decay:action.law.decay});
 }
 for(const rule of (recipe.rules||[]).slice(0,8)){
  if(rule.steps?.length)steps(rule.steps,rule,0);
  else add(rule.action,rule);
 }
 // Resolve simple demonstratives from the *generated* entities rather than
 // guessing a target based on whichever noun appeared last in the sentence.
 const anaphora=/(?:그|이|해당|방금(?:\s*생성한|\s*나뉜)?|남은|분열된|생성된|마지막|최후의)\s*(?:조각|파편|부스러기)(?:들)?(?:은|는|이|가|을|를)?/g;
 let match;while((match=anaphora.exec(raw))!==null&&references.length<8){
  const children=entities.filter(e=>e.role==='fragment');
  const resolved=children.length===1;
  references.push({text:match[0],target:resolved?children[0].id:null,
   resolved,binding:resolved?'actual_child_projectiles':null});
  if(resolved){
   const owner=actions.find(a=>a.object&&relations.some(r=>r.from===a.object&&
    r.to===children[0].id&&r.type.startsWith('fractures_')));
   if(owner)push(children[0].id,'resolved_reference',owner.id,{text:match[0]});
  }
 }
 const semantics=g.SemanticIntentComposer?.analyze?.(raw);
 return {version:1,sourceText:raw,entities,actions,relations,conditions,
  references,requested:semantics?.requested||[],
  limits:{maxActions:MAX_ACTIONS,maxRelations:MAX_RELATIONS,maxEntities:MAX_ENTITIES},
  // The graph is an explanation of registered execution, NOT a second engine.
  runtime:'SignatureRuleSkill / ForgeWorld'};
}
g.SemanticRelationshipGraph=Object.freeze({build});
})(typeof window!=='undefined'?window:globalThis);

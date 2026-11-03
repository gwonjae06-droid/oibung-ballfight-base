/* Skill IR v1: offline declarative intent and bounded physics operation plan.
 * Never executes user text, expressions, functions, URLs or generated JS.
 * To cast, lower back into SignatureRuleSkill's validated registry actions.
 */
(function(g){'use strict';
const PRESETS=Object.freeze({
 tether:['select-target','attach-spring','pull-force','contact-hit'],
 repulse:['select-radius','radial-impulse','contact-hit'],
 vortex:['create-field','tangential-force','inward-force','contact-hit'],
 shot:['spawn-projectile','linear-motion','collision-hit'],
 homing:['spawn-projectile','target-steering','collision-hit'],
 splitshot:['spawn-projectile','fracture-on-event','collision-hit'],
 wave:['select-radius','radial-impact','contact-hit'],
 dash:['self-impulse','movement-only'],
 shield:['protect-window'],heal:['recover-hp'],zone:['create-field','timed-contact-hit']
});
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const primitives=action=>{
 const type=String(action?.type||'');
 const definition=g.ActionRegistry?.get?.(type);
 const operations=type==='kinetic_relay'&&g.ImaginationConcepts?.normalizeRelay?.(action?.relay)?
  ['select-radius','capture-velocity','store-kinetic-energy','delay-release','radial-impulse','confirmed-contact-hit']:
  type==='phenomenon'&&g.PhysicsLawEngine?.normalize?.(action?.law)?
  ['create-force-field',...action.law.terms.map(t=>'force-'+t.op),
   'time-envelope','bounded-motion','confirmed-contact-hit']:
  PRESETS[type]||(
  definition?.physics==='projectile'?['spawn-projectile','collision-hit']:
  definition?.movementOnly?['self-motion','movement-only']:
  definition?.offense?['target-select','contact-hit']:['support-effect']);
 return operations.map(op=>({op,source:type}));
};
function fromRecipe(value){
 const rules=g.SignatureRuleSkill;
 if(!rules)throw Error('스킬 규칙 엔진이 필요합니다.');
 const safe=rules.normalize(value);
 return {version:1,trigger:'momentum',window:safe.window,
  events:safe.rules.map(r=>({
   when:r.when,interval:r.interval,fracture:r.fracture,
   ...(r.when==='wallStored'?{wallHits:r.wallHits}:{}),
   action:{...r.action},
   ...(r.eventGraph?{eventGraph:r.eventGraph}:{}),
   ...(r.steps?.length?{steps:r.steps}:{}),
   physics:primitives(r.action)
  }))};
}
// IR v2 adds an explainable graph; v1 profiles and combat recipes remain
 // unchanged. Untrusted incoming semantic graphs are always recomputed from
 // normalized registered actions rather than accepted as executable data.
function fromSentence(input,recipe){
 const base=fromRecipe(recipe);
 const text=String(input||'').normalize('NFC').trim().slice(0,300);
 return {...base,version:2,sourceText:text,
  semantics:g.SemanticRelationshipGraph?.build?.(text,recipe)||null};
}
function toRecipe(value){
 const rules=g.SignatureRuleSkill;
 if(!rules)throw Error('스킬 규칙 엔진이 필요합니다.');
 const v=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 // The IR's physics list describes registered behavior; it cannot inject
 // new physics code. Game execution always uses the validated action type.
 return rules.normalize({window:v.window,
  rules:(Array.isArray(v.events)?v.events:[]).map(event=>({
   when:event?.when,interval:event?.interval,fracture:event?.fracture,
   ...(event?.when==='wallStored'?{wallHits:event?.wallHits}:{}),
   action:event?.action,
   ...(event?.eventGraph?{eventGraph:event.eventGraph}:{}),
   ...(Array.isArray(event?.steps)?{steps:event.steps}:{})
  }))});
}
function normalize(value){
 if(!value||![1,2].includes(value.version))return undefined;
 const recipe=toRecipe(value);
 return value.version===2?fromSentence(value.sourceText,recipe):fromRecipe(recipe);
}
function describe(value){
 const ir=normalize(value);
 if(!ir)return [];
 return ir.events.map(x=>({
  trigger:x.when,action:x.action.type,
  primitives:x.physics.map(y=>y.op),interval:x.interval
 }));
}
g.SkillIR=Object.freeze({PRESETS,primitives,fromRecipe,fromSentence,toRecipe,normalize,describe});
})(typeof window!=='undefined'?window:globalThis);

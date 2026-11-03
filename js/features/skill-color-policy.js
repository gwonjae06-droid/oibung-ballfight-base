/* Skill Color Policy v1.
 * Explicit color in THIS skill's Korean prompt wins. Otherwise the
 * authored art inherits the fighter's currently chosen effect color.
 * No saved fixed fallback palette overrides later character customization.
 * This only changes rendering, never physical combat properties.
 */
(function(g){'use strict';
const HEX=/^#[0-9a-f]{6}$/i;
const words=Object.freeze([
 ['#ff454f',/빨간색|빨강|빨갛|새빨간|붉은|붉게|붉빛|진홍|적색|빨간/],
 ['#276df0',/파란색|파랑|파랗|푸른색|푸른|푸르|청색|코발트|남색/],
 ['#4ade80',/초록색|초록|녹색|연두색|연두|에메랄드|풀빛/],
 ['#facc15',/노란색|노랑|노랗|황색|금빛|금색|황금색|황금빛/],
 ['#a855f7',/보라색|보라|자주색|자줏빛|자색/],
 ['#fb7185',/분홍색|분홍|핑크|연분홍|장밋빛/],
 ['#fb923c',/주황색|주황|오렌지색/],
 ['#06b6d4',/청록색|청록|민트색|민트|옥색|터키석/],
 ['#f8fafc',/하얀색|하양|하얗|흰색|흰빛|백색|순백|새하얀/],
 ['#101827',/검은색|검정|검은|검게|먹빛|새까만|까만색|흑색|칠흑/],
 ['#9ca3af',/회색|회빛|은색|은빛|백은색/],
 ['#92400e',/갈색|갈빛|황토색|흙빛/],
 ['#c4b5fd',/연보라|라벤더색/]
]);
function explicit(raw){
 const s=String(raw||'').normalize('NFC').slice(0,300);
 const hex=s.match(/(?:색(?:상)?\s*[:=]?\s*|컬러\s*[:=]?\s*|^)(#[0-9a-fA-F]{6})(?![0-9a-fA-F])/);
 if(hex)return {color:hex[1].toLowerCase(),term:hex[1]};
 const hits=[];
 for(const [color,re] of words){
  re.lastIndex=0;const m=re.exec(s);if(m)hits.push({color,term:m[0],index:m.index});
 }
 // Prefer the first explicitly named color in this skill sentence.
 hits.sort((a,b)=>a.index-b.index);
 return hits[0]?{color:hits[0].color,term:hits[0].term}:null;
}
// Associate explicit color adjectives with named physical objects, not with
// whichever hue happened to occur first in the whole 300-char sentence.
// This is intentionally a bounded local grammar, not unrestricted coreference.
function stages(input){
 const raw=String(input||'').normalize('NFC').slice(0,300);
 const hits=[];
 for(const [color,re] of words){
  const scan=new RegExp(re.source,'g');let m,n=0;
  while((m=scan.exec(raw))!==null&&n++<20){
   hits.push({color,term:m[0],index:m.index,end:m.index+m[0].length});
  }
 }
 const hex=/(#[0-9a-f]{6})(?![0-9a-f])/gi;let m;
 while((m=hex.exec(raw))!==null&&hits.length<64)
  hits.push({color:m[1].toLowerCase(),term:m[1],index:m.index,end:m.index+7});
 hits.sort((a,b)=>a.index-b.index);
 const nouns={
  source:/투사체|탄환|탄알|미사일|화살|구슬|발사체|분열탄|추적탄|유도탄/g,
  fragment:/파편|조각|부스러기/g,
  terminal:/폭발|폭파|충격파|폭렬/g
 };
 const boundaries=/투사체|탄환|미사일|화살|구슬|분열탄|추적탄|유도탄|파편|조각|부스러기|폭발|폭파|충격파|폭렬/;
 const found={};
 for(const [role,pattern] of Object.entries(nouns)){
  const scan=new RegExp(pattern.source,'g');let anchor,best=null,n=0;
  while((anchor=scan.exec(raw))!==null&&n++<24){
   const near=hits.filter(h=>{
    const gap=anchor.index-h.end;
    if(gap<0||gap>23)return false;
    const between=raw.slice(h.end,anchor.index);
    return !/[.!?;\n]/.test(between)&&!boundaries.test(between);
   }).sort((a,b)=>b.end-a.end)[0];
   if(near&&(!best||near.end>best.end))best=near;
  }
  if(best)found[role]={color:best.color,term:best.term};
 }
 return found;
}
function normalized(hex,alternative='#a78bfa'){
 return typeof hex==='string'&&HEX.test(hex)?hex.toLowerCase():alternative;
}
function shade(hex,n){
 const h=normalized(hex),rgb=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 const target=n>=0?255:0,m=Math.abs(n);
 return '#'+rgb.map(v=>Math.round(v*(1-m)+target*m).toString(16).padStart(2,'0')).join('');
}
function resolve(value,characterColor){
 const v=g.MetaphorVisuals?.normalize?.(value);
 if(!v)return undefined;
 if(v.colorMode!=='inherit'&&v.colorMode!=='explicit')return v; // historical art stays fixed
 const base=v.colorMode==='explicit'?normalized(v.color):normalized(characterColor);
 return {...v,color:base,
  layers:(v.layers||[]).map((l,i)=>({...l,
   color:shade(base,i%4===0?0:i%4===1?.16:i%4===2?-.12:.29)}))};
}
function decorate(recipe,text){
 if(!recipe||!Array.isArray(recipe.rules))return {recipe,priority:'none',explicit:null};
 const palette=stages(text);
 // Only a genuine shard-producing shot supports three differently colored
 // physical phases. Other legacy skills retain the original first-color rule.
 const hasSplit=recipe.rules.some(r=>r.action?.type==='shot'&&r.action?.fusion?.split);
 const scoped=hasSplit&&(palette.fragment||palette.terminal);
 const selected=palette.source||(!scoped?explicit(text):null);
 const mode=selected?'explicit':'inherit';
 const applyAction=a=>{
  if(!a||typeof a!=='object')return a;
  const old=g.MetaphorVisuals?.normalize?.(a.visual);
  // Existing effect motif is kept; only palette selection changes.
  if(!old)return a;
  const fusion=a.type==='shot'&&a.fusion?.split?g.ConceptFusion?.normalize?.({
   ...a.fusion,
   ...(palette.fragment?{childColor:palette.fragment.color}:{}),
   ...(a.fusion.finalBurst&&palette.terminal?{finalColor:palette.terminal.color}:{})
  }):a.fusion;
  return {...a,visual:{...old,color:selected?.color||old.color,colorMode:mode},
   ...(fusion?{fusion}:{})};
 };
 const walk=steps=>(steps||[]).map(s=>{
  if(!s||typeof s!=='object')return s;
  return {...s,...(s.action?{action:applyAction(s.action)}:{}),
   ...(s.body?{body:walk(s.body)}:{}),
   ...(s.then?{then:walk(s.then)}:{}),
   ...(s.else?{else:walk(s.else)}:{})};
 });
 const raw={...recipe,rules:recipe.rules.map(rule=>({
  ...rule,action:applyAction(rule.action),
  ...(rule.steps?{steps:walk(rule.steps)}:{})
 }))};
 return {recipe:g.SignatureRuleSkill?.normalize?.(raw)||raw,
  priority:scoped?'phase-specific':selected?'skill-sentence':'character',
  explicit:selected,
  stages:scoped?palette:null};
}
g.SkillColorPolicy=Object.freeze({explicit,stages,normalized,shade,resolve,decorate});
})(typeof window!=='undefined'?window:globalThis);

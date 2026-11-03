/* Korean skill-language analyzer v1.
 * Offline finite lexicon + Hangul ending/particle segmentation, not an
 * unbounded generative model. Outputs auditable slots for combat compilers.
 * There is NO eval, model API, network, dynamic generated source or NPM runtime.
 */
(function(g){'use strict';
const PARTICLES=['에서부터','에게서는','으로부터','에게까지','들한테','한테서','에게서','까지는','으로는','에서는','에게는','한테는','에서','에게','한테','으로','로서','로써','부터','까지','처럼','같이','보다','마다','조차','마저','밖에','하고','과','와','랑','으로','를','을','은','는','이','가','에','도','만','의','로'];
const ENDINGS=['으면서','면서','자마자','기전에','ㄹ때마다','을때마다','때마다','때에는','되면','으면','다면','하자','도록','었을때','았을때','고나서','고나면','고서','하고','지만','더니','다가','으면','면서','려고','므로','니까','하며','해서','하고','면','고','며','기','다','어','아','여','음'];
// Productive Korean bound morphemes. These are hints, not a claim of full
// dictionary-grade morphological parsing or POS disambiguation.
const PREFIXES=['초','극','대','재','무','반','불','비'];
const SUFFIXES=['스럽게','스럽다','시키다','하다','화하다','형으로','형태로','적으로','답게'];
const ADVERBS=[
 ['scale',/^(?:엄청나게|어마어마하게|초거대하게|거대하게|크게|커다랗게|두껍게|굵게)$/],
 ['speed',/^(?:재빠르게|빠르게|신속히|순식간에|즉시|광속으로|엄청빨리|느리게|천천히)$/],
 ['repeat',/^(?:계속|끊임없이|여러번|반복해서|수없이|무한히|마구|잔뜩|연속으로)$/],
 ['direction',/^(?:앞으로|뒤로|사방으로|전방으로|주위로|주변으로)$/],
 ['intensity',/^(?:강하게|세게|묵직하게|격렬하게|강렬하게|살살|약하게|힘껏)$/]
];
const VERBS=[
 ['beam',/^(?:발사|쏘|내뿜|뿜|방출|뿜어|레이저)/],
 ['slash',/^(?:후려치|휘두르|내리치|때리|치|베|할퀴|긁|물어뜯|깨물|물)/],
 ['splitshot',/^(?:분열|쪼개|갈라|증식)/],
 ['wave',/^(?:폭발|폭파|터뜨리|터지|펑|충격파|울리|진동)/],
 ['bolt',/^(?:번개|찌릿|방전|감전)/],
 ['leap',/^(?:점프|뛰어오르|도약|솟아오르)/],
 ['dive',/^(?:낙하|내려찍|내리꽂|급강하)/],
 ['dash',/^(?:돌진|들이받|박치기|달려들)/],
 ['haste',/^(?:가속|빨라지|빨라|속도높)/],
 ['shield',/^(?:막|방어|보호|감싸)/],
 ['heal',/^(?:회복|치유|살리)/],
 ['summon',/^(?:소환|불러내|생성)/]
];
const NOUNS=[
 ['beam',/멘헤라빔|광선|레이저|빔|열선|빛줄기/],
 ['bolt',/번개|낙뢰|뇌전|전기|벼락|전류|찌릿/],
 ['slash',/턱|이빨|발톱|검|칼날|주먹|망치/],
 ['splitshot',/분열탄|분열하는\s*(?:탄|구슬)|파편탄/],
 ['shot',/탄환|탄알|화살|투사체|총알|미사일/],
 ['wave',/충격파|폭발|파동|소닉붐|지진/],
 ['haste',/속도|가속|광속|질주/],
 ['shield',/방어막|보호막|실드/],
 ['summon',/소환수|분신|사역마/],
 ['heal',/회복|체력|치유/]
];
const END_STEMS=[['때마다','conditional'],['으면','conditional'],['되면','conditional'],['면','conditional'],
 ['자마자','sequential'],['고나서','sequential'],['고나면','sequential'],
 ['다가','sequential'],['고','sequential'],['며','sequential'],
 ['면서','simultaneous'],['지만','contrast'],['다','declarative']];
const isHangul=s=>/[가-힣]/.test(s);
function tokenize(input){
 const words=String(input||'').normalize('NFC').replace(/[.,!?;:()“”"']/g,' ').split(/\s+/).filter(Boolean).slice(0,150);
 return words.map(word=>{
  const a=ADVERBS.find(([,re])=>re.test(word));
  let stem=word,particle=null,ending=null;
  if(!a){
   for(const suffix of ENDINGS){
    if(word.length>suffix.length+1&&word.endsWith(suffix)){
      stem=word.slice(0,-suffix.length);ending=suffix;break;
    }
   }
   if(!ending)for(const suffix of PARTICLES){
    if(word.length>suffix.length&&word.endsWith(suffix)){
      stem=word.slice(0,-suffix.length);particle=suffix;break;
    }
   }
  }
  const verb=VERBS.find(([,re])=>re.test(stem));
  const noun=NOUNS.find(([,re])=>re.test(stem));
  const pos=a?'adverb':verb?'verb':noun?'noun':particle?'noun':ending?'verb':isHangul(word)?'unknown':'symbol';
  const prefix=PREFIXES.find(p=>stem.startsWith(p)&&stem.length>p.length+1)||null;
  const suffix=SUFFIXES.find(p=>stem.endsWith(p)&&stem.length>p.length+1)||null;
  return {surface:word,stem,particle,ending,prefix,suffix,pos,
   semantic:a?.[0]||verb?.[0]||noun?.[0]||null};
 });
}
const CONNECT=/(\S+?(?:때마다|자마자|고나서|고나면|하면|되면|으면|면서|다가|거나|고|면))(?=\s|$)/g;
function segments(raw){
 const text=String(raw||'').normalize('NFC').trim()
  .replace(/\s+(?:말고|말구)\s+/g,' 말고 그리고 ')
  .replace(/(?:그\s*다음|그\s*뒤|이후에|이어서|뒤이어|다음엔|그리고|그러고\s*나서)/g,' 그리고 ');
 const pieces=[];
 for(const part of text.split(/[,;.!?。]\s*|\s+그리고\s+/).filter(Boolean)){
  // Split a *verbal ending*, not arbitrary lexical stem ending in "고":
  // '멘헤라고' must remain a noun; require a recognized verbal root.
  const ws=part.split(/\s+/).filter(Boolean),buffer=[];
  for(const word of ws){
   buffer.push(word);
   const cond=/(?:면|때마다|자마자|고나서|고나면|면서|다가|고)$/.test(word);
   const stem=word.replace(/(?:때마다|자마자|고나서|고나면|으면|면서|다가|면|고)$/,'');
   const verb=VERBS.some(([,re])=>re.test(stem))||
    /(?:튀기|부딪히|부딪|맞|적중|명중|충돌|착지|모이|모아|응축|커지|변하|변형|회전|다가가|휘감|휘몰|돌다가|폭발|터지)/.test(stem);
   if(cond&&verb&&buffer.length){
    pieces.push(buffer.join(' '));buffer.length=0;
   }
  }
  if(buffer.length)pieces.push(buffer.join(' '));
 }
 return pieces.slice(0,16);
}
const clauseWhen=s=>/벽(?:에|과|을|이)?.*(?:튕기|부딪|충돌|닿)/.test(s)?'wall':
  /(?:상대|적|몸|공)(?:와|과|에|을|에게)?.*(?:부딪|충돌|접촉|들이받)/.test(s)?'contact':
  /(?:적중|명중|맞히|맞추)/.test(s)?'hit':
  /착지|땅에\s*닿/.test(s)?'land':
  /분열(?:할|하|했|되)/.test(s)&&/(?:면|때마다)/.test(s)?'split':
  /(?:방어|막|막았)/.test(s)&&/(?:면|때마다)/.test(s)?'guard':
  /(?:피하|회피)/.test(s)&&/(?:면|때마다)/.test(s)?'dodge':
  /체력.*(?:낮|적|부족|이하)/.test(s)?'hpLow':'pulse';
const conditional=s=>/(?:면|때마다|경우|때|자마자)$/.test(s.trim());
const negated=s=>/(?:않|안\s|못\s|말아|말고|금지|하지\s*마)/.test(s);
const pickType=(text,types,context={})=>{
 const raw=String(text||'');
 const nt=tokenize(raw),supported=k=>Object.hasOwn(types,k);
 const available=NOUNS.filter(([k,re])=>re.test(raw)&&supported(k));
 const lexical=(g.NaturalForge?.recognize?.(raw)||[]).filter(x=>supported(x.type)).map(x=>x.type);
 const metaphor=g.MetaphorVisuals?.interpret?.(raw);
 // A dominant named object has priority over the incidental verb "발사".
 if(metaphor&&supported(metaphor.type))return {type:metaphor.type,visual:metaphor.visual,source:'metaphor'};
 const explicit=available.find(([k])=>k==='splitshot'||k==='beam'||k==='wave')||available[0];
 if(explicit)return {type:explicit[0],source:'noun'};
 const verbs=VERBS.filter(([k,re])=>supported(k)&&nt.some(t=>re.test(t.stem)));
 const verb=verbs.find(([k])=>k==='slash'&&/때리|후려|휘두르/.test(raw))||verbs[0];
 if(verb)return {type:verb[0],source:'verb'};
 if(lexical.length)return {type:lexical[0],source:'lexicon'};
 // Even unfamiliar poetic imagery can suggest an existing combat mechanic,
 // without claiming to invent a new physics system.
 const analogue=g.SkillFXComposer?.suggestAction?.(raw,types);
 if(analogue)return analogue;
 if(/뿅|슝|퓽|휙|펑|쾅|콰광|빠직|찌릿/.test(raw)){
  const guessed=/찌릿|빠직/.test(raw)?'bolt':/쾅|콰광|펑/.test(raw)?'wave':'shot';
  if(supported(guessed))return {type:guessed,source:'onomatopoeia'};
 }
 return null;
};
function analyze(input,types={}){
 const raw=String(input||'').normalize('NFC').trim();
 const tokens=tokenize(raw),clauses=segments(raw).map((text,index)=>({
  index,text,tokens:tokenize(text),when:clauseWhen(text),
  conditional:conditional(text),negated:negated(text),chosen:pickType(text,types)
 }));
 // '벽에 튕기면' is a trigger, not a requested "dash" attack.
 for(let i=0;i<clauses.length;i++){
  const c=clauses[i];
  if(c.conditional&&['wall','contact','hit','guard','dodge','land','hpLow','split'].includes(c.when)
    &&i+1<clauses.length){
   const next=clauses[i+1];
   if(next.when==='pulse')next.when=c.when;
   if(c.chosen?.type==='haste'&&c.when==='wall'&&!/가속|빨라|속도/.test(c.text))
    c.chosen=null;
  }
  // Imperative "하지 마" removes that requested action, not the entire skill.
  if(c.negated){c.suppressed=c.chosen;c.chosen=null;}
 }
 const adverbs=tokens.filter(x=>x.pos==='adverb').map(x=>x.semantic);
 // Modifiers belong to their nearest clause; never apply '검은' or
 // '천천히' from the first action to every later action.
 for(const clause of clauses){
  const fx=g.SkillFXComposer?.infer?.(clause.text);
  if(fx)clause.fx=fx;
 }
 return {tokens,clauses,adverbs,negative:clauses.some(c=>c.negated),
  hasAction:clauses.some(c=>!!c.chosen),
  confidence:clauses.filter(c=>c.chosen).length/Math.max(1,clauses.length)};
}
g.KoreanSkillGrammar=Object.freeze({tokenize,segments,analyze,clauseWhen,pickType,negated});
})(typeof window!=='undefined'?window:globalThis);

/* Korean battle commentator using the browser's installed voices.
 * Nonblocking: narration never changes game simulation or audio/BGM settings.
 * Short factual phrases are spoken instead of reading long subtitle variants.
 */
(function(g){'use strict';
let bound=false;
const cap=(v,l,h)=>Math.max(l,Math.min(h,v));
const doc=()=>g.document;
const node=id=>doc()?.getElementById?.(id);
function supports(){return !!(g.speechSynthesis&&g.SpeechSynthesisUtterance);}
function enabled(){return !!node('arena-commentary-voice')?.checked;}
function rate(){const v=Number(node('arena-commentary-rate')?.value);return cap(Number.isFinite(v)?v:1.38,1,1.65);}
function chooseVoice(){
 const voices=g.speechSynthesis?.getVoices?.()||[];
 const ko=voices.filter(v=>/^ko(?:[-_]|$)/i.test(String(v.lang||'')));
 if(!ko.length)return null;
 function weight(v){
  const n=String(v.name||'').toLowerCase(),language=String(v.lang||'').toLowerCase();
  let score=language==='ko-kr'?15:8;
  if(/natural|neural|premium|enhanced/.test(n))score+=30;
  if(/google|microsoft|apple/.test(n))score+=12;
  if(v.localService)score+=2;
  if(/online/.test(n))score+=4;
  if(/compact|robot|espeak/.test(n))score-=18;
  return score;
 }
 return ko.slice().sort((a,b)=>weight(b)-weight(a))[0];
}
function spoken(kind,args,full){
 const [n,s,t,d]=args||[];
 switch(kind){
  case 'start':return '경기 시작! 첫 충돌을 지켜보시죠.';
  case 'cast':return String(n||'파이터')+'의 '+String(s||'기술')+'!';
  case 'impact':return String(s||'공격')+' 명중! '+String(t||'상대')+', '+(Number(d)||0)+' 피해!';
  case 'control':return String(t||'상대')+', '+String(d||'상태 이상')+'!';
  case 'low':return String(n||'파이터')+', 체력이 위험합니다!';
  case 'heavy':return String(n||'파이터')+', 강한 타격! '+(Number(s)||0)+' 피해!';
  case 'lead':return String(n||'파이터')+'이 체력에서 앞섭니다.';
  case 'overtime':return '결전 돌입! 이제 시간도 적입니다.';
  case 'recovery':return String(n||'파이터')+', '+(Number(s)||0)+' 체력 회복!';
  case 'comeback':return String(n||'파이터')+'이 반격을 노립니다!';
  case 'combo':return String(n||'파이터')+', '+String(s||0)+' 콤보!';
  case 'charge':return String(n||'파이터')+'의 기세가 '+String(s||70)+'!';
  case 'ready':return String(n||'파이터')+', 기세 100! 필살기 준비!';
  case 'pattern':return '보스 위험 지역! 반사 방향을 보세요!';
  case 'ultimate':case 'critical':return String(n||'파이터')+'의 '+String(s||'필살기')+'!';
  case 'finish':return full;
  default:return full;
 }
}
function clean(value){
 return String(value||'').replace(/<[^>]+>/g,' ').replace(/[⚡🔥💥✨⚔️◉]/gu,'')
  .replace(/\s+/g,' ').trim().slice(0,115);
}
function stop(){
 try{g.speechSynthesis?.cancel?.();}catch(_){}
}
function say(text,options={}){
 if(!supports()||!enabled())return false;
 const {kind='other',args=[],priority=2}=options;
 const synth=g.speechSynthesis;
 // A previously spoken low-value skill never delays an urgent hit,
 // near-defeat warning or final result. Nonurgent captions still update.
 if(synth.speaking&&priority<5)return false;
 const line=clean(spoken(kind,args,text));
 if(!line)return false;
 try{
  if(synth.speaking||synth.pending)synth.cancel();
  const u=new g.SpeechSynthesisUtterance(line);
  u.lang='ko-KR';u.rate=rate();u.pitch=1.04;u.volume=.95;
  const v=chooseVoice();if(v)u.voice=v;
  synth.speak(u);return true;
 }catch(_){return false;}
}
function bind(){
 if(bound||!doc()?.getElementById)return false;
 const toggle=node('arena-commentary-voice'),select=node('arena-commentary-rate');
 if(!toggle||!select)return false;
 bound=true;
 toggle.addEventListener?.('change',()=>{if(!toggle.checked)stop();});
 select.addEventListener?.('change',()=>{
  // Speed selection affects the next utterance without interrupting current
  // phrase or writing to player profile/combat save data.
  try{g.localStorage?.setItem?.('arena-commentary-speed',String(rate()));}catch(_){}
 });
 try{const saved=Number(g.localStorage?.getItem?.('arena-commentary-speed'));
   if(saved>=1&&saved<=1.65){
    const choices=[...select.options||[]],near=choices.reduce((best,o)=>
      Math.abs(Number(o.value)-saved)<Math.abs(Number(best.value)-saved)?o:best,choices[0]);
    if(near)select.value=near.value;
   }
 }catch(_){}
 return true;
}
if(!bind())doc()?.addEventListener?.('DOMContentLoaded',bind,{once:true});
g.ArenaCommentaryVoice=Object.freeze({say,stop,bind,enabled,rate,spoken,chooseVoice});
})(typeof window!=='undefined'?window:globalThis);

/* Public character power ranking. Estimated strength, NOT an online win rate.
 * Only valid public GitHub share Issues are displayed. The ranking is read-only
 * until the player explicitly imports a character, after the match ends. */
(function(global){
'use strict';
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,Number(n)||0));
const OFFENSE=new Set(['wave','shot','beam','bolt','pull','zone','homing','pierce','boomerang',
  'chain','nova','meteor','mine','drain','blackhole','starfall','dung','uppercut',
  'slash','spinslash','thrust','aircombo','arcshot','splitshot','dive','erupt',
  'burrowdash','trap','turret','summon']);
const DEFENSE=new Set(['heal','shield','cleanse','regen','fortify','lifebloom',
  'resurrect','haste','rewind','grow','shrink','timestop','timeburst']);
function power(profile){
  if(!profile||!Array.isArray(profile.skills))return 0;
  const hp=Math.round(clamp((profile.hp-140)/360,0,1)*260);
  const mobility=Math.round(clamp((profile.speed-.6)/4.4,0,1)*145);
  const skills=profile.skills.slice(0,4).map(skill=>{
    const cooldown=clamp(skill.cooldown,.2,30)||3;
    const parts=(skill.actions||[]).slice(0,3).map(a=>{
      const type=String(a.type||''),damage=clamp(a.damage,0,120);
      const radius=clamp(a.radius,30,300),count=clamp(a.count,1,8);
      const attack=OFFENSE.has(type);
      const protection=DEFENSE.has(type);
      const utility=protection?22:attack?0:10;
      const impact=attack?damage*((type==='zone'||type==='mine')?.7:1):0;
      return impact+utility+(attack?radius*.055:0)+
        (attack&&a.status&&a.status!=='none'?10:0)+
        (attack&&count>1?Math.min(12,(count-1)*2):0);
    });
    // Slightly reward complementary skills, not blindly counting every block.
    const value=parts.reduce((sum,n,i)=>sum+n*(i===0?1:.63),0);
    return Math.min(150,Math.round(value/(.75+Math.sqrt(cooldown)*.48)));
  });
  return Math.min(1200,Math.round(100+hp+mobility+
    skills.reduce((sum,n)=>sum+n,0)+(profile.allAbilities?100:0)));
}
function rank(shares,limit=10){
  const distinct=new Map();
  for(const share of shares||[]){
    if(!share?.profile||!share?.number)continue;
    const author=String(share.author||'GitHub 사용자');
    const name=String(share.profile.name||'커스텀 파이터');
    const key=author.toLowerCase()+'\u0000'+name.toLowerCase();
    const entry={...share,author,name,score:power(share.profile)};
    // Newest edit/share from one author with the same name wins.
    if(!distinct.has(key)||entry.number>distinct.get(key).number)distinct.set(key,entry);
  }
  return [...distinct.values()].sort((a,b)=>b.score-a.score||a.number-b.number)
    .slice(0,Math.max(0,Math.min(100,limit)));
}
function install(){
  const main=global.document?.getElementById('container');
  if(!main||!global.CommunityForge?.loadShared)return;
  const aside=document.createElement('aside');
  aside.className='community-power-ranking';
  aside.id='community-power-ranking';
  aside.setAttribute('aria-label','다른 플레이어가 GitHub에 공유한 캐릭터 파워랭킹');
  aside.innerHTML='<div class="power-ranking-title"><div><span>COMMUNITY / POWER</span><h2>⚡ 파워랭킹</h2></div>'
    +'<button id="power-ranking-reload" type="button" aria-label="공유 캐릭터 파워랭킹 새로고침">↻</button></div>'
    +'<p class="power-ranking-intro">공개된 공유 캐릭터의 <strong>추정 전투력</strong> 순위입니다. 실제 승률이 아닙니다.</p>'
    +'<ol id="power-ranking-list" class="power-ranking-list"></ol>'
    +'<p id="power-ranking-status" class="power-ranking-status" role="status" aria-live="polite">공유 캐릭터를 확인하는 중…</p>'
    +'<a class="power-ranking-issues" href="https://github.com/gwonjae06-droid/oibung-ballfight-base/issues" target="_blank" rel="noopener noreferrer">GitHub 공개 공유글 보기</a>'
    +'<small class="power-ranking-method">HP 260점 · 속도 145점 · 공격/보조 스킬과 쿨타임을 반영한 상대적 점수. 최신 공개 공유글 최대 100개 중 상위 10개.</small>';
  main.parentNode.insertBefore(aside,main);
  document.body.classList.add('has-power-ranking');
  // Move the ONE existing share browser into the left-hand ranking panel.
  // Its existing handlers, publish action and import action remain attached.
  // The same nested ordering works when the panel moves below the game on mobile.
  const gallery=global.document.querySelector('.community-section');
  const afterRanking=aside.querySelector('.power-ranking-issues');
  if(gallery&&afterRanking){
    gallery.classList.add('power-ranking-gallery');
    aside.insertBefore(gallery,afterRanking);
  }
  const list=aside.querySelector('#power-ranking-list');
  const status=aside.querySelector('#power-ranking-status');
  const refresh=aside.querySelector('#power-ranking-reload');
  function card(share,i){
    const li=document.createElement('li');
    li.className='power-ranking-card';
    const top=document.createElement('div');top.className='power-ranking-row';
    const number=document.createElement('span');number.className='power-ranking-number';
    number.textContent=String(i+1).padStart(2,'0');
    const detail=document.createElement('div');detail.className='power-ranking-fighter';
    const title=document.createElement('strong');title.textContent=share.name;
    const creator=document.createElement('small');creator.textContent='@'+share.author;
    detail.append(title,creator);
    const score=document.createElement('span');score.className='power-ranking-score';
    score.textContent=share.score.toLocaleString('ko-KR');
    score.title='실제 승률이 아닌 추정 전투력 점수';
    top.append(number,detail,score);
    const tools=document.createElement('div');tools.className='power-ranking-tools';
    const add=document.createElement('button');add.type='button';add.textContent='+ 내 게임에 추가';
    add.setAttribute('aria-label',share.name+'을 내 게임에 추가');
    add.addEventListener('click',()=>{
      if(typeof roundStarted!=='undefined'&&roundStarted&&typeof isGameOver!=='undefined'&&!isGameOver){
        status.textContent='진행 중인 경기가 끝난 뒤 캐릭터를 추가할 수 있습니다.';return;
      }
      try{
        global.SkillForge.register(share.profile);
        global.SkillForge.persist();
        global.reRollMatch?.();
        global.SkillForge.refreshList?.();
        status.textContent=share.name+' 추가 완료 · 대진 설정에서 선택하세요.';
      }catch(e){status.textContent='추가 실패: '+(e?.message||'캐릭터 설정을 확인해 주세요.');}
    });
    const link=document.createElement('a');
    link.textContent='공유글';link.rel='noopener noreferrer';link.target='_blank';
    if(/^https:\/\/github\.com\/gwonjae06-droid\/oibung-ballfight-base\/issues\/[0-9]+$/.test(share.html_url||''))
      link.href=share.html_url;
    else link.hidden=true;
    tools.append(add,link);li.append(top,tools);return li;
  }
  async function reload(force=false){
    if(refresh.disabled)return;
    refresh.disabled=true;status.textContent='공개 공유글을 불러오는 중…';
    try{
      const shared=await global.CommunityForge.loadShared(force);
      const entries=rank(shared);
      list.replaceChildren(...entries.map(card));
      status.textContent=entries.length?
        '공개 캐릭터 '+shared.length+'개 · 추정 전투력 기준 상위 '+entries.length+'명':
        '아직 공개된 공유 캐릭터가 없습니다. 캐릭터 제작기에서 GitHub에 공유해 보세요.';
    }catch(e){
      status.textContent='랭킹을 불러오지 못했습니다. '+(e?.message||'네트워크 연결을 확인하세요.');
      // Keep the previously loaded ranking on temporary API failures.
    }finally{refresh.disabled=false;}
  }
  refresh.addEventListener('click',()=>reload(true));
  reload();
}
global.CommunityPowerRanking={power,rank,install};
if(typeof document!=='undefined')install();
})(window);

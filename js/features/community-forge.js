/* Shared characters: public GitHub Issues, no user token in the browser.
   Publishing requires a GitHub login and clicking Submit on GitHub. */
(function(global){
'use strict';
const OWNER='gwonjae06-droid', REPO='oibung-ballfight-base';
const MARK='OIBUNG-CHARACTER-V1';
function makeBody(profile){
  const cfg=SkillForge.normalize(profile);
  return '오이붕 아레나 캐릭터 공유\n\n'+MARK+'\n'+JSON.stringify(cfg)+'\nEND-'+MARK+
    '\n\n게임의 공유 저장소에서 이 설정을 불러올 수 있습니다.';
}
function parseBody(body){
  const m=String(body||'').match(/OIBUNG-CHARACTER-V1\n([\s\S]{2,7000}?)\nEND-OIBUNG-CHARACTER-V1/);
  if(!m)return null;
  try {return SkillForge.normalize(JSON.parse(m[1]));} catch(_) {return null;}
}
function makeUrl(profile){
  const cfg=SkillForge.normalize(profile);
  const body=makeBody(cfg);
  if(body.length>5000)throw Error('공유 설정이 너무 큽니다. 스킬 수를 줄여주세요.');
  return 'https://github.com/'+OWNER+'/'+REPO+'/issues/new?'+new URLSearchParams({
    title:'[ARENA SHARE] '+cfg.name,body
  }).toString();
}
// One bounded public read for the gallery and ranking. Only GitHub Issues
// submitted with the share marker count; PRs and ordinary Issues do not.
let publicSnapshot=null,loadedAt=0,request=null;
async function loadShared(force=false){
  if(!force&&publicSnapshot&&Date.now()-loadedAt<60000)return publicSnapshot;
  if(!force&&request)return request;
  const task=(async()=>{
    const url='https://api.github.com/repos/'+OWNER+'/'+REPO+
      '/issues?state=open&sort=created&direction=desc&per_page=100';
    const response=await fetch(url,{headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok)throw Error('GitHub API 오류 ('+response.status+') · 잠시 후 다시 시도하세요.');
    const issues=await response.json();
    if(!Array.isArray(issues))throw Error('공유 목록 응답이 올바르지 않습니다.');
    const result=[];
    for(const issue of issues){
      if(issue.pull_request||!String(issue.title||'').startsWith('[ARENA SHARE]'))continue;
      const profile=parseBody(issue.body);
      if(!profile)continue;
      const number=Number(issue.number)||0;
      const html='https://github.com/'+OWNER+'/'+REPO+'/issues/'+number;
      result.push({number,profile,author:String(issue.user?.login||'GitHub 사용자'),
        html_url:number>0?html:null});
    }
    publicSnapshot=result;
    loadedAt=Date.now();
    return result;
  })();
  request=task;
  try{return await task;}finally{if(request===task)request=null;}
}
function install(){
  const panel=document.querySelector('.bf-tools');if(!panel)return;
  const section=document.createElement('details');
  section.className='bf-details community-section';
  const summary=document.createElement('summary');summary.textContent='공유 캐릭터 둘러보기';
  section.appendChild(summary);
  const body=document.createElement('div');body.className='bf-details-body';
  body.innerHTML='<p class="bf-helper">모든 플레이어가 공개된 캐릭터를 불러올 수 있습니다. 공유 등록에는 GitHub 로그인이 필요합니다.</p>'
    +'<label for="community-own">내가 만든 캐릭터</label><select id="community-own"></select>'
    +'<div class="bf-btn-row"><button type="button" id="community-publish">GitHub에 공유하기</button>'
    +'<button type="button" id="community-refresh">공유 목록 새로고침</button></div>'
    +'<p id="community-state" class="bf-helper" role="status" aria-live="polite"></p>'
    +'<div id="community-items" class="community-items"></div>'
    +'<p class="bf-helper">공유글을 삭제하려면 GitHub에서 해당 글을 닫거나 삭제하세요. 내 기기에서 삭제하는 것과 공개글 삭제는 별개입니다.</p>';
  section.appendChild(body);
  // Share and locally saved fighters belong in one collapsed library, not a
  // second large top-level editor section.
  const saved=panel.querySelector('.forge-saved');
  (saved||panel).appendChild(section);
  const $=id=>document.getElementById(id);
  const state=$('community-state'), own=$('community-own'),list=$('community-items');
  function refreshOwn(){
    const old=own.value;own.replaceChildren();
    const saved=SkillForge.list();
    for(const {id,profile} of saved){
      const opt=document.createElement('option');opt.value=id;opt.textContent=profile.name;
      own.append(opt);
    }
    if(saved.some(v=>v.id===old))own.value=old;
    if(!saved.length){const opt=document.createElement('option');opt.textContent='먼저 캐릭터를 만드세요';own.append(opt);}
    $('community-publish').disabled=!saved.length;
  }
  section.addEventListener('toggle',()=>{
    if(section.open){refreshOwn();if(!list.children.length)reload();}
  });
  $('community-publish').addEventListener('click',()=>{
    refreshOwn();
    const selected=SkillForge.list().find(x=>x.id===own.value);
    if(!selected){state.textContent='먼저 캐릭터를 저장하세요.';return;}
    try{
      const url=makeUrl(selected.profile);
      const tab=window.open(url,'_blank','noopener,noreferrer');
      if(!tab)window.location.href=url;
      state.textContent='GitHub에서 로그인 후 [Submit new issue]를 눌러야 공개됩니다. 아직 자동 게시된 것은 아닙니다.';
    }catch(e){state.textContent=e.message;}
  });
  async function reload(){
    state.textContent='공유 캐릭터 목록 불러오는 중…';
    $('community-refresh').disabled=true;
    list.replaceChildren();
    try {
      const shares=await loadShared();
      let count=0;
      for(const issue of shares){
        const cfg=issue.profile;
        count++;
        const card=document.createElement('article');card.className='community-item';
        const head=document.createElement('div');head.className='community-item-head';
        const name=document.createElement('strong');name.textContent=cfg.name;
        const author=document.createElement('small');author.textContent='by '+issue.author;
        head.append(name,author);
        const info=document.createElement('p');info.textContent=cfg.skills.length+'개 스킬 · '+cfg.hp+' HP · 이동속도 '+cfg.speed;
        const tools=document.createElement('div');tools.className='bf-btn-row';
        const use=document.createElement('button');use.textContent='내 게임에 추가';use.type='button';
        use.addEventListener('click',()=>{
          if(roundStarted&&!isGameOver){state.textContent='경기 종료 후 추가할 수 있습니다.';return;}
          try{
            SkillForge.register(cfg);SkillForge.persist();
            reRollMatch();
            SkillForge.refreshList();refreshOwn();
            state.textContent=cfg.name+' 추가 완료. 대진 설정에서 선택하세요.';
          }catch(e){state.textContent=e.message;}
        });
        const link=document.createElement('a');link.textContent='공유글 보기';link.rel='noopener noreferrer';link.target='_blank';
        if(String(issue.html_url||'').startsWith('https://github.com/'+OWNER+'/'+REPO+'/issues/'))link.href=issue.html_url;
        tools.append(use,link);card.append(head,info,tools);list.append(card);
      }
      state.textContent=count?count+'개 공개 캐릭터 (최신 100개 게시글 내)':'아직 불러올 수 있는 공유 캐릭터가 없습니다.';
    }catch(e){state.textContent=e.message;}
    finally{$('community-refresh').disabled=false;}
  }
  $('community-refresh').addEventListener('click',()=>{refreshOwn();publicSnapshot=null;reload();});
}
global.CommunityForge={makeBody,parseBody,makeUrl,loadShared};
if(typeof document!=='undefined'&&document.querySelector('.bf-tools'))install();
})(window);

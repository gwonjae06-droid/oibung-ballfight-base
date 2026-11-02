/* Safe opt-in local backup: never uploads saves, never touches combat state. */
(function(g){'use strict';
const KEYS=['oibung-tower-v1','oibung-forge-v3','oibung-ancient-one-clear'];
const FORMAT='oibung-arena-local-backup',MAX_BYTES=2*1024*1024;
function valid(key,value){
 if(key==='oibung-ancient-one-clear'){
  if(value!=='true'&&value!=='false')throw Error('최종 보스 기록 형식 오류');
  return value;
 }
 const parsed=JSON.parse(value);
 if(key==='oibung-tower-v1'){
  if(!parsed||Array.isArray(parsed)||typeof parsed.records!=='object'||!parsed.records||Array.isArray(parsed.records))throw Error('탑 기록 형식 오류');
  if(Object.keys(parsed.records).length>20000)throw Error('탑 기록 개수 초과');
  for(const [id,record] of Object.entries(parsed.records)){
   if(!/^[a-z0-9_-]{1,130}$/i.test(id)||!record||typeof record!=='object'||Array.isArray(record)||
      !Number.isFinite(record.best)||record.best<0||record.best>10||
      !Number.isFinite(record.attempts)||record.attempts<0||
      !Number.isFinite(record.victories)||record.victories<0)throw Error('잘못된 탑 기록');
  }
 }else if(key==='oibung-forge-v3'){
  if(!Array.isArray(parsed)||parsed.length>5000||parsed.some(p=>!p||typeof p!=='object'||Array.isArray(p)||
    typeof p.name!=='string'||!Array.isArray(p.skills)||p.skills.length<1||p.skills.length>4))
    throw Error('캐릭터 저장 형식 오류');
 }
 return JSON.stringify(parsed);
}
function snapshot(store){
 const entries={};
 for(const key of KEYS){const value=store.getItem(key);if(value!=null)entries[key]=valid(key,value);}
 return JSON.stringify({format:FORMAT,version:1,createdAt:new Date().toISOString(),entries},null,2);
}
function parse(text){
 if(typeof text!=='string'||text.length>MAX_BYTES)throw Error('백업 파일이 너무 크거나 유효하지 않습니다.');
 const payload=JSON.parse(text);
 if(!payload||payload.format!==FORMAT||payload.version!==1||!payload.entries||
    typeof payload.entries!=='object'||Array.isArray(payload.entries))throw Error('오이붕 아레나 백업 파일이 아닙니다.');
 const entries={};
 for(const [key,value] of Object.entries(payload.entries)){
  if(!KEYS.includes(key)||typeof value!=='string'||value.length>MAX_BYTES)throw Error('알 수 없는 백업 항목');
  entries[key]=valid(key,value);
 }
 if(!Object.keys(entries).length)throw Error('복원할 기록이 없습니다.');
 return entries;
}
function restore(store,text){
 const entries=parse(text),before={};
 for(const key of Object.keys(entries))before[key]=store.getItem(key);
 const written=[];
 try{
  for(const [key,value] of Object.entries(entries)){store.setItem(key,value);written.push(key);}
 }catch(error){
  for(const key of written){try{if(before[key]===null)store.removeItem(key);else store.setItem(key,before[key]);}catch(_){}}
  throw Error('저장 공간에 기록을 복원하지 못했습니다.');
 }
 return written;
}
function mount(){
 const doc=g.document,host=doc?.getElementById?.('tower-record-panel');
 if(!host||host.querySelector?.('#arena-save-backup'))return false;
 const section=doc.createElement('section');section.id='arena-save-backup';section.className='tower-record-backup';
 section.innerHTML='<h3>기록 · 캐릭터 백업</h3><p>이 기기에 저장된 탑 기록, 제작 캐릭터, 최종 보스 기록을 파일로 보관합니다. 온라인 업로드는 하지 않습니다.</p>'
  +'<div class="tower-backup-actions"><button type="button" data-backup-export>백업 파일 저장</button><button type="button" data-backup-import>백업 불러오기</button></div>'
  +'<input type="file" data-backup-file accept=".json,application/json" hidden aria-label="오이붕 백업 JSON 선택">'
  +'<p data-backup-status role="status" aria-live="polite"></p>';
 host.append(section);
 const status=section.querySelector('[data-backup-status]'),file=section.querySelector('[data-backup-file]');
 section.querySelector('[data-backup-export]')?.addEventListener('click',()=>{
  try{
   const data=snapshot(g.localStorage),blob=new Blob([data],{type:'application/json'});
   const url=g.URL.createObjectURL(blob),a=doc.createElement('a');
   a.href=url;a.download='oibung-arena-backup.json';a.click();
   g.setTimeout?.(()=>g.URL.revokeObjectURL(url),1000);
   status.textContent='백업 파일을 저장했습니다.';
  }catch(e){status.textContent='저장 실패 · '+e.message;}
 });
 section.querySelector('[data-backup-import]')?.addEventListener('click',()=>file?.click());
 file?.addEventListener('change',async()=>{
  try{
   const selected=file.files?.[0];if(!selected)return;
   if(selected.size>MAX_BYTES)throw Error('2MB 이하 파일만 지원합니다.');
   const data=await selected.text();const entries=parse(data);
   if(g.confirm&&!g.confirm('기존 '+Object.keys(entries).length+'종류의 기록을 백업으로 덮어쓸까요? 복원 전에 현재 기록을 따로 백업하는 것을 권장합니다.'))return;
   restore(g.localStorage,data);
   status.textContent='복원 완료. 화면을 다시 불러옵니다.';
   g.location?.reload?.();
  }catch(e){status.textContent='복원 실패 · '+e.message;}
  finally{file.value='';}
 });
 return true;
}
g.ArenaSaveBackup=Object.freeze({KEYS,FORMAT,snapshot,parse,restore,mount});
if(g.document){
 if(g.document.readyState==='loading')g.document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
}
})(typeof window!=='undefined'?window:globalThis);

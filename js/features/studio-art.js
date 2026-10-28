/* Self-contained custom-fighter portrait studio.
 * JPEG/PNG/WebP upload, pointer drawing, eraser and local persistence.
 * Art is stored per stable profile.artKey, never sent to a server.
 */
(function(global){
'use strict';
const container=document.querySelector('#character-studio-dialog .forge-studio');
if(!container)return;
const STORAGE='oibung-fighter-art-v1:';
const doc=document;
const card=doc.createElement('section');card.className='character-art-editor';
card.innerHTML='<div class="character-art-head"><div><h3>캐릭터 외형 · 직접 그리기</h3><p>사진을 가져오거나 캔버스에 그릴 수 있습니다. 저장 후 전투에 표시됩니다.</p></div></div>'
  +'<div class="character-art-grid"><div class="character-art-canvas-wrap">'
  +'<canvas id="character-art-canvas" width="256" height="256" aria-label="캐릭터 그림판"></canvas>'
  +'</div><div class="character-art-options">'
  +'<label>사진 가져오기<input id="character-art-upload" type="file" accept="image/png,image/jpeg,image/webp"></label>'
  +'<label>펜 색상<input id="character-art-ink" type="color" value="#202b38"></label>'
  +'<label>펜 크기 <output id="character-art-width-text">8</output><input id="character-art-width" type="range" min="2" max="32" value="8"></label>'
  +'<div class="character-art-buttons"><button type="button" id="character-art-pen" aria-pressed="true">그리기</button>'
  +'<button type="button" id="character-art-erase" aria-pressed="false">지우개</button>'
  +'<button type="button" id="character-art-undo">실행 취소</button>'
  +'<button type="button" id="character-art-clear">전체 지우기</button></div>'
  +'<p id="character-art-status" class="bf-helper" role="status" aria-live="polite">사진 없이 저장하면 캐릭터 색 원으로 표시됩니다.</p>'
  +'</div></div>';
// Place the portrait editor alongside appearance controls after quick generation.
const appearanceAnchor=container.querySelector('.forge-name')||container.querySelector('.forge-primary-actions');
if(appearanceAnchor)container.insertBefore(card,appearanceAnchor);
else container.append(card);
const $=id=>doc.getElementById(id);
const canvas=$('character-art-canvas'),ctx=canvas.getContext('2d',{willReadFrequently:false});
if(!ctx)return;
let dirty=false,drawing=false,mode='pen',last=null,history=[];
function blank(){
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
}
blank();
function snapshot(){
  if(history.length>=14)history.shift();
  try{history.push(ctx.getImageData(0,0,canvas.width,canvas.height));}catch(_){}
}
const status=text=>{$('character-art-status').textContent=text;};
function reset(){
  drawing=false;last=null;dirty=false;history=[];
  blank();$('character-art-upload').value='';
  status('새 외형을 만들 수 있습니다. 빈 상태로 저장하면 캐릭터 색 원을 사용합니다.');
}
function selectMode(next){
  mode=next;
  $('character-art-pen').setAttribute('aria-pressed',String(mode==='pen'));
  $('character-art-erase').setAttribute('aria-pressed',String(mode==='erase'));
}
function point(event){
  const rect=canvas.getBoundingClientRect();
  return {
    x:(event.clientX-rect.left)*canvas.width/Math.max(1,rect.width),
    y:(event.clientY-rect.top)*canvas.height/Math.max(1,rect.height)
  };
}
function stroke(a,b){
  const width=Number($('character-art-width').value);
  ctx.strokeStyle=mode==='erase'?'#ffffff':$('character-art-ink').value;
  ctx.fillStyle=ctx.strokeStyle;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.beginPath();ctx.arc(b.x,b.y,width/2,0,Math.PI*2);ctx.fill();
  dirty=true;
}
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==undefined&&event.button!==0)return;
  event.preventDefault();snapshot();
  drawing=true;last=point(event);stroke(last,last);
  try{canvas.setPointerCapture(event.pointerId);}catch(_){}
});
canvas.addEventListener('pointermove',event=>{
  if(!drawing)return;
  event.preventDefault();const next=point(event);stroke(last,next);last=next;
});
const finish=()=>{drawing=false;last=null;};
canvas.addEventListener('pointerup',finish);
canvas.addEventListener('pointercancel',finish);
canvas.addEventListener('lostpointercapture',finish);
$('character-art-width').addEventListener('input',()=>{
  $('character-art-width-text').textContent=$('character-art-width').value;
});
$('character-art-pen').addEventListener('click',()=>selectMode('pen'));
$('character-art-erase').addEventListener('click',()=>selectMode('erase'));
$('character-art-undo').addEventListener('click',()=>{
  if(!history.length)return;
  ctx.putImageData(history.pop(),0,0);dirty=true;status('마지막 그리기를 취소했습니다.');
});
$('character-art-clear').addEventListener('click',reset);
$('character-art-upload').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){
    status('JPG·PNG·WebP, 최대 5MB 파일만 사용할 수 있습니다.');return;
  }
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();
    await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});
    const side=Math.min(img.naturalWidth,img.naturalHeight);
    snapshot();blank();
    ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,
      side,side,0,0,256,256);
    dirty=true;status('사진을 불러왔습니다. 위에 바로 그림을 그릴 수도 있습니다.');
  }catch(_){status('이미지를 열 수 없습니다. 다른 파일을 선택해 주세요.');}
  finally{URL.revokeObjectURL(url);}
});
function key(id){return STORAGE+String(id||'');}
function restore(id,artKey){
  if(!artKey)return false;
  try{
    const src=localStorage.getItem(key(artKey));
    if(!src||!/^data:image\/jpeg;base64,/.test(src))return false;
    global.loadPhoto(id,src);return true;
  }catch(_){return false;}
}
function commit(id){
  const def=global.CUSTOM_DEFS?.find(d=>d.id===id)||
    (typeof CUSTOM_DEFS!=='undefined'?CUSTOM_DEFS.find(d=>d.id===id):null);
  const artKey=def?.forgeData?.artKey;
  if(!def||!artKey)return false;
  if(!dirty){restore(id,artKey);return true;}
  try{
    const src=canvas.toDataURL('image/jpeg',.8);
    localStorage.setItem(key(artKey),src);
    global.loadPhoto(id,src);dirty=false;
    status('그림이 캐릭터와 함께 저장되었습니다.');
    return true;
  }catch(_){
    status('사진 저장 공간이 부족합니다. 더 작은 사진을 사용하거나 기존 캐릭터 그림을 삭제해 주세요.');
    return false;
  }
}
function remove(artKey){
  if(!artKey)return;
  try{localStorage.removeItem(key(artKey));}catch(_){}
}
function restoreAll(){
  const defs=typeof CUSTOM_DEFS==='undefined'?[]:CUSTOM_DEFS;
  defs.filter(d=>d.forgeData?.artKey).forEach(d=>restore(d.id,d.forgeData.artKey));
}
global.CharacterStudioArt={reset,commit,restore,restoreAll,remove,
  get hasArtwork(){return dirty;},get canvas(){return canvas;}};
restoreAll();
})(window);

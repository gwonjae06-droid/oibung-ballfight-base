/* High-DPI arena backing store: physics and game coordinates remain logical. */
(function(global){
'use strict';
const node=global.document?.getElementById?.('arena');
const proto=global.HTMLCanvasElement?.prototype;
const nativeW=proto&&Object.getOwnPropertyDescriptor(proto,'width');
const nativeH=proto&&Object.getOwnPropertyDescriptor(proto,'height');
if(!node||!nativeW?.get||!nativeW?.set||!nativeH?.get||!nativeH?.set)return;
const context=node.getContext('2d');
let logicalW=nativeW.get.call(node),logicalH=nativeH.get.call(node);
let scale=1;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function desiredScale(){
  const dpr=clamp(Number(global.devicePixelRatio)||1,1,2.5);
  // Cap canvas backing dimensions to prevent 10-player, 2x-speed GPU overload.
  return Math.max(1,Math.min(dpr,2300/Math.max(logicalW,logicalH)));
}
function sync(force=false){
  const next=desiredScale();
  const w=Math.max(1,Math.round(logicalW*next)),h=Math.max(1,Math.round(logicalH*next));
  if(force||nativeW.get.call(node)!==w||nativeH.get.call(node)!==h||scale!==next){
    nativeW.set.call(node,w);nativeH.set.call(node,h);
    scale=next;
    context.setTransform(scale,0,0,scale,0,0);
    context.imageSmoothingEnabled=true;
    if('imageSmoothingQuality'in context)context.imageSmoothingQuality='high';
  }
  return scale;
}
Object.defineProperties(node,{
  width:{configurable:true,get(){return logicalW;},set(value){
    logicalW=clamp(Math.round(Number(value)||500),1,3000);sync(true);
  }},
  height:{configurable:true,get(){return logicalH;},set(value){
    logicalH=clamp(Math.round(Number(value)||500),1,3000);sync(true);
  }}
});
sync(true);
global.addEventListener?.('resize',()=>sync());
global.ArenaResolution={sync,get scale(){return scale;},
  get logicalWidth(){return logicalW;},get logicalHeight(){return logicalH;},
  get pixelWidth(){return nativeW.get.call(node);},
  get pixelHeight(){return nativeH.get.call(node);}};
})(window);

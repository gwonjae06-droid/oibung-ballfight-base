/* Shared splitshot kinematics: combat and read-only mini-lab.
 * This module owns ONLY geometry; hit authorization, FX, and damage
 * remain with the authoritative combat simulation.
 */
(function(g){'use strict';
const SPLIT_PROGRESS=.56,MAX_DEPTH=3,REACH=95;
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
function rootTravel(sx,sy,tx,ty,speed){
 const distance=Math.hypot(tx-sx,ty-sy);
 return clamp(Math.ceil(distance/(Math.max(2,Number(speed)||6)*.5)),24,72);
}
function childTravel(speed){
 return clamp(Math.ceil(REACH/Math.max(2,Number(speed)||6)),10,40);
}
function childEndpoints(x,y,radius,count,width,height){
 const n=clamp(Math.round(Number(count)||1),1,8);
 const reach=Math.min(REACH,Number(radius)||REACH);
 return Array.from({length:n},(_,j)=>{
  const theta=j/n*Math.PI*2;
  return {x:clamp(x+Math.cos(theta)*reach,15,width-15),
          y:clamp(y+Math.sin(theta)*reach,15,height-15),theta};
 });
}
function shouldSplit(kind,age,travel,remaining){
 return (kind==='splitshot'||kind==='fragment'&&remaining>1)
   &&age/Math.max(1,travel)>=SPLIT_PROGRESS;
}
g.ArenaSplitshotGeometry=Object.freeze({
 SPLIT_PROGRESS,MAX_DEPTH,REACH,rootTravel,childTravel,childEndpoints,shouldSplit
});
})(typeof window!=='undefined'?window:globalThis);

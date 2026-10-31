/* One shared 2.5D visual language across combat, authored skills and towers.
 * This renderer does not read/write hitboxes, player physics or HP.
 * World-layer ground discs project with ArenaDepth.projectWorld; upright fins
 * stand between ground plane and their aerial caps. Cost is bounded per frame.
 */
(function(g){'use strict';
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let quiet=false,items=0,ceiling=140;
function setReduced(v){quiet=!!v;}
function beginFrame(density=0){items=0;ceiling=quiet?18:density>=65?35:density>=30?70:140;}
function floor(x,y){if(!(g.ArenaTower?.active&&g.ArenaScreenRouter?.active==='tower'))return 0;
 const z=Number(g.ArenaTowerTerrain?.worldHeight?.(x,y));return Number.isFinite(z)?clamp(z,-120,180):0;}
function altitude(p){const z=Number(g.AdvancedCombat?.visibleHeight?.(p));return Number.isFinite(z)?z:Math.max(0,Number(p?.z)||0);}
function canDraw(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&x>-180&&x<700&&y>-180&&y<700;}
function ellipse(c,x,y,rx,ry){c.beginPath();c.ellipse(x,y,Math.max(.2,rx),Math.max(.2,ry),0,0,TAU);}
function ground(c,x,y,r,color='#8ce9ff',alpha=.55,kind='circle'){
 if(!c||!canDraw(x,y)||!(r>0)||items++>=ceiling)return false;
 const yy=y-floor(x,y),radius=clamp(r,3,260);
 c.save();c.globalAlpha*=clamp(alpha,0,1);c.strokeStyle=color;c.lineWidth=kind==='warning'?2.3:1.75;
 if(kind==='warning')c.setLineDash?.([7,6]);
 ellipse(c,x,yy,radius,Math.max(2,radius*.35));c.stroke();
 if(!quiet){c.globalAlpha*=.32;c.fillStyle=color;ellipse(c,x,yy,radius*.86,Math.max(2,radius*.26));c.fill();}
 if(kind==='warning')c.setLineDash?.([]);
 c.restore();return true;
}
// Raised beam with true vertical side faces, a shaded width and an elliptical cap.
// Drawn once in projected world space (not in the already transformed air pass).
function column(c,x,y,r,h,color='#8ce9ff',alpha=.67,kind='energy'){
 if(quiet||!c||!canDraw(x,y)||!(h>1)||items++>=ceiling)return false;
 const z=floor(x,y),base=y-z,top=base-clamp(h,3,230),radius=clamp(r,2,90);
 c.save();c.globalAlpha*=clamp(alpha,0,1);
 c.fillStyle=color;c.globalAlpha*=.21;
 c.beginPath();c.moveTo(x-radius,base);c.lineTo(x-radius*.73,top);c.quadraticCurveTo(x,top-radius*.26,x+radius*.73,top);c.lineTo(x+radius,base);c.closePath();c.fill();
 c.globalAlpha=clamp(alpha*.8,0,1);c.strokeStyle=color;c.lineWidth=kind==='lightning'?2.8:1.7;
 for(const side of [-1,1]){c.beginPath();c.moveTo(x+side*radius,base);c.quadraticCurveTo(x+side*radius*.7,top+(base-top)*.45,x+side*radius*.73,top);c.stroke();}
 ellipse(c,x,top,radius*.73,Math.max(2,radius*.23));c.stroke();
 if(kind==='flame'||kind==='storm'){
  c.beginPath();c.moveTo(x-radius*.15,base);c.lineTo(x+radius*.18,base-(base-top)*.55);c.lineTo(x-radius*.13,top);c.stroke();
 }
 c.restore();return true;
}
function impact(c,x,y,r,h,color,age=0,kind='magic'){
 if(!c||!canDraw(x,y))return false;
 const t=clamp(Number(age)||0,0,1);
 ground(c,x,y,r*(.46+.54*t),color,(1-t)*.7);
 column(c,x,y,Math.min(23,r*.32)*(1-.4*t),h*(1-t*.75),color,(1-t)*.67,kind);
 return true;
}
// Air sprites are already projected by ArenaDepth: render at consistent altitude.
// Old world-space painters that know y-z stay untouched; this helper is for
// brand new local-origin sprites only.
function billboard(c,x,y,z,paint){
 if(!c||typeof paint!=='function')return;
 const height=Math.max(0,Number(z)||0),d=g.ArenaDepth;
 if(d?.air){d.air(c,{x,y},height,target=>{target.save();target.translate(x,y-2*height);try{paint(target);}finally{target.restore();}},0);}
 else{c.save();c.translate(x,y-height);try{paint(c);}finally{c.restore();}}
}
g.ArenaFXDepth=Object.freeze({ground,column,impact,billboard,altitude,floor,beginFrame,setReduced,get budget(){return ceiling;},get used(){return items;}});
})(typeof window!=='undefined'?window:globalThis);

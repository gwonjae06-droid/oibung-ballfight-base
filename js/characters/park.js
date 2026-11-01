CHARACTER_DEFS.push({id:'park',name:'박성원',themeColor:'#059669',borderColor:'#047857',tagColor:'#34d399',radius:34,hp:300,maxHp:300,createInstance:(playerNum)=>({id:'park',name:'박성원',playerNum,x:0,y:0,vx:1.2,vy:0.9,radius:34,hp:300,maxHp:300,baseDamage:10,borderColor:'#047857',tagColor:'#34d399',invincible:0,slowTimer:0,slowMultiplier:1,jumpTimer:0,jumpCooldown:260,minJumpCooldown:130,jumpState:'ground',jumpHeight:0,targetLandX:0,targetLandY:0,jumpAirTime:0,postSlamInvincibleDuration:12,getImage:()=>CHARACTER_PHOTOS.park||null,getDisplayName(){if(this.jumpState!=='ground')return '박성원 (🚀 도약!)';if(this.invincible>0)return '박성원 (🛡️ 0.2초 무적!)';return '박성원';},getTag(){if(this.jumpState!=='ground')return{text:'⚡ 공중 도약중',bg:'#d1fae5',color:'#059669',border:'#34d399'};if(this.invincible>0)return{text:'🛡️ 0.2초 무적',bg:'#dcfce7',color:'#15803d',border:'#86efac'};return null;}})});
/* Original automatic attacks now belong exclusively to the shared
 * 100-energy ultimate engine. Keep hooks for older runtime call sites. */
BEHAVIORS.park={order:4,update(self,target){
 return globalThis.ArenaOriginalMomentum?.update?.(self,target,typeof players!=='undefined'?players:[])??false;
},onContact(self,other){
 return globalThis.ArenaOriginalMomentum?.onContact?.(self,other)??false;
}};

CHARACTER_DEFS.push({id:'bae',name:'배서준',themeColor:'#ea580c',borderColor:'#c2410c',tagColor:'#fb923c',radius:34,hp:250,maxHp:250,createInstance:(playerNum)=>({id:'bae',name:'배서준',playerNum,x:0,y:0,vx:1.1,vy:0.9,radius:34,hp:250,maxHp:250,baseDamage:10,borderColor:'#c2410c',tagColor:'#fb923c',invincible:0,slowTimer:0,slowMultiplier:1,skillTimer:0,skillCooldown:240,skillCycle:0,waves:[],getImage:()=>CHARACTER_PHOTOS.bae||null,getDisplayName(){return this.skillCycle===2?'배서준 (🩸 피모으기 준비)':'배서준';},getTag(){return this.skillCycle===2?{text:'🩸 피모으기 준비',bg:'#fee2e2',color:'#dc2626',border:'#f87171'}:{text:'🩸 파동 → 파동 → 피모으기',bg:'#ffedd5',color:'#ea580c',border:'#fb923c'};}})});
/* Original automatic attacks now belong exclusively to the shared
 * 100-energy ultimate engine. Keep hooks for older runtime call sites. */
BEHAVIORS.bae={order:3,update(self,target){
 return globalThis.ArenaOriginalMomentum?.update?.(self,target,typeof players!=='undefined'?players:[])??false;
},onContact(self,other){
 return globalThis.ArenaOriginalMomentum?.onContact?.(self,other)??false;
}};

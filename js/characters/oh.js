CHARACTER_DEFS.push({id:'oh',name:'오슬우',themeColor:'#7e22ce',borderColor:'#dc2626',tagColor:'#f87171',radius:34,hp:250,maxHp:250,createInstance:(playerNum)=>({id:'oh',name:'오슬우',playerNum,x:0,y:0,vx:1,vy:1.1,radius:34,hp:250,maxHp:250,baseDamage:10,borderColor:'#dc2626',tagColor:'#f87171',invincible:0,slowTimer:0,slowMultiplier:1,mode:'boin',modeDuration:300,modeTimer:0,boinMaxSpeed:4.8,boinAccel:0.22,boinDamage:26,charmTimer:0,charmCooldown:120,menheraBaseSpeed:0.7,menheraDamage:5,auraRadius:105,auraPulse:0,shootTimer:0,shootCooldown:50,projectiles:[],poisonTearTimer:0,poisonTearCooldown:72,poisonTears:[],poisonTearDamage:8,poisonSlowDuration:85,poisonSlowMultiplier:0.45,getImage(){return CHARACTER_PHOTOS[this.mode==='boin'?'oh-boin':'oh-menhera']||null;},getDisplayName(){return this.mode==='boin'?'오슬우 (보인고)':'오슬우 (멘헤라)';},getTag(){const b=this.mode==='boin';return{text:b?'보인고':'멘헤라',bg:b?'#fee2e2':'#f3e8ff',color:b?'#dc2626':'#7e22ce',border:b?'#f87171':'#c084fc'};}})});
/* Original automatic attacks now belong exclusively to the shared
 * 100-energy ultimate engine. Keep hooks for older runtime call sites. */
BEHAVIORS.oh={order:1,update(self,target){
 return globalThis.ArenaOriginalMomentum?.update?.(self,target,typeof players!=='undefined'?players:[])??false;
},onContact(self,other){
 return globalThis.ArenaOriginalMomentum?.onContact?.(self,other)??false;
}};

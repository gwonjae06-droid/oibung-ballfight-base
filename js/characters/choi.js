CHARACTER_DEFS.push({id:'choi',name:'최규원',themeColor:'#e11d48',borderColor:'#be123c',tagColor:'#fb7185',radius:34,hp:250,maxHp:250,createInstance:(playerNum)=>({id:'choi',name:'최규원',playerNum,x:0,y:0,vx:1.1,vy:0.9,radius:34,hp:250,maxHp:250,baseDamage:10,borderColor:'#be123c',tagColor:'#fb7185',invincible:0,slowTimer:0,slowMultiplier:1,suneungTimer:0,suneungCooldown:280,suneungState:'normal',nSuCount:1,bullChargePulse:0,suneungMessageTimer:0,suneungMessageText:'',suneungMessageColor:'',suneungHealText:'',getImage:()=>CHARACTER_PHOTOS.choi||null,getDisplayName(){if(this.suneungState==='success')return '최규원 (🔥 미친황소!)';if(this.suneungState==='fail')return '최규원 (💀 수능 망함...)';return `최규원 (${this.nSuCount}수생)`;},getTag(){if(this.suneungState==='success')return{text:'🔥 수능 만점',bg:'#ffe4e6',color:'#e11d48',border:'#f43f5e'};if(this.suneungState==='fail')return{text:'💀 수능 폭망',bg:'#f1f5f9',color:'#475569',border:'#94a3b8'};return{text:`${this.nSuCount}수 평타`,bg:'#fef3c7',color:'#d97706',border:'#fbbf24'};}})});
/* Original automatic attacks now belong exclusively to the shared
 * 100-energy ultimate engine. Keep hooks for older runtime call sites. */
BEHAVIORS.choi={order:2,update(self,target){
 return globalThis.ArenaOriginalMomentum?.update?.(self,target,typeof players!=='undefined'?players:[])??false;
},onContact(self,other){
 return globalThis.ArenaOriginalMomentum?.onContact?.(self,other)??false;
}};

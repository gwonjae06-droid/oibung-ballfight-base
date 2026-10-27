/* Signature remixes for five classic fighters.
 * Keeps their recognizable identities; changes cooldown pacing, secondary effects,
 * hit/phase feedback, and cast telegraphs without replacing their registered AI. */
(function(){
  const R=(id,fn)=>{
    const base=BEHAVIORS[id];
    if(!base)return;
    const oldUpdate=base.update,oldContact=base.onContact;
    base.update=function(self,target){fn('before',self,target);
      oldUpdate.call(base,self,target);
      fn('after',self,target);
    };
    if(oldContact)base.onContact=function(self,enemy){
      const oldHP=enemy.hp;
      oldContact.call(base,self,enemy);
      if(enemy.hp<oldHP)fn('hit',self,enemy,oldHP-enemy.hp);
    };
  };
  const fx=(p,kind,label,opt)=>{
    if(!window.BattleFX)return;
    BattleFX.cast(p,kind,Object.assign({label},opt));
  };
  R('bae',(phase,p,target,damage)=>{
    if(phase==='before'){
      p.skillCooldown=p.hp<p.maxHp*.45?160:205;
      p._oldCycle=p.skillCycle;
      p._oldWaves=p.waves.length;
      p._oldHp=p.hp;
    }else if(phase==='after'){
      if(p.skillCycle!==p._oldCycle){
        if(p.skillCycle===0){
          fx(p,'heal','피의 재생',{color:'#ff775d',radius:105});
          p.vx*=1.23;p.vy*=1.23;
        } else fx(p,'wave','혈류 파동',{color:'#ff775d',radius:175});
      }
      if(p._oldHp<p.hp && p.skillCycle!==0 && Math.random()<.1)BattleFX.sound('heal',.5);
    }else if(phase==='hit'){
      fx(p,'dash','흡혈',{color:'#ff8c64'});
    }
  });
  R('oh',(phase,p,target,damage)=>{
    if(phase==='before'){
      p.modeDuration=270;p.charmCooldown=100;p.poisonTearCooldown=65;
      p._oldMode=p.mode;p._oldCharm=p.charmTimer;
      p._oldShoot=p.projectiles.length;p._oldTears=p.poisonTears.length;
    }else if(phase==='after'){
      if(p.mode!==p._oldMode)fx(p,'transform',p.mode==='boin'?'매혹 각성':'독성 영역',{color:p.mode==='boin'?'#ff86ad':'#ba9bff',radius:130});
      if(p.mode==='boin'&&p.charmTimer===0&&p._oldCharm>0){
        fx(p,'wave','매혹',{color:'#ff89c2',radius:145});
      }
      if(p.poisonTears.length>p._oldTears)fx(p,'energy','독눈물',{color:'#c6a7ff',radius:65});
      if(p.projectiles.length>p._oldShoot&&Math.random()<.7)BattleFX.sound('cast',.6);
    }else if(phase==='hit'&&p.mode==='boin'){
      BattleFX.hit(target.x,target.y,'#ff87ad',{heavy:damage>=24});
    }
  });
  R('lee',(phase,p,target,damage)=>{
    if(phase==='before'){
      p.runeDuration=245;p.pokeCooldown=48;
      p._lastRune=p.currentRune;p._pokeBefore=p.pokeAnim;
      p._lastRolling=p.isRolling;
    }else if(phase==='after'){
      if(p.currentRune!==p._lastRune){
        const c={'빙결':'#79e4ff','칼날비':'#ff8c8d','정복자':'#ffb477','치명적속도':'#ffe69a','난입':'#c6a4ff'}[p.currentRune]||'#8ccfff';
        fx(p,'rune',p.currentRune,{color:c,radius:110});
      } else if(p.isRolling&&!p._lastRolling)BattleFX.sound('rune',.6);
      if(p.pokeAnim===1&&target){
        const r={'빙결':'#79e4ff','칼날비':'#ff8585','정복자':'#ffb26d'}[p.currentRune]||'#78d7ff';
        BattleFX.beam(p.x,p.y,target.x,target.y,r);
        if(Math.random()<.4)BattleFX.sound('dash',.6);
      }
    }else if(phase==='hit'){
      BattleFX.hit(target.x,target.y,'#75d9ff',{heavy:damage>=24});
    }
  });
  R('park',(phase,p,target,damage)=>{
    if(phase==='before'){
      p.jumpCooldown=245;p.minJumpCooldown=112;
      p._beforeJump=p.jumpState;
      if(p._aftershockTimer>0&&--p._aftershockTimer===0){
        const near=players.filter(e=>e!==p&&e.hp>0&&e.invincible===0&&Math.hypot(e.x-p.x,e.y-p.y)<105+e.radius);
        near.forEach(e=>{
          e.hp=Math.max(0,e.hp-10);e.invincible=14;
          createHitParticles(e.x,e.y,'#8aefc2',11);
          addFloatingText('-10',e.x,e.y-30,'#8aefc2',16);
        });
        fx(p,'wave','여진',{color:'#8af0be',radius:115});
      }
    }else if(phase==='after'){
      if(p._beforeJump==='ground'&&p.jumpState==='rising'){
        fx(p,'meteor','메테오',{x:p.targetLandX,y:p.targetLandY,color:'#86f0bd',radius:135});
      }
      if(p._beforeJump==='slamming'&&p.jumpState==='ground'){
        p._aftershockTimer=18;
        fx(p,'wave','착지 강타',{color:'#89f5c1',radius:165});
        BattleFX.hit(p.x,p.y,'#9dffd0',{heavy:true});
      }
    }else if(phase==='hit')BattleFX.hit(target.x,target.y,'#9dffd0');
  });
  R('choi',(phase,p,target,damage)=>{
    if(phase==='before'){
      p.suneungCooldown=250;
      p._previousState=p.suneungState;
      p._previousHits=p._furyHits||0;
    }else if(phase==='after'){
      if(p._previousState!==p.suneungState){
        const strong=p.suneungState==='success',weak=p.suneungState==='fail';
        fx(p,weak?'shield':'transform',strong?'미친황소':weak?'탈진':'회복 성공',
          {color:strong?'#ff6f83':weak?'#9da4b6':'#f5c981',radius:strong?145:85});
      }
      if(p.suneungState==='success' && Math.random()<.035){
        BattleFX.cast(p,'dash',{color:'#ff748c'});
      }
    }else if(phase==='hit'){
      if(p.suneungState==='success'){
        p._furyHits=Math.min(5,(p._furyHits||0)+1);
        target.vx+=(target.x-p.x)/(Math.hypot(target.x-p.x,target.y-p.y)||1)*(1+p._furyHits*.45);
        BattleFX.hit(target.x,target.y,'#ff6e83',{heavy:true});
      }else{
        p._furyHits=0;
        BattleFX.hit(target.x,target.y,'#a3a4b5',{heavy:false});
      }
    }
  });
})();

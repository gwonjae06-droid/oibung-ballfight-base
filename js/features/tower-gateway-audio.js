/* Original short brass fanfare, synthesized only on a user-initiated tower entry.
   No external music assets, autoplay, network or timers. */
(function(global){
'use strict';
let audio=null, lastPlayed=0;
function play(){
  const music=global.BackgroundMusic;
  if(music&&(music.muted||!music.enabled||music.volume<=0))return false;
  const Ctor=global.AudioContext||global.webkitAudioContext;
  if(!Ctor)return false;
  try{
    const now=Date.now();
    if(now-lastPlayed<850)return false;
    lastPlayed=now;
    if(!audio||audio.state==='closed')audio=new Ctor();
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    const start=audio.currentTime+.025;
    const master=audio.createGain();
    master.gain.value=Math.min(.24,Math.max(.045,(music?.volume??.35)*.37));
    master.connect(audio.destination);
    // A new original heraldic phrase. Brass is made from a sawtooth with a
    // second low-level triangle oscillator filtered into a short-room echo.
    const phrase=[
      [392,0,.21],[523.25,.23,.21],[659.25,.48,.22],
      [783.99,.77,.44],[659.25,1.30,.19],[783.99,1.52,.22],
      [1046.5,1.80,.72]
    ];
    for(const [freq,at,duration] of phrase){
      const envelope=audio.createGain(),tone=audio.createBiquadFilter();
      tone.type='lowpass';tone.frequency.setValueAtTime(1700,start+at);
      tone.frequency.exponentialRampToValueAtTime(2750,start+at+.09);
      envelope.gain.setValueAtTime(.0001,start+at);
      envelope.gain.exponentialRampToValueAtTime(.45,start+at+.028);
      envelope.gain.setTargetAtTime(.27,start+at+.07,.055);
      envelope.gain.setTargetAtTime(.0001,start+at+duration,.085);
      tone.connect(envelope);envelope.connect(master);
      for(const [kind,vol,detune] of [['sawtooth',.17,0],['triangle',.16,-5],['sawtooth',.045,5]]){
        const osc=audio.createOscillator(),gain=audio.createGain();
        osc.type=kind;osc.frequency.value=freq;osc.detune.value=detune;gain.gain.value=vol;
        osc.connect(gain);gain.connect(tone);osc.start(start+at);osc.stop(start+at+duration+.38);
      }
    }
    return true;
  }catch(_){return false;}
}
global.TowerGatewayAudio={play};
})(globalThis);

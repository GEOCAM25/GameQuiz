// ===== Sonidos (WebAudio, sin archivos) + vibración =====
const Sfx = (() => {
  let ctx = null;
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  const unlock = () => { try { ac().resume(); } catch(e){} };
  document.addEventListener("pointerdown", unlock, { once:true });

  function tone(freq, dur=0.15, type="sine", vol=0.25, when=0){
    try{
      const a = ac(), o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, a.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + when + dur);
      o.connect(g).connect(a.destination);
      o.start(a.currentTime + when); o.stop(a.currentTime + when + dur + 0.05);
    }catch(e){}
  }
  const vib = p => { try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} };

  return {
    click(){ tone(600,0.06,"square",0.12); vib(15); },
    tick(){ tone(880,0.05,"square",0.08); },
    urgent(){ tone(1200,0.07,"square",0.15); vib(30); },
    countdown(){ tone(523,0.2,"triangle",0.3); vib(60); },
    go(){ tone(523,0.12,"triangle",0.3); tone(659,0.12,"triangle",0.3,0.12); tone(784,0.25,"triangle",0.35,0.24); vib([60,40,120]); },
    pick(){ tone(700,0.1,"sine",0.2); vib(25); },
    correct(){ [523,659,784,1047].forEach((f,i)=>tone(f,0.14,"triangle",0.3,i*0.09)); vib([50,30,50,30,120]); },
    wrong(){ tone(220,0.3,"sawtooth",0.22); tone(180,0.35,"sawtooth",0.2,0.1); vib([200]); },
    board(){ tone(440,0.1,"triangle",0.2); tone(554,0.1,"triangle",0.2,0.1); },
    msg(){ tone(900,0.08,"sine",0.15); },
    join(){ tone(659,0.1,"triangle",0.2); tone(880,0.15,"triangle",0.2,0.1); },
    leave(){ tone(440,0.12,"triangle",0.2); tone(330,0.2,"triangle",0.2,0.12); },
    fanfare(){ [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,0.22,"triangle",0.32,i*0.14)); vib([100,50,100,50,300]); },
  };
})();

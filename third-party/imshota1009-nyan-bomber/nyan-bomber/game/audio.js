'use strict';
/* ============================================================
   audio.js — WebAudio synth SE / voices / BGM sequencer
   ============================================================ */
let AC=null, seGain=null, bgmGain=null;
function ensureAC(){
  if(AC){ if(AC.state==='suspended') AC.resume(); return; }
  AC=new (window.AudioContext||window.webkitAudioContext)();
  seGain=AC.createGain(); seGain.connect(AC.destination);
  bgmGain=AC.createGain(); bgmGain.connect(AC.destination);
  applyVolumes();
  if(BGM.pend){ startBGM(BGM.pend); BGM.pend=null; }
}
function applyVolumes(){
  if(!AC) return;
  seGain.gain.value=(SAVE.volSE/100)*0.6;
  bgmGain.gain.value=(SAVE.volBGM/100)*0.3;
}
function tone(f0,f1,dur,type,vol,delay,dest){
  if(!AC) return;
  type=type||'sine'; vol=vol===undefined?0.2:vol; delay=delay||0;
  const t0=AC.currentTime+delay;
  const o=AC.createOscillator(), g=AC.createGain();
  o.type=type; o.frequency.setValueAtTime(f0,t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t0+dur);
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.exponentialRampToValueAtTime(vol,t0+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g); g.connect(dest||seGain); o.start(t0); o.stop(t0+dur+0.02);
}
function noiseBurst(dur,vol,fc,delay){
  if(!AC) return;
  delay=delay||0;
  const t0=AC.currentTime+delay;
  const n=Math.max(1,Math.floor(AC.sampleRate*dur));
  const buf=AC.createBuffer(1,n,AC.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const src=AC.createBufferSource(); src.buffer=buf;
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=fc;
  const g=AC.createGain(); g.gain.value=vol;
  src.connect(f); f.connect(g); g.connect(seGain); src.start(t0);
}
const CHAIN_NOTES=[523,587,659,784,880,1047,1175,1319,1568];
const sfx={
  colon(){ tone(520,240,.13,'square',.14); tone(900,500,.08,'sine',.1,.02); },     // 設置「コロン♪」
  tick(){ tone(1300,1100,.045,'square',.05); },
  popon(big){ noiseBurst(.3,.42,big?900:700); tone(300,80,.18,'triangle',.32); tone(170,50,.34,'sine',.42,.03); }, // 爆発「ポポン！」
  chain(n){ const f=CHAIN_NOTES[clamp(n,0,CHAIN_NOTES.length-1)]; tone(f,f*1.01,.16,'triangle',.3); tone(f*2,f*2,.1,'sine',.14,.05); },
  bloom(){ tone(880,1760,.18,'sine',.09); },
  poyon(){ tone(140,520,.22,'sine',.28); tone(420,90,.18,'triangle',.18,.1); },    // 撃破「ポヨン！」
  poof(){ noiseBurst(.15,.2,1400); },
  piron(){ tone(880,880,.07,'square',.13); tone(1320,1320,.12,'square',.13,.07); },// アイテム「ピロン♪」
  powerup(){ [660,880,1100,1320].forEach((f,i)=>tone(f,f,.09,'square',.13,i*0.055)); },
  nya(){ tone(720,1050,.08,'sine',.2); tone(1050,620,.16,'sine',.18,.08); },       // 「にゃ〜！」
  nyat(){ tone(820,1150,.06,'sine',.18); tone(1150,760,.08,'sine',.15,.06); },     // 「にゃっ！」
  myat(){ tone(600,180,.22,'sawtooth',.2); tone(900,300,.14,'sine',.16,.02); },    // 「ミャッ！」
  nyaan(){ tone(700,520,.2,'sine',.16); tone(520,300,.4,'sine',.14,.2); },         // 「にゃ〜ん…」
  hurt(){ tone(300,80,.3,'sawtooth',.24); },
  dash(){ noiseBurst(.12,.14,2400); tone(300,700,.1,'sine',.1); },
  vine(){ noiseBurst(.2,.18,900); tone(180,420,.25,'triangle',.14); },
  trap(){ tone(760,180,.2,'square',.16); tone(240,140,.25,'triangle',.2,.06); },
  dig(){ noiseBurst(.25,.25,500); },
  splash(){ noiseBurst(.3,.3,600); tone(500,150,.25,'sine',.15); },
  gust(){ noiseBurst(.5,.16,1600); },
  freeze(){ tone(1600,2400,.15,'sine',.12); tone(2400,1200,.2,'sine',.1,.12); },
  barrier(){ tone(400,900,.14,'triangle',.2); },
  caw(){ tone(900,500,.12,'sawtooth',.13); tone(850,480,.12,'sawtooth',.11,.13); },
  clap(){ for(let i=0;i<6;i++) noiseBurst(.06,.14,3000,i*.09); },
  warn(){ tone(980,980,.09,'square',.14); tone(980,980,.09,'square',.14,.16); },
  gateOpen(){ [523,659,784].forEach((f,i)=>tone(f,f,.14,'triangle',.18,i*.09)); },
  roar(){ tone(120,60,.6,'sawtooth',.35); noiseBurst(.5,.3,300); },
  drill(){ for(let i=0;i<5;i++) noiseBurst(.05,.18,900,i*.06); },
  timeAlert(){ tone(1200,1200,.08,'square',.15); },
  fanfare(){ [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,f,.16,'triangle',.22,i*0.11)); },
  over(){ [440,415,392,330].forEach((f,i)=>tone(f,f*0.98,.3,'triangle',.2,i*0.22)); },
  select(){ tone(700,1000,.08,'square',.12); },
};

/* ---------------- BGM sequencer (16-step loop, 8th notes) ---------------- */
const m2f = m => 440*Math.pow(2,(m-69)/12);
const BGM_PATS={
  title:{ bpm:112, hat:false,
    bass:[36,0,43,0,45,0,43,0, 36,0,43,0,41,0,43,0],
    mel:[72,0,76,79,0,76,0,72, 69,0,72,76,0,74,72,0] },
  s1:{ bpm:132, hat:true,
    bass:[36,0,43,0,45,0,43,0, 36,0,43,0,41,0,43,0],
    mel:[72,0,76,79,0,76,74,0, 69,0,72,76,0,74,72,0] },
  s2:{ bpm:142, hat:true,
    bass:[38,0,45,0,42,0,45,0, 38,0,45,0,43,0,45,0],
    mel:[74,0,78,81,0,78,76,0, 74,76,78,0,81,0,78,0] },
  s3:{ bpm:116, hat:false,
    bass:[33,0,40,0,36,0,40,0, 31,0,38,0,36,0,38,0],
    mel:[69,0,72,0,74,0,72,69, 0,67,69,72,0,69,67,0] },
  s4:{ bpm:104, hat:false,
    bass:[41,0,0,48,0,0,45,0, 41,0,0,48,0,50,48,0],
    mel:[77,0,0,81,0,84,0,81, 0,79,77,0,79,0,77,0] },
  s5:{ bpm:152, hat:true,
    bass:[33,33,0,33,36,0,33,0, 31,31,0,31,38,0,36,0],
    mel:[0,0,69,0,0,68,0,66, 0,0,69,0,72,0,69,68] },
  end:{ bpm:96, hat:false,
    bass:[36,0,0,43,0,0,45,0, 41,0,0,48,0,0,43,0],
    mel:[72,0,76,0,79,0,84,0, 81,0,79,0,76,0,72,0] },
};
const BGM={ on:false, pat:null, step:0, nextT:0, pend:null };
function startBGM(key){
  if(!AC){ BGM.pend=key; return; }
  BGM.pat=BGM_PATS[key]||BGM_PATS.s1; BGM.on=true; BGM.step=0;
  BGM.nextT=AC.currentTime+0.06;
}
function stopBGM(){ BGM.on=false; }
function updateBGM(){
  if(!AC||!BGM.on||!BGM.pat) return;
  const stepDur=60/BGM.pat.bpm/2;
  while(BGM.nextT<AC.currentTime+0.18){
    const s=BGM.step%16, t0=BGM.nextT;
    const b=BGM.pat.bass[s];
    if(b){ const o=AC.createOscillator(),g=AC.createGain();
      o.type='square'; o.frequency.value=m2f(b);
      g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(.09,t0+.01);
      g.gain.exponentialRampToValueAtTime(.0001,t0+.2);
      o.connect(g); g.connect(bgmGain); o.start(t0); o.stop(t0+.22); }
    const m=BGM.pat.mel[s];
    if(m){ const o=AC.createOscillator(),g=AC.createGain();
      o.type='triangle'; o.frequency.value=m2f(m);
      g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(.075,t0+.01);
      g.gain.exponentialRampToValueAtTime(.0001,t0+.16);
      o.connect(g); g.connect(bgmGain); o.start(t0); o.stop(t0+.18); }
    BGM.step++; BGM.nextT+=stepDur;
  }
}

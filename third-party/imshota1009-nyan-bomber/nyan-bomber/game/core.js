'use strict';
/* ============================================================
   core.js — shared state, constants, input, save data
   ============================================================ */
const $ = s => document.querySelector(s);
const clamp = (v,a,b) => v<a?a:(v>b?b:v);
const lerp = (a,b,t) => a+(b-a)*t;
const rnd = (a=1,b) => b===undefined ? Math.random()*a : a+Math.random()*(b-a);
const rndi = (a,b) => Math.floor(rnd(a,b+1));
const TAU = Math.PI*2;
const easeOutBack = t => { const c=1.70158; t-=1; return 1 + t*t*((c+1)*t + c); };

/* grid */
const COLS=15, ROWS=13;
const CX=(COLS-1)/2, CZ=(ROWS-1)/2;
const W = c => c-CX;
const Z = r => r-CZ;
const K = (c,r) => c+r*COLS;
const inB = (c,r) => c>=0&&c<COLS&&r>=0&&r<ROWS;

/* board state: grid = obstacles (0 empty / 1 hard / 2 soft)
   terra = ground type (0 grass / 1 water / 2 ice / 3 leaf pile) */
const grid=new Uint8Array(COLS*ROWS);
const terra=new Uint8Array(COLS*ROWS);
const softMap=new Map(), bombMap=new Map(), blastMap=new Map(), powerMap=new Map(), slimeMap=new Map();
const terraMeshes=new Map(), leafItems=new Map();
let bombs=[], enemies=[], vines=[], events=[], spawnQueue=[], projs=[];
let bloomed=new Set(), floorTotal=1;
let gate={ cell:-1, revealed:false, mesh:null };
let wind={ next:8, t:0, dir:{x:1,z:0} };
let BOSS=null;
let shake=0;

/* global game state */
const G={
  state:'title', stage:1, t:0, timeLimit:60, timeLeft:60,
  score:0, kills:0, hearts:3, chainNow:1, chainMax:1, comboT:0,
  fert:0, tookDamage:false, gateExit:false, snapshot:null, alertOn:false,
};
function later(d,f){ events.push({t:G.t+d,f}); }
function addScore(n){ const v=G.fert>0? n*2 : n; G.score+=v; return v; }

/* playable cats (spec 6.1) */
const CATS={
  anzu:{ name:'あんず', breed:'三毛猫・バランス', desc:'初心者向け\nオールマイティ',
    base:0xfff6ec, ear:0xffd9c4, patches:[[0xf59b42,-.16,.42,.12],[0x4a4a52,.15,.46,-.05],[0xf59b42,.05,.75,.14]],
    bombs:3, range:2, speed:3.6, sBomb:3,sFire:3,sSpd:3 },
  kuromame:{ name:'くろまめ', breed:'黒猫・スピード', desc:'1.3倍速で駆ける\n韋駄天ステップ',
    base:0x3a3a46, ear:0x2c2c36, patches:[], eyeColor:0xffd24a,
    bombs:2, range:1, speed:4.68, sBomb:2,sFire:1,sSpd:5 },
  mofuko:{ name:'もふこ', breed:'アメショ・パワー', desc:'爆弾4個＆爆風3マス\nじゅうたん爆撃',
    base:0xb9bfc9, ear:0xa8aeb8, patches:[[0x8a92a0,-.14,.44,.1],[0x8a92a0,.16,.4,-.02],[0x8a92a0,0,.72,-.12]],
    bombs:4, range:3, speed:2.9, sBomb:5,sFire:5,sSpd:2 },
  yuki:{ name:'ゆき', breed:'白猫・アイス（隠し）', desc:'爆風が氷結して\n敵をこおらせる',
    base:0xffffff, ear:0xcfe4f2, patches:[], eyeColor:0x4ea8f2,
    bombs:3, range:2, speed:3.6, sBomb:3,sFire:3,sSpd:3, ice:true },
};
const P={ x:1, z:1, dir:{x:0,z:1}, lastDir:{x:0,z:1}, mesh:null, catKey:'anzu', def:CATS.anzu,
  bombMax:3, range:2, speedLv:0, vines:0, active:0, inv:0, pawNext:false,
  dashT:0, dashCd:0, alive:true, walkPh:0, yaw:0, deadT:0, sliding:false };
function setCat(key){
  P.catKey=key; P.def=CATS[key];
  P.bombMax=P.def.bombs; P.range=P.def.range; P.speedLv=0; P.vines=0; P.pawNext=false;
}

/* input */
const keys={}, jp=new Set();
const KEYMAP={
  arrowleft:'L', a:'L', arrowright:'R', d:'R', arrowup:'U', w:'U', arrowdown:'D', s:'D',
  ' ':'B', z:'B', x:'V', shift:'DASH', escape:'P', p:'P', enter:'E', c:'CAM'
};
addEventListener('keydown',e=>{
  const k=KEYMAP[e.key.toLowerCase()];
  if(k){ e.preventDefault(); ensureAC(); if(!keys[k]) jp.add(k); keys[k]=true; }
});
addEventListener('keyup',e=>{ const k=KEYMAP[e.key.toLowerCase()]; if(k) keys[k]=false; });
addEventListener('pointerdown',()=>ensureAC());

/* ---------------- save data (localStorage) ---------------- */
function loadSave(){
  const def={ unlocked:1, seenOp:false, tutorialDone:false, records:{}, ach:{},
    vineCatch:0, charClears:{}, yuki:false, volBGM:55, volSE:70 };
  try{ return Object.assign(def, JSON.parse(localStorage.getItem('NB_SAVE')||'{}')); }
  catch(e){ return def; }
}
const SAVE=loadSave();
function persist(){ try{ localStorage.setItem('NB_SAVE',JSON.stringify(SAVE)); }catch(e){} }

function hasSaveData(){
  return SAVE.unlocked>1||SAVE.tutorialDone||Object.keys(SAVE.records).length>0||Object.keys(SAVE.ach).length>0;
}
function resetSave(){
  const keep={volBGM:SAVE.volBGM, volSE:SAVE.volSE};
  for(const k of Object.keys(SAVE)) delete SAVE[k];
  Object.assign(SAVE,{ unlocked:1, seenOp:false, tutorialDone:false, records:{}, ach:{},
    vineCatch:0, charClears:{}, yuki:false, selCat:'anzu' }, keep);
  persist();
}

/* ---------------- achievements (spec 7) ---------------- */
const ACH_DEFS=[
  {id:'bloom1',   name:'初めての開花'},
  {id:'kill1',    name:'初めての撃破'},
  {id:'chain2',   name:'2れんぞく達成'},
  {id:'chain3',   name:'3れんぞく達成'},
  {id:'nodmg',    name:'ノーダメージクリア'},
  {id:'rankS',    name:'Sランク獲得'},
  {id:'vine5',    name:'蔦トラップで5匹キャッチ'},
  {id:'allclear', name:'全ステージクリア'},
  {id:'allS',     name:'全ステージSランク'},
  {id:'allcats',  name:'全キャラでボス撃破'},
];
function unlockAch(id){
  if(SAVE.ach[id]) return;
  SAVE.ach[id]=true; persist();
  const d=ACH_DEFS.find(a=>a.id===id);
  showToast('🏆 実績かいじょ：'+(d?d.name:id));
  if(!SAVE.yuki && ACH_DEFS.every(a=>SAVE.ach[a.id])){
    SAVE.yuki=true; persist();
    setTimeout(()=>showToast('❄ 隠しキャラ「白猫のゆき」がなかまになった！'),1200);
  }
}
function stageClear(){
  G.state='result';
  const timeBonus=Math.max(0,Math.round(G.timeLeft))*10;
  const regenBonus=regenPct()*5;
  G.score+=timeBonus+regenBonus;
  const rank=calcRank();
  if(rank==='S') unlockAch('rankS');
  if(!G.tookDamage) unlockAch('nodmg');
  const isNew=saveRecord(G.stage,rank,G.score);
  if(G.stage>=5){ SAVE.charClears[P.catKey]=true; persist(); }
  checkRankAchievements();
  showClearScreen(rank,timeBonus,regenBonus,isNew);

  // Firebaseへプレイデータを保存
  savePlaySession(G.stage, rank, G.score, G.timeLeft);
}
function checkRankAchievements(){
  const done=[1,2,3,4,5].every(n=>SAVE.records['s'+n]);
  if(done) unlockAch('allclear');
  if([1,2,3,4,5].every(n=>SAVE.records['s'+n]&&SAVE.records['s'+n].rank==='S')) unlockAch('allS');
  if(['anzu','kuromame','mofuko'].every(c=>SAVE.charClears[c])) unlockAch('allcats');
}

/* ---------------- Firebase functions ---------------- */
function savePlaySession(stage, rank, score, timeLeft) {
  try {
    if (typeof firebase !== 'undefined') {
      const db = firebase.firestore();
      db.collection('play_sessions').add({
        stage: stage,
        rank: rank,
        score: score,
        timeLeft: timeLeft,
        catKey: P.catKey,
        catName: P.def.name,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: getOrCreateUserId()
      });
    }
  } catch (e) {
    console.error("Firebase save error:", e);
  }
}

function getOrCreateUserId() {
  if (!SAVE.userId) {
    SAVE.userId = 'user_' + Math.random().toString(36).substring(2, 15);
    persist();
  }
  return SAVE.userId;
}

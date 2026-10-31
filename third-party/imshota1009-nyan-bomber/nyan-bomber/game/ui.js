'use strict';
/* ============================================================
   ui.js — HUD, screens, select, opening, toasts, results
   ============================================================ */
function hideAllScreens(){
  for(const id of ['title','opening','howto','select','pause','clear','gameover','ending','final','confirmNew'])
    $('#'+id).classList.add('hidden');
  $('#tutMsg').classList.add('hidden');
}
function showBanner(txt){
  const b=$('#stageBanner');
  b.textContent=txt;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function showChain(n){
  const b=$('#chainBanner');
  b.textContent=`${n}れんぞく！`;                       // ひらがな表記（spec 5.2）
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function showNice(){
  const b=$('#niceBanner');
  b.textContent='NICE!';
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function showToast(msg){
  const box=$('#toasts');
  const d=document.createElement('div');
  d.className='toast'; d.textContent=msg;
  box.appendChild(d);
  setTimeout(()=>{ if(d.parentNode) box.removeChild(d); },3500);
}
function updateHUD(){
  $('#hearts').textContent='❤'.repeat(Math.max(0,G.hearts))+'♡'.repeat(Math.max(0,Math.max(3,G.hearts)-G.hearts));
  const t=Math.max(0,Math.ceil(G.timeLeft));
  $('#timeNum').textContent=G.timeLimit>500?'∞':t;
  const bar=$('#timeBar');
  bar.style.width=(G.timeLimit>500?100:clamp(G.timeLeft/G.timeLimit*100,0,100))+'%';
  const alert=G.timeLeft<=10&&G.timeLimit<500;
  $('#timeNum').classList.toggle('alert',alert);
  bar.classList.toggle('alert',alert);
  $('#scoreChip').textContent='★ '+G.score;
  $('#regenChip').textContent='🌷 再生度 '+regenPct()+'%';
  const left=enemies.filter(e=>e.state!=='fly').length+spawnQueue.length+(BOSS&&!BOSS.dead?1:0);
  $('#enemyChip').textContent= BOSS? ('🐾 ボス'+(left>1?' +'+(left-1):'')) : ('🐾 のこり '+left+'匹');
  let st=`🌰${P.bombMax-P.active}/${P.bombMax} 🌸${P.range} 👟${P.speedLv+1} 🌿${P.vines}`;
  if(P.pawNext) st+=' 🐾!';
  if(G.fert>0) st+=` ✨${Math.ceil(G.fert)}`;
  $('#statusRow').textContent=st;
}

/* ---------------- title / opening ---------------- */
const OP_SLIDES=[
  ['🌸🏡','「にゃん爺の秘密の庭」は、四季の花が咲きほこる楽園だった。'],
  ['🐱🌷','見習い庭師ネコの「あんず」は、今日も庭のお手入れ。'],
  ['🐱💤','…のはずが、ひなたぼっこでうたた寝している間に！'],
  ['🐹⚡🦔','「モグラ団長ドリル」ひきいる害獣軍団が乱入！'],
  ['🥀😿','花壇はぐちゃぐちゃ。おばあちゃんの庭が、大ピンチ。'],
  ['🌰✨','倉庫のすみで見つけたのは、ふしぎな「種爆弾」。'],
  ['💥🌼','起爆すると…あら不思議、爆風の跡に花が咲いた！'],
  ['🔥🐱🐾','「この庭は、わたしが とりもどすにゃ！」'],
];
let opIdx=0;
function startOpening(){
  hideAllScreens();
  opIdx=0;
  renderOpening();
  $('#opening').classList.remove('hidden');
  G.state='opening';
}
function renderOpening(){
  $('#opArt').textContent=OP_SLIDES[opIdx][0];
  $('#opText').textContent=OP_SLIDES[opIdx][1];
}
function advanceOpening(){
  opIdx++;
  if(opIdx>=OP_SLIDES.length){ finishOpening(); return; }
  sfx.select();
  renderOpening();
}
function finishOpening(){
  SAVE.seenOp=true; persist();
  openSelect();
}

/* ---------------- select screen ---------------- */
let selStage=1;
function catFaceSVG(def){
  const hex=n=>'#'+n.toString(16).padStart(6,'0');
  const base=hex(def.base), ear=hex(def.ear);
  const eye=def.eyeColor?hex(def.eyeColor):'#33333d';
  let patches='';
  (def.patches||[]).forEach((p,i)=>{
    const px=[28,62,45][i%3], py=[30,26,20][i%3];
    patches+=`<ellipse cx="${px}" cy="${py}" rx="12" ry="9" fill="${hex(p[0])}" opacity=".9"/>`;
  });
  return `<svg viewBox="0 0 90 90" class="face">
    <polygon points="18,30 26,4 40,22" fill="${base}" stroke="#00000018"/>
    <polygon points="72,30 64,4 50,22" fill="${base}" stroke="#00000018"/>
    <polygon points="22,24 27,10 35,21" fill="${ear}"/>
    <polygon points="68,24 63,10 55,21" fill="${ear}"/>
    <circle cx="45" cy="48" r="34" fill="${base}"/>
    ${patches}
    <circle cx="33" cy="46" r="4.5" fill="${eye}"/>
    <circle cx="57" cy="46" r="4.5" fill="${eye}"/>
    <ellipse cx="45" cy="60" rx="10" ry="7" fill="#fff"/>
    <path d="M42 57 L48 57 L45 61 Z" fill="#ff9eb8"/>
    <path d="M45 61 Q45 66 40 67 M45 61 Q45 66 50 67" stroke="#8a7a6a" fill="none" stroke-width="1.6"/>
  </svg>`;
}
function openSelect(){
  hideAllScreens();
  renderSelect();
  $('#select').classList.remove('hidden');
  G.state='select';
}
function renderSelect(){
  const box=$('#cards');
  box.innerHTML='';
  const keys=['anzu','kuromame','mofuko'];
  if(SAVE.yuki) keys.push('yuki');
  if(!SAVE.selCat||!keys.includes(SAVE.selCat)) SAVE.selCat='anzu';
  for(const key of keys){
    const d=CATS[key];
    const el=document.createElement('div');
    el.className='card'+(key===SAVE.selCat?' sel':'');
    el.innerHTML=`${catFaceSVG(d)}
      <h3>${d.name}</h3><div class="breed">${d.breed}</div>
      <div class="desc">${d.desc.replace('\n','<br>')}</div>
      <div class="stat"><span>爆弾</span><div class="bar"><i style="width:${d.sBomb*20}%"></i></div></div>
      <div class="stat"><span>爆風</span><div class="bar"><i style="width:${d.sFire*20}%"></i></div></div>
      <div class="stat"><span>速さ</span><div class="bar"><i style="width:${d.sSpd*20}%"></i></div></div>`;
    el.addEventListener('click',()=>{
      sfx.select();
      SAVE.selCat=key; persist();
      renderSelect();
    });
    box.appendChild(el);
  }
  const sl=$('#stageList');
  sl.innerHTML='';
  const tb=document.createElement('button');
  tb.className='stbtn'+(selStage===0?' sel':'');
  tb.innerHTML='<b>Stage 0</b><br>チュートリアル';
  tb.addEventListener('click',()=>{ sfx.select(); selStage=0; renderSelect(); });
  sl.appendChild(tb);
  for(let n=1;n<=5;n++){
    const locked=n>SAVE.unlocked;
    const rec=SAVE.records['s'+n];
    const b=document.createElement('button');
    b.className='stbtn'+(selStage===n?' sel':'')+(locked?' locked':'');
    b.innerHTML=`<b>Stage ${n}</b><br>${STAGES[n].name}`+
      (rec?`<br><span class="rk">${rec.rank}</span> <span class="bs">★${rec.score}</span>`:'<br><span class="bs">'+(locked?'🔒':'未クリア')+'</span>');
    if(!locked) b.addEventListener('click',()=>{ sfx.select(); selStage=n; renderSelect(); });
    sl.appendChild(b);
  }
}

/* ---------------- results ---------------- */
const RANK_WORDS={ S:'伝説の花咲かネコ！ノーダメージ完全勝利！', A:'庭園の守り神！おみごと！',
  B:'よくがんばりました！', C:'ギリギリセーフ…おひるね多め？' };
function calcRank(){
  const allKill=!G.gateExit;
  if(allKill&&G.timeLeft>=G.timeLimit*0.5&&!G.tookDamage) return 'S';
  if(allKill&&G.timeLeft>=G.timeLimit*0.25) return 'A';
  if(G.gateExit&&enemies.length>0) return 'C';
  if(G.timeLeft<5) return 'C';
  return 'B';
}
function saveRecord(n,rank,score){
  const key='s'+n;
  const old=SAVE.records[key];
  const order={S:4,A:3,B:2,C:1};
  const rec=old?{...old}:{score:0,time:999,rank:'C'};
  rec.score=Math.max(rec.score,score);
  rec.time=Math.min(rec.time,Math.round(G.timeLimit-G.timeLeft));
  if(order[rank]>order[rec.rank]) rec.rank=rank;
  SAVE.records[key]=rec;
  SAVE.unlocked=Math.max(SAVE.unlocked,Math.min(5,n+1));
  persist();
  return (!old||score>old.score);
}
function showClearScreen(rank,timeBonus,regenBonus,isNewBest){
  $('#rankBig').textContent=rank;
  $('#rankWord').textContent=RANK_WORDS[rank];
  $('#resTime').textContent=Math.max(0,Math.round(G.timeLeft))+'秒（+'+timeBonus+'）';
  $('#resKill').textContent=G.kills+'匹';
  $('#resChain').textContent='×'+G.chainMax;
  $('#resRegen').textContent=regenPct()+'%（+'+regenBonus+'）';
  $('#resScore').textContent=G.score;
  $('#resBest').textContent=isNewBest?'✨ じこベストこうしん！':'';
  $('#btnNext').textContent= G.stage>=5?'けっか発表へ →':'つぎの庭へ →';
  $('#clear').classList.remove('hidden');
  rankFx(rank);
}
function rankFx(rank){
  if(rank==='S'){ for(let i=0;i<24;i++) later(i*.06,()=>petalBurst(rnd(-6,6),rnd(2,5),rnd(-4,4),6,true)); sfx.fanfare(); }
  else if(rank==='A'){ for(let i=0;i<10;i++) later(i*.08,()=>starBurst(rnd(-5,5),rnd(2,4),rnd(-3,3),4)); sfx.fanfare(); }
  else sfx.fanfare();
}

/* ---------------- pause menu ---------------- */
function openPause(){
  G.state='pause';
  $('#volBGM').value=SAVE.volBGM; $('#volBGMv').textContent=SAVE.volBGM;
  $('#volSE').value=SAVE.volSE; $('#volSEv').textContent=SAVE.volSE;
  $('#pause').classList.remove('hidden');
}
function closePause(){
  $('#pause').classList.add('hidden');
  G.state= TUT? 'tutorial':'play';
}
function wireUI(){
  $('#btnNew').addEventListener('click',()=>{ sfx.nya();
    if(hasSaveData()) $('#confirmNew').classList.remove('hidden');
    else startOpening(); });
  $('#btnWipeYes').addEventListener('click',()=>{ sfx.select();
    resetSave(); $('#confirmNew').classList.add('hidden');
    $('#btnCont').disabled=true; startOpening(); });
  $('#btnWipeCont').addEventListener('click',()=>{ sfx.select();
    $('#confirmNew').classList.add('hidden'); openSelect(); });
  $('#btnWipeNo').addEventListener('click',()=>{ sfx.select();
    $('#confirmNew').classList.add('hidden'); });
  $('#btnCont').addEventListener('click',()=>{ sfx.select(); openSelect(); });
  $('#btnHow').addEventListener('click',()=>{ sfx.select(); hideAllScreens(); $('#howto').classList.remove('hidden'); G.state='howto'; });
  $('#btnHowBack').addEventListener('click',()=>{ sfx.select();
    if(TUT||G.state==='pausedHow'){ $('#howto').classList.add('hidden'); openPause(); }
    else goTitle(); });
  $('#btnTut').addEventListener('click',()=>{ sfx.nya(); startTutorial(); });
  $('#btnSelBack').addEventListener('click',()=>{ sfx.select(); goTitle(); });
  $('#btnGo').addEventListener('click',()=>{ sfx.nya();
    if(selStage===0) startTutorial(); else startRun(selStage); });
  $('#btnResume').addEventListener('click',()=>{ sfx.select(); closePause(); });
  $('#btnPRetry').addEventListener('click',()=>{ sfx.select(); $('#pause').classList.add('hidden'); retryStage(); });
  $('#btnPHow').addEventListener('click',()=>{ sfx.select();
    $('#pause').classList.add('hidden'); $('#howto').classList.remove('hidden'); G.state='pausedHow'; });
  $('#btnPTitle').addEventListener('click',()=>{ sfx.select(); goTitle(); });
  $('#btnNext').addEventListener('click',()=>{ sfx.select();
    if(G.stage>=5) showFinal();
    else{ setCat(P.catKey); G.hearts=Math.max(G.hearts,4); startStage(G.stage+1,true); } });
  $('#btnRetry').addEventListener('click',()=>{ sfx.select(); retryStage(); });
  $('#btnGoSel').addEventListener('click',()=>{ sfx.select(); openSelect(); });
  $('#btnFinSel').addEventListener('click',()=>{ sfx.select(); openSelect(); });
  $('#btnFinTitle').addEventListener('click',()=>{ sfx.select(); goTitle(); });
  $('#volBGM').addEventListener('input',e=>{ SAVE.volBGM=+e.target.value; $('#volBGMv').textContent=SAVE.volBGM; applyVolumes(); persist(); });
  $('#volSE').addEventListener('input',e=>{ SAVE.volSE=+e.target.value; $('#volSEv').textContent=SAVE.volSE; applyVolumes(); persist(); sfx.piron(); });
  $('#btnCont').disabled=!(SAVE.unlocked>1||SAVE.tutorialDone||Object.keys(SAVE.records).length);
}

/* ---------------- ending (spec 7) ---------------- */
const END_LINES=[
  '🌸 「やったにゃ…！庭が、もどってきた！」',
  '🐱 おばあちゃん猫「よくがんばったねぇ、あんず。」',
  '🌷 ふたりの庭に、まんかいの春がやってきた。',
];
function showFinal(){
  hideAllScreens();
  $('#finScore').textContent=G.score;
  $('#finChain').textContent='×'+G.chainMax;
  $('#final').classList.remove('hidden');
  G.state='final';
}

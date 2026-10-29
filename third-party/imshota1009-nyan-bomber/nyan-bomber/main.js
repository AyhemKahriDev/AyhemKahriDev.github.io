'use strict';
/* ============================================================
   main.js — Three.js setup, camera, game loop, stage flow
   ============================================================ */
function initThree(){
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  $('#game').appendChild(renderer.domElement);

  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x9fd9f6);
  scene.fog=new THREE.Fog(0xaee2f8,24,46);

  camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.1,100);
  camera.position.set(0,14,9.4);
  camera.lookAt(0,0,.5);

  hemiLight=new THREE.HemisphereLight(0xeaffff,0x77a868,0.85); scene.add(hemiLight);
  dirLight=new THREE.DirectionalLight(0xfff2d8,0.95);
  dirLight.position.set(7,13,5);
  dirLight.castShadow=true;
  dirLight.shadow.mapSize.set(1024,1024);
  const sc=dirLight.shadow.camera;
  sc.left=-11; sc.right=11; sc.top=11; sc.bottom=-11; sc.far=40;
  dirLight.shadow.bias=-0.0006;
  scene.add(dirLight);

  scene.add(staticGroup,boardGroup,fxGroup);
  buildStaticWorld();
  makeAllPools();
  addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
}

/* ---------------- title 3D backdrop ---------------- */
let titleAngle=0, titleCats=[];
function titleSetup(){
  clearBoard();
  applyTheme(STAGES[1]);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const k=K(c,r);
    if(c===0||c===COLS-1||r===0||r===ROWS-1){ grid[k]=1; continue; }
    if(c%2===0&&r%2===0){ grid[k]=1; boardGroup.add(pos3(makeRock(),c,r)); continue; }
    grid[k]=0;
    if(Math.random()<.16) boardGroup.add(pos3(makeSoftBlock(rndi(0,1)),c,r));
  }
  titleCats=[];
  ['anzu','kuromame','mofuko'].forEach((k,i)=>{
    const m=makeCat(CATS[k]);
    m.position.set(W(5+i*2),0,Z(7));
    boardGroup.add(m); titleCats.push(m);
  });
  startBGM('title');
}
function titleAnim(dt){
  titleAngle+=dt*.12;
  camera.position.set(Math.sin(titleAngle)*10.5,9.5,Math.cos(titleAngle)*10.5);
  camera.lookAt(0,0,0);
  const now=performance.now()/1000;
  titleCats.forEach((m,i)=>{
    m.position.y=Math.abs(Math.sin(now*3+i*1.1))*.12;
    m.rotation.y=Math.sin(now*.7+i*2)*.6+titleAngle;
    m.userData.tail.rotation.z=1.2+Math.sin(now*5+i)*.4;
  });
}
function goTitle(){
  hideAllScreens();
  $('#hud').classList.add('hidden');
  $('#title').classList.remove('hidden');
  if(TUT) endTutorial();
  G.state='title';
  titleSetup();
  $('#btnCont').disabled=!(SAVE.unlocked>1||SAVE.tutorialDone||Object.keys(SAVE.records).length);
}

/* ---------------- stage flow ---------------- */
let introT=0, wonT=0, endT=0, endLineIdx=0, lastAlertSec=-1;
function startRun(n){
  setCat(SAVE.selCat||'anzu');
  G.score=0; G.hearts=4;
  startStage(n,false);
}
function startStage(n,keepStats){
  hideAllScreens();
  $('#hud').classList.remove('hidden');
  buildStage(n);
  updateHUD();
  lastAlertSec=-1;
  G.state='intro'; introT=1.5;
  showBanner('STAGE '+n+'　'+STAGES[n].name);
}
function retryStage(){
  const s=G.snapshot;
  if(s){ G.score=s.score; P.bombMax=s.bombMax; P.range=s.range; P.speedLv=s.speedLv;
    P.vines=s.vines; P.pawNext=s.pawNext; }
  G.hearts=4;
  startStage(G.stage,true);
}
function winStage(){
  if(G.state!=='play'&&G.state!=='tutorial') return;
  if(G.state==='tutorial'){
    sfx.fanfare();
    showBanner('ステージクリア！');
    endTutorial();
    setTimeout(()=>openSelect(),1600);
    G.state='result';
    return;
  }
  G.state='won'; wonT=0;
  sfx.fanfare();
  showBanner('庭をとりもどした！');
  floodBloom();
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
}
function gameOver(title,msg){
  if(G.state==='over') return;
  G.state='over';
  stopBGM();
  sfx.over();
  $('#goTitle').textContent=title||'にゃんてこった…';
  $('#goMsg').textContent=msg||'庭は害獣たちに占拠されてしまった。';
  $('#goScore').textContent=G.score;
  $('#gameover').classList.remove('hidden');
}

/* ---------------- ending (stage5 clear) ---------------- */
function startEnding(){
  G.state='ending'; endT=0; endLineIdx=-1;
  startBGM('end');
  $('#ending').classList.remove('hidden');
  $('#endText').textContent='';
  floodBloom();
  later(1.5,()=>floodBloom());
  const grandma=makeCat({base:0xf2ede4,ear:0xd8c8b8,patches:[[0xb8a898,-.14,.44,.1]]});
  grandma.scale.setScalar(.92);
  grandma.position.set(W(P.x)+1.2,0,Z(P.z));
  boardGroup.add(grandma);
  titleCats=[grandma];
}
function endingUpdate(dt){
  endT+=dt;
  const idx=Math.min(END_LINES.length-1,Math.floor(endT/3));
  if(idx!==endLineIdx){ endLineIdx=idx; $('#endText').textContent=END_LINES[idx]; sfx.bloom(); }
  if(Math.random()<.1) petalBurst(rnd(-6,6),rnd(2,5),rnd(-4,4),4,true);
  if(titleCats[0]){
    titleCats[0].userData.tail.rotation.z=1.2+Math.sin(endT*5)*.4;
    titleCats[0].position.y=Math.abs(Math.sin(endT*3))*.08;
  }
  if(P.mesh){ P.mesh.rotation.y+=dt*.5; }
  if(endT>=10){
    $('#ending').classList.add('hidden');
    stageClear();
    $('#clear').classList.add('hidden');
    showFinal();
  }
}

/* ---------------- per-frame game step ---------------- */
function step(dt,active){
  for(let i=events.length-1;i>=0;i--){
    if(events[i].t<=G.t){ const f=events[i].f; events.splice(i,1); f(); }
  }
  if(active){
    for(let i=spawnQueue.length-1;i>=0;i--){
      if(spawnQueue[i].t<=G.t){ spawnEnemy(spawnQueue[i].type); spawnQueue.splice(i,1); }
    }
    if(G.timeLimit<500){
      G.timeLeft-=dt;
      if(G.timeLeft<=10&&G.timeLeft>0){
        const s=Math.ceil(G.timeLeft);
        if(s!==lastAlertSec){ lastAlertSec=s; sfx.timeAlert(); }
      }
      if(G.timeLeft<=0){
        G.timeLeft=0;
        if(P.alive){ P.alive=false; P.deadT=0;
          later(1.0,()=>gameOver('時間切れ…','日が暮れて、害獣たちのやりたい放題に。')); }
      }
    }
    if(G.fert>0) G.fert-=dt;
  }
  updateBombs(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateVines(dt);
  updatePowerups(dt);
  updateSlimes();
  updateWind(dt);
  if(BOSS) updateBoss(dt);
  if(G.state==='play'&&gate.revealed) updateGate(dt);
  for(const [k,t1] of blastMap) if(t1<G.t-.1) blastMap.delete(k);
  if(G.comboT>0){ G.comboT-=dt; if(G.comboT<=0) G.chainNow=1; }
  /* 最後の1匹は場所をピンで教える */
  if(active&&!BOSS&&spawnQueue.length===0){
    const alive=enemies.filter(e=>e.state!=='fly');
    if(alive.length===1){
      G.pingT=(G.pingT||0)-dt;
      if(G.pingT<=0){ G.pingT=1.2; spawnMarker(Math.round(alive[0].x),Math.round(alive[0].z),.9,false); }
    }
  }
  updateHUD();
  if(active&&P.alive&&!BOSS&&enemies.length===0&&spawnQueue.length===0&&G.state==='play'){
    winStage();
  }
}

/* ---------------- camera ---------------- */
let camMode=0, camMix=0;
function updateCamera(dt){
  shake*=Math.exp(-dt*12);
  if(G.state==='title') return;
  camMix=lerp(camMix,camMode,Math.min(1,dt*5));
  const px=W(P.x), pz=Z(P.z);
  const ax=px*.22, ay=14, az=9.4+pz*.1;
  const bx=px*.1, by=17.5, bz=pz*.1+.6;
  const sx=rnd(-1,1)*shake*.18, sz=rnd(-1,1)*shake*.18;
  camera.position.set(lerp(ax,bx,camMix)+sx, lerp(ay,by,camMix), lerp(az,bz,camMix)+sz);
  camera.lookAt(lerp(px*.2,px*.08,camMix),0,lerp(.5+pz*.08,pz*.08,camMix));
}

/* ---------------- main loop ---------------- */
let lastTs=0;
function tick(ts){
  requestAnimationFrame(tick);
  const dt=Math.min(.033,(ts-lastTs)/1000||.016);
  lastTs=ts;

  updateParts(dt); updateFlashes(dt); updateFlowers(dt); updatePaws(dt); updateMarkers(dt);
  updateBGM();
  for(const cl of clouds){ cl.position.x+=cl.userData.vx*dt; if(cl.position.x>16) cl.position.x=-16; }

  switch(G.state){
    case 'title':
      titleAnim(dt);
      if(jp.has('E')) $('#btnNew').click();
      break;
    case 'opening':
      if(jp.has('B')||jp.has('E')) advanceOpening();
      if(jp.has('P')) finishOpening();
      break;
    case 'howto': case 'pausedHow':
      if(jp.has('P')) $('#btnHowBack').click();
      break;
    case 'select':
      if(jp.has('E')) $('#btnGo').click();
      break;
    case 'intro':
      introT-=dt;
      if(introT<=0){ G.state='play'; showBanner('GO!'); }
      break;
    case 'play':
      G.t+=dt;
      step(dt,true);
      if(jp.has('CAM')){ camMode=1-camMode; sfx.select(); }
      if(jp.has('P')) openPause();
      break;
    case 'tutorial':
      G.t+=dt;
      step(dt,false);
      tutUpdate(dt);
      if(jp.has('CAM')){ camMode=1-camMode; sfx.select(); }
      if(jp.has('P')){ endTutorial(); openSelect(); }
      break;
    case 'won':
      G.t+=dt;
      step(dt,false);
      wonT+=dt;
      if(wonT>=2.2) stageClear();
      break;
    case 'pause':
      break;
    case 'result':
      if(jp.has('E')&&!$('#clear').classList.contains('hidden')) $('#btnNext').click();
      break;
    case 'over':
      G.t+=dt;
      step(dt,false);
      if(jp.has('E')) $('#btnRetry').click();
      break;
    case 'ending':
      G.t+=dt;
      step(dt,false);
      endingUpdate(dt);
      break;
    case 'final':
      if(jp.has('E')) $('#btnFinSel').click();
      break;
  }
  updateCamera(dt);
  renderer.render(scene,camera);
  jp.clear();
}

/* ---------------- boot ---------------- */
if(typeof THREE==='undefined'){
  const d=document.createElement('div');
  d.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#87c9ef;font:bold 16px/1.9 sans-serif;color:#3a5a7a;text-align:center;padding:20px;';
  d.innerHTML='3Dライブラリ（Three.js）の読み込みに失敗しました。<br>「vendor/three.min.js」がゲームフォルダにあるか確認するか、<br>インターネットに接続してから再読み込みしてください。';
  document.body.appendChild(d);
}else{
  wireUI();
  initThree();
  titleSetup();
  requestAnimationFrame(tick);
}

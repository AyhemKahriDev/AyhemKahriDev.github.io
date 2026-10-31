'use strict';
/* ============================================================
   tutorial.js — Stage 0：6ステップ学習（spec 2）
   ============================================================ */
let TUT=null;
function startTutorial(){
  hideAllScreens();
  $('#hud').classList.remove('hidden');
  clearBoard();
  G.stage=1;                                    // 桜テーマ流用
  const st=STAGES[1];
  applyTheme(st);
  G.t=0; G.timeLimit=999; G.timeLeft=999;
  G.score=0; G.kills=0; G.hearts=3; G.fert=0;
  G.chainNow=1; G.chainMax=1; G.tookDamage=false; G.gateExit=false;
  shake=0;

  /* 固定ミニレイアウト */
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const k=K(c,r);
    if(c===0||c===COLS-1||r===0||r===ROWS-1){ grid[k]=1; continue; }
    if(c%2===0&&r%2===0){ grid[k]=1; boardGroup.add(pos3(makeRock(),c,r)); continue; }
    grid[k]=0;
  }
  for(const [c,r] of [[5,1],[5,3],[3,5],[7,5],[9,3],[1,7]]){
    grid[K(c,r)]=2;
    const m=pos3(makeSoftBlock(0),c,r); boardGroup.add(m); softMap.set(K(c,r),m);
  }

  setCat(SAVE.selCat||'anzu');
  P.x=1; P.z=1; P.dir={x:0,z:1}; P.lastDir={x:0,z:1};
  P.active=0; P.inv=1.5; P.alive=true; P.deadT=0; P.dashT=0; P.dashCd=0;
  P.bombMax=1; P.range=2;
  P.mesh=makeCat(P.def); boardGroup.add(P.mesh);
  P.mesh.position.set(W(1),0,Z(1));

  TUT={ step:1, moveDist:0, lastX:1, lastZ:1, bombRef:null, escaped:false, waiting:false };
  G.state='tutorial';
  startBGM('title');
  tutShow('① WASD または やじるしキーで うごいてみよう！');
}
function tutShow(msg){
  const d=$('#tutMsg');
  d.textContent=msg;
  d.classList.remove('hidden');
}
function tutNice(next){
  if(!TUT) return;
  TUT.waiting=true;
  sfx.clap();
  showNice();                                     // 「NICE!」＋拍手（spec 2.2）
  later(.9,()=>{ TUT.waiting=false; next(); });
}
function tutEvent(ev,data){
  if(!TUT||TUT.waiting||G.state!=='tutorial') return;
  if(ev==='moved'&&TUT.step===1){
    TUT.moveDist+=Math.abs(P.x-TUT.lastX)+Math.abs(P.z-TUT.lastZ);
    TUT.lastX=P.x; TUT.lastZ=P.z;
    if(TUT.moveDist>2.5) tutNice(()=>{ TUT.step=2;
      tutShow('② スペースキーで 種爆弾を おいてみよう'); });
  }
  else if(ev==='bomb'&&TUT.step===2){
    TUT.bombRef=data; TUT.step=3; TUT.escaped=false;
    tutShow('③ ばくふうから はなれよう！ 赤いマークの外へ！');
    const cells=data.type==='paw'?pawCells(data):crossCells(data);
    for(const cell of cells) spawnMarker(cell.c,cell.r,data.fuse-data.t,true);
  }
  else if(ev==='hurt'&&TUT.step===3){
    TUT.step=2; TUT.bombRef=null;
    tutShow('いたた…！ もういちど。② スペースで爆弾をおいてみよう');
  }
  else if(ev==='item'&&TUT.step===4){
    tutNice(()=>{ TUT.step=5;
      tutShow('⑤ モグラを ばくふうで やっつけよう！');
      spawnEnemy('mole',true); });                // ゆっくりモグラ
  }
  else if(ev==='kill'&&TUT.step===5){
    tutNice(()=>{ TUT.step=6;
      tutShow('⑥ でぐちゲートが ひらいた！ すすもう！');
      gate.cell=K(11,9); gate.revealed=true;
      gate.mesh=makeGate(); pos3(gate.mesh,11,9); gate.mesh.scale.setScalar(.01);
      boardGroup.add(gate.mesh);
      sfx.gateOpen(); });
  }
}
function tutUpdate(dt){
  if(!TUT) return;
  /* step3: 爆発を生き延びたか */
  if(TUT.step===3&&TUT.bombRef&&TUT.bombRef.dead&&!TUT.waiting){
    later(.5,()=>{
      if(!TUT||TUT.step!==3) return;
      tutNice(()=>{ TUT.step=4;
        tutShow('④ うえきばちを こわして アイテムを ゲット！');
        if(!softMap.size){
          grid[K(5,1)]=2;
          const m=pos3(makeSoftBlock(0),5,1); boardGroup.add(m); softMap.set(K(5,1),m);
        }
        TUT.forcedDrop=true; });
    });
    TUT.bombRef=null;
  }
  /* step4: 破壊されたら必ずアイテム */
  if(TUT.step===4&&TUT.forcedDrop&&powerMap.size===0){
    let anyDestroyed=softMap.size<6;
    if(anyDestroyed&&!TUT.dropped){
      // 最後に壊れた場所が分からないため、破壊済みセルへ強制ドロップ
      for(const [c,r] of [[5,1],[5,3],[3,5],[7,5],[9,3],[1,7]]){
        if(grid[K(c,r)]===0&&!powerMap.has(K(c,r))){ spawnPower(c,r,'range'); TUT.dropped=true; break; }
      }
    }
  }
  /* step6: ゲート到達 */
  if(TUT.step===6&&gate.revealed){
    updateGate(dt);
  }
}
function endTutorial(){
  $('#tutMsg').classList.add('hidden');
  SAVE.tutorialDone=true; persist();
  TUT=null;
}

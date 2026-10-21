'use strict';
/* ============================================================
   stage.js — stage data, map generation, seasonal gimmicks
   ============================================================ */
const STAGES={
  1:{ name:'春のはじまり花壇', time:120, bg:0x9fd9f6, fog:0xaee2f8, sun:0xfff2d8, hemi:0x77a868,
      roster:['mole','mole','mole','mole'], soft:.42, bgm:'s1' },
  2:{ name:'夏の恵み菜園', time:120, bg:0x8fd8f8, fog:0xa8e8f8, sun:0xfff8c8, hemi:0x68b868,
      roster:['mole','mole','crow','mole','crow'], soft:.4, water:true, bgm:'s2' },
  3:{ name:'秋の落ち葉庭', time:120, bg:0xf6bd8a, fog:0xf8cd9e, sun:0xffc98a, hemi:0x9a7858,
      roster:['mole','slug','crow','mole','slug','crow'], soft:.4, leaves:true, windOn:true, bgm:'s3' },
  4:{ name:'冬のあたたか温室', time:120, bg:0xcfe4f2, fog:0xdff0f8, sun:0xe8f0ff, hemi:0x8a9aa8,
      roster:['mole','crow','slug','hedgehog','mole','crow','slug'], soft:.38, ice:true, narrow:true, bgm:'s4' },
  5:{ name:'けっせん！ボスの庭', time:150, bg:0x5a6aa8, fog:0x6a7ab8, sun:0xaab8e8, hemi:0x4a5a6a,
      roster:[], soft:.3, boss:true, bgm:'s5' },
};

/* ---------------- static world (lawn/fence/trees/clouds) ---------------- */
function buildStaticWorld(){
  const checker=canvasTex(COLS,ROWS,(g)=>{
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      g.fillStyle=(c+r)%2? '#7cc258':'#8ed06c'; g.fillRect(c,r,1,1);
    }
  });
  checker.magFilter=THREE.NearestFilter; checker.minFilter=THREE.NearestFilter;
  const board=new THREE.Mesh(new THREE.PlaneGeometry(COLS,ROWS), new THREE.MeshLambertMaterial({map:checker}));
  board.rotation.x=-Math.PI/2; board.receiveShadow=true; staticGroup.add(board);

  const apron=new THREE.Mesh(new THREE.PlaneGeometry(46,40), Lam(0x6fb254));
  apron.rotation.x=-Math.PI/2; apron.position.y=-0.03; apron.receiveShadow=true; staticGroup.add(apron);

  const postGeo=new THREE.CylinderGeometry(.07,.09,.62,6);
  const railGeo=new THREE.BoxGeometry(1,.07,.06);
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
    if(c!==0&&c!==COLS-1&&r!==0&&r!==ROWS-1) continue;
    const p=new THREE.Mesh(postGeo,M.fence); p.position.set(W(c),.31,Z(r)); p.castShadow=true; staticGroup.add(p);
    if((r===0||r===ROWS-1)&&c<COLS-1){
      const rl=new THREE.Mesh(railGeo,M.fence); rl.position.set(W(c)+.5,.42,Z(r)); staticGroup.add(rl);
      const rl2=rl.clone(); rl2.position.y=.2; staticGroup.add(rl2);
    }
    if((c===0||c===COLS-1)&&r<ROWS-1){
      const rl=new THREE.Mesh(railGeo,M.fence); rl.rotation.y=Math.PI/2; rl.position.set(W(c),.42,Z(r)+.5); staticGroup.add(rl);
      const rl2=rl.clone(); rl2.position.y=.2; staticGroup.add(rl2);
    }
  }
  for(const [x,z] of [[-9.5,-7.5],[9.5,-7.5],[-9.5,7.5],[9.5,7.5],[-11,0],[11,.8],[0,-8.6]]){
    const t=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.26,1.1,7),M.trunk); trunk.position.y=.55;
    const top=new THREE.Mesh(new THREE.SphereGeometry(1.05,8,7),M.treeTop); top.position.y=1.7; top.scale.y=.85;
    const top2=new THREE.Mesh(new THREE.SphereGeometry(.7,8,7),M.bushHi); top2.position.set(.5,1.35,.3);
    trunk.castShadow=top.castShadow=true;
    t.add(trunk,top,top2); t.position.set(x,0,z); t.scale.setScalar(rnd(.85,1.2)); staticGroup.add(t);
  }
  for(let i=0;i<4;i++){
    const cl=new THREE.Group();
    for(let j=0;j<3;j++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(rnd(.7,1.2),7,6),M.cloud);
      s.position.set(j*1.1-1.1+rnd(-.2,.2),rnd(-.15,.15),rnd(-.3,.3)); s.scale.y=.6; cl.add(s);
    }
    cl.position.set(rnd(-14,14),rnd(6.5,9),rnd(-9,-3));
    cl.userData.vx=rnd(.15,.35);
    staticGroup.add(cl); clouds.push(cl);
  }
}

/* ---------------- board build ---------------- */
function clearBoard(){
  while(boardGroup.children.length) boardGroup.remove(boardGroup.children[0]);
  softMap.clear(); bombMap.clear(); blastMap.clear(); powerMap.clear(); slimeMap.clear();
  terraMeshes.clear(); leafItems.clear();
  bombs=[]; enemies=[]; vines=[]; events=[]; spawnQueue=[]; projs=[];
  bloomed=new Set();
  gate={cell:-1,revealed:false,mesh:null};
  BOSS=null;
  terra.fill(0);
  $('#bossBox').classList.add('hidden');
}
function pos3(m,c,r){ m.position.set(W(c),0,Z(r)); return m; }
function applyTheme(st){
  scene.background.setHex(st.bg); scene.fog.color.setHex(st.fog);
  dirLight.color.setHex(st.sun); hemiLight.groundColor.setHex(st.hemi);
}

function buildStage(n){
  clearBoard();
  G.stage=n;
  const st=STAGES[n];
  G.t=0; G.timeLimit=st.time; G.timeLeft=st.time;
  G.chainMax=1; G.chainNow=1; G.comboT=0; G.kills=0; G.fert=0;
  G.tookDamage=false; G.gateExit=false; G.alertOn=false; shake=0;
  applyTheme(st);
  wind={ next:rnd(6,9), t:0, dir:{x:1,z:0} };

  const reserved=new Set([K(1,1),K(2,1),K(1,2),K(3,1),K(1,3)]);
  const bossZone=st.boss? new Set() : null;
  if(st.boss) for(let r=1;r<=3;r++)for(let c=1;c<COLS-1;c++) bossZone.add(K(c,r));

  /* terrain first */
  if(st.water){
    for(let r=1;r<ROWS-1;r++){
      if(r===4||r===8) continue;                     // 橋
      terra[K(7,r)]=1;
    }
  }
  if(st.ice){
    for(let i=0;i<14;i++){
      const c=rndi(3,COLS-2), r=rndi(1,ROWS-2);
      if(!reserved.has(K(c,r))&&!(c%2===0&&r%2===0)) terra[K(c,r)]=2;
    }
  }

  /* obstacles */
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const k=K(c,r);
    if(c===0||c===COLS-1||r===0||r===ROWS-1){ grid[k]=1; continue; }
    if(c%2===0&&r%2===0){ grid[k]=1; boardGroup.add(pos3(makeRock(),c,r)); continue; }
    grid[k]=0;
    if(terra[k]===1) continue;
    if(reserved.has(k)) continue;
    if(bossZone&&bossZone.has(k)){
      if(Math.random()<.12){ grid[k]=2; const m=pos3(makeSoftBlock(rndi(0,1)),c,r); boardGroup.add(m); softMap.set(k,m); }
      continue;
    }
    let p=st.soft;
    if(st.narrow&&(c%4===1&&r%4===3)&&!reserved.has(k)){ grid[k]=1; boardGroup.add(pos3(makeRock(),c,r)); continue; }
    if(Math.random()<p){
      grid[k]=2;
      const m=pos3(makeSoftBlock(rndi(0,1)),c,r); boardGroup.add(m); softMap.set(k,m);
    }
  }

  /* terrain visuals */
  for(let r=1;r<ROWS-1;r++)for(let c=1;c<COLS-1;c++){
    const k=K(c,r);
    if(terra[k]===1){
      const w=new THREE.Mesh(new THREE.PlaneGeometry(.98,.98),M.water);
      w.rotation.x=-Math.PI/2; w.position.set(W(c),.02,Z(r));
      boardGroup.add(w); terraMeshes.set(k,w);
    }else if(terra[k]===2){
      const iceM=new THREE.Mesh(new THREE.PlaneGeometry(.94,.94),M.ice);
      iceM.rotation.x=-Math.PI/2; iceM.position.set(W(c),.02,Z(r));
      boardGroup.add(iceM); terraMeshes.set(k,iceM);
    }
  }

  /* 落ち葉（隠れアイテム） */
  if(st.leaves){
    let placed=0, tries=0;
    while(placed<9&&tries++<300){
      const c=rndi(1,COLS-2), r=rndi(1,ROWS-2), k=K(c,r);
      if(grid[k]!==0||terra[k]!==0||reserved.has(k)||leafItems.has(k)) continue;
      terra[k]=3;
      const pile=new THREE.Group();
      pile.add(sph(.3,M.leafPile,0,.06,0,1,.25,1), sph(.2,M.autumnHi,.15,.1,.12,1,.3,1), sph(.18,M.leafPile,-.15,.09,-.1,1,.3,1));
      pos3(pile,c,r); boardGroup.add(pile); terraMeshes.set(k,pile);
      if(Math.random()<.6) leafItems.set(k, Math.random()<.5?'heal':(Math.random()<.5?'fert':'paw'));
      placed++;
    }
  }

  /* 出口ゲート（ボス面以外・遠い柔ブロックの下に隠す） */
  if(!st.boss){
    let best=-1, bd=-1;
    for(const [k] of softMap){
      const c=k%COLS, r=(k-c)/COLS;
      const d=Math.abs(c-1)+Math.abs(r-1);
      if(d>bd){ bd=d; best=k; }
    }
    gate.cell=best;
  }

  /* player */
  P.x=1; P.z=1; P.dir={x:0,z:1}; P.lastDir={x:0,z:1};
  P.active=0; P.inv=1.5; P.alive=true; P.deadT=0; P.dashT=0; P.dashCd=0; P.sliding=false;
  P.mesh=makeCat(P.def); boardGroup.add(P.mesh);
  P.mesh.position.set(W(1),0,Z(1));
  P.mesh.scale.setScalar(1); P.mesh.rotation.set(0,0,0);

  /* enemies */
  st.roster.forEach((tp,i)=>{
    if(i<3) spawnEnemy(tp);
    else spawnQueue.push({t:6+(i-2)*6, type:tp});
  });
  if(st.boss) initBoss();

  /* floor total for 再生度 */
  floorTotal=0;
  for(let r=1;r<ROWS-1;r++)for(let c=1;c<COLS-1;c++)
    if(grid[K(c,r)]!==1&&terra[K(c,r)]!==1) floorTotal++;

  G.snapshot={ score:G.score, bombMax:P.bombMax, range:P.range, speedLv:P.speedLv,
    vines:P.vines, pawNext:P.pawNext };
  startBGM(st.bgm);
}
function regenPct(){ return Math.min(100,Math.round(bloomed.size/floorTotal*100)); }

/* ---------------- soft block destruction / gate ---------------- */
function destroySoft(c,r){
  const k=K(c,r);
  grid[k]=0;
  const m=softMap.get(k);
  if(m){ boardGroup.remove(m); softMap.delete(k); }
  for(let j=0;j<4;j++)
    spawnPart(leafPool,W(c),.4,Z(r),rnd(-2,2),rnd(1.5,3.5),rnd(-2,2),rnd(.5,.9),rnd(.8,1.3));
  addScore(10);
  if(k===gate.cell&&!gate.revealed){
    gate.revealed=true;
    gate.mesh=makeGate(); pos3(gate.mesh,c,r); gate.mesh.scale.setScalar(.01);
    boardGroup.add(gate.mesh);
    sfx.gateOpen();
    popup(W(c),1.2,Z(r),'でぐちゲート！','item');
  }else if(Math.random()<.5){
    later(.05,()=>spawnPower(c,r));
  }
}
function updateGate(dt){
  if(!gate.revealed||!gate.mesh) return;
  const s=gate.mesh.scale.x;
  if(s<1) gate.mesh.scale.setScalar(Math.min(1,s+dt*2.5));
  gate.mesh.userData.glow.material.opacity=.4+Math.sin(G.t*5)*.3;
  if(P.alive&&Math.round(P.x)===gate.cell%COLS&&Math.round(P.z)===Math.floor(gate.cell/COLS)){
    G.gateExit=true;
    winStage();
  }
}

/* ---------------- wind gimmick (stage3) ---------------- */
function updateWind(dt){
  if(!STAGES[G.stage].windOn) return;
  if(wind.t>0){
    wind.t-=dt;
    if(Math.random()<.35)
      spawnPart(leafPool, W(rnd(1,COLS-2)), rnd(.3,1.2), Z(rnd(1,ROWS-2)),
        wind.dir.x*rnd(3,5), rnd(.5,1.5), wind.dir.z*rnd(3,5), rnd(.5,.8), rnd(.8,1.2));
  }else{
    wind.next-=dt;
    if(wind.next<=0){
      wind.next=rnd(7,10); wind.t=1.6;
      const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
      const d=dirs[rndi(0,3)];
      wind.dir={x:d[0],z:d[1]};
      sfx.gust();
      popup(W(P.x),1.6,Z(P.z),'かぜ！','item');
      for(const b of bombs) if(!b.dead) later(rnd(.05,.3),()=>windSlideBomb(b));
    }
  }
}

/* ---------------- slime ---------------- */
const slimeGeo=new THREE.CircleGeometry(.36,10);
function dropSlime(c,r){
  const k=K(c,r);
  if(slimeMap.has(k)){ slimeMap.get(k).t1=G.t+4.5; return; }
  const m=new THREE.Mesh(slimeGeo,M.slime);
  m.rotation.x=-Math.PI/2; m.position.set(W(c),.045,Z(r));
  boardGroup.add(m);
  slimeMap.set(k,{t1:G.t+4.5,m});
}
function updateSlimes(){
  for(const [k,s] of slimeMap){
    if(s.t1<G.t){ boardGroup.remove(s.m); slimeMap.delete(k); }
  }
}

/* ---------------- クリア時の庭再生カットイン ---------------- */
function floodBloom(){
  const cells=[];
  for(let r=1;r<ROWS-1;r++)for(let c=1;c<COLS-1;c++)
    if(grid[K(c,r)]!==1&&terra[K(c,r)]!==1) cells.push([c,r]);
  cells.sort(()=>Math.random()-.5);
  cells.forEach(([c,r],i)=>{
    if(i%2===0) later(i*.018,()=>{ spawnFlowerPatch(c,r); if(i%8===0) sfx.bloom(); });
  });
}

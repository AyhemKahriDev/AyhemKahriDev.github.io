'use strict';
/* ============================================================
   boss.js — Stage5 ボス「巨大モグラ団長ドリル」
   HP10 / 3種の攻撃 / 破壊可能な弱点シールド
   ============================================================ */
function initBoss(){
  const mesh=makeBoss();
  mesh.scale.setScalar(1.4);
  boardGroup.add(mesh);
  BOSS={ hp:8, maxHp:8, shield:2, state:'move', t:0, atkT:4,
    x:7, z:2, tx:7, tz:2, mesh, vulnT:0, warnMk:null, hitCd:0, anim:0, dead:false };
  mesh.position.set(W(7),0,Z(2));
  $('#bossBox').classList.remove('hidden');
  updateBossBar();
  sfx.roar();
}
function updateBossBar(){
  $('#bossBar').style.width=Math.max(0,BOSS.hp/BOSS.maxHp*100)+'%';
}
function bossBlastHit(c,r){
  if(!BOSS||BOSS.dead||BOSS.hitCd>0||BOSS.state==='burrow') return;
  if(Math.abs(Math.round(BOSS.x)-c)>1||Math.abs(Math.round(BOSS.z)-r)>1) return;
  BOSS.hitCd=.35;
  if(BOSS.vulnT>0){                                   // 弱点むきだし → ダメージ
    BOSS.hp--;
    updateBossBar();
    sfx.poyon(); sfx.drill();
    const sc=addScore(200*Math.max(1,G.chainNow));
    popup(W(BOSS.x),1.8,Z(BOSS.z),'+'+sc+' ボスにヒット!','gold');
    starBurst(W(BOSS.x),1.2,Z(BOSS.z),6);
    shake=Math.min(.3,shake+.15);
    if(BOSS.hp<=0){ bossDefeat(); return; }
  }else if(BOSS.shield>0){                            // シールド破壊
    BOSS.shield--;
    sfx.barrier();
    dirtBurst(Math.round(BOSS.x),Math.round(BOSS.z),8);
    popup(W(BOSS.x),1.8,Z(BOSS.z),BOSS.shield>0?'シールドにヒビ！':'シールド破壊！','item');
    const sh=BOSS.mesh.userData.shields;
    for(const s of sh) s.visible=BOSS.shield>0||false;
    if(BOSS.shield===1) sh[2].visible=false;
    if(BOSS.shield<=0){
      BOSS.vulnT=6.5; BOSS.state='stun';
      popup(W(BOSS.x),2.2,Z(BOSS.z),'いまだ！弱点をねらえ！','gold');
      sfx.warn();
    }
  }
}
function bossDefeat(){
  BOSS.dead=true;
  stopBGM();
  sfx.roar(); sfx.fanfare();
  addScore(1000);
  G.kills++;
  const bx=Math.round(BOSS.x), bz=Math.round(BOSS.z);
  for(let j=0;j<5;j++)
    later(j*.3,()=>{ spawnFlash(W(bx)+rnd(-1,1),Z(bz)+rnd(-1,1),1.6,.45);
      petalBurst(W(bx),1,Z(bz),12,true); sfx.popon(true); });
  later(1.6,()=>{ boardGroup.remove(BOSS.mesh); starBurst(W(bx),1,Z(bz),12);
    dirtBurst(bx,bz,10); });
  // 手下も一掃
  for(const e of enemies) if(e.state!=='fly') killEnemy(e,bx,bz);
  later(2.2,()=>startEnding());
}
function updateBoss(dt){
  if(!BOSS||BOSS.dead) return;
  BOSS.t+=dt; BOSS.anim+=dt; BOSS.hitCd-=dt;
  const m=BOSS.mesh;
  m.userData.drill.rotation.z+=dt*10;                 // ドリル回転

  if(BOSS.vulnT>0){                                   // スタン（弱点露出）
    BOSS.vulnT-=dt;
    m.position.y=Math.sin(BOSS.anim*20)*.04;
    m.rotation.z=Math.sin(BOSS.anim*10)*.08;
    m.userData.weak.scale.setScalar(1+Math.sin(BOSS.anim*8)*.3);
    if(BOSS.vulnT<=0){
      BOSS.shield=2; BOSS.state='move'; BOSS.atkT=2.5;
      m.rotation.z=0;
      for(const s of m.userData.shields) s.visible=true;
      popup(W(BOSS.x),2,Z(BOSS.z),'シールド再生…','item');
    }
  }
  else if(BOSS.state==='move'){
    // ゆっくり徘徊、通り道の柔ブロックを破壊
    if(Math.abs(BOSS.x-BOSS.tx)<.1&&Math.abs(BOSS.z-BOSS.tz)<.1){
      BOSS.tx=rndi(2,COLS-3); BOSS.tz=rndi(1,4);
    }
    BOSS.x+=Math.sign(BOSS.tx-BOSS.x)*dt*1.1;
    BOSS.z+=Math.sign(BOSS.tz-BOSS.z)*dt*1.1;
    const bc=Math.round(BOSS.x), br=Math.round(BOSS.z);
    if(inB(bc,br)&&grid[K(bc,br)]===2){ destroySoft(bc,br); sfx.drill(); }
    m.position.x=W(BOSS.x); m.position.z=Z(BOSS.z);
    m.position.y=Math.abs(Math.sin(BOSS.anim*6))*.08;
    m.rotation.y=Math.atan2(P.x-BOSS.x,P.z-BOSS.z)*.3;
    BOSS.atkT-=dt;
    if(BOSS.atkT<=0){
      BOSS.atkT=rnd(6,8);
      const roll=Math.random();
      if(roll<.4) bossBurrowAttack();
      else if(roll<.75) bossVolley();
      else bossSummon();
    }
  }
  else if(BOSS.state==='burrow'){
    BOSS.burT+=dt;
    if(BOSS.burT<.5){ m.position.y=-2.4*BOSS.burT; }
    else if(BOSS.burT<1.7){
      m.position.y=-1.4;
      // 警告マーカーがプレイヤーを追う
      if(BOSS.burT>1.2&&!BOSS.lockPos){ BOSS.lockPos={c:Math.round(P.x),r:Math.round(P.z)}; sfx.warn(); }
      if(!BOSS.lockPos&&Math.random()<.3) spawnMarker(Math.round(P.x),Math.round(P.z),.3,true);
      if(BOSS.lockPos&&Math.random()<.5) spawnMarker(BOSS.lockPos.c,BOSS.lockPos.r,.25,true);
    }
    else{
      const lp=BOSS.lockPos||{c:Math.round(P.x),r:Math.round(P.z)};
      BOSS.x=BOSS.tx=lp.c; BOSS.z=BOSS.tz=lp.r;
      m.position.x=W(lp.c); m.position.z=Z(lp.r); m.position.y=0;
      dirtBurst(lp.c,lp.r,14);
      shake=Math.min(.35,shake+.25);
      sfx.roar(); sfx.dig();
      for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++){
        const c=lp.c+dc, r=lp.r+dr;
        if(inB(c,r)&&grid[K(c,r)]===2) destroySoft(c,r);
      }
      if(P.alive&&P.inv<=0&&Math.abs(P.x-lp.c)<=1.3&&Math.abs(P.z-lp.r)<=1.3) hurtPlayer();
      BOSS.state='move'; BOSS.lockPos=null;
    }
  }
  // シールド軌道
  const sh=m.userData.shields;
  for(let i=0;i<sh.length;i++){
    if(!sh[i].visible) continue;
    const a=BOSS.anim*2+i/sh.length*TAU;
    sh[i].position.set(Math.cos(a)*.85,.6+Math.sin(BOSS.anim*3+i)*.1,Math.sin(a)*.85);
    sh[i].rotation.x+=dt*2; sh[i].rotation.y+=dt*3;
  }
  m.userData.weak.visible=BOSS.vulnT>0;
  // 接触ダメージ
  if(P.alive&&P.inv<=0&&BOSS.state!=='burrow'&&Math.abs(BOSS.x-P.x)<.85&&Math.abs(BOSS.z-P.z)<.85) hurtPlayer();
}
function bossBurrowAttack(){
  BOSS.state='burrow'; BOSS.burT=0; BOSS.lockPos=null;
  dirtBurst(Math.round(BOSS.x),Math.round(BOSS.z),10);
  sfx.dig(); sfx.roar();
}
function bossVolley(){
  sfx.caw(); sfx.warn();
  for(let i=0;i<3;i++){
    const tc=clamp(Math.round(P.x)+rndi(-2,2),1,COLS-2);
    const tr=clamp(Math.round(P.z)+rndi(-2,2),1,ROWS-2);
    spawnMarker(tc,tr,1.1,true);
    const mesh=makeAcorn(); mesh.scale.setScalar(1.4); boardGroup.add(mesh);
    projs.push({ mesh, t:-i*.15, dur:1.1, x0:BOSS.x, z0:BOSS.z, x1:tc, z1:tr });
  }
}
function bossSummon(){
  sfx.roar();
  popup(W(BOSS.x),2,Z(BOSS.z),'しゅつげき〜！','item');
  const alive=enemies.filter(e=>e.state!=='fly').length;
  for(let i=0;i<Math.min(2,6-alive);i++) later(i*.4,()=>spawnEnemy('mole'));
}

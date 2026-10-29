'use strict';
/* ============================================================
   enemy.js — 害獣軍団AI（モグラ/カラス/ナメクジ/ハリネズミ）
   ============================================================ */
const ENEMY_DEFS={
  mole:     { speed:1.15,  hp:1, make:makeMole,     fly:false },
  crow:     { speed:1.65,  hp:2, make:makeCrow,     fly:true  },
  slug:     { speed:0.75, hp:1, make:makeSlug,     fly:false },
  hedgehog: { speed:0.95, hp:3, make:makeHedgehog, fly:false },
};
/* モグラの再登場はプレイヤーの近く（追いかけ回さなくて済むように） */
function findCellNearPlayer(){
  for(let i=0;i<120;i++){
    const c=clamp(Math.round(P.x)+rndi(-5,5),1,COLS-2), r=clamp(Math.round(P.z)+rndi(-5,5),1,ROWS-2);
    const k=K(c,r);
    if(grid[k]!==0||bombMap.has(k)||terra[k]===1) continue;
    const d=Math.abs(c-P.x)+Math.abs(r-P.z);
    if(d<2.5||d>7) continue;
    return {c,r};
  }
  return null;
}
function findSpawnCell(minDist){
  for(let i=0;i<250;i++){
    const c=rndi(1,COLS-2), r=rndi(1,ROWS-2);
    const k=K(c,r);
    if(grid[k]!==0||bombMap.has(k)||terra[k]===1) continue;
    if(Math.abs(c-P.x)+Math.abs(r-P.z)<minDist) continue;
    if(enemies.some(e=>Math.abs(e.x-c)<1.1&&Math.abs(e.z-r)<1.1)) continue;
    return {c,r};
  }
  return null;
}
function spawnEnemy(type,slow){
  const cell=findSpawnCell(5.5)||findSpawnCell(3)||{c:COLS-2,r:ROWS-2};
  const def=ENEMY_DEFS[type];
  const mesh=def.make(); boardGroup.add(mesh);
  mesh.position.set(W(cell.c),0,Z(cell.r));
  const e={ type, fly:def.fly, hp:def.hp, speed:def.speed*(slow?.5:1)*(1+.03*(G.stage-1)),
    x:cell.c, z:cell.r, fx:cell.c, fz:cell.r, tx:cell.c, tz:cell.r, prog:1, yaw:0,
    state:'walk', spawnT:.6, trapT:0, hitCd:0, frozen:0, iceCube:null,
    digT:type==='mole'?rnd(12,18):1e9,
    barrier:type==='slug',
    throwT:type==='crow'?rnd(4.5,7):1e9,
    chargeT:type==='hedgehog'?rnd(5,7):1e9, chargeDir:null, stunT:0,
    mesh, anim:rnd(TAU), vy:0, vx:0, vz:0, flyT:0, spinX:0, spinZ:0 };
  if(type!=='slug'&&mesh.userData.barrier) mesh.userData.barrier.visible=false;
  enemies.push(e);
  dirtBurst(cell.c,cell.r,6);
  sfx.poof();
  return e;
}
function passableE(e,c,r){
  if(!inB(c,r)) return false;
  const g=grid[K(c,r)];
  if(g===1) return false;
  if(g===2&&!e.fly) return false;
  if(terra[K(c,r)]===1&&!e.fly) return false;
  if(bombMap.has(K(c,r))&&!e.fly) return false;
  return true;
}
function chooseDir(e){
  const dirs= e.fly? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]  // カラスは斜め移動
                   : [[1,0],[-1,0],[0,1],[0,-1]];
  const cx=Math.round(e.x), cz=Math.round(e.z);
  const cand=[];
  for(const [dx,dz] of dirs){
    if(!passableE(e,cx+dx,cz+dz)) continue;
    let w=1;
    if(dx===Math.sign(e.tx-e.fx)&&dz===Math.sign(e.tz-e.fz)&&(dx||dz)) w+=2.2;
    if(Math.sign(P.x-cx)===Math.sign(dx)&&dx!==0) w+=1.1;
    if(Math.sign(P.z-cz)===Math.sign(dz)&&dz!==0) w+=1.1;
    if(dx===Math.round(e.fx-e.tx)&&dz===Math.round(e.fz-e.tz)) w*=.15;
    cand.push({dx,dz,w});
  }
  if(!cand.length){ e.tx=cx; e.tz=cz; e.prog=1; return; }
  let sum=0; for(const c of cand) sum+=c.w;
  let pick=rnd(sum);
  for(const c of cand){ pick-=c.w; if(pick<=0){ e.fx=cx; e.fz=cz; e.tx=cx+c.dx; e.tz=cz+c.dz; e.prog=0; return; } }
}

/* ---------------- damage / knockback ---------------- */
function hitEnemy(e,oc,or){
  if(e.state==='fly'||e.hitCd>0) return;
  e.hitCd=.5;
  if(e.barrier){                                      // ナメクジ粘液バリア（爆風1回無効）
    e.barrier=false;
    if(e.mesh.userData.barrier) e.mesh.userData.barrier.visible=false;
    sfx.barrier();
    popup(W(e.x),1,Z(e.z),'バリア！','item');
    spawnFlash(W(e.x),Z(e.z),.9,.3,0xb9f28e);
    return;
  }
  e.hp--;
  if(e.hp<=0){ killEnemy(e,oc,or); return; }
  sfx.poyon();
  e.mesh.position.y+=.15;
  spawnFlash(W(e.x),Z(e.z),.7,.25);
  popup(W(e.x),1,Z(e.z),'HP'+e.hp,'');
}
function killEnemy(e,oc,or){
  if(e.state==='fly') return;
  const wasTrapped=e.state==='trapped';
  if(wasTrapped){
    const v=vines.find(v=>v.caught===e);
    if(v){ v.caught=null; vineDie(v); }
    SAVE.vineCatch++;
    if(SAVE.vineCatch>=5) unlockAch('vine5');
    persist();
  }
  if(e.iceCube) e.iceCube.visible=false;
  e.state='fly'; e.flyT=0; e.frozen=0;
  let dx=e.x-oc, dz=e.z-or;
  const len=Math.hypot(dx,dz)||1; dx/=len; dz/=len;
  e.vx=dx*rnd(2.4,4)+rnd(-.6,.6); e.vz=dz*rnd(2.4,4)+rnd(-.6,.6); e.vy=rnd(5.2,7);
  e.spinX=rnd(8,16)*(Math.random()<.5?-1:1); e.spinZ=rnd(8,16)*(Math.random()<.5?-1:1);
  G.kills++;
  unlockAch('kill1');
  const mult=Math.max(1,G.chainNow);
  const sc=addScore(100*mult+(wasTrapped?80:0));
  popup(W(e.x),1.1,Z(e.z),'+'+sc+(mult>1?' れんぞく!':'')+(wasTrapped?' 蔦!':''), mult>1||wasTrapped?'gold':'');
  sfx.poyon();
  tutEvent('kill');
}

/* ---------------- update ---------------- */
function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.anim+=dt; e.hitCd-=dt;
    if(e.spawnT>0){ e.spawnT-=dt;
      e.mesh.scale.setScalar(easeOutBack(clamp(1-e.spawnT/.6,0,1))||.01); }

    if(e.state==='fly'){                               // ふわっと浮いてくるくる吹き飛ぶ
      e.flyT+=dt; e.vy-=12*dt;
      e.mesh.position.x+=e.vx*dt; e.mesh.position.z+=e.vz*dt;
      e.mesh.position.y+=e.vy*dt;
      e.mesh.rotation.x+=e.spinX*dt; e.mesh.rotation.z+=e.spinZ*dt;
      if(e.mesh.position.y<=0.05&&e.vy<0&&!e.landed){  // 着地で星が飛び散る（spec 5.3）
        e.landed=true;
        starBurst(e.mesh.position.x,.3,e.mesh.position.z,5);
        sfx.poyon();
      }
      if(e.flyT>1.5||e.mesh.position.y<-2){
        petalBurst(e.mesh.position.x,Math.max(.3,e.mesh.position.y),e.mesh.position.z,6,false);
        starBurst(e.mesh.position.x,.4,e.mesh.position.z,3);
        sfx.poof();
        boardGroup.remove(e.mesh);
        enemies.splice(i,1);
      }
      continue;
    }

    if(e.frozen>0){                                    // ゆきの氷結
      e.frozen-=dt;
      if(e.frozen<=0&&e.iceCube) e.iceCube.visible=false;
    }
    else if(e.state==='trapped'){
      e.trapT-=dt;
      e.mesh.position.x=W(e.x)+Math.sin(e.anim*30)*.05;
      e.mesh.rotation.z=Math.sin(e.anim*22)*.15;
      if(e.trapT<=0){
        e.state='walk';
        const v=vines.find(v=>v.caught===e);
        if(v){ v.caught=null; vineDie(v); }
      }
    }
    else if(e.state==='burrow'){
      e.burT+=dt;
      if(e.burT<.4) e.mesh.position.y=-2.2*e.burT;
      else if(e.burT<.55){ if(!e.tele){ e.tele=true;
        const cell=findCellNearPlayer()||findSpawnCell(2.5);
        if(cell){ e.x=e.fx=e.tx=cell.c; e.z=e.fz=e.tz=cell.r; e.prog=1;
          e.mesh.position.x=W(cell.c); e.mesh.position.z=Z(cell.r); dirtBurst(cell.c,cell.r,7); sfx.dig(); } } }
      else if(e.burT<.95) e.mesh.position.y=-.88+2.2*(e.burT-.55);
      else{ e.mesh.position.y=0; e.state='walk'; e.digT=rnd(14,20); }
    }
    else if(e.state==='telegraph'){                    // ハリネズミ予備動作
      e.teleT-=dt;
      e.mesh.position.x=W(e.x)+Math.sin(e.anim*40)*.06;
      if(e.mesh.userData.spikes) e.mesh.userData.spikes.scale.setScalar(1+Math.sin(e.anim*20)*.15+.2);
      if(e.teleT<=0){ e.state='charge'; sfx.drill(); }
    }
    else if(e.state==='charge'){                       // ハリネズミ突進
      const d=e.chargeDir;
      const nx=e.x+d.x*4.2*dt, nz=e.z+d.z*4.2*dt;
      const ac=Math.round(nx+d.x*.5), ar=Math.round(nz+d.z*.5);
      if(!passableE(e,ac,ar)&&(Math.abs(ac-Math.round(e.x))+Math.abs(ar-Math.round(e.z))>0)){
        e.state='stun'; e.stunT=1.1;
        shake=Math.min(.3,shake+.12);
        dirtBurst(Math.round(e.x),Math.round(e.z),5);
        sfx.poyon();
      }else{
        e.x=clamp(nx,1,COLS-2); e.z=clamp(nz,1,ROWS-2);
        e.fx=e.tx=Math.round(e.x); e.fz=e.tz=Math.round(e.z); e.prog=1;
        e.mesh.rotation.x+=dt*18;
      }
      e.mesh.position.x=W(e.x); e.mesh.position.z=Z(e.z);
    }
    else if(e.state==='stun'){
      e.stunT-=dt;
      e.mesh.rotation.z=Math.sin(e.anim*14)*.25;
      if(e.stunT<=0){ e.state='walk'; e.mesh.rotation.x=0; e.mesh.rotation.z=0; e.chargeT=rnd(5,7); }
    }
    else{ /* walk */
      if(e.type==='crow'){
        e.throwT-=dt;
        if(e.throwT<=0){ e.throwT=rnd(4.5,7); crowThrow(e); }
      }
      if(e.type==='hedgehog'){
        e.chargeT-=dt;
        if(e.chargeT<=0){
          const adx=Math.abs(P.x-e.x)>Math.abs(P.z-e.z);
          e.chargeDir= adx? {x:Math.sign(P.x-e.x)||1,z:0} : {x:0,z:Math.sign(P.z-e.z)||1};
          e.state='telegraph'; e.teleT=.6;
          sfx.warn();
          const mx=Math.round(e.x)+e.chargeDir.x, mz=Math.round(e.z)+e.chargeDir.z;
          if(inB(mx,mz)) spawnMarker(mx,mz,.65,true);   // 赤＋点滅＋形状で予告
          continue;
        }
      }
      if(e.prog>=1){
        const cx=Math.round(e.x), cz=Math.round(e.z);
        if(e.type==='slug') dropSlime(cx,cz);
        const v=vines.find(v=>v.state==='armed'&&!v.caught&&v.c===cx&&v.r===cz);
        if(v){ v.caught=e; e.state='trapped'; e.trapT=3.0;    // 3秒拘束（spec 5.4）
          v.mesh.scale.setScalar(1.35); sfx.trap();
          popup(W(cx),1,Z(cz),'キャッチ！','item');
          continue; }
        if(e.type==='mole'){ e.digT-=rnd(.8,1.4);
          if(e.digT<=0){ e.state='burrow'; e.burT=0; e.tele=false; sfx.dig(); dirtBurst(cx,cz,7); continue; } }
        chooseDir(e);
      }
      const cellDist=Math.hypot(e.tx-e.fx,e.tz-e.fz)||1;
      e.prog=Math.min(1,e.prog+e.speed*dt/cellDist);
      e.x=lerp(e.fx,e.tx,e.prog); e.z=lerp(e.fz,e.tz,e.prog);
      e.mesh.position.x=W(e.x); e.mesh.position.z=Z(e.z);
      if(e.type==='crow'){
        e.mesh.position.y=.62+Math.sin(e.anim*5)*.1;
        e.mesh.userData.wL.rotation.z=Math.sin(e.anim*14)*.7+.2;
        e.mesh.userData.wR.rotation.z=-Math.sin(e.anim*14)*.7-.2;
      }else if(e.type==='slug'){
        const s=1+Math.sin(e.anim*6)*.08;
        e.mesh.scale.set(2-s,1,s); e.mesh.position.y=0;
      }else{
        e.mesh.position.y=Math.abs(Math.sin(e.anim*8))*.05;
      }
      const mvx=e.tx-e.fx, mvz=e.tz-e.fz;
      if(mvx||mvz){ const ty=Math.atan2(mvx,mvz);
        let d=ty-e.yaw; while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
        e.yaw+=d*Math.min(1,dt*10); e.mesh.rotation.y=e.yaw; }
    }

    if(e.state!=='burrow'){
      const bk=K(Math.round(e.x),Math.round(e.z));
      if(blastMap.has(bk)&&blastMap.get(bk)>G.t) hitEnemy(e,blastOrigin.c,blastOrigin.r);
    }
    const harmful=(e.state==='walk'||e.state==='charge')&&e.frozen<=0;
    if(harmful&&e.spawnT<=0&&P.alive&&P.inv<=0){
      if(Math.abs(e.x-P.x)<.56&&Math.abs(e.z-P.z)<.56) hurtPlayer();
    }
  }
}

/* ---------------- カラスのどんぐり弾 ---------------- */
function crowThrow(e){
  sfx.caw();
  const tc=Math.round(P.x), tr=Math.round(P.z);
  spawnMarker(tc,tr,1.15,true);
  const mesh=makeAcorn(); boardGroup.add(mesh);
  projs.push({ mesh, t:0, dur:1.15,
    x0:e.x, z0:e.z, x1:tc, z1:tr, boss:false });
}
function updateProjectiles(dt){
  for(let i=projs.length-1;i>=0;i--){
    const p=projs[i];
    p.t+=dt;
    const k=Math.min(1,p.t/p.dur);
    const x=lerp(p.x0,p.x1,k), z=lerp(p.z0,p.z1,k);
    p.mesh.position.set(W(x), .6+Math.sin(k*Math.PI)*2.2, Z(z));
    p.mesh.rotation.x+=dt*9; p.mesh.rotation.z+=dt*7;
    if(k>=1){
      dirtBurst(Math.round(x),Math.round(z),4);
      sfx.poof();
      if(P.alive&&P.inv<=0&&Math.abs(P.x-x)<.65&&Math.abs(P.z-z)<.65) hurtPlayer();
      boardGroup.remove(p.mesh);
      projs.splice(i,1);
    }
  }
}

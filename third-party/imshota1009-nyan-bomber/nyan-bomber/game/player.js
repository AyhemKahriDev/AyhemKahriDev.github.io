'use strict';
/* ============================================================
   player.js — soft-grid movement, dash, ice slide, damage
   ============================================================ */
function moveActor(a,dx,dz,dist){
  if(dx){
    const r0=Math.round(a.z);
    const off=r0-a.z;
    if(Math.abs(off)>0.001) a.z+=Math.sign(off)*Math.min(Math.abs(off),dist);
    if(Math.abs(r0-a.z)<0.1){
      let nx=a.x+dx*dist;
      const ahead=Math.round(nx+dx*0.49);
      if(solidForPlayer(ahead,r0)) nx=dx>0?Math.min(nx,ahead-0.99):Math.max(nx,ahead+0.99);
      a.x=clamp(nx,1,COLS-2);
    }
  }else if(dz){
    const c0=Math.round(a.x);
    const off=c0-a.x;
    if(Math.abs(off)>0.001) a.x+=Math.sign(off)*Math.min(Math.abs(off),dist);
    if(Math.abs(c0-a.x)<0.1){
      let nz=a.z+dz*dist;
      const ahead=Math.round(nz+dz*0.49);
      if(solidForPlayer(c0,ahead)) nz=dz>0?Math.min(nz,ahead-0.99):Math.max(nz,ahead+0.99);
      a.z=clamp(nz,1,ROWS-2);
    }
  }
}
function updatePlayer(dt){
  if(!P.alive){
    P.deadT+=dt;
    P.mesh.rotation.y+=dt*14;
    P.mesh.position.y=Math.max(0,Math.sin(P.deadT*3)*2.2*(1-P.deadT/1.2));
    P.mesh.scale.setScalar(Math.max(.01,1-P.deadT*.7));
    return;
  }
  P.inv-=dt; P.dashCd-=dt; P.dashT-=dt;
  if(jp.has('DASH')&&P.dashCd<=0){
    P.dashT=.28; P.dashCd=3.0;                        // クールダウン3秒（spec 4.1）
    sfx.dash(); sfx.nyat();
    for(let j=0;j<4;j++)
      spawnPart(dirtPool,W(P.x),.1,Z(P.z),rnd(-1,1)-P.dir.x*2,rnd(1,2),rnd(-1,1)-P.dir.z*2,rnd(.3,.5),rnd(.6,1));
  }
  let speed=P.def.speed*(1+.13*P.speedLv);
  if(P.dashT>0) speed*=1.95;
  const cellK=K(Math.round(P.x),Math.round(P.z));
  if(slimeMap.has(cellK)) speed*=.55;

  let dx=(keys.R?1:0)-(keys.L?1:0);
  let dz=(keys.D?1:0)-(keys.U?1:0);
  const moving=dx||dz;
  if(moving){
    P.dir={x:dx,z:dz};
    P.lastDir={x:dx,z:dz};
    P.sliding=false;
    if(dx&&dz){                                       // 対角移動（spec 4.1）
      moveActor(P,dx,0,speed*dt*.707);
      moveActor(P,0,dz,speed*dt*.707);
    }else moveActor(P,dx,dz,speed*dt);
    P.walkPh+=speed*dt*5.5;
    tutEvent('moved');
  }else if(terra[cellK]===2){                         // 氷ですべる（stage4）
    P.sliding=true;
    if(P.lastDir.x&&P.lastDir.z){
      moveActor(P,P.lastDir.x,0,speed*dt*.5);
      moveActor(P,0,P.lastDir.z,speed*dt*.5);
    }else moveActor(P,P.lastDir.x,P.lastDir.z,speed*dt*.72);
  }else P.sliding=false;

  P.mesh.position.x=W(P.x); P.mesh.position.z=Z(P.z);
  P.mesh.position.y=Math.abs(Math.sin(P.walkPh))*.07;
  const dirForYaw=moving?P.dir:P.lastDir;
  const targetYaw=Math.atan2(dirForYaw.x,dirForYaw.z);
  let dY=targetYaw-P.yaw; while(dY>Math.PI)dY-=TAU; while(dY<-Math.PI)dY+=TAU;
  P.yaw+=dY*Math.min(1,dt*14); P.mesh.rotation.y=P.yaw;
  P.mesh.rotation.z=Math.sin(P.walkPh)*.06;
  const ud=P.mesh.userData;
  ud.tail.rotation.z=1.2+Math.sin(G.t*6)*.35;
  ud.earL.rotation.z=.18+Math.sin(G.t*9)*.06;
  ud.earR.rotation.z=-.18-Math.sin(G.t*9+1)*.06;
  P.mesh.visible=!(P.inv>0&&Math.sin(G.t*30)>0);

  // 落ち葉をかき分ける（stage3 隠れアイテム）
  const pc=Math.round(P.x), pr=Math.round(P.z);
  if(terra[K(pc,pr)]===3) revealLeaf(pc,pr);

  if(jp.has('B')) placeBomb();
  if(jp.has('V')) placeVine();

  if(P.inv<=0){
    const bk=K(Math.round(P.x),Math.round(P.z));
    if(blastMap.has(bk)&&blastMap.get(bk)>G.t) hurtPlayer();
  }
}
function hurtPlayer(){
  if(P.inv>0||!P.alive) return;
  if(G.state==='tutorial'){ tutEvent('hurt'); P.inv=1.5; sfx.myat(); return; }
  G.hearts--;
  G.tookDamage=true;
  sfx.hurt(); sfx.nyaan();
  shake=Math.min(.35,shake+.2);
  const h=$('#hurtFx'); h.classList.remove('show'); void h.offsetWidth; h.classList.add('show');
  if(G.hearts<=0){
    P.alive=false; P.deadT=0;
    later(1.2,()=>gameOver('にゃんてこった…','庭は害獣たちに占拠されてしまった。'));
  }else{
    P.inv=2.0;                                        // 無敵時間（やさしめ調整）
  }
}

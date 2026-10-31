'use strict';
/* ============================================================
   bomb.js — seed bombs, explosions, chains, items, vine traps
   ============================================================ */
function solidForPlayer(c,r){
  if(!inB(c,r)) return true;
  if(grid[K(c,r)]!==0) return true;
  if(terra[K(c,r)]===1) return true;               // 水路
  const b=bombMap.get(K(c,r));
  if(b&&!b.passers.has(P)) return true;
  return false;
}

/* ---------------- placement ---------------- */
function placeBomb(){
  if(P.active>=P.bombMax) return;
  const c=Math.round(P.x), r=Math.round(P.z);
  const k=K(c,r);
  if(bombMap.has(k)||grid[k]!==0||terra[k]===1) return;
  const type= P.pawNext? 'paw' : (P.def.ice? 'ice':'cross');
  if(P.pawNext){ P.pawNext=false; }
  const mesh=makeBombMesh(type); boardGroup.add(mesh);
  mesh.position.set(W(c),0,Z(r));
  const passers=new Set([P]);
  for(const e of enemies) if(Math.abs(e.x-c)<.75&&Math.abs(e.z-r)<.75) passers.add(e);
  const face=(P.dir.x||P.dir.z)?{x:Math.sign(P.dir.x),z:Math.sign(P.dir.z)}:{x:0,z:1};
  const b={ c,r,fuse:3.0,t:0,range:P.range,type,face,
    mesh,passers,dead:false,chained:false,pulse:0,nextTick:1.0,slide:null };
  bombs.push(b); bombMap.set(k,b);
  P.active++;
  sfx.colon(); sfx.nya();
  // 爆風範囲プレビュー（spec 4.2）
  const cells=type==='paw'?pawCells(b):crossCells(b);
  for(const cell of cells) spawnMarker(cell.c,cell.r,.7,false);
  tutEvent('bomb',b);
}

/* 風で爆弾がずれる（stage3） */
function windSlideBomb(b){
  if(b.dead) return;
  const c2=b.c+wind.dir.x, r2=b.r+wind.dir.z;
  if(!inB(c2,r2)||grid[K(c2,r2)]!==0||bombMap.has(K(c2,r2))||terra[K(c2,r2)]===1) return;
  bombMap.delete(K(b.c,b.r));
  b.c=c2; b.r=r2;
  bombMap.set(K(c2,r2),b);
  b.slide={fx:b.mesh.position.x,fz:b.mesh.position.z,t:0};
  for(let j=0;j<3;j++)
    spawnPart(leafPool,b.mesh.position.x,.3,b.mesh.position.z,wind.dir.x*2,rnd(1,2),wind.dir.z*2,rnd(.4,.6),1);
}

/* ---------------- update ---------------- */
function updateBombs(dt){
  for(let i=bombs.length-1;i>=0;i--){
    const b=bombs[i];
    if(b.dead){ bombs.splice(i,1); continue; }
    b.t+=dt;
    for(const ent of b.passers)
      if(Math.abs(ent.x-b.c)>.72||Math.abs(ent.z-b.r)>.72) b.passers.delete(ent);
    if(b.slide){
      b.slide.t+=dt*3.3;
      if(b.slide.t>=1){ b.mesh.position.set(W(b.c),0,Z(b.r)); b.slide=null; }
      else{ b.mesh.position.x=lerp(b.slide.fx,W(b.c),b.slide.t);
            b.mesh.position.z=lerp(b.slide.fz,Z(b.r),b.slide.t); }
    }
    const k01=b.t/b.fuse;
    const u=b.mesh.userData;
    u.mound.scale.set(.4+k01*.75,.12+k01*.3,.4+k01*.75);   // 地面ふくらみ予兆
    b.pulse+=dt*(5+16*k01);
    u.core.scale.setScalar(1+.1*Math.sin(b.pulse)*(0.5+k01));
    u.core.position.y=k01*.06;
    // 種の色：緑 → 黄 → 赤（spec 5.1）
    if(b.type==='cross') u.seedMat.color.setHex(b.t<1?0x58c84e : b.t<2?0xe8c83c : 0xd8503c);
    if(b.fuse-b.t<0.8) u.seedMat.emissive=new THREE.Color(Math.sin(b.pulse*2)>0?0x661111:0x000000);
    if(b.t>=b.nextTick){ b.nextTick+=Math.max(.12,(1-k01)*.5); sfx.tick(); }
    if(b.t>=b.fuse&&!b.chained) detonate(b,0);
  }
}

/* ---------------- blast cell computation ---------------- */
function crossCells(b){
  const arr=[{c:b.c,r:b.r,d:0}];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    for(let i=1;i<=b.range;i++){
      const c=b.c+dx*i, r=b.r+dz*i;
      if(!inB(c,r)) break;
      const g=grid[K(c,r)];
      if(g===1) break;
      if(terra[K(c,r)]===1){ splashAt(c,r); break; }   // 水で不発
      arr.push({c,r,d:i});
      if(g===2) break;
      if(bombMap.has(K(c,r))) break;
    }
  }
  return arr;
}
function pawCells(b){
  const f=b.face, td=1+b.range;
  const local=[];
  for(let lx=-1;lx<=1;lx++)for(let lz=-1;lz<=1;lz++) local.push([lx,lz,Math.abs(lx)+Math.abs(lz)]);
  local.push([-2,-td+1,td+1],[-1,-td,td+1],[1,-td,td+1],[2,-td+1,td+1]);
  const arr=[];
  for(const [lx,lz,d] of local){
    let dx,dz;
    if(f.z===-1){ dx=lx; dz=lz; }
    else if(f.z===1){ dx=-lx; dz=-lz; }
    else if(f.x===1){ dx=-lz; dz=lx; }
    else { dx=lz; dz=-lx; }
    const c=b.c+dx, r=b.r+dz;
    if(!inB(c,r)||grid[K(c,r)]===1||terra[K(c,r)]===1) continue;
    arr.push({c,r,d});
  }
  return arr;
}
function splashAt(c,r){
  sfx.splash();
  for(let j=0;j<5;j++)
    spawnPart(petalPools[3],W(c),.15,Z(r),rnd(-1.5,1.5),rnd(2,4),rnd(-1.5,1.5),rnd(.5,.8),rnd(.8,1.2));
}

/* ---------------- detonation & chains ---------------- */
const blastOrigin={c:7,r:6};
function detonate(b,depth){
  if(b.dead) return;
  b.dead=true;
  bombMap.delete(K(b.c,b.r));
  boardGroup.remove(b.mesh);
  P.active=Math.max(0,P.active-1);
  sfx.popon(depth>0);
  shake=Math.min(.3,shake+.16);                     // 控えめシェイク（spec 4.2）
  unlockAch('bloom1');
  if(depth>0){
    G.chainNow=depth+1;
    G.chainMax=Math.max(G.chainMax,G.chainNow);
    showChain(G.chainNow);                          // 「2れんぞく！」
    sfx.chain(depth); sfx.bloom();
    if(G.chainNow>=2) unlockAch('chain2');
    if(G.chainNow>=3) unlockAch('chain3');
  } else G.chainNow=Math.max(1,G.chainNow);
  G.comboT=1.2;
  if(b.type==='paw'){
    const ang=Math.atan2(b.face.x,-b.face.z);
    spawnPawDecal(W(b.c),Z(b.r),3+b.range*.8,-ang);
  }
  const cells=b.type==='paw'?pawCells(b):crossCells(b);
  const rainbow=G.chainNow>=3;
  for(const cell of cells)
    later(cell.d*.045,()=>blastCell(cell.c,cell.r,b.c,b.r,depth,b.type,rainbow));
}
function blastCell(c,r,oc,or,depth,type,rainbow){
  const k=K(c,r);
  if(grid[k]===1) return;
  blastOrigin.c=oc; blastOrigin.r=or;
  const ob=bombMap.get(k);
  if(ob&&!ob.dead&&!ob.chained){ ob.chained=true; later(.09,()=>detonate(ob,depth+1)); }
  if(grid[k]===2) destroySoft(c,r);
  if(terra[k]===3) revealLeaf(c,r);
  const v=vines.find(v=>v.c===c&&v.r===r&&v.state!=='dead');
  if(v){ v.caught=null; vineDie(v); }
  blastMap.set(k,G.t+.42);
  const isCenter=(c===oc&&r===or);
  spawnFlash(W(c),Z(r),isCenter?1.5:1.0,.38, type==='ice'?0xbfe8ff:0xfff2b0);
  let dx=c-oc, dz=r-or; const len=Math.hypot(dx,dz);
  if(len){ dx/=len; dz/=len; }
  const n=isCenter?10:6;
  for(let j=0;j<n;j++){
    const p=petalPools[rainbow? j%petalPools.length : j%3];
    const a=rnd(TAU), sp=rnd(1,3.2);
    spawnPart(p,W(c),rnd(.2,.6),Z(r),dx*2+Math.cos(a)*sp,rnd(2.5,5.5),dz*2+Math.sin(a)*sp,rnd(.8,1.3),rnd(.9,1.5));
  }
  for(let j=0;j<3;j++){
    const a=rnd(TAU);
    spawnPart(dirtPool,W(c),.2,Z(r),dx*1.5+Math.cos(a)*rnd(1,2.5),rnd(2,4.5),dz*1.5+Math.sin(a)*rnd(1,2.5),rnd(.5,.9),rnd(.8,1.3));
    spawnPart(leafPool,W(c),.3,Z(r),dx*2+Math.cos(a)*rnd(1,3),rnd(2,5),dz*2+Math.sin(a)*rnd(1,3),rnd(.7,1.1),rnd(.9,1.4));
  }
  if(type==='ice') freezeSplash(c,r);
  if(BOSS) bossBlastHit(c,r);
  later(.26,()=>spawnFlowerPatch(c,r));             // 開花（〜2秒咲く）
}
function freezeSplash(c,r){
  for(const e of enemies){
    if(e.state==='fly'||e.state==='burrow') continue;
    if(Math.abs(Math.round(e.x)-c)<=1&&Math.abs(Math.round(e.z)-r)<=1&&!e.frozen){
      e.frozen=2.5;
      sfx.freeze();
      if(!e.iceCube){
        e.iceCube=new THREE.Mesh(new THREE.BoxGeometry(.85,.9,.85),M.iceCube);
        e.iceCube.position.y=.42;
        e.mesh.add(e.iceCube);
      }
      e.iceCube.visible=true;
    }
  }
}
function revealLeaf(c,r){
  const k=K(c,r);
  if(terra[k]!==3) return;
  terra[k]=0;
  const m=terraMeshes.get(k);
  if(m){ boardGroup.remove(m); terraMeshes.delete(k); }
  for(let j=0;j<6;j++)
    spawnPart(leafPool,W(c),.2,Z(r),rnd(-2.5,2.5),rnd(2,4),rnd(-2.5,2.5),rnd(.5,.9),rnd(.9,1.4));
  const hid=leafItems.get(k);
  if(hid){ leafItems.delete(k); later(.1,()=>spawnPower(c,r,hid)); popup(W(c),1,Z(r),'なにか出てきた！','item'); }
}

/* ---------------- items (spec 6.3) ---------------- */
function spawnPower(c,r,forceType){
  const k=K(c,r);
  if(powerMap.has(k)||grid[k]!==0) return;
  let type=forceType;
  if(!type){
    const roll=Math.random();
    type= roll<.2?'bomb': roll<.4?'range': roll<.56?'speed': roll<.7?'vine':
          roll<.84?'heal': roll<.94?'fert':'paw';
  }
  const mat=new THREE.SpriteMaterial({map:POWER_DEFS[type].tex,transparent:true});
  const s=new THREE.Sprite(mat);
  s.scale.setScalar(.6); s.position.set(W(c),.42,Z(r));
  boardGroup.add(s);
  powerMap.set(k,{type,s,ph:rnd(TAU)});
}
function updatePowerups(dt){
  const pk=K(Math.round(P.x),Math.round(P.z));
  for(const [k,p] of powerMap){
    p.ph+=dt*3;
    p.s.position.y=.42+Math.sin(p.ph)*.08;
    if(k===pk&&P.alive){
      powerMap.delete(k); boardGroup.remove(p.s);
      applyPower(p.type);
      addScore(50);
      sfx.piron(); sfx.powerup();
      popup(W(P.x),1.2,Z(P.z),POWER_DEFS[p.type].label,'item');
      tutEvent('item');
    }
  }
}
function applyPower(type){
  if(type==='bomb') P.bombMax=Math.min(8,P.bombMax+1);
  else if(type==='range') P.range=Math.min(7,P.range+1);
  else if(type==='speed') P.speedLv=Math.min(5,P.speedLv+1);
  else if(type==='vine') P.vines=Math.min(3,P.vines+1);
  else if(type==='heal') G.hearts=Math.min(5,G.hearts+1);
  else if(type==='fert') G.fert=30;
  else if(type==='paw') P.pawNext=true;
}

/* ---------------- vine traps (spec 5.4) ---------------- */
function vineAt(c,r){ return vines.find(v=>v.c===c&&v.r===r&&v.state!=='dead'); }
function placeVine(){
  if(P.vines<=0) return;
  let c=Math.round(P.x+P.dir.x), r=Math.round(P.z+P.dir.z);
  const ok=(c,r)=>inB(c,r)&&grid[K(c,r)]===0&&terra[K(c,r)]!==1&&!bombMap.has(K(c,r))&&!vineAt(c,r);
  if(!ok(c,r)){ c=Math.round(P.x); r=Math.round(P.z); if(!ok(c,r)) return; }
  const mesh=makeVineMesh(); boardGroup.add(mesh);
  mesh.position.set(W(c),0,Z(r)); mesh.scale.setScalar(.01);
  vines.push({c,r,t:0,state:'grow',life:9,mesh,caught:null,fade:0});
  P.vines--;
  sfx.vine();
}
function vineDie(v){
  if(v.state==='dead') return;
  v.state='dead'; v.fade=0;
  for(let j=0;j<5;j++)
    spawnPart(leafPool,W(v.c),.4,Z(v.r),rnd(-2,2),rnd(1.5,3.5),rnd(-2,2),rnd(.5,.9),rnd(.8,1.3));
}
function updateVines(dt){
  for(let i=vines.length-1;i>=0;i--){
    const v=vines[i];
    if(v.state==='dead'){
      v.fade+=dt;
      v.mesh.scale.setScalar(Math.max(.01,(1-v.fade*3)));
      if(v.fade>.35){ boardGroup.remove(v.mesh); vines.splice(i,1); }
      continue;
    }
    v.t+=dt;
    if(v.state==='grow'){                             // ニョキニョキ成長 0.5秒
      v.mesh.scale.setScalar(Math.max(.01,easeOutBack(Math.min(1,v.t/.5))));
      if(v.t>=.5) v.state='armed';
    }else{
      v.life-=dt;
      v.mesh.rotation.y+=dt*(v.caught?4:.8);
      const w=1+Math.sin(v.t*(v.caught?18:5))*.06;
      v.mesh.scale.set(w*(v.caught?1.35:1),(v.caught?1.35:1),w*(v.caught?1.35:1));
      if(v.caught){ v.mesh.position.x=W(v.caught.x); v.mesh.position.z=Z(v.caught.z); }
      if(v.life<=0&&!v.caught) vineDie(v);
    }
  }
}

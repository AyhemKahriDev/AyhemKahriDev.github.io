'use strict';
/* ============================================================
   fx.js — models, textures, particle pools, decals
   ============================================================ */
let renderer, scene, camera, hemiLight, dirLight;
const staticGroup=new THREE.Group(), boardGroup=new THREE.Group(), fxGroup=new THREE.Group();
const clouds=[];

function canvasTex(w,h,fn){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  fn(c.getContext('2d'),w,h);
  return new THREE.CanvasTexture(c);
}
const Lam=(color,extra)=>new THREE.MeshLambertMaterial(Object.assign({color},extra||{}));
const M={
  pot:Lam(0xcf7a4a), potRim:Lam(0xb96238), bush:Lam(0x58a84e), bushHi:Lam(0x74c364),
  sakura:Lam(0xf2a8c8), sakuraHi:Lam(0xf8c8dc), autumn:Lam(0xd8883c), autumnHi:Lam(0xe8a85c),
  frost:Lam(0x9ec8d8), frostHi:Lam(0xc8e8f2),
  rock:Lam(0x9aa0a8), rockDk:Lam(0x848a94), fence:Lam(0xf4f0e6),
  seedStripe:Lam(0x6d4527), sprout:Lam(0x6dc85e),
  mound:Lam(0x8f6b48),
  mole:Lam(0x8a6242), molePink:Lam(0xf0a0a8), crow:Lam(0x3a3a46), crowBeak:Lam(0xf2b03c),
  slug:Lam(0xc8d86a), slugDk:Lam(0xa8b84e),
  slime:new THREE.MeshBasicMaterial({color:0xb9f28e,transparent:true,opacity:.45}),
  hedge:Lam(0xa8825a), hedgeSpike:Lam(0x6b5138),
  vine:Lam(0x4e9a44), vineDk:Lam(0x3d7a36), leaf:Lam(0x74c364),
  white:Lam(0xffffff), pink:Lam(0xffa8c8), black:Lam(0x30303a), trunk:Lam(0x8a6242), treeTop:Lam(0x4e9a44),
  cloud:Lam(0xffffff,{emissive:0x556677,emissiveIntensity:.15}),
  water:new THREE.MeshLambertMaterial({color:0x4ea8e8,transparent:true,opacity:.85}),
  ice:new THREE.MeshLambertMaterial({color:0xbfe8f8,transparent:true,opacity:.9,emissive:0x224455,emissiveIntensity:.2}),
  leafPile:Lam(0xc8842c),
  acorn:Lam(0x8a5a2c),
  drill:Lam(0xb8bcc6,{emissive:0x333344,emissiveIntensity:.3}), bossFur:Lam(0x6b4a32), helmet:Lam(0x8a4a2c),
  weak:new THREE.MeshLambertMaterial({color:0xff6b9e,emissive:0xaa2255,emissiveIntensity:.6}),
  gateWood:Lam(0xc8955a),
  glow:new THREE.MeshBasicMaterial({color:0xfff2a0,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}),
  flash:new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}),
  iceCube:new THREE.MeshLambertMaterial({color:0xbfe8ff,transparent:true,opacity:.55}),
  shadow:new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:.4}),
};

function sph(r,mat,x,y,z,sx,sy,sz){
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),mat);
  m.position.set(x,y,z); if(sx!==undefined) m.scale.set(sx,sy,sz);
  m.castShadow=true; return m;
}

/* ---------------- character builders ---------------- */
function makeCat(def){
  const g=new THREE.Group();
  const base=Lam(def.base);
  const body=sph(.34,base,0,.32,0,1,.85,1.05);
  const head=sph(.27,base,0,.68,.06);
  const earGeo=new THREE.ConeGeometry(.1,.2,4);
  const earL=new THREE.Mesh(earGeo,base); earL.position.set(-.15,.9,.02); earL.rotation.z=.18; earL.castShadow=true;
  const earR=earL.clone(); earR.position.x=.15; earR.rotation.z=-.18;
  const inL=new THREE.Mesh(new THREE.ConeGeometry(.05,.1,4),Lam(def.ear)); inL.position.set(-.15,.89,.06); inL.rotation.z=.18;
  const inR=inL.clone(); inR.position.x=.15; inR.rotation.z=-.18;
  const muzzle=sph(.11,M.white,0,.62,.26,1,.8,.75);
  const nose=sph(.032,M.pink,0,.66,.34);
  const eyeMat=def.eyeColor?Lam(def.eyeColor):M.black;
  const eyeL=sph(.04,eyeMat,-.1,.72,.26), eyeR=sph(.04,eyeMat,.1,.72,.26);
  const tail=new THREE.Mesh(new THREE.TorusGeometry(.17,.05,6,10,Math.PI*1.3),base);
  tail.position.set(0,.4,-.34); tail.rotation.set(.4,0,1.2); tail.castShadow=true;
  const pawL=sph(.075,base,-.13,.07,.24), pawR=sph(.075,base,.13,.07,.24);
  g.add(body,head,earL,earR,inL,inR,muzzle,nose,eyeL,eyeR,tail,pawL,pawR);
  for(const [col,x,y,z] of def.patches){ g.add(sph(.13,Lam(col),x,y,z,1,.7,1)); }
  g.userData={tail,earL,earR};
  return g;
}
function makeMole(){
  const g=new THREE.Group();
  g.add(sph(.3,M.mole,0,.28,0,1,.9,1.15), sph(.07,M.molePink,0,.34,.32),
    sph(.03,M.black,-.1,.42,.24), sph(.03,M.black,.1,.42,.24));
  const clawGeo=new THREE.ConeGeometry(.06,.14,4);
  const cL=new THREE.Mesh(clawGeo,M.molePink); cL.position.set(-.24,.16,.2); cL.rotation.x=1.2; cL.castShadow=true;
  const cR=cL.clone(); cR.position.x=.24;
  g.add(cL,cR);
  return g;
}
function makeCrow(){
  const g=new THREE.Group();
  const beak=new THREE.Mesh(new THREE.ConeGeometry(.06,.18,4),M.crowBeak);
  beak.position.set(0,.2,.42); beak.rotation.x=Math.PI/2; beak.castShadow=true;
  const wingGeo=new THREE.BoxGeometry(.4,.05,.3);
  const wL=new THREE.Mesh(wingGeo,M.crow); wL.position.set(-.32,.06,0); wL.castShadow=true;
  const wR=wL.clone(); wR.position.x=.32;
  const tail=new THREE.Mesh(new THREE.BoxGeometry(.16,.04,.3),M.crow); tail.position.set(0,.02,-.34);
  g.add(sph(.26,M.crow,0,0,0,1,.9,1.2), sph(.17,M.crow,0,.2,.2), beak,
    sph(.035,M.white,-.08,.26,.3), sph(.035,M.white,.08,.26,.3),
    sph(.018,M.black,-.08,.26,.33), sph(.018,M.black,.08,.26,.33), wL,wR,tail);
  g.userData={wL,wR};
  return g;
}
function makeSlug(){
  const g=new THREE.Group();
  const stalkGeo=new THREE.CylinderGeometry(.02,.03,.2,5);
  const sL=new THREE.Mesh(stalkGeo,M.slug); sL.position.set(-.08,.44,.3); sL.rotation.x=-.3; sL.castShadow=true;
  const sR=sL.clone(); sR.position.x=.08;
  g.add(sph(.26,M.slug,0,.2,0,1,.75,1.5), sph(.16,M.slugDk,0,.34,-.14), sL,sR,
    sph(.045,M.black,-.1,.55,.34), sph(.045,M.black,.1,.55,.34));
  // 粘液バリア
  const bar=new THREE.Mesh(new THREE.SphereGeometry(.48,10,8),
    new THREE.MeshLambertMaterial({color:0xb9f28e,transparent:true,opacity:.3}));
  bar.position.y=.28; g.add(bar);
  g.userData={barrier:bar};
  return g;
}
function makeHedgehog(){
  const g=new THREE.Group();
  g.add(sph(.3,M.hedge,0,.28,0,1,.85,1.15), sph(.06,M.black,0,.3,.4),
    sph(.03,M.black,-.09,.4,.3), sph(.03,M.black,.09,.4,.3));
  const spikes=new THREE.Group();
  for(let i=0;i<10;i++){
    const s=new THREE.Mesh(new THREE.ConeGeometry(.06,.22,5),M.hedgeSpike);
    const a=i/10*TAU;
    s.position.set(Math.cos(a)*.18,.42+Math.sin(i*2.3)*.04,Math.sin(a)*.18-.08);
    s.rotation.set(Math.sin(a)*.5,0,Math.cos(a)*.5); s.castShadow=true;
    spikes.add(s);
  }
  g.add(spikes);
  g.userData={spikes};
  return g;
}
function makeBoss(){
  const g=new THREE.Group();
  const body=sph(.62,M.bossFur,0,.6,0,1,.95,1.15);
  const drill=new THREE.Mesh(new THREE.ConeGeometry(.24,.65,8),M.drill);
  drill.position.set(0,.62,.78); drill.rotation.x=Math.PI/2; drill.castShadow=true;
  const helm=new THREE.Mesh(new THREE.SphereGeometry(.5,10,8,0,TAU,0,1.4),M.helmet);
  helm.position.y=.95; helm.castShadow=true;
  const weak=sph(.2,M.weak,0,.42,.55);
  const cL=new THREE.Mesh(new THREE.ConeGeometry(.12,.3,4),M.molePink);
  cL.position.set(-.5,.34,.4); cL.rotation.x=1.2; cL.castShadow=true;
  const cR=cL.clone(); cR.position.x=.5;
  g.add(body,drill,helm,weak,cL,cR,
    sph(.06,M.black,-.2,.8,.5), sph(.06,M.black,.2,.8,.5), sph(.12,M.molePink,0,.66,.62));
  const shields=[];
  for(let i=0;i<3;i++){
    const s=new THREE.Mesh(new THREE.IcosahedronGeometry(.26,0),M.rock);
    s.castShadow=true; g.add(s); shields.push(s);
  }
  g.userData={drill,weak,shields};
  return g;
}
function makeSoftBlock(kind){
  const g=new THREE.Group();
  let bm=M.bush, bh=M.bushHi;
  if(G.stage===1){ bm=M.sakura; bh=M.sakuraHi; }
  else if(G.stage===3){ bm=M.autumn; bh=M.autumnHi; }
  else if(G.stage===4){ bm=M.frost; bh=M.frostHi; }
  if(kind===0){
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(.3,.22,.42,9),M.pot); pot.position.y=.21; pot.castShadow=true;
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(.34,.32,.1,9),M.potRim); rim.position.y=.42; rim.castShadow=true;
    g.add(pot,rim,sph(.26,bm,0,.6,0),sph(.15,bh,.1,.72,.1));
  }else{
    g.add(sph(.34,bm,0,.3,0), sph(.24,bh,-.18,.44,.1), sph(.2,bm,.2,.46,-.06), sph(.12,bh,.02,.6,.08));
  }
  return g;
}
function makeRock(){
  const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.44,0), Math.random()<.5?M.rock:M.rockDk);
  m.position.y=.34; m.rotation.set(rnd(TAU),rnd(TAU),rnd(TAU));
  m.scale.set(rnd(.9,1.15),rnd(.8,1.05),rnd(.9,1.15)); m.castShadow=true;
  const g=new THREE.Group(); g.add(m);
  return g;
}
function makeBombMesh(type){
  const g=new THREE.Group();
  const mound=new THREE.Mesh(new THREE.SphereGeometry(.5,9,7),M.mound);
  mound.position.y=-.02; mound.scale.set(.4,.12,.4); g.add(mound);
  const col= type==='paw'?0xd8a03c : type==='ice'?0x8ecdf2 : 0x58c84e;
  const seedMat=new THREE.MeshLambertMaterial({color:col});
  const seed=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),seedMat); seed.position.y=.3; seed.scale.y=1.1; seed.castShadow=true;
  const stripe=new THREE.Mesh(new THREE.TorusGeometry(.3,.035,6,14),M.seedStripe);
  stripe.position.y=.3; stripe.rotation.x=Math.PI/2; stripe.scale.y=1.1;
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.18,5),M.sprout); stem.position.y=.68;
  const leafGeo=new THREE.SphereGeometry(.09,7,6);
  const lf1=new THREE.Mesh(leafGeo,M.sprout); lf1.position.set(-.09,.78,0); lf1.scale.set(1.4,.5,.7);
  const lf2=lf1.clone(); lf2.position.x=.09;
  const core=new THREE.Group(); core.add(seed,stripe,stem,lf1,lf2); g.add(core);
  g.userData={mound,core,seedMat};
  return g;
}
function makeVineMesh(){
  const g=new THREE.Group();
  for(let i=0;i<5;i++){
    const a=i/5*TAU+rnd(.5), h=rnd(.5,.85);
    const v=new THREE.Mesh(new THREE.ConeGeometry(.055,h,5), i%2?M.vine:M.vineDk);
    v.position.set(Math.cos(a)*.2,h/2,Math.sin(a)*.2);
    v.rotation.set(Math.sin(a)*.5,0,Math.cos(a)*-.5); v.castShadow=true; g.add(v);
    const lf=new THREE.Mesh(new THREE.SphereGeometry(.07,6,5),M.leaf);
    lf.position.set(Math.cos(a)*.28,h*.7,Math.sin(a)*.28); lf.scale.set(1.4,.4,.8); g.add(lf);
  }
  return g;
}
function makeGate(){
  const g=new THREE.Group();
  const postGeo=new THREE.CylinderGeometry(.08,.1,.9,7);
  const pL=new THREE.Mesh(postGeo,M.gateWood); pL.position.set(-.34,.45,0); pL.castShadow=true;
  const pR=pL.clone(); pR.position.x=.34;
  const arch=new THREE.Mesh(new THREE.TorusGeometry(.36,.07,7,12,Math.PI),M.gateWood);
  arch.position.y=.9; arch.castShadow=true;
  const glow=new THREE.Mesh(new THREE.CircleGeometry(.42,14),M.glow.clone());
  glow.rotation.x=-Math.PI/2; glow.position.y=.05;
  const fl=new THREE.Mesh(new THREE.SphereGeometry(.09,7,6),M.pink); fl.position.set(-.34,.95,0);
  const fl2=fl.clone(); fl2.position.x=.34;
  g.add(pL,pR,arch,glow,fl,fl2);
  g.userData={glow};
  return g;
}
function makeAcorn(){
  const g=new THREE.Group();
  g.add(sph(.13,M.acorn,0,0,0,1,1.25,1));
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6,0,TAU,0,1.2),M.seedStripe);
  cap.position.y=.09; g.add(cap);
  return g;
}

/* ---------------- sprite textures ---------------- */
function flowerTexture(petal,center){
  return canvasTex(96,96,(g)=>{
    g.translate(48,48); g.fillStyle=petal;
    for(let i=0;i<5;i++){ const a=i/5*TAU-Math.PI/2;
      g.beginPath(); g.arc(Math.cos(a)*22,Math.sin(a)*22,17,0,TAU); g.fill(); }
    g.fillStyle=center; g.beginPath(); g.arc(0,0,13,0,TAU); g.fill();
  });
}
const flowerTexs=[ flowerTexture('#ff9ec7','#ffd94a'), flowerTexture('#ffffff','#ffb64a'),
  flowerTexture('#ffd94a','#ff8f5e'), flowerTexture('#c9a0ff','#fff3a0'), flowerTexture('#8ecdf2','#fff') ];
function powerTexture(emoji,ring){
  return canvasTex(128,128,(g)=>{
    g.beginPath(); g.arc(64,64,56,0,TAU); g.fillStyle='#fffdf2'; g.fill();
    if(ring==='rainbow'){
      const gr=g.createLinearGradient(8,8,120,120);
      ['#f66','#fa3','#fd3','#6d6','#39f','#96f'].forEach((c,i)=>gr.addColorStop(i/5,c));
      g.strokeStyle=gr;
    } else g.strokeStyle=ring;
    g.lineWidth=10; g.stroke();
    g.font='60px serif'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText(emoji,64,70);
  });
}
/* item colors per spec 6.3 */
const POWER_DEFS={
  bomb: {tex:powerTexture('🌰','#3c78d8'), label:'爆弾ついか +1'},
  range:{tex:powerTexture('🌸','#e04848'), label:'爆風かくだい！'},
  speed:{tex:powerTexture('👟','#e8c83c'), label:'スピードアップ！'},
  vine: {tex:powerTexture('🌿','#3c9a34'), label:'蔦トラップ +1'},
  fert: {tex:powerTexture('✨','rainbow'), label:'肥料ブースト！スコア2倍'},
  heal: {tex:powerTexture('🐟','#e8e8e8'), label:'回復にぼし HP+1'},
  paw:  {tex:powerTexture('🐾','#e8a13c'), label:'肉球爆弾！つぎの1発'},
};
const pawTexture=canvasTex(256,256,(g)=>{
  g.fillStyle='rgba(255,130,175,0.85)';
  g.beginPath(); g.ellipse(128,158,62,52,0,0,TAU); g.fill();
  for(const [x,y,r] of [[52,86,26],[103,58,28],[153,58,28],[204,86,26]]){
    g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); }
});
const starTexture=canvasTex(96,96,(g)=>{
  g.translate(48,48); g.fillStyle='#ffe23c'; g.strokeStyle='#e8a13c'; g.lineWidth=5;
  g.beginPath();
  for(let i=0;i<10;i++){ const r=i%2?11:26, a=i/10*TAU-Math.PI/2;
    g[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r); }
  g.closePath(); g.fill(); g.stroke();
});
/* 攻撃警告：赤 ＋ 点滅 ＋ 三角アイコン（色覚配慮） */
const warnTexture=canvasTex(128,128,(g)=>{
  g.strokeStyle='#e83c50'; g.lineWidth=9;
  g.beginPath(); g.arc(64,64,50,0,TAU); g.stroke();
  g.fillStyle='#e83c50';
  g.beginPath(); g.moveTo(64,34); g.lineTo(88,80); g.lineTo(40,80); g.closePath(); g.fill();
});
/* 爆風プレビュー：白＋花マーク */
const prevTexture=canvasTex(128,128,(g)=>{
  g.strokeStyle='rgba(255,255,255,.9)'; g.lineWidth=7;
  g.beginPath(); g.arc(64,64,46,0,TAU); g.stroke();
  g.fillStyle='rgba(255,220,120,.9)';
  for(let i=0;i<5;i++){ const a=i/5*TAU;
    g.beginPath(); g.arc(64+Math.cos(a)*18,64+Math.sin(a)*18,12,0,TAU); g.fill(); }
});

/* ---------------- particle pools ---------------- */
const dummy=new THREE.Object3D();
const partPools=[];
function makePartPool(geo,color,count,opts){
  opts=opts||{};
  const matOpts={side:THREE.DoubleSide};
  if(opts.map){ matOpts.map=opts.map; matOpts.transparent=true; }
  else matOpts.color=color;
  const mat=opts.basic||opts.map? new THREE.MeshBasicMaterial(matOpts): new THREE.MeshLambertMaterial(matOpts);
  const im=new THREE.InstancedMesh(geo,mat,count);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled=false;
  fxGroup.add(im);
  const arr=[];
  dummy.position.set(0,-99,0); dummy.rotation.set(0,0,0); dummy.scale.setScalar(0.0001); dummy.updateMatrix();
  for(let i=0;i<count;i++){ arr.push({on:false,i}); im.setMatrixAt(i,dummy.matrix); }
  im.instanceMatrix.needsUpdate=true;
  const pool={im,arr,cursor:0,grav:opts.grav||6,drag:opts.drag||0.985};
  partPools.push(pool);
  return pool;
}
let petalPools=[], dirtPool=null, leafPool=null, starPool=null;
function makeAllPools(){
  const petalGeo=new THREE.PlaneGeometry(.17,.13);
  petalPools=[ makePartPool(petalGeo,0xff9ec7,70,{grav:2.4,drag:.97}),
               makePartPool(petalGeo,0xfff3f6,50,{grav:2.4,drag:.97}),
               makePartPool(petalGeo,0xffe289,50,{grav:2.4,drag:.97}),
               makePartPool(petalGeo,0x8ee3f2,40,{grav:2.4,drag:.97}),
               makePartPool(petalGeo,0xc9a0ff,40,{grav:2.4,drag:.97}) ];
  dirtPool=makePartPool(new THREE.SphereGeometry(.085,6,5),0x8f6b48,90,{grav:10});
  leafPool=makePartPool(new THREE.PlaneGeometry(.22,.08),0x74c364,70,{grav:3.5,drag:.97});
  starPool=makePartPool(new THREE.PlaneGeometry(.3,.3),0xffffff,40,{grav:4,drag:.96,map:starTexture});
  makeFlashPool(); makeFlowerPool(); makePawPool(); makePopupPool(); makeMarkerPool();
}
function spawnPart(pool,x,y,z,vx,vy,vz,life,size){
  const o=pool.arr[pool.cursor]; pool.cursor=(pool.cursor+1)%pool.arr.length;
  o.on=true; o.t=0; o.life=life; o.size=size;
  o.x=x; o.y=y; o.z=z; o.vx=vx; o.vy=vy; o.vz=vz;
  o.rx=rnd(TAU); o.ry=rnd(TAU); o.spin=rnd(6,16)*(Math.random()<.5?-1:1);
}
function updateParts(dt){
  for(const p of partPools){
    let dirty=false;
    for(const o of p.arr){
      if(!o.on) continue;
      dirty=true;
      o.t+=dt;
      if(o.t>=o.life){
        o.on=false;
        dummy.position.set(0,-99,0); dummy.scale.setScalar(0.0001); dummy.rotation.set(0,0,0);
      }else{
        o.vy-=p.grav*dt; o.vx*=p.drag; o.vz*=p.drag;
        o.x+=o.vx*dt; o.y+=o.vy*dt; o.z+=o.vz*dt;
        if(o.y<0.03&&o.vy<0){ o.y=0.03; o.vy*=-0.25; }
        o.rx+=o.spin*dt; o.ry+=o.spin*.6*dt;
        const s=o.size*clamp(1.4-o.t/o.life,0,1);
        dummy.position.set(o.x,o.y,o.z); dummy.rotation.set(o.rx,o.ry,0); dummy.scale.setScalar(s);
      }
      dummy.updateMatrix();
      p.im.setMatrixAt(o.i,dummy.matrix);
    }
    if(dirty) p.im.instanceMatrix.needsUpdate=true;
  }
}
function petalBurst(x,y,z,n,rainbow){
  for(let j=0;j<n;j++){
    const p=petalPools[rainbow? j%petalPools.length : j%3];
    const a=rnd(TAU), sp=rnd(1,3.2);
    spawnPart(p,x,y,z,Math.cos(a)*sp,rnd(2.5,5.5),Math.sin(a)*sp,rnd(.8,1.3),rnd(.9,1.5));
  }
}
function starBurst(x,y,z,n){
  for(let j=0;j<n;j++){
    const a=rnd(TAU);
    spawnPart(starPool,x,y,z,Math.cos(a)*rnd(1,2.6),rnd(2,4.5),Math.sin(a)*rnd(1,2.6),rnd(.5,.9),rnd(.7,1.2));
  }
}
function dirtBurst(c,r,n){
  for(let i=0;i<n;i++){
    const a=rnd(TAU);
    spawnPart(dirtPool,W(c)+rnd(-.2,.2),.15,Z(r)+rnd(-.2,.2),
      Math.cos(a)*rnd(.5,2),rnd(2,4.5),Math.sin(a)*rnd(.5,2),rnd(.5,.9),rnd(.7,1.3));
  }
}

/* flash pool */
const flashes=[];
let flashCursor=0;
function makeFlashPool(){
  const geo=new THREE.SphereGeometry(.5,9,7);
  for(let i=0;i<36;i++){
    const m=new THREE.Mesh(geo,M.flash.clone());
    m.visible=false; fxGroup.add(m);
    flashes.push({m,on:false,t:0,life:.4,max:1});
  }
}
function spawnFlash(x,z,maxScale,life,hex){
  const f=flashes[flashCursor]; flashCursor=(flashCursor+1)%flashes.length;
  f.on=true; f.t=0; f.life=life||.4; f.max=maxScale||1.1;
  f.m.material.color.setHex(hex||0xfff2b0);
  f.m.visible=true; f.m.position.set(x,.35,z);
}
function updateFlashes(dt){
  for(const f of flashes){
    if(!f.on) continue;
    f.t+=dt;
    if(f.t>=f.life){ f.on=false; f.m.visible=false; continue; }
    const k=f.t/f.life;
    f.m.scale.setScalar(.2+f.max*easeOutBack(Math.min(1,k*1.4)));
    f.m.material.opacity=.9*(1-k);
  }
}

/* flower sprites */
const flowerSprites=[];
let flowerCursor=0;
function makeFlowerPool(){
  for(let i=0;i<150;i++){
    const mat=new THREE.SpriteMaterial({map:flowerTexs[i%4],transparent:true});
    const s=new THREE.Sprite(mat); s.visible=false; fxGroup.add(s);
    flowerSprites.push({s,on:false,t:0,life:1,base:1,ph:rnd(TAU)});
  }
}
function spawnFlowerPatch(c,r){
  bloomed.add(K(c,r));
  for(let i=0;i<3;i++){
    const f=flowerSprites[flowerCursor]; flowerCursor=(flowerCursor+1)%flowerSprites.length;
    f.on=true; f.t=0; f.life=rnd(1.6,2.2); f.base=rnd(.34,.5);
    const x=W(c)+rnd(-.32,.32), z=Z(r)+rnd(-.3,.3);
    f.s.material.map=flowerTexs[rndi(0,flowerTexs.length-1)];
    f.s.visible=true; f.s.position.set(x,.1,z); f.ph=rnd(TAU);
  }
}
function updateFlowers(dt){
  for(const f of flowerSprites){
    if(!f.on) continue;
    f.t+=dt;
    if(f.t>=f.life){ f.on=false; f.s.visible=false; continue; }
    const k=f.t/f.life;
    const pop=easeOutBack(Math.min(1,f.t*3.2));
    const sc=f.base*pop*(k>.75?(1-(k-.75)/.25):1);
    f.s.scale.set(sc,sc,1);
    f.s.position.y=.08+sc*.45+Math.sin(f.ph+f.t*5)*.02;
    f.s.material.rotation=Math.sin(f.ph+f.t*4)*.18;
    f.s.material.opacity=k>.75?1-(k-.75)/.25:1;
  }
}

/* paw decals */
const pawDecals=[];
let pawCursor=0;
function makePawPool(){
  for(let i=0;i<4;i++){
    const mat=new THREE.MeshBasicMaterial({map:pawTexture,transparent:true,depthWrite:false});
    const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);
    m.rotation.x=-Math.PI/2; m.position.y=.06; m.visible=false;
    fxGroup.add(m);
    pawDecals.push({m,on:false,t:0,size:1});
  }
}
function spawnPawDecal(x,z,size,rotZ){
  const p=pawDecals[pawCursor]; pawCursor=(pawCursor+1)%pawDecals.length;
  p.on=true; p.t=0; p.size=size;
  p.m.visible=true; p.m.position.set(x,.06,z); p.m.rotation.z=rotZ;
}
function updatePaws(dt){
  for(const p of pawDecals){
    if(!p.on) continue;
    p.t+=dt;
    if(p.t>=.5){ p.on=false; p.m.visible=false; continue; }
    const k=p.t/.5;
    p.m.scale.setScalar(p.size*easeOutBack(Math.min(1,k*2)));
    p.m.material.opacity=.85*(1-k*k);
  }
}

/* markers: bomb blast preview + attack warnings */
const markers=[];
let markerCursor=0;
function makeMarkerPool(){
  for(let i=0;i<40;i++){
    const mat=new THREE.MeshBasicMaterial({map:prevTexture,transparent:true,depthWrite:false});
    const m=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),mat);
    m.rotation.x=-Math.PI/2; m.position.y=.07; m.visible=false;
    fxGroup.add(m);
    markers.push({m,on:false,t:0,life:1,warn:false});
  }
}
function spawnMarker(c,r,life,warn){
  const mk=markers[markerCursor]; markerCursor=(markerCursor+1)%markers.length;
  mk.on=true; mk.t=0; mk.life=life; mk.warn=!!warn;
  mk.m.material.map=warn?warnTexture:prevTexture;
  mk.m.visible=true; mk.m.position.set(W(c),.07,Z(r));
  return mk;
}
function updateMarkers(dt){
  for(const mk of markers){
    if(!mk.on) continue;
    mk.t+=dt;
    if(mk.t>=mk.life){ mk.on=false; mk.m.visible=false; continue; }
    const blink=mk.warn? (Math.sin(mk.t*20)>0?1:.25) : 1;
    mk.m.material.opacity=blink*(mk.warn?.95:.7)*(1-mk.t/mk.life*.5);
    mk.m.scale.setScalar(mk.warn? 1+Math.sin(mk.t*10)*.08 : .8+Math.min(1,mk.t*4)*.2);
  }
}

/* DOM score popups */
const popupEls=[];
let popupCursor=0;
function makePopupPool(){
  const box=$('#popups');
  for(let i=0;i<24;i++){
    const d=document.createElement('div'); d.className='pop'; box.appendChild(d); popupEls.push(d);
  }
}
const _v3=new THREE.Vector3();
function popup(x,y,z,txt,cls){
  const d=popupEls[popupCursor]; popupCursor=(popupCursor+1)%popupEls.length;
  _v3.set(x,y,z).project(camera);
  d.textContent=txt;
  d.className='pop '+(cls||'');
  d.style.left=((_v3.x*.5+.5)*innerWidth)+'px';
  d.style.top=((-_v3.y*.5+.5)*innerHeight)+'px';
  void d.offsetWidth;
  d.classList.add('show');
}

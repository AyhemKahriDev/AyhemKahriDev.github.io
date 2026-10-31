const CACHE='bf-v1';
const PRECACHE=['./','./index.html','./manifest.webmanifest','./icon.svg','./og.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE)
    .then(c=>Promise.all(PRECACHE.map(u=>c.add(u).catch(()=>{}))))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url); if(url.origin!==self.location.origin) return;
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(res=>{const cpy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',cpy));return res;})
      .catch(()=>caches.match('./index.html').then(r=>r||caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{const cpy=res.clone();caches.open(CACHE).then(c=>c.put(req,cpy));return res;}).catch(()=>cached)));
});
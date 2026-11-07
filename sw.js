// Ao publicar uma nova versão, altere VERSAO aqui E em index.html (const VERSAO)
const VERSAO='1.1.0';
const CACHE='cbcj2026-'+VERSAO;
const ARQ=['./','index.html','manifest.json','assets/logo-claro.png','assets/cruz.jpg','assets/icone-192.png','assets/icone-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQ)))});
self.addEventListener('message',e=>{if(e.data==='ATUALIZAR')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!e.request.url.startsWith(self.location.origin))return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})));
});

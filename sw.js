// Service worker do CBCJ 2026 — busca sempre a versão mais nova na internet
// e usa a cópia guardada só quando o aparelho está sem conexão.
const CACHE='cbcj2026';
const ARQ=['./','index.html','manifest.json','assets/logo-claro.png','assets/cruz.jpg','assets/icone-192.png','assets/icone-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQ)).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||!req.url.startsWith(self.location.origin)||req.url.includes('versao.json'))return;
  const rede=req.mode==='navigate'?fetch(req.url,{cache:'no-cache',credentials:'same-origin'}):fetch(req,{cache:'no-cache'});
  e.respondWith(rede.then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req.mode==='navigate'?'./':req,cp)).catch(()=>{})}return r})
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('./'))));
});

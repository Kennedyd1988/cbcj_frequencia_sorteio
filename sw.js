// Service worker do CBCJ 2026
// - arquivos do app: busca sempre a versão nova; usa a cópia guardada só sem internet
// - bibliotecas do Firebase e fontes: guardadas no aparelho (o app abre mesmo offline)
const CACHE='cbcj2026';
const ARQ=['./','index.html','app.js','nuvem.js','firebase-config.js','manifest.json','assets/logo-claro.png','assets/cruz.jpg','assets/icone-192.png','assets/icone-512.png'];
const EXTERNOS=['https://www.gstatic.com/firebasejs/','https://fonts.googleapis.com/','https://fonts.gstatic.com/'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQ)).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET')return;
  if(EXTERNOS.some(u=>req.url.startsWith(u))){
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(n=>{if(n.ok||n.type==='opaque'){const cp=n.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return n})));
    return;
  }
  if(!req.url.startsWith(self.location.origin)||req.url.includes('versao.json'))return;
  const rede=req.mode==='navigate'?fetch(req.url,{cache:'no-cache',credentials:'same-origin'}):fetch(req,{cache:'no-cache'});
  e.respondWith(rede.then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req.mode==='navigate'?'./':req,cp)).catch(()=>{})}return r})
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('./'))));
});

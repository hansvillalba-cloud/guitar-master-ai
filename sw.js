const CACHE="guitar-master-ai-v1-4";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./assets/logo.svg","./assets/icon.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  // No interceptar CDN externos: nunca responderles index.html como si fueran JS o audio.
  if(url.origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>{
    if(cached)return cached;
    return fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>event.request.mode==="navigate"?caches.match("./index.html"):Response.error());
  }));
});

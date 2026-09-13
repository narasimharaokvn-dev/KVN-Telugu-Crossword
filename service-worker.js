const CACHE_NAME = "kvn-crossword-pwa-20260708d";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./DYNAMIC/puzzle.html",
  "./DYNAMIC/sources.json",
  "./DYNAMIC/assets/dynamic-puzzle.css?v=20260708d",
  "./DYNAMIC/assets/dynamic-puzzle.js?v=20260708d",
  "./DYNAMIC/assets/header-leaves-left.png",
  "./DYNAMIC/assets/header-leaves-right.png",
  "./DYNAMIC/assets/splash-screen-1.png",
  "./DYNAMIC/assets/splash-screen-2.png",
  "./DYNAMIC/assets/app-icon-192.png",
  "./DYNAMIC/assets/app-icon-512.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(SHELL_FILES.map(function(path){
        return new URL(path, self.registration.scope).toString();
      }));
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){
        return key === CACHE_NAME ? null : caches.delete(key);
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET"){
    return;
  }

  const url = new URL(event.request.url);
  if(url.origin !== location.origin){
    return;
  }

  if(event.request.mode === "navigate"){
    event.respondWith(networkFirst(event.request, new URL("./index.html", self.registration.scope).toString()));
    return;
  }

  if(isPuzzleDataOrImage(url)){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

function isPuzzleDataOrImage(url){
  return /\/DYNAMIC\/.+\.(?:json|png|gif|jpg|jpeg|webp)$/i.test(url.pathname);
}

async function networkFirst(request, fallbackUrl){
  const cache = await caches.open(CACHE_NAME);
  try{
    const response = await fetch(request);
    if(response && response.ok){
      cache.put(request, response.clone());
    }
    return response;
  }catch(error){
    const cached = await cache.match(request);
    if(cached) return cached;
    if(fallbackUrl) return cache.match(fallbackUrl);
    throw error;
  }
}

async function cacheFirst(request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if(cached) return cached;

  const response = await fetch(request);
  if(response && response.ok){
    cache.put(request, response.clone());
  }
  return response;
}

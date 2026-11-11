// Service Worker mínimo — permite instalar o app de entregas na tela inicial
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function () { self.clients.claim(); });
self.addEventListener('fetch', function (e) {
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('Sem conexão. Verifique sua internet.', { status: 503 });
  }));
});

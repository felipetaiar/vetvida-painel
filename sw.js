// Service Worker minimo — habilita instalacao como PWA
// Nao faz cache agressivo para nao servir dados desatualizados do painel
self.addEventListener('install', function(e) {
  self.skipWaiting();
});
self.addEventListener('activate', function(e) {
  self.clients.claim();
});
self.addEventListener('fetch', function(e) {
  // Passa direto pela rede — sem cache, painel sempre com dados atuais
  e.respondWith(fetch(e.request).catch(function() {
    return new Response('Sem conexão. Verifique sua internet.', {status: 503});
  }));
});

// Carregamento do painel do rep: a logo acende por partes por no mínimo 0,8 s e some quando a página termina de carregar.
(function(){
  var t0 = window.__vvT0 || Date.now();
  function fim(){
    var sp = document.getElementById('vv-splash'); if(!sp) return;
    var falta = Math.max(0, 800 - (Date.now() - t0));
    setTimeout(function(){ sp.classList.add('out'); setTimeout(function(){ sp.remove(); }, 250); }, falta);
  }
  if (document.readyState === 'complete') fim(); else window.addEventListener('load', fim);
  setTimeout(function(){ var s = document.getElementById('vv-splash'); if(s) s.remove(); }, 12000);
})();

// Altura real do cabeçalho flutuante: a barra de filtros/abas gruda logo abaixo dele ao rolar.
(function(){
  function med(){
    var h = document.querySelector('.hdr, .header'); if(!h) return;
    document.documentElement.style.setProperty('--vv-hdr-h', h.offsetHeight + 'px');
  }
  window.addEventListener('load', med); window.addEventListener('resize', med); setTimeout(med, 600); setTimeout(med, 2000);
})();

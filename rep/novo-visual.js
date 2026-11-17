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

// Ao rolar para baixo só o topo fica; ao rolar para cima a barra de filtros volta.
(function(){
  var ult = window.pageYOffset || 0, tick = false;
  window.addEventListener('scroll', function(){
    if (tick) return; tick = true;
    requestAnimationFrame(function(){
      var y = window.pageYOffset || 0;
      if (y > 140 && y > ult + 6) document.body.classList.add('vv-ctrl-off');
      else if (y < ult - 6 || y <= 140) document.body.classList.remove('vv-ctrl-off');
      ult = y; tick = false;
    });
  }, {passive:true});
})();

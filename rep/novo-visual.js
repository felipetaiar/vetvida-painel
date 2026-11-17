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
// A barra só some depois que o lugar original dela já passou por cima da tela (senão sobra um buraco).
(function(){
  var ult = window.pageYOffset || 0, tick = false, sent = null;
  function ctrl(){ return document.querySelector('.ctrl'); }
  function sentinela(){
    var c = ctrl(); if(!c) return null;
    if(!sent || !sent.parentNode){
      sent = document.createElement('div'); sent.style.cssText = 'height:0;margin:0;padding:0;';
      c.parentNode.insertBefore(sent, c);
    }
    return sent;
  }
  window.addEventListener('scroll', function(){
    if (tick) return; tick = true;
    requestAnimationFrame(function(){
      var y = window.pageYOffset || 0, c = ctrl(), s = sentinela();
      if (c && s) {
        var topoFixo = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vv-hdr-h')) || 64) + 18;
        var lugarPassou = s.getBoundingClientRect().top + c.offsetHeight + 12 < topoFixo;
        if (!lugarPassou) document.body.classList.remove('vv-ctrl-off');
        else if (y > ult + 6) document.body.classList.add('vv-ctrl-off');
        else if (y < ult - 6) document.body.classList.remove('vv-ctrl-off');
      }
      ult = y; tick = false;
    });
  }, {passive:true});
})();

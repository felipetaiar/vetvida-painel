// ============================================================================
// Vet Hub — Módulo Entregas: configuração, acesso ao Supabase e roteirização
// Usado por /entregas/index.html (motorista) e /entregas/gestor.html (gestor)
// ============================================================================

var ENT = {
  SUPABASE_URL: 'https://wpmvczohuhywwnefwumf.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXZjem9odWh5d3duZWZ3dW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MzM5OTIsImV4cCI6MjA5NzQwOTk5Mn0.iKlH9SEKrw3SdLGC6kEYz99LQgmaNOSj2xblF0Bmtg4',

  // Chave Google (Routes API). Vazia = otimização local (sem trânsito).
  // Restringir a chave no Google Cloud ao domínio painel.vetvidasp.com e à Routes API.
  GOOGLE_KEY: '',

  // usuário de login -> código do motorista no ERP (tabela motor)
  MOTORISTAS: {
    alexandre: { cd: 'ALEXANDR', nome: 'Alexandre' },
    sergio:    { cd: 'SERGIOCO', nome: 'Sergio' }
  },

  MIN_POR_PARADA: 6,      // tempo médio de descarga usado na previsão
  KMH_ESTIMADO: 22,       // velocidade média urbana quando não há Google
  DIAS_JANELA: 4          // romaneios montados nos últimos N dias
};

// ── Sessão ──────────────────────────────────────────────────────────────────
function entSessao() {
  if (!sessionStorage.getItem('vv_auth') && localStorage.getItem('vv_auth') === 'ok') {
    sessionStorage.setItem('vv_auth', 'ok');
    sessionStorage.setItem('vv_perfil', localStorage.getItem('vv_perfil') || '');
    sessionStorage.setItem('vv_user', localStorage.getItem('vv_user') || '');
  }
  return {
    ok: sessionStorage.getItem('vv_auth') === 'ok',
    perfil: sessionStorage.getItem('vv_perfil') || '',
    user: (sessionStorage.getItem('vv_user') || '').toLowerCase()
  };
}
function entSair() {
  sessionStorage.clear();
  ['vv_auth', 'vv_perfil', 'vv_user', 'vv_lembrar'].forEach(function (k) { localStorage.removeItem(k); });
  window.location.href = '/?logout=1';
}

// ── Supabase REST ───────────────────────────────────────────────────────────
function sbHeaders(prefer) {
  var h = { apikey: ENT.SUPABASE_KEY, Authorization: 'Bearer ' + ENT.SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (prefer) h.Prefer = prefer;
  return h;
}
function sbGet(path) {
  return fetch(ENT.SUPABASE_URL + '/rest/v1/' + path, { headers: sbHeaders() }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error('Supabase ' + r.status + ': ' + t.slice(0, 200)); });
    return r.json();
  });
}
function sbPatch(tabela, filtro, dados) {
  return fetch(ENT.SUPABASE_URL + '/rest/v1/' + tabela + '?' + filtro, {
    method: 'PATCH', headers: sbHeaders('return=minimal'), body: JSON.stringify(dados)
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error('Supabase ' + r.status + ': ' + t.slice(0, 200)); });
    return true;
  });
}
function sbUploadFoto(caminho, blob) {
  return fetch(ENT.SUPABASE_URL + '/storage/v1/object/canhotos/' + caminho, {
    method: 'POST',
    headers: { apikey: ENT.SUPABASE_KEY, Authorization: 'Bearer ' + ENT.SUPABASE_KEY, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: blob
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error('Upload ' + r.status + ': ' + t.slice(0, 200)); });
    return ENT.SUPABASE_URL + '/storage/v1/object/public/canhotos/' + caminho;
  });
}

// Reduz a foto para no máx. 1280px / JPEG 0.7 (≈150–300 KB)
function comprimirFoto(file) {
  return new Promise(function (ok, erro) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var max = 1280, w = img.width, h = img.height;
      if (w > max || h > max) { var f = max / Math.max(w, h); w = Math.round(w * f); h = Math.round(h * f); }
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = function () { URL.revokeObjectURL(url); erro(new Error('Não foi possível ler a foto')); };
    img.src = url;
  });
}
function dataUrlParaBlob(dataUrl) {
  var p = dataUrl.split(','), bin = atob(p[1]), arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: 'image/jpeg' });
}

// ── Geometria ───────────────────────────────────────────────────────────────
function temCoord(p) { return p && typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && p.lat !== 0; }
function distKm(a, b) {
  var R = 6371, toR = Math.PI / 180;
  var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(s)) * 1.35; // fator de sinuosidade das ruas
}

// ── Otimização local: vizinho mais próximo + 2-opt ──────────────────────────
// origem: {lat,lng}; paradas: [{...lat,lng}]; retorno: {lat,lng} ou null (onde a rota termina)
function otimizarLocal(origem, paradas, retorno) {
  var pts = paradas.slice();
  if (pts.length <= 1) return pts;
  var rota = [], resto = pts.slice(), atual = origem;
  while (resto.length) {
    var mi = 0, md = Infinity;
    for (var i = 0; i < resto.length; i++) { var d = distKm(atual, resto[i]); if (d < md) { md = d; mi = i; } }
    atual = resto.splice(mi, 1)[0]; rota.push(atual);
  }
  function custo(r) {
    var c = distKm(origem, r[0]);
    for (var i = 1; i < r.length; i++) c += distKm(r[i - 1], r[i]);
    if (retorno) c += distKm(r[r.length - 1], retorno);
    return c;
  }
  var melhorou = true, best = custo(rota), voltas = 0;
  while (melhorou && voltas < 50) {
    melhorou = false; voltas++;
    for (var a = 0; a < rota.length - 1; a++) {
      for (var b = a + 1; b < rota.length; b++) {
        var nova = rota.slice(0, a).concat(rota.slice(a, b + 1).reverse(), rota.slice(b + 1));
        var c = custo(nova);
        if (c < best - 1e-9) { rota = nova; best = c; melhorou = true; }
      }
    }
  }
  return rota;
}

// ── Otimização Google (Routes API, com trânsito) ───────────────────────────
// Retorna {ordem:[paradas], legsSeg:[segundos], km} ou lança erro.
function otimizarGoogle(origem, ordemBase, retorno) {
  var destino = retorno || ordemBase[ordemBase.length - 1];
  var inter = retorno ? ordemBase.slice() : ordemBase.slice(0, -1);
  if (inter.length > 25) return Promise.reject(new Error('Mais de 25 paradas: usando otimização local'));
  function wp(p) { return { location: { latLng: { latitude: p.lat, longitude: p.lng } } }; }
  var corpo = {
    origin: wp(origem), destination: wp(destino),
    intermediates: inter.map(wp),
    travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE',
    optimizeWaypointOrder: inter.length > 1,
    languageCode: 'pt-BR', units: 'METRIC'
  };
  return fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': ENT.GOOGLE_KEY,
      'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters,routes.distanceMeters'
    },
    body: JSON.stringify(corpo)
  }).then(function (r) { return r.json(); }).then(function (j) {
    if (!j.routes || !j.routes.length) throw new Error((j.error && j.error.message) || 'Google não retornou rota');
    var rt = j.routes[0];
    var idx = rt.optimizedIntermediateWaypointIndex || inter.map(function (_, i) { return i; });
    if (idx.length && idx[0] === -1) idx = inter.map(function (_, i) { return i; });
    var ordem = idx.map(function (i) { return inter[i]; });
    if (!retorno) ordem.push(destino);
    var legs = (rt.legs || []).map(function (l) { return parseInt(String(l.duration || '0').replace('s', ''), 10) || 0; });
    return { ordem: ordem, legsSeg: legs, km: (rt.distanceMeters || 0) / 1000, fonte: 'google' };
  });
}

// Estimativa de tempos sem Google
function estimarLegs(origem, ordem, retorno) {
  var legs = [], km = 0, ant = origem;
  ordem.forEach(function (p) { var d = distKm(ant, p); km += d; legs.push(Math.round(d / ENT.KMH_ESTIMADO * 3600)); ant = p; });
  if (retorno && ordem.length) { var d2 = distKm(ant, retorno); km += d2; legs.push(Math.round(d2 / ENT.KMH_ESTIMADO * 3600)); }
  return { legsSeg: legs, km: km };
}

// Roteiriza: decide Google x local, calcula ETAs. Paradas sem coordenada vão ao final.
function roteirizar(origem, paradas, retorno, inicio) {
  var com = paradas.filter(temCoord), sem = paradas.filter(function (p) { return !temCoord(p); });
  var base = otimizarLocal(origem, com, retorno);
  var prom = (ENT.GOOGLE_KEY && base.length)
    ? otimizarGoogle(origem, base, retorno).catch(function (e) {
        console.warn('Google falhou, usando local:', e.message);
        var est = estimarLegs(origem, base, retorno);
        return { ordem: base, legsSeg: est.legsSeg, km: est.km, fonte: 'local', aviso: e.message };
      })
    : Promise.resolve((function () { var est = estimarLegs(origem, base, retorno); return { ordem: base, legsSeg: est.legsSeg, km: est.km, fonte: 'local' }; })());
  return prom.then(function (res) {
    var t = (inicio || new Date()).getTime(), etas = [];
    res.ordem.forEach(function (p, i) {
      t += (res.legsSeg[i] || 0) * 1000;
      etas.push(new Date(t));
      t += ENT.MIN_POR_PARADA * 60000;
    });
    var totalMin = Math.round((t - (inicio || new Date()).getTime()) / 60000);
    return { ordem: res.ordem.concat(sem), etas: etas, km: Math.round(res.km * 10) / 10, min: totalMin, fonte: res.fonte, aviso: res.aviso, semCoord: sem.length };
  });
}

// ── Links de navegação ──────────────────────────────────────────────────────
function enderecoTexto(p) {
  return [p.endereco, p.bairro, p.municipio].filter(Boolean).join(', ');
}
function linkGoogleMaps(p) {
  var dest = temCoord(p) ? (p.lat + ',' + p.lng) : encodeURIComponent(enderecoTexto(p));
  return 'https://www.google.com/maps/dir/?api=1&destination=' + dest + '&travelmode=driving';
}
function linkWaze(p) {
  return temCoord(p) ? 'https://waze.com/ul?ll=' + p.lat + ',' + p.lng + '&navigate=yes'
                     : 'https://waze.com/ul?q=' + encodeURIComponent(enderecoTexto(p)) + '&navigate=yes';
}
// Próximas até 9 paradas numa única rota do Google Maps
function linkRotaGoogle(paradas) {
  var ps = paradas.filter(temCoord).slice(0, 10);
  if (!ps.length) return null;
  var dest = ps[ps.length - 1], wps = ps.slice(0, -1).map(function (p) { return p.lat + ',' + p.lng; }).join('|');
  return 'https://www.google.com/maps/dir/?api=1&destination=' + dest.lat + ',' + dest.lng +
         (wps ? '&waypoints=' + encodeURIComponent(wps) : '') + '&travelmode=driving';
}

// ── Formatação ──────────────────────────────────────────────────────────────
function fmtHora(d) { if (!d) return ''; d = new Date(d); return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function fmtData(d) { if (!d) return ''; d = new Date(d); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
function fmtDur(min) { if (!min && min !== 0) return ''; var h = Math.floor(min / 60), m = min % 60; return (h ? h + 'h' : '') + (m < 10 && h ? '0' : '') + m + (h ? '' : ' min'); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function isoDiasAtras(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d.toISOString(); }

var OCORRENCIAS = ['Estabelecimento fechado', 'Cliente recusou', 'Endereço não encontrado', 'Responsável ausente', 'Avaria / falta de produto', 'Outro'];

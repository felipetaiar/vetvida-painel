// ============================================================================
// Vet Hub — Módulo Entregas: configuração, acesso ao Supabase e roteirização
// Usado por /entregas/index.html (motorista) e /entregas/gestor.html (gestor)
// ============================================================================

var ENT = {
  SUPABASE_URL: 'https://wpmvczohuhywwnefwumf.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXZjem9odWh5d3duZWZ3dW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MzM5OTIsImV4cCI6MjA5NzQwOTk5Mn0.iKlH9SEKrw3SdLGC6kEYz99LQgmaNOSj2xblF0Bmtg4',

  // Chave Google (Routes API). Vazia = otimização local (sem trânsito).
  // Restringir a chave no Google Cloud ao domínio painel.vetvidasp.com e à Routes API.
  GOOGLE_KEY: 'AIzaSyAVDjeTnYwtHbPB7dM621ppJyqm9qwQBeU',

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
function sbInsert(tabela, dados, upsertChave) {
  return fetch(ENT.SUPABASE_URL + '/rest/v1/' + tabela + (upsertChave ? '?on_conflict=' + upsertChave : ''), {
    method: 'POST', headers: sbHeaders((upsertChave ? 'resolution=merge-duplicates,' : '') + 'return=minimal'), body: JSON.stringify(dados)
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error('Supabase ' + r.status + ': ' + t.slice(0, 200)); });
    return true;
  });
}
function sbDelete(tabela, filtro) {
  return fetch(ENT.SUPABASE_URL + '/rest/v1/' + tabela + '?' + filtro, { method: 'DELETE', headers: sbHeaders('return=minimal') })
    .then(function (r) { if (!r.ok) throw new Error('Supabase ' + r.status); return true; });
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

// ── Google Routes API (trânsito + traçado) ─────────────────────────────────
// manterOrdem=true: não reordena, só calcula tempos/traçado da ordem informada.
// Retorna {ordem, legsSeg, km, polyline, fonte}.
function otimizarGoogle(origem, ordemBase, retorno, manterOrdem) {
  var destino = retorno || ordemBase[ordemBase.length - 1];
  var inter = retorno ? ordemBase.slice() : ordemBase.slice(0, -1);
  if (inter.length > 25) return Promise.reject(new Error('Mais de 25 paradas: usando cálculo local'));
  function wp(p) { return { location: { latLng: { latitude: p.lat, longitude: p.lng } } }; }
  var corpo = {
    origin: wp(origem), destination: wp(destino),
    intermediates: inter.map(wp),
    travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE',
    optimizeWaypointOrder: !manterOrdem && inter.length > 1,
    languageCode: 'pt-BR', units: 'METRIC'
  };
  return fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': ENT.GOOGLE_KEY,
      'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
    },
    body: JSON.stringify(corpo)
  }).then(function (r) { return r.json(); }).then(function (j) {
    if (!j.routes || !j.routes.length) throw new Error((j.error && j.error.message) || 'Google não retornou rota');
    var rt = j.routes[0];
    var idx = rt.optimizedIntermediateWaypointIndex;
    if (!idx || !idx.length || idx[0] === -1) idx = inter.map(function (_, i) { return i; });
    var ordem = idx.map(function (i) { return inter[i]; });
    if (!retorno) ordem.push(destino);
    var legs = (rt.legs || []).map(function (l) { return parseInt(String(l.duration || '0').replace('s', ''), 10) || 0; });
    return { ordem: ordem, legsSeg: legs, km: (rt.distanceMeters || 0) / 1000,
             polyline: rt.polyline ? rt.polyline.encodedPolyline : null, fonte: 'google' };
  });
}

// Estimativa de tempos sem Google
function estimarLegs(origem, ordem, retorno) {
  var legs = [], km = 0, ant = origem;
  ordem.forEach(function (p) { var d = distKm(ant, p); km += d; legs.push(Math.round(d / ENT.KMH_ESTIMADO * 3600)); ant = p; });
  if (retorno && ordem.length) { var d2 = distKm(ant, retorno); km += d2; legs.push(Math.round(d2 / ENT.KMH_ESTIMADO * 3600)); }
  return { legsSeg: legs, km: km };
}

function minutosDe(hhmm) { if (!hhmm) return null; var p = String(hhmm).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }

// Calcula horários: respeita tempo na parada e espera abertura da janela; marca atrasos.
function calcularEtas(ordem, legsSeg, inicio) {
  var t = (inicio || new Date()).getTime(), etas = [], atrasos = 0;
  ordem.forEach(function (p, i) {
    t += (legsSeg[i] || 0) * 1000;
    var d = new Date(t), min = d.getHours() * 60 + d.getMinutes();
    var ji = minutosDe(p.janela_inicio), jf = minutosDe(p.janela_fim);
    if (ji != null && min < ji) { t += (ji - min) * 60000; d = new Date(t); min = ji; }
    p._atraso = jf != null && min > jf;
    if (p._atraso) atrasos++;
    etas.push(new Date(t));
    t += (p.tempo_parada_min || ENT.MIN_POR_PARADA) * 60000;
  });
  if (legsSeg.length > ordem.length) t += legsSeg[ordem.length] * 1000; // volta ao ponto final
  return { etas: etas, fim: new Date(t), atrasos: atrasos };
}

// Ordem automática em blocos: prioritárias (fixadas como primeira) → refrigerados (se priorizar gelo) → demais → fixadas como última.
function ordemAutomatica(origem, paradas, retorno, prioFrio) {
  if (prioFrio === undefined) prioFrio = true;
  var meio = function (p) { return p.fixar !== 'primeira' && p.fixar !== 'ultima'; };
  var blocos = [
    paradas.filter(function (p) { return p.fixar === 'primeira'; }),
    paradas.filter(function (p) { return meio(p) && prioFrio && p.refrigerado; }),
    paradas.filter(function (p) { return meio(p) && !(prioFrio && p.refrigerado); }),
    paradas.filter(function (p) { return p.fixar === 'ultima'; })
  ].filter(function (b) { return b.length; });
  var ordem = [], ponto = origem;
  blocos.forEach(function (b, i) {
    var o = otimizarLocal(ponto, b, i === blocos.length - 1 ? retorno : null);
    ordem = ordem.concat(o); ponto = o[o.length - 1];
  });
  return { ordem: ordem, blocos: blocos.length };
}

// Roteiriza. ordemFixa=true mantém a ordem recebida (inverter, ordem manual) e só recalcula tempos/traçado.
function roteirizar(origem, paradas, retorno, inicio, ordemFixa, prioFrio) {
  if (prioFrio === undefined) prioFrio = true;
  var com = paradas.filter(temCoord), sem = paradas.filter(function (p) { return !temCoord(p); });
  var base, manter = !!ordemFixa;
  if (ordemFixa) { base = com; }
  else { var a = ordemAutomatica(origem, com, retorno, prioFrio); base = a.ordem; manter = a.blocos > 1; }
  var frios = (prioFrio && !ordemFixa) ? com.filter(function (p) { return p.refrigerado; }).length : 0;
  function local() { var est = estimarLegs(origem, base, retorno); return { ordem: base, legsSeg: est.legsSeg, km: est.km, polyline: null, fonte: 'local' }; }
  var prom = (ENT.GOOGLE_KEY && base.length)
    ? otimizarGoogle(origem, base, retorno, manter).catch(function (e) {
        console.warn('Google falhou, usando local:', e.message);
        var r = local(); r.aviso = e.message; return r;
      })
    : Promise.resolve(local());
  return prom.then(function (res) {
    var c = calcularEtas(res.ordem, res.legsSeg, inicio);
    var totalMin = Math.round((c.fim.getTime() - (inicio || new Date()).getTime()) / 60000);
    return { ordem: res.ordem.concat(sem), etas: c.etas, fim: c.fim, km: Math.round(res.km * 10) / 10, min: totalMin,
             fonte: res.fonte, aviso: res.aviso, semCoord: sem.length, frios: frios, atrasos: c.atrasos, polyline: res.polyline };
  });
}

// Decodifica o traçado do Google (encoded polyline) em [[lat,lng],...]
function decodificarPolyline(str) {
  var idx = 0, lat = 0, lng = 0, pts = [];
  while (str && idx < str.length) {
    var b, shift = 0, result = 0;
    do { b = str.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

// Romaneio "efetivo" de uma parada (pode ter sido transferida no app)
function romDaParada(p) { return p.rom_app || p.nu_rom; }

// Folha da rota para impressão
function imprimirRota(rom, paradas, nomeMotorista) {
  var linhas = paradas.map(function (p, i) {
    var nfs = (p.notas || []).map(function (n) { return n.nf || n.nu_nf; }).join(', ');
    var vol = p.volumes || p.volumes_erp || '';
    return '<tr><td>' + (p.ordem || i + 1) + '</td><td><b>' + esc(p.fantasia) + '</b>' + (p.tipo === 'coleta' ? ' <i>(coleta)</i>' : '') +
      (p.refrigerado ? ' ❄️' : '') + '<br><small>' + esc(enderecoTexto(p)) + '</small>' +
      (p.janela_inicio || p.janela_fim ? '<br><small>Horário: ' + esc(p.janela_inicio || '') + '–' + esc(p.janela_fim || '') + '</small>' : '') + '</td>' +
      '<td>' + esc(nfs) + '</td><td>' + esc(vol) + (p.posicao ? '<br><small>' + esc(p.posicao) + '</small>' : '') + '</td>' +
      '<td>' + (p.eta ? fmtHora(p.eta) : '') + '</td><td style="width:28%"></td></tr>';
  }).join('');
  var w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups para imprimir.'); return; }
  w.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Rota ' + esc(rom.rota) + ' — romaneio ' + rom.nu_rom + '</title>' +
    '<style>body{font-family:Arial,sans-serif;font-size:12px;margin:18px}h1{font-size:18px;margin:0}p{margin:4px 0 12px;color:#555}' +
    'table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:6px;vertical-align:top;text-align:left}th{background:#f2f2f2}' +
    '.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #CC0000;padding-bottom:6px;margin-bottom:8px}</style></head><body>' +
    '<div class="top"><div><h1>Vet Vida — Rota ' + esc(rom.rota) + ' · romaneio ' + rom.nu_rom + '</h1></div><div>' + new Date().toLocaleDateString('pt-BR') + '</div></div>' +
    '<p>Motorista: <b>' + esc(nomeMotorista || rom.cd_motor || '') + '</b> · ' + paradas.length + ' paradas' +
    (rom.km_estimado ? ' · ~' + Math.round(rom.km_estimado) + ' km' : '') + '</p>' +
    '<table><thead><tr><th>#</th><th>Cliente / endereço</th><th>NF</th><th>Vol.</th><th>Prev.</th><th>Recebido por / assinatura</th></tr></thead><tbody>' +
    linhas + '</tbody></table><script>window.onload=function(){window.print();}<\/script></body></html>');
  w.document.close();
}

// ── Geocodificação de endereço digitado (Google se houver chave; senão OpenStreetMap) ──
function geocodificarEndereco(txt) {
  // 1º Google (se a chave permitir); se recusar ou não achar, OpenStreetMap
  var google = ENT.GOOGLE_KEY
    ? fetch('https://maps.googleapis.com/maps/api/geocode/json?region=br&language=pt-BR&components=country:BR&address=' +
            encodeURIComponent(txt) + '&key=' + ENT.GOOGLE_KEY)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.status !== 'OK' || !j.results.length) { console.warn('Geocoding Google:', j.status, j.error_message || ''); return null; }
          var g = j.results[0];
          return { lat: g.geometry.location.lat, lng: g.geometry.location.lng, endereco: g.formatted_address };
        })
        .catch(function (e) { console.warn('Geocoding Google falhou:', e.message); return null; })
    : Promise.resolve(null);
  return google.then(function (res) {
    if (res) return res;
    return fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&accept-language=pt-BR&q=' + encodeURIComponent(txt))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.length) return null;
        return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), endereco: j[0].display_name.split(',').slice(0, 4).join(',') };
      });
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
// Rota no Google Maps: origem (opcional), até 9 paradas intermediárias e destino.
// fim: ponto final configurado (Vet Vida/casa) — só entra quando todas as paradas cabem no link.
function linkRotaGoogle(paradas, origem, fim) {
  var ps = paradas.filter(temCoord);
  if (!ps.length) return null;
  var ll = function (p) { return p.lat + ',' + p.lng; };
  var dest, wps, completo;
  if (fim && ps.length <= 9) { dest = fim; wps = ps; completo = true; }
  else { var lote = ps.slice(0, 10); dest = lote[lote.length - 1]; wps = lote.slice(0, -1); completo = ps.length <= 10 && !fim; }
  var url = 'https://www.google.com/maps/dir/?api=1' + (origem ? '&origin=' + ll(origem) : '') +
            '&destination=' + ll(dest) + (wps.length ? '&waypoints=' + encodeURIComponent(wps.map(ll).join('|')) : '') + '&travelmode=driving';
  return { url: url, completo: completo, qtd: wps.length + (completo && fim ? 0 : 1) };
}

// ── Formatação ──────────────────────────────────────────────────────────────
function fmtHora(d) { if (!d) return ''; d = new Date(d); return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function fmtData(d) { if (!d) return ''; d = new Date(d); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
function fmtDur(min) { if (!min && min !== 0) return ''; var h = Math.floor(min / 60), m = min % 60; return (h ? h + 'h' : '') + (m < 10 && h ? '0' : '') + m + (h ? '' : ' min'); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function isoDiasAtras(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d.toISOString(); }

var OCORRENCIAS = ['Estabelecimento fechado', 'Cliente recusou', 'Endereço não encontrado', 'Responsável ausente', 'Avaria / falta de produto', 'Outro'];

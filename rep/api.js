var API = '/api/sheets';

function lerContatos() {
  return fetch(API + '?action=ler').then(function(r){ return r.json(); });
}

function registrarContato(rep, cod, nome, status, obs) {
  return fetch(API, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({action:'gravar', rep:rep, cod:cod, nome:nome, status:status, obs:obs||''})
  });
}

function buscarContatosRep(rep) {
  return lerContatos().then(function(rows) {
    var resultado = {};
    // Novo formato: array de objetos do Supabase
    var lista = Array.isArray(rows) ? rows : [];
    lista.forEach(function(r) {
      if (!r) return;
      // Supabase retorna objetos — compatível com formato antigo (array) também
      var repVal  = r.rep  !== undefined ? r.rep  : r[1];
      var codVal  = r.cod_cliente !== undefined ? r.cod_cliente : parseInt(r[2]);
      var status  = r.status !== undefined ? r.status : (r[4]||'Contatado');
      var obs     = r.obs    !== undefined ? r.obs    : (r[5]||'');
      var data    = r.data_hora !== undefined ? r.data_hora : (r[0]||'');
      if (repVal === rep && codVal) {
        // Mantém o mais recente (Supabase já vem order desc)
        if (!resultado[codVal]) {
          resultado[codVal] = { status: status, obs: obs, data: data };
        }
      }
    });
    return resultado;
  });
}

function buscarResumoGestor() {
  return lerContatos().then(function(rows) {
    var hoje = new Date().toLocaleDateString('pt-BR');
    var resumo = {};
    var lista = Array.isArray(rows) ? rows : [];
    lista.forEach(function(r) {
      if (!r) return;
      var rep    = r.rep !== undefined ? r.rep : r[1];
      var cod    = r.cod_cliente !== undefined ? r.cod_cliente : parseInt(r[2]);
      var nome   = r.nome_cliente !== undefined ? r.nome_cliente : r[3];
      var status = r.status !== undefined ? r.status : (r[4]||'');
      var obs    = r.obs !== undefined ? r.obs : (r[5]||'');
      var data   = r.data_hora !== undefined ? r.data_hora : (r[0]||'');
      if (!rep) return;
      if (!resumo[rep]) resumo[rep] = {total:0, hoje:0, ultima:'', cods:{}, detalhes:[]};
      resumo[rep].cods[cod] = { status: status, obs: obs };
      resumo[rep].total++;
      var dt = data ? new Date(data).toLocaleDateString('pt-BR') : '';
      if (dt === hoje) resumo[rep].hoje++;
      if (!resumo[rep].ultima) resumo[rep].ultima = data;
      resumo[rep].detalhes.push({ data: data, nome: nome, status: status, obs: obs });
    });
    return resumo;
  });
}

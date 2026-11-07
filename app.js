'use strict';
/* ================================================================
   CBCJ 2026 — Interface do app (matrículas, chamada, frequência,
   sorteio). Os dados vêm da nuvem (nuvem.js) em tempo real.
   ================================================================ */

/* ================= Estado ================= */
const CHAVE_LOCAL = 'cbcj2026_frequencia';      // dados antigos, de antes da nuvem
const CHAVE_SOM = 'cbcj2026_som';
const CHAVE_MIGRA = 'cbcj2026_migracao_ok';
const D = { alunos: [], aulas: [], pres: {}, sorteios: [], cfg: { turma: '2026', min: 75 } };
let SOM = true; try { SOM = localStorage.getItem(CHAVE_SOM) !== '0'; } catch (e) {}
let telaAtiva = 'alunos';
let estadoApp = 'carregando';
const N = () => window.NUVEM;

/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iniciais = n => { const a = n.trim().split(/\s+/); return ((a[0] || '')[0] || '').toUpperCase() + ((a.length > 1 ? a[a.length - 1] : '')[0] || '').toUpperCase(); };
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');
const fmtData = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const hoje = () => { const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 10); };
function fmtTel(v) { const d = v.replace(/\D/g, '').slice(0, 11); if (d.length <= 2) return d ? `(${d}` : ''; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`; }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2400); }
function abrir(id) { $('#' + id).classList.add('aberto'); }
function fechar(id) { $('#' + id).classList.remove('aberto'); }
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m && m.id !== 'mVence' && m.id !== 'mMigra') fechar(m.id); }));
function baixar(nome, conteudo, tipo) { const b = new Blob([conteudo], { type: tipo }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
/* grava na nuvem sem travar a tela (funciona offline: sincroniza depois) */
function grava(p) { Promise.resolve(p).catch(e => { console.error(e); toast(e && e.code === 'permission-denied' ? 'Sem permissão para salvar' : 'Erro ao salvar na nuvem'); }); }
function nuvemPronta() { if (!N() || estadoApp !== 'pronto') { toast('Aguarde a conexão com a nuvem'); return false; } return true; }

/* ================= Ligação com a nuvem ================= */
let agendado = false;
function redesenha() {
  if (agendado) return; agendado = true;
  requestAnimationFrame(() => { agendado = false; aplicaCfg(); renderAtiva(); });
}
function renderAtiva() { ({ alunos: rAlunos, chamada: rChamada, freq: rFreq, sorteio: rSorteio, dados: rSobre })[telaAtiva](); }

window.App = {
  toast,
  estado(e, info) {
    estadoApp = e;
    document.body.dataset.estado = e;
    if (e === 'semAcesso') $('#saEmail').textContent = info || '';
    if (e === 'erro') $('#erroTxt').textContent = info || '';
    if (e === 'pronto') $('#contaEmail').textContent = info || '';
    if (e === 'login') {
      D.alunos = []; D.aulas = []; D.pres = {}; D.sorteios = [];
      const b = $('#btnEntrar'); b.disabled = false; b.textContent = 'Entrar';
      setTimeout(() => $('#lEmail').focus(), 150);
    }
  },
  dados(tipo, val, meta) {
    if (tipo === 'alunos') D.alunos = val.map(a => ({ id: a.id, nome: a.nome || '', end: a.end || '', tel: a.tel || '', criado: a.criado || 0 }));
    if (tipo === 'aulas') { D.aulas = val.map(a => ({ id: a.id, num: a.num || 0, tit: a.tit || '', data: a.data || '' })); D.pres = {}; val.forEach(a => D.pres[a.id] = a.pres || {}); }
    if (tipo === 'sorteios') D.sorteios = val;
    if (tipo === 'cfg') D.cfg = { turma: val.turma || '2026', min: val.min ?? 75 };
    if (tipo === 'alunos' && meta && !meta.fromCache) verificaMigracao();
    redesenha();
  }
};

/* ================= Conexão (status no cabeçalho) ================= */
function atualizaConexao() {
  const on = navigator.onLine; const st = $('#stNuvem');
  st.classList.toggle('off', !on);
  st.querySelector('span').textContent = on ? 'Na nuvem' : 'Sem internet';
  st.title = on ? 'Dados sincronizados com a nuvem' : 'Sem internet: o que você fizer será enviado quando a conexão voltar';
}
addEventListener('online', () => { atualizaConexao(); toast('Conexão de volta — sincronizando'); });
addEventListener('offline', () => { atualizaConexao(); toast('Sem internet — seguimos salvando no aparelho'); });

/* ================= Login ================= */
function entrar(ev) {
  ev.preventDefault();
  if (!N()) { toast('Conectando… tente em instantes'); return; }
  const email = $('#lEmail').value.trim().toLowerCase(), senha = $('#lSenha').value;
  const b = $('#btnEntrar'); b.disabled = true; b.textContent = 'Entrando…'; $('#lErro').textContent = '';
  N().entrar(email, senha).then(() => { $('#lSenha').value = ''; }).catch(e => {
    b.disabled = false; b.textContent = 'Entrar';
    const c = e && e.code || '';
    $('#lErro').textContent =
      /invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c) ? 'E-mail ou senha incorretos.' :
      /too-many-requests/.test(c) ? 'Muitas tentativas. Aguarde alguns minutos.' :
      /network/.test(c) ? 'Sem internet. Conecte-se para entrar a primeira vez.' :
      /operation-not-allowed/.test(c) ? 'Login por e-mail e senha não está ativado no Firebase.' :
      'Não foi possível entrar (' + c + ').';
  });
}
function esqueci() {
  const email = $('#lEmail').value.trim().toLowerCase();
  if (!email) { $('#lErro').textContent = 'Digite seu e-mail acima e toque de novo em “Esqueci minha senha”.'; $('#lEmail').focus(); return; }
  if (!N()) return;
  N().redefinirSenha(email).then(() => { $('#lErro').textContent = ''; toast('Enviamos um link para ' + email); })
    .catch(() => { $('#lErro').textContent = 'Não foi possível enviar o e-mail. Confira o endereço.'; });
}
function sair() { if (N()) N().sair(); }

/* ================= Migração dos dados antigos do aparelho ================= */
let dadosLocais = null;
function verificaMigracao() {
  if (verificaMigracao.feito) return; verificaMigracao.feito = true;
  try {
    if (localStorage.getItem(CHAVE_MIGRA)) return;
    const x = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || 'null');
    if (!x || !Array.isArray(x.alunos) || !x.alunos.length) return;
    dadosLocais = x;
    $('#migraTxt').innerHTML = `Encontramos <b>${x.alunos.length} aluno${x.alunos.length > 1 ? 's' : ''}</b>${(x.aulas || []).length ? ` e <b>${x.aulas.length} aula${x.aulas.length > 1 ? 's' : ''}</b>` : ''} salvos só neste aparelho, da versão anterior do app.`;
    $('#migraAviso').style.display = D.alunos.length ? '' : 'none';
    abrir('mMigra');
  } catch (e) {}
}
function migrar(enviar) {
  fechar('mMigra');
  try { localStorage.setItem(CHAVE_MIGRA, '1'); } catch (e) {}
  if (!enviar || !dadosLocais) return;
  const x = dadosLocais;
  // junta com o que já existe na nuvem (não apaga nada): só entra quem ainda não está lá
  const jaTem = new Set(D.alunos.map(a => semAcento(a.nome)));
  const novos = x.alunos.filter(a => !jaTem.has(semAcento(a.nome)));
  if (!D.alunos.length && !D.aulas.length) grava(N().substituirTudo({ alunos: [], aulas: [], sorteios: [] }, x));
  else grava(N().loteAlunos(novos.map(a => ({ nome: a.nome, end: a.end || '', tel: a.tel || '' }))));
  toast('Dados enviados para a nuvem');
}

/* ================= Frequência (cálculo) ================= */
function aulasOrd() { return [...D.aulas].sort((a, b) => (a.num - b.num) || String(a.data).localeCompare(b.data)); }
function freqDe(id) {
  const tot = D.aulas.length; if (!tot) return { p: 0, tot: 0, pct: null };
  let p = 0; D.aulas.forEach(a => { if (D.pres[a.id] && D.pres[a.id][id]) p++; });
  return { p, tot, pct: Math.round(p / tot * 100) };
}
function classeFreq(pct) { return pct === null ? 'neutro' : pct >= D.cfg.min ? 'ok' : 'alerta'; }

/* ================= Navegação ================= */
document.querySelectorAll('nav.abas button').forEach(b => b.onclick = () => irPara(b.dataset.tela));
function irPara(t) {
  telaAtiva = t;
  document.querySelectorAll('nav.abas button').forEach(b => b.classList.toggle('ativo', b.dataset.tela === t));
  document.querySelectorAll('.tela').forEach(s => s.classList.toggle('ativa', s.id === 't-' + t));
  if (t === 'dados') rDados(); else renderAtiva();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================= Matriculados ================= */
let alunoEdit = null;
$('#buscaAluno').oninput = rAlunos;
$('#fTel').oninput = e => e.target.value = fmtTel(e.target.value);
function rAlunos() {
  const q = semAcento($('#buscaAluno').value.trim());
  const n = D.alunos.length;
  $('#contAlunos').textContent = n ? `${n} aluno${n > 1 ? 's' : ''} matriculado${n > 1 ? 's' : ''}` : 'Nenhum aluno ainda';
  const ord = [...D.alunos].sort(porNome);
  const lista = ord.filter(a => !q || semAcento(a.nome + ' ' + a.end + ' ' + a.tel).includes(q));
  const el = $('#listaAlunos');
  if (!n) { el.innerHTML = `<div class="card vazio" style="grid-column:1/-1"><div class="ic"><svg class="i"><use href="#i-users"/></svg></div><h3>Nenhum matriculado</h3><p>Toque em <b>Matricular</b> para cadastrar o primeiro aluno do curso.</p></div>`; return; }
  if (!lista.length) { el.innerHTML = `<div class="vazio" style="grid-column:1/-1">Nenhum aluno encontrado.</div>`; return; }
  el.innerHTML = lista.map(a => {
    const f = freqDe(a.id); const tel = a.tel.replace(/\D/g, '');
    return `<div class="card aluno">
      <div class="avatar">${esc(iniciais(a.nome))}</div>
      <div class="info">
        <div class="nome"><span class="num">${String(ord.indexOf(a) + 1).padStart(2, '0')}</span>${esc(a.nome)}</div>
        ${a.end ? `<div class="det"><svg class="i"><use href="#i-pin"/></svg><span>${esc(a.end)}</span></div>` : ''}
        ${a.tel ? `<div class="det"><svg class="i"><use href="#i-phone"/></svg><span>${esc(a.tel)}</span></div>` : ''}
      </div>
      <div class="acts">
        <span class="mini-freq ${classeFreq(f.pct)}">${f.pct === null ? 'sem aulas' : f.pct + '%'}</span>
        <div>
          ${tel ? `<a class="btn-ic" title="WhatsApp" target="_blank" rel="noopener" href="https://wa.me/55${tel}"><svg class="i"><use href="#i-wa"/></svg></a>` : ''}
          <button class="btn-ic" title="Editar" onclick="abrirAluno('${a.id}')"><svg class="i"><use href="#i-edit"/></svg></button>
        </div>
      </div></div>`;
  }).join('');
}
function abrirAluno(id) {
  alunoEdit = id || null; const a = D.alunos.find(x => x.id === id);
  $('#mAlunoTit').textContent = a ? 'Editar matrícula' : 'Nova matrícula';
  $('#fNome').value = a ? a.nome : ''; $('#fEnd').value = a ? a.end : ''; $('#fTel').value = a ? a.tel : '';
  $('#btnExcluirAluno').style.display = a ? '' : 'none';
  $('#btnExcluirAluno').onclick = () => excluirAluno(id);
  abrir('mAluno'); setTimeout(() => $('#fNome').focus(), 100);
}
function salvarAluno() {
  if (!nuvemPronta()) return;
  const nome = $('#fNome').value.trim().replace(/\s+/g, ' ');
  if (!nome) { toast('Informe o nome completo'); $('#fNome').focus(); return; }
  const dup = D.alunos.find(x => semAcento(x.nome) === semAcento(nome) && x.id !== alunoEdit);
  if (dup && !confirm('Já existe um aluno com esse nome. Salvar mesmo assim?')) return;
  grava(N().salvarAluno(alunoEdit, { nome, end: $('#fEnd').value.trim(), tel: $('#fTel').value.trim() }));
  fechar('mAluno'); toast(alunoEdit ? 'Matrícula atualizada' : 'Aluno matriculado');
}
function excluirAluno(id) {
  const a = D.alunos.find(x => x.id === id);
  if (!confirm(`Excluir a matrícula de ${a.nome}? As presenças dele também serão apagadas.`)) return;
  grava(N().excluirAluno(id, D.aulas.filter(au => D.pres[au.id] && D.pres[au.id][id]).map(au => au.id)));
  fechar('mAluno'); toast('Matrícula excluída');
}
function abrirLote() { $('#fLote').value = ''; abrir('mLote'); setTimeout(() => $('#fLote').focus(), 100); }
function salvarLote() {
  if (!nuvemPronta()) return;
  const vistos = new Set(D.alunos.map(x => semAcento(x.nome))); const novos = [];
  $('#fLote').value.split('\n').map(l => l.trim().replace(/^"|"$/g, '')).filter(Boolean).forEach(l => {
    const [nome, end = '', tel = ''] = l.split(/[;\t]/).map(s => s.trim());
    const k = semAcento(nome);
    if (nome && !vistos.has(k)) { vistos.add(k); novos.push({ nome: nome.replace(/\s+/g, ' '), end, tel: tel ? fmtTel(tel) : '' }); }
  });
  if (novos.length) grava(N().loteAlunos(novos));
  fechar('mLote'); toast(novos.length ? `${novos.length} aluno${novos.length > 1 ? 's' : ''} matriculado${novos.length > 1 ? 's' : ''}` : 'Nenhum nome novo');
}

/* ================= Chamada ================= */
let aulaAtual = null, aulaEdit = null;
$('#selAula').onchange = e => { aulaAtual = e.target.value; rChamada(); };
function rotAula(a) { return `Lição ${String(a.num).padStart(2, '0')}${a.tit ? ' – ' + a.tit : ''}${a.data ? ' · ' + fmtData(a.data) : ''}`; }
function rChamada() {
  const aulas = aulasOrd(); const sel = $('#selAula');
  if (!aulas.find(a => a.id === aulaAtual)) aulaAtual = aulas.length ? aulas[aulas.length - 1].id : null;
  sel.innerHTML = aulas.length ? aulas.map(a => `<option value="${a.id}" ${a.id === aulaAtual ? 'selected' : ''}>${esc(rotAula(a))}</option>`).join('') : '<option>Nenhuma aula criada</option>';
  sel.disabled = !aulas.length; $('#btnEditAula').style.display = aulas.length ? '' : 'none';
  const el = $('#areaChamada');
  if (!aulas.length) { el.innerHTML = `<div class="card vazio"><div class="ic"><svg class="i"><use href="#i-book"/></svg></div><h3>Nenhuma aula registrada</h3><p>Toque em <b>Nova aula</b> para abrir a chamada da primeira lição.</p></div>`; return; }
  if (!D.alunos.length) { el.innerHTML = `<div class="card vazio"><div class="ic"><svg class="i"><use href="#i-users"/></svg></div><h3>Ninguém matriculado</h3><p>Cadastre os alunos na aba <b>Matriculados</b>.</p></div>`; return; }
  const a = D.aulas.find(x => x.id === aulaAtual); const p = D.pres[a.id] || {};
  const pres = D.alunos.filter(x => p[x.id]).length;
  el.innerHTML = `<div class="card aula-info">
      <div class="lnum">${String(a.num).padStart(2, '0')}</div>
      <div><div class="ltit">${esc(a.tit || 'Lição ' + a.num)}</div><div class="ldata">${a.data ? fmtData(a.data) : 'sem data'}</div></div>
      <div class="cont"><b id="contPres">${pres}</b><b style="opacity:.6">/${D.alunos.length}</b><small>presentes</small></div>
    </div>
    <div class="barra"><button class="btn btn-sec" onclick="marcarTodos(true)">Todos presentes</button><button class="btn btn-sec" onclick="marcarTodos(false)">Limpar</button></div>
    <div class="chamada">${[...D.alunos].sort(porNome).map(x => `<button class="pres ${p[x.id] ? 'p' : ''}" data-id="${x.id}" onclick="alternaPres(this)"><div class="avatar">${esc(iniciais(x.nome))}</div><span class="nm">${esc(x.nome)}</span><span class="tag">${p[x.id] ? 'PRESENTE' : 'FALTA'}</span></button>`).join('')}</div>`;
}
function alternaPres(btn) {
  if (!nuvemPronta()) return;
  const id = btn.dataset.id; const v = !(D.pres[aulaAtual] && D.pres[aulaAtual][id]);
  btn.classList.toggle('p', v); btn.querySelector('.tag').textContent = v ? 'PRESENTE' : 'FALTA';
  grava(N().marcarPresenca(aulaAtual, id, v));
  if (navigator.vibrate) navigator.vibrate(15);
}
function marcarTodos(v) {
  if (!nuvemPronta()) return;
  const p = {}; if (v) D.alunos.forEach(a => p[a.id] = true);
  grava(N().definirPresencas(aulaAtual, p));
}
function abrirAula(id) {
  aulaEdit = id || null; const a = D.aulas.find(x => x.id === id);
  $('#mAulaTit').textContent = a ? 'Editar aula' : 'Nova aula';
  $('#aNum').value = a ? a.num : (D.aulas.reduce((m, x) => Math.max(m, x.num), 0) + 1);
  $('#aTit').value = a ? a.tit : ''; $('#aData').value = a ? a.data : hoje();
  $('#btnExcluirAula').style.display = a ? '' : 'none'; $('#btnExcluirAula').onclick = () => excluirAula(id);
  abrir('mAula');
}
function salvarAula() {
  if (!nuvemPronta()) return;
  const num = parseInt($('#aNum').value, 10); if (!num || num < 1) { toast('Informe o número da lição'); return; }
  const dados = { num, tit: $('#aTit').value.trim(), data: $('#aData').value };
  if (aulaEdit) grava(N().editarAula(aulaEdit, dados));
  else { const r = N().novaAula(dados); aulaAtual = r.id; grava(r.p); }
  fechar('mAula'); toast(aulaEdit ? 'Aula atualizada' : 'Aula criada — faça a chamada');
}
function excluirAula(id) {
  if (!confirm('Excluir esta aula e todas as presenças dela?')) return;
  grava(N().excluirAula(id)); aulaAtual = null;
  fechar('mAula'); toast('Aula excluída');
}

/* ================= Frequência (grade) ================= */
$('#buscaFreq').oninput = rFreq; $('#ordFreq').onchange = rFreq;
function rFreq() {
  $('#lblMin').textContent = D.cfg.min + '%';
  const aulas = aulasOrd(); const fs = D.alunos.map(a => ({ a, f: freqDe(a.id) }));
  const comPct = fs.filter(x => x.f.pct !== null);
  const media = comPct.length ? Math.round(comPct.reduce((s, x) => s + x.f.pct, 0) / comPct.length) : 0;
  const aptos = comPct.filter(x => x.f.pct >= D.cfg.min).length;
  $('#stats').innerHTML = [[D.alunos.length, 'Matriculados'], [aulas.length, 'Aulas realizadas'], [aulas.length ? media + '%' : '—', 'Frequência média'], [aulas.length ? aptos : '—', `Aptos (≥ ${D.cfg.min}%)`]]
    .map(([n, l]) => `<div class="card stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
  const el = $('#areaGrade'); const sx = el.scrollLeft;
  if (!D.alunos.length || !aulas.length) { el.innerHTML = `<div class="vazio"><div class="ic"><svg class="i"><use href="#i-chart"/></svg></div><h3>Sem dados ainda</h3><p>${!D.alunos.length ? 'Cadastre os matriculados' : 'Crie a primeira aula na aba Chamada'} para ver a frequência.</p></div>`; return; }
  const q = semAcento($('#buscaFreq').value.trim()); const ord = $('#ordFreq').value;
  const lista = fs.filter(x => !q || semAcento(x.a.nome).includes(q));
  lista.sort(ord === 'nome' ? (x, y) => porNome(x.a, y.a) : ord === 'maior' ? (x, y) => y.f.pct - x.f.pct || porNome(x.a, y.a) : (x, y) => x.f.pct - y.f.pct || porNome(x.a, y.a));
  el.innerHTML = `<table class="grade"><thead><tr><th>Aluno</th>${aulas.map(a => `<th title="${esc(rotAula(a))}">L${String(a.num).padStart(2, '0')}<small>${a.data ? fmtData(a.data).slice(0, 5) : ''}</small></th>`).join('')}<th>Presenças</th><th>Frequência</th></tr></thead><tbody>
  ${lista.map(({ a, f }) => `<tr><td title="${esc(a.nome)}">${esc(a.nome)}</td>${aulas.map(au => { const p = D.pres[au.id] && D.pres[au.id][a.id]; return `<td><button class="cel ${p ? 'P' : 'F'}" onclick="celula('${au.id}','${a.id}')">${p ? 'P' : 'F'}</button></td>`; }).join('')}
  <td><b>${f.p}</b>/${f.tot}</td><td><div class="pct"><div class="bar"><i style="width:${f.pct}%"></i></div><b style="color:${f.pct >= D.cfg.min ? 'var(--verde)' : 'var(--verm)'}">${f.pct}%</b></div></td></tr>`).join('')}
  </tbody></table>`;
  el.scrollLeft = sx;
}
function celula(au, al) { if (!nuvemPronta()) return; grava(N().marcarPresenca(au, al, !(D.pres[au] && D.pres[au][al]))); }
function csv(linhas) { return '﻿' + linhas.map(l => l.map(c => { c = String(c ?? ''); return /[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c; }).join(';')).join('\r\n'); }
function exportarCSV() {
  const aulas = aulasOrd();
  const l = [['Nº', 'Aluno', ...aulas.map(a => `L${String(a.num).padStart(2, '0')} ${fmtData(a.data)}`), 'Presenças', 'Faltas', 'Frequência', 'Situação']];
  [...D.alunos].sort(porNome).forEach((a, i) => { const f = freqDe(a.id); l.push([i + 1, a.nome, ...aulas.map(au => D.pres[au.id] && D.pres[au.id][a.id] ? 'P' : 'F'), f.p, f.tot - f.p, (f.pct ?? 0) + '%', f.pct >= D.cfg.min ? 'Apto' : 'Abaixo do mínimo']); });
  baixar(`Frequencia_CBCJ_${D.cfg.turma}.csv`, csv(l), 'text/csv;charset=utf-8');
}
function exportarAlunos() {
  const l = [['Nº', 'Nome completo', 'Endereço', 'Telefone', 'Frequência']];
  [...D.alunos].sort(porNome).forEach((a, i) => { const f = freqDe(a.id); l.push([i + 1, a.nome, a.end, a.tel, f.pct === null ? '' : f.pct + '%']); });
  baixar(`Matriculados_CBCJ_${D.cfg.turma}.csv`, csv(l), 'text/csv;charset=utf-8');
}

/* ================= Sorteio ================= */
let LARG = 232;
function medeCartao() { const cw = Math.min(220, Math.round($('#janela').clientWidth * 0.56)); $('#fita').style.setProperty('--cw', cw + 'px'); LARG = cw + 12; }
let girando = false, ctxAudio = null;
['luzesC', 'luzesB'].forEach(id => $('#' + id).innerHTML = '<i></i>'.repeat(14));
$('#sortFiltro').onchange = () => { $('#boxSortAula').style.display = $('#sortFiltro').value === 'aula' ? '' : 'none'; rSorteio(); };
$('#sortAula').onchange = rSorteio; $('#sortSemRepetir').onchange = rSorteio;
function pool() {
  let l = [...D.alunos]; const f = $('#sortFiltro').value;
  if (f === 'aptos') l = l.filter(a => { const x = freqDe(a.id); return x.pct !== null && x.pct >= D.cfg.min; });
  if (f === 'aula') { const au = $('#sortAula').value; l = l.filter(a => D.pres[au] && D.pres[au][a.id]); }
  if ($('#sortSemRepetir').checked) { const ja = new Set(D.sorteios.map(s => s.alunoId)); l = l.filter(a => !ja.has(a.id)); }
  return l;
}
function rSorteio() {
  const aulas = aulasOrd(); const sa = $('#sortAula'); const v = sa.value;
  sa.innerHTML = aulas.length ? aulas.map(a => `<option value="${a.id}">${esc(rotAula(a))}</option>`).join('') : '<option value="">Nenhuma aula</option>';
  if (aulas.find(a => a.id === v)) sa.value = v; else if (aulas.length) sa.value = aulas[aulas.length - 1].id;
  $('#btnSom').style.color = SOM ? 'var(--vinho)' : ''; $('#btnSom').style.opacity = SOM ? 1 : .45;
  const p = pool();
  $('#poolInfo').innerHTML = `<b>${p.length}</b> nome${p.length !== 1 ? 's' : ''} na roleta`;
  $('#btnSortear').disabled = !p.length || girando;
  if (!girando) montarFita(p.length ? p : D.alunos, null);
  const h = $('#listaHist'); const n = D.sorteios.length;
  h.innerHTML = n ? [...D.sorteios].reverse().map((s, i) => `<li><span class="pos">${n - i}º</span><span class="q">${esc(s.nome)}</span><small>${new Date(s.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></li>`).join('') : '<li style="background:none;color:var(--suave);justify-content:center">Nenhum sorteio ainda</li>';
}
function embaralha(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function montarFita(lista, vencedor) {
  const fita = $('#fita'); fita.style.transition = 'none'; medeCartao();
  if (!lista.length) { fita.innerHTML = `<div class="nm-card" style="margin-left:calc(50% - var(--cw,220px)/2 - 6px)">Cadastre alunos</div>`; fita.style.transform = 'translateX(0)'; return 0; }
  let itens = []; const min = vencedor ? 70 : 12;
  while (itens.length < min) itens = itens.concat(embaralha(lista));
  let alvo = 0;
  if (vencedor) { alvo = itens.length - 5; itens[alvo] = vencedor; if (itens[alvo - 1] && itens[alvo - 1].id === vencedor.id && lista.length > 1) itens[alvo - 1] = lista.find(x => x.id !== vencedor.id); }
  fita.innerHTML = itens.map(a => `<div class="nm-card">${esc(a.nome)}</div>`).join('');
  const w = $('#janela').clientWidth;
  const ini = vencedor ? 0 : -(Math.floor(itens.length / 2) * LARG + LARG / 2 - w / 2);
  fita.style.transform = `translateX(${ini}px)`;
  return alvo;
}
function sortear() {
  if (girando) return; if (!nuvemPronta()) return;
  const p = pool(); if (!p.length) { toast('Não há nomes para sortear'); return; }
  const arr = new Uint32Array(1); crypto.getRandomValues(arr);
  const venc = p[arr[0] % p.length];
  girando = true; $('#btnSortear').disabled = true;
  const maq = $('#maquina'); maq.classList.remove('ganhou'); maq.classList.add('girando');
  const alvo = montarFita(p, venc);
  const w = $('#janela').clientWidth;
  const jitter = (Math.random() - .5) * (LARG * .5);
  const fim = -(alvo * LARG + LARG / 2 - w / 2) + jitter * 0.6;
  const dur = 6200 + Math.random() * 900; const t0 = performance.now(); const fita = $('#fita');
  let ultimo = 0;
  const ease = t => 1 - Math.pow(1 - t, 4.2);
  (function passo(t) {
    const k = Math.min(1, (t - t0) / dur); const x = fim * ease(k);
    fita.style.transform = `translateX(${x}px)`;
    const idx = Math.floor((-x + w / 2) / LARG); if (idx !== ultimo) { ultimo = idx; tique(); }
    if (k < 1) requestAnimationFrame(passo);
    else {
      fita.style.transition = 'transform .45s cubic-bezier(.3,1.4,.5,1)';
      fita.style.transform = `translateX(${-(alvo * LARG + LARG / 2 - w / 2)}px)`;
      setTimeout(() => {
        fita.children[alvo].classList.add('vence'); maq.classList.remove('girando'); maq.classList.add('ganhou'); fanfarra();
        grava(N().registrarSorteio({ alunoId: venc.id, nome: venc.nome, quando: Date.now() }));
        setTimeout(() => { $('#nomeVence').textContent = venc.nome; abrir('mVence'); confete(); girando = false; if (telaAtiva === 'sorteio') rSorteio(); }, 700);
      }, 480);
    }
  })(t0);
}
function audio() { if (!SOM) return null; try { ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)(); return ctxAudio; } catch (e) { return null; } }
function tique() { const c = audio(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = 1500; g.gain.setValueAtTime(.05, c.currentTime); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .04); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + .05); }
function fanfarra() { const c = audio(); if (!c) return; [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f; const t = c.currentTime + i * .12; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.15, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .5); o.connect(g).connect(c.destination); o.start(t); o.stop(t + .55); }); }
function alternaSom() { SOM = !SOM; try { localStorage.setItem(CHAVE_SOM, SOM ? '1' : '0'); } catch (e) {} rSorteio(); toast(SOM ? 'Som ligado' : 'Som desligado'); }
function limparHist() {
  if (!D.sorteios.length || !nuvemPronta()) return;
  if (!confirm('Limpar o histórico de sorteados? Todos voltam a participar.')) return;
  grava(N().limparSorteios(D.sorteios.map(s => s.id)));
}
function confete() {
  const cv = $('#confete'), c = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cores = ['#8E1B2E', '#C9962B', '#E9C77B', '#5E0F1D', '#ffffff'];
  const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, c: cores[Math.random() * cores.length | 0], a: Math.random() * 6, va: (Math.random() - .5) * .3 }));
  const t0 = performance.now();
  (function f(t) {
    c.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); });
    if (t - t0 < 3200) requestAnimationFrame(f); else c.clearRect(0, 0, cv.width, cv.height);
  })(t0);
}
addEventListener('resize', () => { if (!girando && telaAtiva === 'sorteio') rSorteio(); });

/* ================= Dados ================= */
function rDados() { rSobre(); $('#cfgTurma').value = D.cfg.turma; $('#cfgMin').value = D.cfg.min; }
function salvarCfg() {
  if (!nuvemPronta()) return;
  const m = parseInt($('#cfgMin').value, 10);
  grava(N().salvarCfg({ turma: $('#cfgTurma').value.trim() || '2026', min: isNaN(m) ? 75 : Math.max(0, Math.min(100, m)) }));
  toast('Ajustes salvos');
}
function aplicaCfg() { $('#tituloTurma').textContent = D.cfg.turma; }
function backup() {
  const x = { app: 'CBCJ', versao: VERSAO, gerado: new Date().toISOString(), alunos: D.alunos, aulas: D.aulas.map(a => ({ ...a, pres: D.pres[a.id] || {} })), sorteios: D.sorteios, cfg: D.cfg };
  baixar(`Backup_CBCJ_${D.cfg.turma}_${hoje()}.json`, JSON.stringify(x, null, 1), 'application/json'); toast('Cópia baixada');
}
function restaurar(inp) {
  const f = inp.files[0]; if (!f || !nuvemPronta()) { inp.value = ''; return; } const r = new FileReader();
  r.onload = () => {
    try {
      const x = JSON.parse(r.result); if (!Array.isArray(x.alunos)) throw 0;
      if (!confirm(`Restaurar a cópia com ${x.alunos.length} alunos e ${(x.aulas || []).length} aulas? Os dados atuais da nuvem serão substituídos.`)) return;
      grava(N().substituirTudo({ alunos: D.alunos, aulas: D.aulas, sorteios: D.sorteios }, x)); toast('Dados restaurados');
    } catch (e) { toast('Arquivo inválido'); }
    inp.value = '';
  };
  r.readAsText(f);
}
function zerar() {
  if (!nuvemPronta()) return;
  if (!confirm('Apagar TODOS os dados do curso na nuvem? Isso afeta todos os aparelhos.')) return;
  if (!confirm('Tem certeza? Isso não pode ser desfeito.')) return;
  grava(N().substituirTudo({ alunos: D.alunos, aulas: D.aulas, sorteios: D.sorteios }, { cfg: { turma: '2026', min: 75 } }));
  irPara('alunos'); toast('Dados apagados');
}

/* ================= Versão e novidades ================= */
const VERSAO = '2.0.0';
const NOVIDADES = [
  { v: '2.0.0', d: '07/11/2026', itens: ['Dados salvos na nuvem (Firebase): iguais no celular e no computador', 'Funciona sem internet e sincroniza quando a conexão volta', 'Acesso com e-mail e senha', 'Envio dos dados antigos do aparelho para a nuvem'] },
  { v: '1.2.0', d: '07/11/2026', itens: ['Aviso de nova versão corrigido: só aparece quando há versão nova publicada'] },
  { v: '1.1.0', d: '07/11/2026', itens: ['Botão “Instalar app”, número da versão e lista de novidades'] },
  { v: '1.0.0', d: '07/11/2026', itens: ['Matriculados, chamada, frequência com %, sorteio em roleta e cópia de segurança'] }
];
function rSobre() {
  $('#lblVersao').textContent = 'v' + VERSAO; $('#rodVersao').textContent = 'v' + VERSAO;
  $('#listaNovidades').innerHTML = NOVIDADES.map(n => `<li><b>v${n.v}</b><small>${n.d}</small><ul>${n.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul></li>`).join('');
  $('#btnInstalar2').style.display = instalado() ? 'none' : '';
}

/* ================= Instalar app ================= */
let promptInstalar = null;
const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function instalado() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
function mostraBotaoInstalar() { $('#btnInstalar').classList.toggle('on', !instalado() && (!!promptInstalar || ehIOS)); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstalar = e; mostraBotaoInstalar(); });
addEventListener('appinstalled', () => { promptInstalar = null; mostraBotaoInstalar(); rSobre(); toast('App instalado!'); });
async function instalar() {
  if (instalado()) { toast('O app já está instalado'); return; }
  if (promptInstalar) { promptInstalar.prompt(); const r = await promptInstalar.userChoice; promptInstalar = null; mostraBotaoInstalar(); if (r.outcome === 'accepted') toast('Instalando…'); return; }
  abrir(ehIOS ? 'mIos' : 'mInstalar');
}

/* ================= Atualizações (compara com versao.json) ================= */
if (/[?&]v=/.test(location.search)) history.replaceState(null, '', location.pathname);
async function versaoRemota() { try { const r = await fetch('versao.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return null; return (await r.json()).versao || null; } catch (e) { return null; } }
async function checarVersao(manual) {
  if (location.protocol === 'file:') { if (manual) toast('Verificação disponível só no endereço publicado'); return; }
  const v = await versaoRemota();
  if (!v) { if (manual) toast('Não foi possível verificar agora'); return; }
  if (v !== VERSAO) { $('#lblNova').textContent = 'v' + v; $('#barraAtualiza').classList.add('on'); }
  else { $('#barraAtualiza').classList.remove('on'); if (manual) toast('Você já está na versão mais recente (v' + VERSAO + ')'); }
}
function verificarAtualizacao() { toast('Verificando…'); checarVersao(true); }
async function aplicarAtualizacao() {
  const b = $('#barraAtualiza .btn'); b.disabled = true; b.textContent = 'Atualizando…';
  try { if ('serviceWorker' in navigator) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.update().catch(() => {}))); } } catch (e) {}
  try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (e) {}
  location.replace(location.pathname + '?v=' + Date.now());
}
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
checarVersao(false);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checarVersao(false); });
setInterval(() => checarVersao(false), 30 * 60 * 1000);

/* ================= Início ================= */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal.aberto').forEach(m => { if (m.id !== 'mMigra') fechar(m.id); });
  if (e.key === 'Enter' && $('#mAluno').classList.contains('aberto')) salvarAluno();
});
document.body.dataset.estado = 'carregando';
aplicaCfg(); atualizaConexao(); rAlunos(); rSobre(); mostraBotaoInstalar();

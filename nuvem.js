// ============================================================
//  NUVEM — Firebase Auth + Firestore (com funcionamento offline)
//  Toda a comunicação com o banco fica neste arquivo.
// ============================================================
import { firebaseConfig, TURMA_ID } from './firebase-config.js';

const V = '10.12.2';
const URL = n => `https://www.gstatic.com/firebasejs/${V}/firebase-${n}.js`;
const App = window.App;

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('COLE')) {
  App.estado('config');
} else {
  iniciar().catch(e => {
    console.error(e);
    App.estado('erro', 'Não foi possível conectar ao Firebase. Verifique a internet e tente de novo.');
  });
}

async function iniciar() {
  const [{ initializeApp }, A, F] = await Promise.all([import(URL('app')), import(URL('auth')), import(URL('firestore'))]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);

  let db;
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    db = F.getFirestore(app);
  }

  const base = F.doc(db, 'turmas', TURMA_ID);
  const col = n => F.collection(base, n);
  let parar = [];
  let usuario = null;

  async function emLotes(ops) {
    const p = [];
    for (let i = 0; i < ops.length; i += 450) {
      const b = F.writeBatch(db);
      ops.slice(i, i + 450).forEach(f => f(b));
      p.push(b.commit());
    }
    return Promise.all(p);
  }

  function ouvir() {
    parar.forEach(f => f()); parar = [];
    const erro = e => {
      console.error(e);
      if (e.code === 'permission-denied') App.estado('semAcesso', usuario && usuario.email);
      else App.toast('Erro de conexão com a nuvem');
    };
    const pronto = () => App.estado('pronto', usuario.email);
    parar.push(F.onSnapshot(col('alunos'), { includeMetadataChanges: true }, s => {
      pronto(); App.dados('alunos', s.docs.map(d => ({ id: d.id, ...d.data() })), s.metadata);
    }, erro));
    parar.push(F.onSnapshot(col('aulas'), s => {
      App.dados('aulas', s.docs.map(d => ({ id: d.id, ...d.data() })), s.metadata);
    }, erro));
    parar.push(F.onSnapshot(F.query(col('sorteios'), F.orderBy('quando')), s => {
      App.dados('sorteios', s.docs.map(d => ({ id: d.id, ...d.data() })), s.metadata);
    }, erro));
    parar.push(F.onSnapshot(base, s => {
      App.dados('cfg', s.exists() ? s.data() : {}, s.metadata);
    }, erro));
  }

  window.NUVEM = {
    // ---- conta ----
    entrar: (email, senha) => A.signInWithEmailAndPassword(auth, email, senha),
    sair: () => A.signOut(auth),
    redefinirSenha: email => A.sendPasswordResetEmail(auth, email),

    // ---- alunos ----
    salvarAluno(id, dados) {
      if (id) return F.updateDoc(F.doc(col('alunos'), id), dados);
      return F.setDoc(F.doc(col('alunos')), { ...dados, criado: Date.now() });
    },
    loteAlunos(lista) {
      return emLotes(lista.map(a => b => b.set(F.doc(col('alunos')), { ...a, criado: Date.now() })));
    },
    excluirAluno(id, aulasComPresenca) {
      const ops = [b => b.delete(F.doc(col('alunos'), id))];
      aulasComPresenca.forEach(au => ops.push(b => b.update(F.doc(col('aulas'), au), { ['pres.' + id]: F.deleteField() })));
      return emLotes(ops);
    },

    // ---- aulas e presença ----
    novaAula(dados) {
      const r = F.doc(col('aulas'));
      return { id: r.id, p: F.setDoc(r, { ...dados, pres: {} }) };
    },
    editarAula: (id, dados) => F.updateDoc(F.doc(col('aulas'), id), dados),
    excluirAula: id => F.deleteDoc(F.doc(col('aulas'), id)),
    marcarPresenca: (aula, aluno, presente) =>
      F.updateDoc(F.doc(col('aulas'), aula), { ['pres.' + aluno]: presente ? true : F.deleteField() }),
    definirPresencas: (aula, pres) => F.updateDoc(F.doc(col('aulas'), aula), { pres }),

    // ---- sorteio ----
    registrarSorteio: s => F.setDoc(F.doc(col('sorteios')), s),
    limparSorteios: ids => emLotes(ids.map(id => b => b.delete(F.doc(col('sorteios'), id)))),

    // ---- configuração ----
    salvarCfg: cfg => F.setDoc(base, cfg, { merge: true }),

    // ---- importar / apagar ----
    substituirTudo(atual, novo) {
      const ops = [];
      atual.alunos.forEach(a => ops.push(b => b.delete(F.doc(col('alunos'), a.id))));
      atual.aulas.forEach(a => ops.push(b => b.delete(F.doc(col('aulas'), a.id))));
      atual.sorteios.forEach(s => ops.push(b => b.delete(F.doc(col('sorteios'), s.id))));
      (novo.alunos || []).forEach(a => ops.push(b => b.set(F.doc(col('alunos'), a.id), {
        nome: a.nome || '', end: a.end || '', tel: a.tel || '', criado: a.criado || Date.now()
      })));
      (novo.aulas || []).forEach(a => ops.push(b => b.set(F.doc(col('aulas'), a.id), {
        num: a.num, tit: a.tit || '', data: a.data || '', pres: a.pres || (novo.pres && novo.pres[a.id]) || {}
      })));
      (novo.sorteios || []).forEach(s => ops.push(b => b.set(F.doc(col('sorteios')), {
        alunoId: s.alunoId || s.id, nome: s.nome, quando: s.quando || Date.now()
      })));
      if (novo.cfg) ops.push(b => b.set(base, { turma: novo.cfg.turma || '2026', min: novo.cfg.min ?? 70 }, { merge: true }));
      return emLotes(ops);
    }
  };

  A.onAuthStateChanged(auth, u => {
    usuario = u;
    if (!u) { parar.forEach(f => f()); parar = []; App.estado('login'); return; }
    App.estado('carregando');
    ouvir();
  });
}

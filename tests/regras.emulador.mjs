// Teste das regras do Firestore no emulador (não roda no npm test: precisa de Java).
// Uso, numa pasta separada com firebase-tools, @firebase/rules-unit-testing e firebase instalados:
//   npx firebase emulators:exec --only firestore --project demo-quadro-pix "node regras.emulador.mjs firestore.rules"

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDoc, getDocs, writeBatch } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-quadro-pix',
  firestore: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8080 },
});
const E = (c) => (c.includes('@') ? c : `${c}@quadro-pix.firebaseapp.com`);
const ctx = (c) => env.authenticatedContext(c, { email: E(c) }).firestore();
const card = (col) => ({ columnId: col, origemId: col, chavePix: 'k', favorecido: 'F', descricao: 'd', valor: 10, precisaComprovante: false, createdAt: new Date().toISOString(), archived: false });
const nomes = { leao: 'Churrascaria Leão do Parque', pier49: 'Restaurante Pier 49', chefe: 'Chefe', financeiro: 'Financeiro', desenvolvedor: 'Desenvolvedor' };
const log = (c, ator = nomes[c]) => ({ acao: 'x', ator, detalhe: 'x', em: new Date().toISOString(), email: E(c) });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'cards/c1'), card('leao'));
  await setDoc(doc(db, 'cards/old'), { columnId: 'leao', origemId: 'leao', chavePix: 'k', favorecido: 'F', valor: 10, createdAt: 'x' });
  await setDoc(doc(db, 'cards/feito'), { ...card('leao'), columnId: 'feito' });
  await setDoc(doc(db, 'cards/p1'), card('pier49'));
  await setDoc(doc(db, 'acessos/centro@quadro-pix.firebaseapp.com'), { papel: 'bloqueado', empresaId: '' });
  await setDoc(doc(db, 'acessos/novo@exemplo.com'), { papel: 'empresa', empresaId: 'leao' });
});
const edit = { chavePix: 'k2', favorecido: 'F2', descricao: 'd2', valor: 20, precisaComprovante: true };
let falhas = 0;
const r = async (name, esperado, p) => {
  let ok;
  try { await p; ok = true; } catch (e) { ok = false; }
  const certo = ok === esperado;
  if (!certo) falhas++;
  console.log(certo ? 'OK  ' : 'ERRO', name, '->', ok ? 'permitido' : 'negado');
};
await r('leao lê cards', true, getDoc(doc(ctx('leao'), 'cards/c1')));
await r('leao cria na leao', true, setDoc(doc(ctx('leao'), 'cards/c2'), card('leao')));
await r('leao cria na pier (nega)', false, setDoc(doc(ctx('leao'), 'cards/c3'), card('pier49')));
await r('leao edita card da leao', true, updateDoc(doc(ctx('leao'), 'cards/c1'), edit));
await r('leao edita card antigo da leao', true, updateDoc(doc(ctx('leao'), 'cards/old'), edit));
await r('leao edita card em Feito (nega)', false, updateDoc(doc(ctx('leao'), 'cards/feito'), edit));
await r('leao muda coluna (nega)', false, updateDoc(doc(ctx('leao'), 'cards/c1'), { columnId: 'feito' }));
await r('leao exclui (nega)', false, deleteDoc(doc(ctx('leao'), 'cards/c1')));
await r('pier edita card da leao (nega)', false, updateDoc(doc(ctx('pier49'), 'cards/c1'), edit));
await r('pier edita card da pier', true, updateDoc(doc(ctx('pier49'), 'cards/p1'), edit));
await r('leao registra atividade', true, addDoc(collection(ctx('leao'), 'audit_log'), log('leao')));
await r('leao registra como chefe (nega)', false, addDoc(collection(ctx('leao'), 'audit_log'), log('leao', 'Chefe')));
await r('leao registra sem email (nega)', false, addDoc(collection(ctx('leao'), 'audit_log'), (({ email, ...resto }) => resto)(log('leao'))));
await r('leao lê atividades (nega)', false, getDocs(collection(ctx('leao'), 'audit_log')));
await r('financeiro cria na pier', true, setDoc(doc(ctx('financeiro'), 'cards/f1'), card('pier49')));
await r('financeiro edita card da leao', true, updateDoc(doc(ctx('financeiro'), 'cards/c1'), edit));
await r('financeiro marca feito (nega)', false, updateDoc(doc(ctx('financeiro'), 'cards/c1'), { columnId: 'feito' }));
await r('financeiro registra atividade', true, addDoc(collection(ctx('financeiro'), 'audit_log'), log('financeiro')));
await r('chefe marca feito', true, updateDoc(doc(ctx('chefe'), 'cards/c1'), { columnId: 'feito', pagoEm: 'x' }));
await r('chefe exclui', true, deleteDoc(doc(ctx('chefe'), 'cards/c2')));
await r('chefe lê atividades', true, getDocs(collection(ctx('chefe'), 'audit_log')));
await r('chefe registra atividade', true, addDoc(collection(ctx('chefe'), 'audit_log'), log('chefe')));
await r('dev lê cards', true, getDoc(doc(ctx('desenvolvedor'), 'cards/p1')));
await r('dev edita card (nega)', false, updateDoc(doc(ctx('desenvolvedor'), 'cards/p1'), edit));
await r('dev lê atividades', true, getDocs(collection(ctx('desenvolvedor'), 'audit_log')));
await r('dev lista acessos', true, getDocs(collection(ctx('desenvolvedor'), 'acessos')));
await r('leao lista acessos (nega)', false, getDocs(collection(ctx('leao'), 'acessos')));
await r('novo lê o próprio acesso', true, getDoc(doc(ctx('novo@exemplo.com'), 'acessos/novo@exemplo.com')));
await r('novo (liberado como leao) edita card da leao', true, updateDoc(doc(ctx('novo@exemplo.com'), 'cards/old'), edit));
await r('centro bloqueado lê cards (nega)', false, getDoc(doc(ctx('centro'), 'cards/p1')));
await r('desconhecido lê cards (nega)', false, getDoc(doc(ctx('x@exemplo.com'), 'cards/p1')));
const dv = ctx('desenvolvedor');
const b = writeBatch(dv);
b.set(doc(dv, 'acessos/fulano@exemplo.com'), { papel: 'financeiro', empresaId: '', atualizadoEm: 'a', atualizadoPor: E('desenvolvedor') });
b.set(doc(collection(dv, 'audit_log')), log('desenvolvedor'));
await r('dev muda acesso + registro (batch)', true, b.commit());
await r('dev muda o desenvolvedor fixo (nega)', false, setDoc(doc(ctx('desenvolvedor'), 'acessos/' + E('desenvolvedor')), { papel: 'bloqueado', empresaId: '', atualizadoEm: 'a', atualizadoPor: E('desenvolvedor') }));
await r('chefe muda acesso (nega)', false, setDoc(doc(ctx('chefe'), 'acessos/y@exemplo.com'), { papel: 'chefe', empresaId: '', atualizadoEm: 'a', atualizadoPor: E('chefe') }));
await env.cleanup();
console.log(falhas ? `${falhas} RESULTADO(S) ERRADO(S)` : 'TODOS OS CASOS CERTOS');

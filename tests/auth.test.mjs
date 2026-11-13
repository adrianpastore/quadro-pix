import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Evaluate only the actual pure declarations; never initialize React or Firebase.
const source = readFileSync(new URL('../src/app.jsx', import.meta.url), 'utf8');
function extract(pattern, name) {
  const match = source.match(pattern);
  assert.ok(match, `Declaration not found: ${name}`);
  return match[0];
}
const declarations = [
  extract(/^const EMPRESAS = \[[\s\S]*?^\];/m, 'EMPRESAS'),
  extract(/^const CHEFE_EMAIL = .*;$/m, 'CHEFE_EMAIL'),
  extract(/^const FINANCEIRO_EMAIL = .*;$/m, 'FINANCEIRO_EMAIL'),
  extract(/^const DESENVOLVEDOR_EMAIL = .*;$/m, 'DESENVOLVEDOR_EMAIL'),
  extract(/^const PAPEIS_GERAIS = .*;$/m, 'PAPEIS_GERAIS'),
  extract(/^function papelDoEmail\(email\) \{[\s\S]*?^\}/m, 'papelDoEmail'),
  extract(/^function resolverAcesso\(email, acesso\) \{[\s\S]*?^\}/m, 'resolverAcesso'),
  extract(/^function nomeDoAcesso\(acesso\) \{[\s\S]*?^\}/m, 'nomeDoAcesso'),
  extract(/^function emailDoBotao\(role, emailDigitado\) \{[\s\S]*?^\}/m, 'emailDoBotao'),
  extract(/^function authErro\(code\) \{[\s\S]*?^\}/m, 'authErro'),
];
const { papelDoEmail, authErro, resolverAcesso, nomeDoAcesso, emailDoBotao } = vm.runInNewContext(
  declarations.join('\n') + '\n({ papelDoEmail, authErro, resolverAcesso, nomeDoAcesso, emailDoBotao })',
  {}, { timeout: 1000 },
);
const accounts = [
  ['chefe', { type: 'chefe' }],
  ['financeiro', { type: 'financeiro' }],
  ['desenvolvedor', { type: 'desenvolvedor' }],
  ...['leao', 'pier49', 'centro', 'cassino'].map(id => [id, { type: 'empresa', id }]),
];
for (const [account, expected] of accounts) {
  for (const uppercase of [false, true]) {
    const email = `${account}@quadro-pix.firebaseapp.com`;
    test(`papelDoEmail: ${account}${uppercase ? ' uppercase' : ''}`, () => {
      // Normalize cross-realm prototypes before comparing the complete result.
      assert.deepEqual(JSON.parse(JSON.stringify(papelDoEmail(uppercase ? email.toUpperCase() : email))), expected);
    });
  }
}
for (const email of ['desconhecido@quadro-pix.firebaseapp.com', 'chefe@example.com', '', null, undefined]) {
  test(`papelDoEmail rejects ${String(email)}`, () => assert.equal(papelDoEmail(email), null));
}
for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials']) {
  test(`authErro: ${code}`, () => assert.equal(authErro(code), 'Senha incorreta.'));
}
for (const [code, expected] of [
  ['auth/user-not-found', 'Conta não encontrada. Fale com o responsável.'],
  ['auth/user-disabled', 'Esta conta foi desativada. Fale com o responsável.'],
  ['auth/too-many-requests', 'Muitas tentativas. Espere alguns minutos e tente de novo.'],
  ['auth/network-request-failed', 'Sem conexão com a internet.'],
  ['auth/unknown', 'Não foi possível entrar. Tente de novo.'],
  [undefined, 'Não foi possível entrar. Tente de novo.'],
]) {
  test(`authErro: ${String(code)}`, () => assert.equal(authErro(code), expected));
}

const plain = (v) => JSON.parse(JSON.stringify(v));
const D = (c) => `${c}@quadro-pix.firebaseapp.com`;
test('resolverAcesso: sem documento usa o padrão', () => {
  assert.deepEqual(plain(resolverAcesso(D('leao'), null)), { type: 'empresa', id: 'leao' });
  assert.equal(resolverAcesso('novo@exemplo.com', null), null);
});
test('resolverAcesso: o documento vale mais que o padrão', () => {
  assert.deepEqual(plain(resolverAcesso(D('chefe'), { papel: 'financeiro', empresaId: '' })), { type: 'financeiro' });
  assert.deepEqual(plain(resolverAcesso('Novo@Exemplo.com', { papel: 'empresa', empresaId: 'pier49' })), { type: 'empresa', id: 'pier49' });
  assert.deepEqual(plain(resolverAcesso('novo@exemplo.com', { papel: 'desenvolvedor', empresaId: '' })), { type: 'desenvolvedor' });
});
test('resolverAcesso: bloqueado, papel desconhecido ou estabelecimento inválido tiram o acesso', () => {
  assert.equal(resolverAcesso(D('chefe'), { papel: 'bloqueado', empresaId: '' }), null);
  assert.equal(resolverAcesso(D('leao'), { papel: 'admin', empresaId: '' }), null);
  assert.equal(resolverAcesso(D('leao'), { papel: 'empresa', empresaId: 'xyz' }), null);
});
test('resolverAcesso: o desenvolvedor fixo não pode ser bloqueado', () => {
  assert.deepEqual(plain(resolverAcesso(D('desenvolvedor').toUpperCase(), { papel: 'bloqueado', empresaId: '' })), { type: 'desenvolvedor' });
});
test('nomeDoAcesso', () => {
  assert.equal(nomeDoAcesso({ type: 'financeiro' }), 'Financeiro');
  assert.equal(nomeDoAcesso({ type: 'desenvolvedor' }), 'Desenvolvedor');
  assert.equal(nomeDoAcesso({ type: 'chefe' }), 'Chefe');
  assert.equal(nomeDoAcesso({ type: 'empresa', id: 'centro' }), 'Padaria Gaúcha Centro');
  assert.equal(nomeDoAcesso(null), 'Sem acesso');
});
test('emailDoBotao: os botões preenchem o e-mail sozinhos', () => {
  assert.equal(emailDoBotao({ type: 'financeiro' }), D('financeiro'));
  assert.equal(emailDoBotao({ type: 'desenvolvedor' }), D('desenvolvedor'));
  assert.equal(emailDoBotao({ type: 'empresa', id: 'cassino' }), D('cassino'));
  assert.equal(emailDoBotao({ type: 'outro' }, '  Fulano@Exemplo.com '), 'fulano@exemplo.com');
});

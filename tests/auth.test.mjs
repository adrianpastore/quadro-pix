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
  extract(/^function papelDoEmail\(email\) \{[\s\S]*?^\}/m, 'papelDoEmail'),
  extract(/^function authErro\(code\) \{[\s\S]*?^\}/m, 'authErro'),
];
const { papelDoEmail, authErro } = vm.runInNewContext(
  declarations.join('\n') + '\n({ papelDoEmail, authErro })',
  {}, { timeout: 1000 },
);
const accounts = [
  ['chefe', { type: 'chefe' }],
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

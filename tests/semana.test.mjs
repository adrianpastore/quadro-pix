import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Avalia só as funções puras do agrupamento por semana, sem React nem Firebase.
const source = readFileSync(new URL('../src/app.jsx', import.meta.url), 'utf8').split('\r\n').join('\n');
function extract(name) {
  const match = source.match(new RegExp(String.raw`^function ${name}\([^)]*\) \{[\s\S]*?^\}`, 'm'));
  assert.ok(match, `Função não encontrada: ${name}`);
  return match[0];
}
const { semanaInfo, agruparPorSemana } = vm.runInNewContext(
  ['ddmm', 'semanaInfo', 'agruparPorSemana'].map(extract).join('\n') + '\n({ semanaInfo, agruparPorSemana })',
  {}, { timeout: 1000 },
);
// Datas no horário local, como o app mostra.
const iso = (a, m, d, h = 12) => new Date(a, m - 1, d, h).toISOString();
const plain = (v) => JSON.parse(JSON.stringify(v));

// Novembro de 2026 começa num domingo e termina numa segunda.
for (const [dia, label] of [
  [1, 'Semana 1 · 01/11'],
  [2, 'Semana 2 · 02/11 a 08/11'],
  [8, 'Semana 2 · 02/11 a 08/11'],
  [13, 'Semana 3 · 09/11 a 15/11'],
  [29, 'Semana 5 · 23/11 a 29/11'],
  [30, 'Semana 6 · 30/11'],
]) {
  test(`semanaInfo no mês: ${dia}/11`, () => assert.equal(semanaInfo(iso(2026, 11, dia), '2026-11').label, label));
}

test('semanaInfo: começo e fim do dia ficam na mesma semana', () => {
  assert.equal(semanaInfo(iso(2026, 11, 9, 0), '2026-11').key, semanaInfo(iso(2026, 11, 15, 23), '2026-11').key);
});

test('semanaInfo sem mês: semana inteira com o ano, mesmo atravessando o mês', () => {
  assert.deepEqual(plain(semanaInfo(iso(2026, 11, 1))), { key: '2026-10-26', label: '26/10/2026 a 01/11/2026' });
  assert.equal(semanaInfo(iso(2026, 10, 28)).key, '2026-10-26');
});

test('agruparPorSemana: grupos na ordem da lista, com quantidade e subtotal', () => {
  const list = [
    { createdAt: iso(2026, 11, 13), valor: 10 },
    { createdAt: iso(2026, 11, 10), valor: 5.5 },
    { createdAt: iso(2026, 11, 4), valor: 100 },
    { createdAt: iso(2026, 11, 1), valor: '2' },
  ];
  const grupos = agruparPorSemana(list, '2026-11');
  assert.deepEqual(plain(grupos.map((g) => [g.label, g.cards.length, g.total])), [
    ['Semana 3 · 09/11 a 15/11', 2, 15.5],
    ['Semana 2 · 02/11 a 08/11', 1, 100],
    ['Semana 1 · 01/11', 1, 2],
  ]);
});

test('agruparPorSemana: lista vazia', () => assert.deepEqual(plain(agruparPorSemana([], '2026-11')), []));

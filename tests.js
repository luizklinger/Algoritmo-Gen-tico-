// Testes de validação (seção 6). Uso: node tests/tests.js > tests/RESULTADOS.md
const G = require('./ga.js');
const P = [
  { name: 'Melhoria da iluminação', cost: 4000, benefit: 7 },
  { name: 'Instalação de bicicletários', cost: 3000, benefit: 5 },
  { name: 'Aquisição de bancos', cost: 2000, benefit: 3 },
  { name: 'Reforma de espaço de convivência', cost: 5000, benefit: 8 }];
const base = { projects: P, budget: 7000, popSize: 20, generations: 50, crossRate: .8, mutRate: .05, tournament: 2, elite: 1, seed: 42 };
const bits = s => s.split('').map(Number), S = G.S;
const out = []; let fails = 0;
const log = s => out.push(s);
const t = (name, ok, d = '') => { if (!ok) fails++; log(`- ${ok ? '✅' : '❌'} ${name}${d ? ' — ' + d : ''}`); };

log('# Resultados dos testes\n');
log('## 6.2 Avaliação (1100, orçamento R$ 7.000)');
let e = G.evaluate(bits('1100'), P, 7000);
t('1100 → custo 7000, benefício 12, saldo 0, viável', e.cost === 7000 && e.benefit === 12 && e.balance === 0 && e.feasible, `obtido: custo ${e.cost}, benefício ${e.benefit}, saldo ${e.balance}`);
const ref = { '0000': [0, 0], '1000': [4000, 7], '0100': [3000, 5], '0010': [2000, 3], '0001': [5000, 8], '1100': [7000, 12], '1010': [6000, 10], '0110': [5000, 8], '0011': [7000, 11] };
let all = true, feas = [];
for (let n = 0; n < 16; n++) {
  const s = n.toString(2).padStart(4, '0'), r = G.evaluate(bits(s), P, 7000);
  if (r.feasible) { feas.push(s); if (!ref[s] || ref[s][0] !== r.cost || ref[s][1] !== r.benefit) all = false; }
}
t('as 9 soluções viáveis coincidem com a tabela de referência', all && feas.length === 9, feas.join(', '));

log('\n## 6.3 Reparação (1111, orçamento R$ 7.000)');
let r = G.repair(bits('1111'), P, 7000);
t('1111 → 1101 → 1100 (remove C, depois D)', r.steps.map(s => s.to).join('>') === '1101>1100' && r.steps.map(s => G.L(s.removed)).join('') === 'CD', '1111 → ' + r.steps.map(s => s.to).join(' → '));
t('1111 antes: custo 14000, benefício 23; depois: custo 7000, benefício 12', G.evaluate(bits('1111'), P, 99999).cost === 14000 && G.evaluate(bits('1111'), P, 99999).benefit === 23 && G.evaluate(r.chrom, P, 7000).benefit === 12);

log('\n## 6.4 Cruzamento, mutação e reparação controlados');
const [f1, f2] = G.cross(bits('1100'), bits('0011'), 2);
t('11|00 + 00|11 → filho 1 = 1111; filho 2 = 0000', S(f1) === '1111' && S(f2) === '0000', `obtido ${S(f1)} e ${S(f2)}`);
const seq = a => { let i = 0; return () => (i < a.length ? a[i++] : 0.99); };
const m1 = G.mutate(f1, .5, seq([0])), m2 = G.mutate(f2, .5, () => 0.99);
t('mutação só no 1º gene do filho 1 → 0111; filho 2 = 0000', S(m1.chrom) === '0111' && S(m2.chrom) === '0000' && m1.flips.join() === '0', `obtido ${S(m1.chrom)} e ${S(m2.chrom)}`);
const q1 = G.repair(m1.chrom, P, 7000), q2 = G.repair(m2.chrom, P, 7000);
t('reparação do filho 1: 0111 → 0101 → 0100; filho 2 permanece 0000', q1.steps.map(s => s.to).join() === '0101,0100' && S(q2.chrom) === '0000');
const v1 = G.evaluate(q1.chrom, P, 7000), v2 = G.evaluate(q2.chrom, P, 7000);
t('avaliação: filho 1 = 0100 (custo 3000, aptidão 5); filho 2 = 0000 (custo 0, aptidão 0)', S(q1.chrom) === '0100' && v1.cost === 3000 && v1.fitness === 5 && v2.cost === 0 && v2.fitness === 0);
t('mutação 0% não inverte nenhum gene', G.mutate(bits('1010'), 0, Math.random).flips.length === 0);
t('mutação 100% inverte todos os genes', S(G.mutate(bits('1010'), 1, Math.random).chrom) === '0101');
let g = new G.GA({ ...base, crossRate: 0, mutRate: 0, elite: 0 }); const old = new Set(g.pop.map(x => S(x.ch))); g.step();
t('cruzamento 0% e mutação 0%: filhos copiam os pais', g.pop.every(x => old.has(S(x.ch))) && g.pairs.every(p => p.cut === null));
g = new G.GA({ ...base, crossRate: 1, mutRate: 1, elite: 0 }); g.step();
t('cruzamento 100%: todo par tem corte; mutação 100%: filhos = complemento do cruzamento antes da reparação',
  g.pairs.every(p => p.cut >= 1 && p.cut <= 3 && p.k.every(k => S(k.mut) === S(k.cross.map(b => 1 - b)))));

log('\n## 6.4 Seleção por torneio');
let w = G.tournament([7, 11, 12], 3, Math.random);
t('candidatos 1000 (7), 0011 (11), 1100 (12) → vence 1100 (índice 3)', w.winner === 2);
w = G.tournament([0, 8, 5, 8], 4, Math.random);
t('empate de aptidão (índices 2 e 4, ambos 8) → vence o menor índice', w.winner === 1, `vencedor: índice ${w.winner + 1} na população`);
let distinct = true; for (let i = 0; i < 200; i++) { const c = G.tournament([1, 2, 3, 4, 5], 3, Math.random).candidates; if (new Set(c).size !== 3) distinct = false; }
t('candidatos do torneio são distintos', distinct);

log('\n## 6.5 Execução completa (população 20, 50 gerações, cruzamento 80%, mutação 5%, torneio 2, elite 1, semente 42)');
g = new G.GA(base); while (!g.done) g.step();
const h = g.history, b = g.best, bv = G.evaluate(b.ch, P, 7000);
t('histórico com 51 registros (geração 0 + 50)', h.length === 51);
t('melhor acumulado nunca diminui', h.every((x, i) => !i || x.bestSoFar >= h[i - 1].bestSoFar));
t('com elite ≥ 1, a melhor aptidão da população nunca diminui', h.every((x, i) => !i || x.bestFit >= h[i - 1].bestFit));
t('solução final consistente (custo ≤ 7000, benefício ≤ 12, totais batem com o cromossomo)', bv.cost <= 7000 && bv.benefit <= 12 && bv.benefit === b.benefit && bv.cost === b.cost);
const g2 = new G.GA(base); while (!g2.done) g2.step();
t('mesma semente e mesmos parâmetros reproduzem o histórico', JSON.stringify(h) === JSON.stringify(g2.history));
log(`\n**Resultado (semente 42):** cromossomo ${S(b.ch)}; projetos ${b.ch.map((x, i) => x ? G.L(i) : '').join('') || '—'}; custo R$ ${bv.cost}; benefício ${bv.benefit}; saldo R$ ${bv.balance}.`);

log('\n### Efeito da taxa de mutação (sementes 1 a 5; demais parâmetros iguais)\n');
log('| Mutação | Melhor benefício final (sementes 1..5) | Média | Execuções com benefício 12 |');
log('|---|---|---|---|');
for (const mr of [.01, .2]) {
  const res = [1, 2, 3, 4, 5].map(sd => { const x = new G.GA({ ...base, mutRate: mr, seed: sd }); while (!x.done) x.step(); return x.best.fitness; });
  log(`| ${mr * 100}% | ${res.join(', ')} | ${(res.reduce((a, c) => a + c, 0) / 5).toFixed(2)} | ${res.filter(x => x === 12).length} de 5 |`);
}

log('\n## 6.6 Limites de orçamento');
g = new G.GA({ ...base, budget: 0 });
t('orçamento R$ 0: toda a população é 0000 (custo, benefício e aptidão 0)', g.pop.every(x => S(x.ch) === '0000' && x.cost === 0 && x.fitness === 0));
e = G.evaluate(bits('1111'), P, 14000);
t('orçamento R$ 14.000: 1111 viável, custo 14000, benefício 23, saldo 0', e.feasible && e.cost === 14000 && e.benefit === 23 && e.balance === 0);

log(`\n**${fails ? fails + ' teste(s) falharam' : 'Todos os testes automatizados passaram.'}**`);
console.log(out.join('\n'));
process.exit(fails ? 1 : 0);

/* Motor do algoritmo genético (sem dependências). Funciona no navegador e no Node. */
(function (root) {
  'use strict';
  const S = c => c.join('');
  const L = i => String.fromCharCode(65 + i);
  const cents = v => Math.round(v * 100);

  // PRNG com semente (mulberry32)
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Custos em centavos inteiros: evita erro de ponto flutuante na comparação com o orçamento.
  function evaluate(ch, pr, budget) {
    let cc = 0, benefit = 0;
    ch.forEach((g, i) => { if (g) { cc += cents(pr[i].cost); benefit += pr[i].benefit; } });
    const b = cents(budget);
    return { cost: cc / 100, benefit, balance: (b - cc) / 100, feasible: cc <= b, fitness: benefit, costCents: cc };
  }

  // Reparação: remove o selecionado de menor benefício/custo (empate: menor índice).
  function repair(ch, pr, budget) {
    const c = ch.slice(), steps = [], b = cents(budget);
    let cost = evaluate(c, pr, budget).costCents;
    while (cost > b) {
      let w = -1;
      for (let i = 0; i < c.length; i++) {
        if (!c[i]) continue;
        // razão_i < razão_w  <=>  ben_i * custo_w < ben_w * custo_i  (custos > 0)
        if (w < 0 || pr[i].benefit * cents(pr[w].cost) < pr[w].benefit * cents(pr[i].cost)) w = i;
      }
      c[w] = 0; cost -= cents(pr[w].cost);
      steps.push({ removed: w, to: S(c) });
    }
    return { chrom: c, steps };
  }

  // Torneio: k candidatos distintos; vence a maior aptidão; empate -> menor índice da população.
  function tournament(fits, k, rng) {
    const idx = fits.map((_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const cand = idx.slice(0, k).sort((a, b) => a - b);
    let w = cand[0];
    for (const i of cand) if (fits[i] > fits[w]) w = i;
    return { winner: w, candidates: cand };
  }

  // Cruzamento de um ponto: corte após o gene `cut` (1 .. n-1)
  const cross = (a, b, cut) => [a.slice(0, cut).concat(b.slice(cut)), b.slice(0, cut).concat(a.slice(cut))];

  // Mutação por inversão de bits, sorteada independentemente por gene
  function mutate(ch, rate, rng) {
    const flips = [];
    const out = ch.map((g, i) => { if (rng() < rate) { flips.push(i); return 1 - g; } return g; });
    return { chrom: out, flips };
  }

  function pairText(o) {
    let t = `Pais: ${S(o.p1)} (#${o.i1 + 1}) e ${S(o.p2)} (#${o.i2 + 1}); `;
    t += o.cut === null
      ? `sem cruzamento, filhos copiam os pais: ${S(o.k[0].cross)} e ${S(o.k[1].cross)}`
      : `corte após o gene ${o.cut}; filhos: ${S(o.k[0].cross)} e ${S(o.k[1].cross)}`;
    o.k.forEach((k, j) => {
      t += '; ' + (k.flips.length
        ? `mutação no(s) gene(s) ${k.flips.map(x => x + 1).join(', ')} do filho ${j + 1}: ${S(k.mut)}`
        : `sem mutação no filho ${j + 1}`);
      if (k.steps.length) {
        t += `; reparação do filho ${j + 1}: ${[S(k.mut)].concat(k.steps.map(s => s.to)).join(' → ')} (removeu ${k.steps.map(s => L(s.removed)).join(', ')})`;
      }
    });
    if (o.discarded) t += '; filho 2 descartado (restava uma vaga)';
    return t;
  }

  class GA {
    constructor(cfg) {
      this.cfg = cfg; this.rng = mulberry32(cfg.seed);
      this.gen = 0; this.history = []; this.best = null; this.pairs = []; this.lines = [];
      const n = cfg.projects.length;
      this.pop = [];
      this.lines.push('População inicial aleatória (geração 0):');
      for (let p = 0; p < cfg.popSize; p++) {
        const raw = Array.from({ length: n }, () => (this.rng() < 0.5 ? 1 : 0));
        const r = repair(raw, cfg.projects, cfg.budget);
        this.pop.push(this._ind(r.chrom));
        this.lines.push(`Indivíduo #${p + 1}: ` + (r.steps.length
          ? `${[S(raw)].concat(r.steps.map(s => s.to)).join(' → ')} (reparado, removeu ${r.steps.map(s => L(s.removed)).join(', ')})`
          : `${S(raw)} (viável)`));
      }
      this._record();
    }
    get done() { return this.gen >= this.cfg.generations; }
    _ind(ch) { return Object.assign({ ch }, evaluate(ch, this.cfg.projects, this.cfg.budget)); }
    _record() {
      const f = this.pop.map(x => x.fitness);
      this.pop.forEach(x => { if (!this.best || x.fitness > this.best.fitness) this.best = x; });
      this.history.push({
        gen: this.gen, bestFit: Math.max(...f),
        avg: f.reduce((a, b) => a + b, 0) / f.length, bestSoFar: this.best.fitness
      });
    }
    step() {
      if (this.done) return null;
      const c = this.cfg, P = this.pop, fits = P.map(x => x.fitness), N = c.popSize, n = c.projects.length;
      const order = P.map((_, i) => i).sort((a, b) => fits[b] - fits[a] || a - b);
      const next = [], lines = [], pairs = [];
      const el = order.slice(0, c.elite);
      el.forEach(i => next.push(P[i]));
      if (el.length) lines.push(`Elitismo: preservados ${el.map(i => `${S(P[i].ch)} (#${i + 1}, aptidão ${P[i].fitness})`).join('; ')}`);
      while (next.length < N) {
        const t1 = tournament(fits, c.tournament, this.rng), t2 = tournament(fits, c.tournament, this.rng);
        const p1 = P[t1.winner].ch, p2 = P[t2.winner].ch;
        let a = p1, b = p2, cut = null;
        if (this.rng() < c.crossRate) {
          cut = 1 + Math.floor(this.rng() * (n - 1));
          [a, b] = cross(p1, p2, cut);
        }
        const k = [a, b].map(x => {
          const m = mutate(x, c.mutRate, this.rng);
          const r = repair(m.chrom, c.projects, c.budget);
          return { cross: x, flips: m.flips, mut: m.chrom, steps: r.steps, final: r.chrom };
        });
        next.push(this._ind(k[0].final));
        const discarded = next.length >= N;
        if (!discarded) next.push(this._ind(k[1].final));
        const o = { i1: t1.winner, i2: t2.winner, p1, p2, cut, k, discarded };
        o.text = pairText(o);
        pairs.push(o); lines.push(o.text);
      }
      this.pop = next; this.gen++; this.pairs = pairs; this.lines = lines;
      this._record();
      return this.history[this.history.length - 1];
    }
  }

  const api = { GA, evaluate, repair, tournament, cross, mutate, mulberry32, S, L };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GAEngine = api;
})(typeof self !== 'undefined' ? self : this);

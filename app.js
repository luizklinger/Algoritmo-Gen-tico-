(function () {
  'use strict';
  const { GA, S, L } = GAEngine;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const FIELDS = [['budget', 'Orçamento disponível (R$)', '7000.00'], ['pop', 'Tamanho da população', '20'],
    ['gens', 'Número de gerações', '50'], ['cross', 'Taxa de cruzamento (%, por par)', '80'],
    ['mut', 'Taxa de mutação (%, por gene)', '5'], ['tour', 'Tamanho do torneio', '2'],
    ['elite', 'Indivíduos de elite', '1'], ['seed', 'Semente aleatória', '42']];
  let rows = [['Melhoria da iluminação', '4000.00', '7'], ['Instalação de bicicletários', '3000.00', '5'],
    ['Aquisição de bancos', '2000.00', '3'], ['Reforma de espaço de convivência', '5000.00', '8']]
    .map(([name, cost, benefit]) => ({ name, cost, benefit }));
  let ga = null, timer = null, animTimer = null, dirty = true;

  // ---------- validação ----------
  const parseMoney = (s, zero) => { s = s.trim().replace(',', '.'); if (!/^\d+(\.\d{1,2})?$/.test(s)) return null; const n = +s; return isFinite(n) && (zero || n > 0) ? n : null; };
  const parseNum = s => { s = s.trim().replace(',', '.'); if (!/^\d+(\.\d+)?$/.test(s)) return null; const n = +s; return isFinite(n) ? n : null; };
  const parseInt0 = (s, neg) => { s = s.trim(); if (!(neg ? /^-?\d+$/ : /^\d+$/).test(s)) return null; const n = +s; return Number.isSafeInteger(n) ? n : null; };
  const parsePct = s => { const n = parseNum(s); return n !== null && n <= 100 ? n / 100 : null; };

  function readConfig() {
    let ok = rows.length >= 4 && rows.length <= 15;
    const bad = (el, c) => { el.classList.toggle('bad', !!c); if (c) ok = false; };
    const projects = rows.map(r => {
      const name = r.els.name.value.trim(), cost = parseMoney(r.els.cost.value, false), benefit = parseNum(r.els.benefit.value);
      bad(r.els.name, !name); bad(r.els.cost, cost === null); bad(r.els.benefit, benefit === null);
      return { name, cost, benefit };
    });
    const v = id => $(id).value;
    const budget = parseMoney(v('budget'), true); bad($('budget'), budget === null);
    const popSize = parseInt0(v('pop')); bad($('pop'), popSize === null || popSize < 2);
    const generations = parseInt0(v('gens')); bad($('gens'), generations === null || generations < 1);
    const crossRate = parsePct(v('cross')); bad($('cross'), crossRate === null);
    const mutRate = parsePct(v('mut')); bad($('mut'), mutRate === null);
    const tournament = parseInt0(v('tour')); bad($('tour'), tournament === null || tournament < 2 || (popSize !== null && tournament > popSize));
    const elite = parseInt0(v('elite')); bad($('elite'), elite === null || elite < 0 || (popSize !== null && elite > popSize - 1));
    const seed = parseInt0(v('seed'), true); bad($('seed'), seed === null);
    return { ok, cfg: { projects, budget, popSize, generations, crossRate, mutRate, tournament, elite, seed } };
  }

  // ---------- formulário ----------
  function renderRows() {
    const tb = $('rows'); tb.innerHTML = '';
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${L(i)}</b></td><td><input aria-label="Nome do projeto ${L(i)}"></td><td><input inputmode="decimal" aria-label="Custo do projeto ${L(i)}"></td><td><input inputmode="decimal" aria-label="Benefício do projeto ${L(i)}"></td><td><button type="button" class="sm">Remover</button></td>`;
      const ins = tr.querySelectorAll('input'); r.els = { name: ins[0], cost: ins[1], benefit: ins[2] };
      ['name', 'cost', 'benefit'].forEach(k => { r.els[k].value = r[k]; r.els[k].oninput = () => { r[k] = r.els[k].value; changed(); }; });
      tr.querySelector('button').onclick = () => { if (rows.length > 4) { rows.splice(i, 1); renderRows(); changed(); } };
      tb.appendChild(tr);
    });
    $('add').disabled = rows.length >= 15;
    tb.querySelectorAll('button').forEach(b => { b.disabled = rows.length <= 4; });
  }
  $('add').onclick = () => { if (rows.length < 15) { rows.push({ name: 'Novo projeto', cost: '1000.00', benefit: '1' }); renderRows(); changed(); } };
  FIELDS.forEach(([id, label, def]) => {
    const l = document.createElement('label'); l.textContent = label;
    const i = document.createElement('input'); i.id = id; i.value = def; i.inputMode = 'decimal'; i.oninput = changed;
    l.appendChild(i); $('params').appendChild(l);
  });

  // ---------- controles ----------
  function pause() { clearInterval(timer); timer = null; clearInterval(animTimer); }
  function changed() { pause(); dirty = true; refresh(); }
  function refresh() {
    const ok = readConfig().ok, blocked = dirty || !ga || ga.done;
    $('run').disabled = blocked || !!timer; $('step').disabled = blocked; $('pause').disabled = !timer; $('reset').disabled = !ok;
    $('msg').textContent = !ok ? 'Há campos inválidos (em vermelho). Corrija para reiniciar.'
      : dirty ? 'Alterações pendentes: clique em Reiniciar para aplicá-las.'
      : ga.done ? 'Execução encerrada: limite de gerações atingido.' : timer ? 'Executando…' : 'Pausado.';
  }
  function reset() {
    const r = readConfig(); if (!r.ok) { refresh(); return; }
    pause(); ga = new GA(r.cfg); dirty = false;
    $('log').innerHTML = ''; $('hist').innerHTML = '';
    addGen(); render(); refresh();
  }
  function advance() { ga.step(); addGen(); render(); if (ga.done) pause(); refresh(); }
  $('reset').onclick = reset;
  $('step').onclick = () => { pause(); if (ga && !dirty && !ga.done) advance(); refresh(); };
  $('pause').onclick = () => { pause(); refresh(); };
  $('run').onclick = () => { if (!ga || dirty || ga.done || timer) return; timer = setInterval(advance, 350); refresh(); };

  // ---------- exibição ----------
  function addGen() {
    const h = ga.history[ga.history.length - 1], d = document.createElement('div');
    d.innerHTML = `<h4>Geração ${h.gen}</h4>` + ga.lines.map(t => `<p>${esc(t)}</p>`).join('');
    $('log').appendChild(d); $('log').scrollTop = $('log').scrollHeight;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${h.gen}</td><td>${h.bestFit}</td><td>${h.avg.toFixed(2)}</td><td>${h.bestSoFar}</td>`;
    $('hist').appendChild(tr);
  }
  function render() {
    const h = ga.history[ga.history.length - 1], b = ga.best, cfg = ga.cfg;
    $('sGen').textContent = `${ga.gen} / ${cfg.generations}`; $('sBest').textContent = h.bestFit;
    $('sAvg').textContent = h.avg.toFixed(2); $('sAcc').textContent = h.bestSoFar;
    const chosen = b.ch.map((g, i) => g ? `${L(i)} (${esc(cfg.projects[i].name)})` : null).filter(Boolean);
    $('solution').innerHTML = `<h2>${ga.done ? 'Resultado final' : 'Melhor solução até agora'}</h2>
      <div class="ln">${b.ch.map(g => `<span class="b ${g ? 'on' : ''}">${g}</span>`).join('')}</div>
      <p>Projetos escolhidos: ${chosen.length ? chosen.join('; ') : 'nenhum'}<br>
      Custo total: <b>${brl(b.cost)}</b> · Benefício total: <b>${b.benefit}</b> · Saldo do orçamento: <b>${brl(b.balance)}</b></p>`;
    chart();
    const sel = $('pairSel'); sel.innerHTML = '';
    ga.pairs.forEach((p, i) => sel.add(new Option(`Par ${i + 1}`, i)));
    $('anim').disabled = !ga.pairs.length; drawPair(ga.pairs[0], 4);
  }
  function chart() {
    const c = $('chart'), x = c.getContext('2d'), W = c.width, H = c.height, hs = ga.history;
    x.clearRect(0, 0, W, H);
    const mx = Math.max(1, ...hs.map(r => Math.max(r.bestFit, r.bestSoFar))), N = Math.max(1, ga.cfg.generations);
    const px = g => 40 + (W - 55) * g / N, py = v => H - 25 - (H - 40) * v / mx;
    x.strokeStyle = '#999'; x.beginPath(); x.moveTo(40, 10); x.lineTo(40, H - 25); x.lineTo(W - 10, H - 25); x.stroke();
    x.fillStyle = '#444'; x.font = '12px sans-serif'; x.fillText(+mx.toFixed(2), 6, 16); x.fillText('0', 26, H - 22); x.fillText('geração ' + N, W - 80, H - 8);
    [['bestSoFar', '#1a7f37'], ['bestFit', '#2358c4'], ['avg', '#c2352b']].forEach(([k, col]) => {
      x.strokeStyle = col; x.lineWidth = 2; x.beginPath();
      hs.forEach((r, i) => i ? x.lineTo(px(r.gen), py(r[k])) : x.moveTo(px(r.gen), py(r[k]))); x.stroke();
    });
  }

  // ---------- animação do par selecionado (reflete o estado real da geração) ----------
  function line(label, ch, o) {
    let h = '';
    ch.forEach((g, i) => { if (o.cut === i && i > 0) h += '<span class="cut" title="ponto de corte"></span>'; h += `<span class="b ${(o.cls || {})[i] || ''}">${g}</span>`; });
    return `<div class="ln"><em>${label}</em>${h}</div>`;
  }
  const all = (ch, c) => Object.fromEntries(ch.map((_, i) => [i, c]));
  const CAP = ['Pais escolhidos por torneio.', 'Ponto de corte sorteado.', 'Filhos gerados: segmentos trocados.', 'Mutação: bits invertidos em laranja.', 'Reparação: projetos removidos em vermelho.'];
  function drawPair(pr, st) {
    if (!pr) { $('stage').innerHTML = ''; $('cap').textContent = ''; return; }
    const cut = pr.cut;
    let h = line(`Pai 1 (#${pr.i1 + 1})`, pr.p1, { cut: st >= 1 ? cut : null, cls: all(pr.p1, 'par') }) +
            line(`Pai 2 (#${pr.i2 + 1})`, pr.p2, { cut: st >= 1 ? cut : null, cls: all(pr.p2, 'par') });
    pr.k.forEach((k, j) => {
      if (st >= 2) h += line(`Filho ${j + 1} (cruzamento)`, k.cross, { cut });
      if (st >= 3) h += line(`Filho ${j + 1} (mutação)`, k.mut, { cls: Object.fromEntries(k.flips.map(i => [i, 'mut'])) });
      if (st >= 4) h += line(`Filho ${j + 1} (reparação)`, k.final, { cls: Object.fromEntries(k.mut.map((g, i) => [i, g && !k.final[i] ? 'rem' : '']).filter(e => e[1])) });
    });
    $('stage').innerHTML = h;
    $('cap').textContent = (st === 1 && cut === null ? 'Sem cruzamento neste par: filhos copiam os pais.' : CAP[st]) + (pr.discarded && st >= 2 ? ' O filho 2 foi descartado (restava uma vaga).' : '');
  }
  $('pairSel').onchange = () => { clearInterval(animTimer); drawPair(ga.pairs[+$('pairSel').value], 4); };
  $('anim').onclick = () => {
    clearInterval(animTimer); const pr = ga.pairs[+$('pairSel').value]; let st = 0; drawPair(pr, 0);
    animTimer = setInterval(() => { st++; drawPair(pr, st); if (st >= 4) clearInterval(animTimer); }, 1100);
  };

  renderRows(); reset();
})();

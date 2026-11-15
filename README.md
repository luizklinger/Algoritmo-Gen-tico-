# Algoritmo genético: seleção de projetos do campus

Atividade Prática de Algoritmo Genético · Inteligência Artificial · UFPI · 2026.2

**Autores:** Luiz Klinger, Vitor Fichel, Caio Andrade

## Descrição da solução

Simulador que busca, com algoritmo genético, o conjunto de projetos de melhoria de um campus de maior benefício total sem ultrapassar o orçamento. Roda inteiramente no navegador (HTML, CSS e JavaScript), sem servidor, login ou instalação.

- **Cromossomo:** vetor binário, uma posição por projeto (`1` = selecionado). Os genes são rotulados A, B, C… na ordem da tabela.
- **População inicial:** cada gene sorteado com probabilidade 0,5 de ser 0 ou 1.
- **Seleção:** torneio com candidatos distintos; vence a maior aptidão e, em empate, o menor índice na população. Cada pai vem de um torneio independente.
- **Cruzamento:** um ponto, com corte sorteado entre o primeiro e o penúltimo gene; a taxa é aplicada por par. Sem cruzamento, os filhos copiam os pais.
- **Mutação:** inversão de bits, sorteada independentemente por gene dos descendentes.
- **Reparação:** enquanto o custo exceder o orçamento, remove o projeto selecionado de menor razão benefício/custo (empate: menor índice). Aplicada à população inicial e aos descendentes, antes da avaliação.
- **Aptidão:** benefício total da solução reparada (seleção vazia é válida, aptidão 0).
- **Elitismo:** os melhores indivíduos passam sem modificação. As demais vagas são preenchidas por descendentes, com pais sempre da população anterior. Se sobrar uma vaga, só o primeiro filho do último par entra. O tamanho da população é constante.
- **Valores em reais** são tratados em centavos inteiros, para a comparação com o orçamento ser exata.
- **Melhor solução** é a melhor de toda a execução (inclui a geração 0).

## Estrutura

```
index.html      interface
style.css       estilos
ga.js        motor do algoritmo (sem dependências; roda também no Node)
app.js       interface, validação, controles, gráfico e animação
tests.js  testes da seção 6 (node tests/tests.js)
RESULTADOS.md  saída dos testes
```

## Instruções de uso

1. Abra a página. Ela inicia com os quatro projetos do enunciado e orçamento de R$ 7.000.
2. Edite, adicione (máximo 15) ou remova (mínimo 4) projetos e ajuste os parâmetros. Campos inválidos ficam em vermelho e bloqueiam o botão **Reiniciar**; qualquer alteração exige reinício.
3. **Reiniciar** cria a geração 0 com a semente configurada e limpa o histórico. **Executar** roda até o limite de gerações; **Pausar** preserva o estado; **Avançar uma geração** produz exatamente uma geração e deixa a execução pausada.
4. Acompanhe os indicadores, o gráfico, o histórico e o **log**, que registra pais, corte, filhos, bits mutados, reparações e elites efetivamente ocorridos.
5. Em **Operações da última geração**, escolha um par e clique em **Animar par**: a animação reproduz os dados reais daquele par (pais, corte, troca de segmentos, mutação em laranja, reparação em vermelho).

## Parâmetros

| Parâmetro | Validação | Valor inicial |
|---|---|---|
| Projetos | nome não vazio; custo > 0 (até 2 casas); benefício ≥ 0 | dados da seção 6.1 |
| Orçamento | ≥ 0, até 2 casas decimais | R$ 7.000,00 |
| Tamanho da população | inteiro ≥ 2 | 20 |
| Número de gerações | inteiro ≥ 1 (a geração 0 é a inicial) | 50 |
| Taxa de cruzamento | 0% a 100%, por par | 80% |
| Taxa de mutação | 0% a 100%, por gene | 5% |
| Tamanho do torneio | inteiro de 2 até o tamanho da população | 2 |
| Indivíduos de elite | inteiro de 0 até população − 1 | 1 |
| Semente | inteiro | 42 |

## Bibliotecas auxiliares

Nenhuma. O gráfico usa a API Canvas do navegador e o gerador pseudoaleatório com semente (mulberry32) está em `js/ga.js`.

## Análise da taxa de mutação (seção 6.5)

Com mutação de 1% e de 20%, as cinco execuções (sementes 1 a 5) terminaram em benefício 12, o ótimo. Como a média e a contagem são idênticas, **estes testes não mostram que uma taxa seja melhor que a outra**. A explicação mais provável está na instância: há só 16 cromossomos possíveis, a população tem 20 indivíduos e a reparação concentra soluções inviáveis em viáveis (por exemplo, 1111 vira 1100), então o ótimo aparece com facilidade qualquer que seja a mutação. O efeito da taxa tende a aparecer em instâncias maiores (até 15 projetos), onde 1% explora pouco e 20% pode destruir boas soluções; isso pode ser conferido na própria aplicação alterando os dados.

# Resultados dos testes

## 6.2 Avaliação (1100, orçamento R$ 7.000)
- 1100 → custo 7000, benefício 12, saldo 0, viável — obtido: custo 7000, benefício 12, saldo 0
- as 9 soluções viáveis coincidem com a tabela de referência — 0000, 0001, 0010, 0011, 0100, 0110, 1000, 1010, 1100

## 6.3 Reparação (1111, orçamento R$ 7.000)
- 1111 → 1101 → 1100 (remove C, depois D) — 1111 → 1101 → 1100
- 1111 antes: custo 14000, benefício 23; depois: custo 7000, benefício 12

## 6.4 Cruzamento, mutação e reparação controlados
- 11|00 + 00|11 → filho 1 = 1111; filho 2 = 0000 — obtido 1111 e 0000
- mutação só no 1º gene do filho 1 → 0111; filho 2 = 0000 — obtido 0111 e 0000
- reparação do filho 1: 0111 → 0101 → 0100; filho 2 permanece 0000
- avaliação: filho 1 = 0100 (custo 3000, aptidão 5); filho 2 = 0000 (custo 0, aptidão 0)
- mutação 0% não inverte nenhum gene
- mutação 100% inverte todos os genes
- cruzamento 0% e mutação 0%: filhos copiam os pais
- cruzamento 100%: todo par tem corte; mutação 100%: filhos = complemento do cruzamento antes da reparação

## 6.4 Seleção por torneio
- candidatos 1000 (7), 0011 (11), 1100 (12) → vence 1100 (índice 3)
- empate de aptidão (índices 2 e 4, ambos 8) → vence o menor índice — vencedor: índice 2 na população
- candidatos do torneio são distintos

## 6.5 Execução completa (população 20, 50 gerações, cruzamento 80%, mutação 5%, torneio 2, elite 1, semente 42)
- histórico com 51 registros (geração 0 + 50)
- melhor acumulado nunca diminui
- com elite ≥ 1, a melhor aptidão da população nunca diminui
- solução final consistente (custo ≤ 7000, benefício ≤ 12, totais batem com o cromossomo)
- mesma semente e mesmos parâmetros reproduzem o histórico

**Resultado (semente 42):** cromossomo 1100; projetos AB; custo R$ 7000; benefício 12; saldo R$ 0.

### Efeito da taxa de mutação (sementes 1 a 5; demais parâmetros iguais)

| Mutação | Melhor benefício final (sementes 1..5) | Média | Execuções com benefício 12 |
|---|---|---|---|
| 1% | 12, 12, 12, 12, 12 | 12.00 | 5 de 5 |
| 20% | 12, 12, 12, 12, 12 | 12.00 | 5 de 5 |

## 6.6 Limites de orçamento
- orçamento R$ 0: toda a população é 0000 (custo, benefício e aptidão 0)
- orçamento R$ 14.000: 1111 viável, custo 14000, benefício 23, saldo 0

**Todos os testes automatizados passaram.**

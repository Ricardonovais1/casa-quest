// ============================================================
// Casa Quest — Domain: Ações parecidas
//
// O catálogo cresce aos poucos e as repetições entram sem ninguém notar:
// "Colocar louça" veio do catálogo pronto, "Encher a lava-louça" foi
// criada à mão — é a mesma tarefa, e as duas acabam no dia de alguém.
// Aqui os nomes são comparados e os pares que merecem uma olhada saem
// como sugestão. Decidir (fundir, ou "não são iguais") é de quem
// gerencia a casa.
//
// Puro, sem I/O.
// ============================================================

export interface SimilarityCandidate {
  id: string;
  name: string;
  category: string;
  is_active?: boolean;
}

/**
 * `same`    — o mesmo trabalho com outras palavras; quase sempre vale fundir.
 * `related` — tarefas vizinhas ("Cuidar do pet" e "Higiene do pet"); talvez
 *             caibam numa só, talvez não.
 */
export type SimilarityKind = 'same' | 'related';

export interface SimilarityMatch {
  kind: SimilarityKind;
  /** 0–1: quanto dos dois nomes coincide. */
  score: number;
  /** As palavras em comum, já normalizadas. */
  shared: string[];
}

export interface SimilarPair extends SimilarityMatch {
  /** Ids em ordem estável (a < b). */
  a: string;
  b: string;
}

/**
 * Só se funde o que vive no mesmo lugar do ciclo: hábito e colaboração são
 * gerados no dia; tropeço tira energia; missões extras somam. Juntar um
 * tropeço com uma missão extra trocaria o sinal do que já aconteceu.
 */
const MERGE_GROUP: Record<string, string> = {
  habitos: 'dia',
  cooperacao: 'dia',
  tropecos: 'tropeco',
  missoes: 'extra',
  gentilezas: 'extra',
  autoaperfeicoamento: 'extra',
  rendimento_escolar: 'extra',
};

export function canMerge(a: { category: string }, b: { category: string }): boolean {
  return (MERGE_GROUP[a.category] ?? a.category) === (MERGE_GROUP[b.category] ?? b.category);
}

/** Chave estável de um par, independente da ordem. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Expressões de várias palavras que nomeiam uma coisa só. */
const PHRASES: [RegExp, string][] = [
  [/maquina de lavar loucas?/g, ' louca '],
  [/lava[\s-]*loucas?/g, ' louca '],
];

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'em', 'no', 'na', 'nos', 'nas',
  'ao', 'aos', 'para', 'pra', 'com', 'sem', 'que', 'se',
  'seu', 'sua', 'seus', 'suas', 'apos', 'nao',
  'todo', 'toda', 'todos', 'todas',
]);

/** Palavras que, numa tarefa de casa, dizem a mesma coisa. */
const SYNONYMS: Record<string, string> = {
  por: 'colocar',
  botar: 'colocar',
  encher: 'colocar',
  abastecer: 'colocar',
  repor: 'colocar',
  esvaziar: 'tirar',
  retirar: 'tirar',
  remover: 'tirar',
  organizar: 'arrumar',
  alimentar: 'cuidar',
  cachorro: 'pet',
  cachorra: 'pet',
  cao: 'pet',
  gato: 'pet',
  gata: 'pet',
  bicho: 'pet',
  animal: 'pet',
  prato: 'louca',
  copo: 'louca',
  lixeira: 'lixo',
};

/**
 * Verbos que aparecem em quase toda tarefa. Dividir só um deles não prova
 * nada: "Arrumar a cama" e "Arrumar armário" são tarefas diferentes.
 */
const GENERIC = new Set([
  'colocar', 'tirar', 'arrumar', 'cuidar', 'fazer', 'limpar', 'lavar',
  'ajudar', 'guardar', 'tomar', 'trazer', 'levar', 'dar', 'passar', 'ficar',
]);

/** Ações opostas sobre a mesma coisa: "Colocar a mesa" não é "Tirar a mesa". */
const OPPOSITES: [string, string][] = [['colocar', 'tirar']];

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Plural simples: "louças" → "louca", "refeições" → "refeicao". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('oes')) return `${word.slice(0, -3)}ao`;
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** As palavras que importam num nome, já normalizadas. */
export function nameTokens(name: string): string[] {
  let text = fold(name);
  for (const [pattern, replacement] of PHRASES) text = text.replace(pattern, replacement);

  const tokens = new Set<string>();
  for (const raw of text.split(/[^a-z0-9]+/)) {
    if (!raw || STOPWORDS.has(raw)) continue;
    const word = stem(raw);
    const canonical = SYNONYMS[word] ?? word;
    if (!STOPWORDS.has(canonical)) tokens.add(canonical);
  }
  return [...tokens];
}

function opposed(a: Set<string>, b: Set<string>): boolean {
  return OPPOSITES.some(
    ([x, y]) =>
      (a.has(x) && !a.has(y) && b.has(y) && !b.has(x)) ||
      (a.has(y) && !a.has(x) && b.has(x) && !b.has(y))
  );
}

function compareTokens(
  a: Set<string>,
  b: Set<string>,
  nameA: string,
  nameB: string
): SimilarityMatch | null {
  if (a.size === 0 || b.size === 0) {
    // Nome feito só de palavras vazias ("A"): resta comparar o texto.
    return fold(nameA).trim() === fold(nameB).trim() ? { kind: 'same', score: 1, shared: [] } : null;
  }
  if (opposed(a, b)) return null;

  const shared = [...a].filter((t) => b.has(t));
  if (shared.length === 0) return null;

  const jaccard = shared.length / (a.size + b.size - shared.length);
  if (jaccard === 1) return { kind: 'same', score: 1, shared };

  // Um nome inteiro dentro do outro: "Não guardar" e "Não guardar utensílios…".
  const containment = shared.length / Math.min(a.size, b.size);
  if (containment === 1) return { kind: 'related', score: Math.max(jaccard, 0.5), shared };

  // Dividem o objeto da tarefa, não só o verbo: "Cuidar do pet" e "Higiene do pet".
  const meaningful = shared.some((t) => !GENERIC.has(t));
  if (meaningful && jaccard >= 1 / 3 - 1e-9) return { kind: 'related', score: jaccard, shared };

  return null;
}

/** Compara dois nomes de ação. null quando não há parentesco que valha mostrar. */
export function compareNames(nameA: string, nameB: string): SimilarityMatch | null {
  return compareTokens(new Set(nameTokens(nameA)), new Set(nameTokens(nameB)), nameA, nameB);
}

/**
 * Todos os pares do catálogo que podem ser a mesma tarefa, os mais
 * prováveis primeiro. Só compara ações que dá para fundir (mesmo grupo de
 * categoria) e ignora pares em que as duas estão desativadas.
 */
export function findSimilarActions(items: SimilarityCandidate[]): SimilarPair[] {
  const tokens = items.map((item) => new Set(nameTokens(item.name)));
  const pairs: SimilarPair[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const x = items[i]!;
      const y = items[j]!;
      if (!canMerge(x, y)) continue;
      if (x.is_active === false && y.is_active === false) continue;

      const match = compareTokens(tokens[i]!, tokens[j]!, x.name, y.name);
      if (!match) continue;

      const [a, b] = x.id < y.id ? [x.id, y.id] : [y.id, x.id];
      pairs.push({ a, b, ...match });
    }
  }

  return pairs.sort((p, q) => {
    if (p.kind !== q.kind) return p.kind === 'same' ? -1 : 1;
    return q.score - p.score;
  });
}

import { Card, ResolutionDetail, ResolutionResult } from './types';

export interface ScoreOptions {
  hand: Card[];
  starter: Card;
  isCrib?: boolean;
}

export function scoreHand(options: ScoreOptions): ResolutionResult {
  const { hand, starter, isCrib = false } = options;
  const allCards = [...hand, starter];
  const details: ResolutionDetail[] = [];

  const fifteenDamage = scoreFifteens(allCards, details);
  const pairDamage = scorePairs(allCards, details);
  const runDamage = scoreRuns(allCards, details);
  const flushShield = scoreFlush(hand, starter, isCrib, details);
  const initiative = scoreNobs(hand, starter, details);

  return {
    damage: fifteenDamage + pairDamage + runDamage,
    shield: flushShield,
    initiative,
    details
  };
}

function scoreFifteens(cards: Card[], details: ResolutionDetail[]): number {
  const combos = enumerateSubsets(cards);
  let damage = 0;
  for (const subset of combos) {
    const total = subset.reduce((sum, card) => sum + card.value, 0);
    if (total === 15) {
      damage += 2;
      details.push({ kind: 'fifteen', points: 2, cards: subset.slice() });
    }
  }
  return damage;
}

function scorePairs(cards: Card[], details: ResolutionDetail[]): number {
  const byRank = new Map<number, Card[]>();
  for (const card of cards) {
    const group = byRank.get(card.rank) ?? [];
    group.push(card);
    byRank.set(card.rank, group);
  }
  let damage = 0;
  for (const group of byRank.values()) {
    if (group.length >= 2) {
      const pairCount = (group.length * (group.length - 1)) / 2;
      const points = pairCount * 2;
      damage += points;
      const kind =
        group.length === 2 ? 'pair' : group.length === 3 ? 'pair3' : 'pair4';
      details.push({ kind, points, cards: group.slice() });
    }
  }
  return damage;
}

function scoreRuns(cards: Card[], details: ResolutionDetail[]): number {
  const groups = new Map<number, Card[]>();
  for (const card of cards) {
    const existing = groups.get(card.rank) ?? [];
    existing.push(card);
    groups.set(card.rank, existing);
  }
  const ranks = Array.from(groups.keys()).sort((a, b) => a - b);
  let damage = 0;
  let currentRun: number[] = [];

  const flushRun = () => {
    if (currentRun.length >= 3) {
      const combos = buildRunCombos(groups, currentRun);
      for (const combo of combos) {
        damage += currentRun.length;
        details.push({ kind: 'run', points: currentRun.length, cards: combo, length: currentRun.length });
      }
    }
    currentRun = [];
  };

  for (const rank of ranks) {
    if (currentRun.length === 0) {
      currentRun.push(rank);
      continue;
    }
    const prev = currentRun[currentRun.length - 1];
    if (rank === prev + 1) {
      currentRun.push(rank);
    } else {
      flushRun();
      currentRun.push(rank);
    }
  }
  flushRun();

  return damage;
}

function buildRunCombos(groups: Map<number, Card[]>, ranks: number[]): Card[][] {
  const combos: Card[][] = [];
  const current: Card[] = [];

  const backtrack = (index: number) => {
    if (index === ranks.length) {
      combos.push(current.slice());
      return;
    }
    const rank = ranks[index];
    const cards = groups.get(rank) ?? [];
    for (const card of cards) {
      current.push(card);
      backtrack(index + 1);
      current.pop();
    }
  };

  backtrack(0);
  return combos;
}

function scoreFlush(
  hand: Card[],
  starter: Card,
  isCrib: boolean,
  details: ResolutionDetail[]
): number {
  if (hand.length === 0) {
    return 0;
  }
  const firstSuit = hand[0].suit;
  const allMatchHand = hand.every((card) => card.suit === firstSuit);
  if (!allMatchHand) {
    return 0;
  }
  const starterMatches = starter.suit === firstSuit;
  if (isCrib && !starterMatches) {
    return 0;
  }
  const shield = starterMatches ? 5 : 4;
  if (isCrib && shield !== 5) {
    return 0;
  }
  const cards = [...hand, starterMatches ? starter : undefined].filter(
    (card): card is Card => Boolean(card)
  );
  details.push({ kind: 'flush', points: shield, cards });
  return shield;
}

function scoreNobs(hand: Card[], starter: Card, details: ResolutionDetail[]): boolean {
  if (!starter) {
    return false;
  }
  const jack = hand.find((card) => card.rank === 11 && card.suit === starter.suit);
  if (jack) {
    details.push({ kind: 'nobs', points: 0, cards: [jack, starter] });
    return true;
  }
  return false;
}

function enumerateSubsets(cards: Card[]): Card[][] {
  const subsets: Card[][] = [];
  const total = 1 << cards.length;
  for (let mask = 1; mask < total; mask += 1) {
    const subset: Card[] = [];
    for (let i = 0; i < cards.length; i += 1) {
      if (mask & (1 << i)) {
        subset.push(cards[i]);
      }
    }
    subsets.push(subset);
  }
  return subsets;
}

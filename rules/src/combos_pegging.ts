import { ComboEvent, PeggingPileEntry } from './types';

export function detectPeggingCombos(
  pile: PeggingPileEntry[],
  currentCount: number
): ComboEvent[] {
  if (pile.length === 0) {
    return [];
  }

  const combos: ComboEvent[] = [];

  if (currentCount === 15) {
    combos.push({ kind: 'fifteen', damage: 3 });
  }
  if (currentCount === 31) {
    combos.push({ kind: 'thirtyone', damage: 6 });
  }

  const pairCombo = detectPairCombo(pile);
  if (pairCombo) {
    combos.push(pairCombo);
  }

  const runCombo = detectRunCombo(pile);
  if (runCombo) {
    combos.push(runCombo);
  }

  return combos;
}

function detectPairCombo(pile: PeggingPileEntry[]): ComboEvent | null {
  const last = pile[pile.length - 1];
  const sameRank: PeggingPileEntry[] = [last];
  for (let i = pile.length - 2; i >= 0; i -= 1) {
    if (pile[i].card.rank === last.card.rank) {
      sameRank.push(pile[i]);
    } else {
      break;
    }
  }

  switch (sameRank.length) {
    case 2:
      return { kind: 'pair', damage: 2, length: 2 };
    case 3:
      return { kind: 'pair3', damage: 6, length: 3 };
    case 4:
      return { kind: 'pair4', damage: 12, length: 4 };
    default:
      return null;
  }
}

function detectRunCombo(pile: PeggingPileEntry[]): ComboEvent | null {
  const maxWindow = Math.min(7, pile.length);
  for (let window = maxWindow; window >= 3; window -= 1) {
    const slice = pile.slice(pile.length - window);
    if (formsRun(slice)) {
      return { kind: 'run', damage: window, length: window };
    }
  }
  return null;
}

function formsRun(slice: PeggingPileEntry[]): boolean {
  const ranks = slice.map((entry) => entry.card.rank).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i += 1) {
    if (ranks[i] === ranks[i - 1]) {
      return false;
    }
    if (ranks[i] !== ranks[i - 1] + 1) {
      return false;
    }
  }
  return true;
}

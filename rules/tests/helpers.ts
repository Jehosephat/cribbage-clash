import { Card, PeggingPileEntry, PlayerId, Suit } from '../src';

let idCounter = 0;

export function makeCard(rank: number, suit: Suit = 'hearts'): Card {
  return {
    id: `${suit}-${rank}-${idCounter++}`,
    rank,
    suit,
    value: Math.min(rank, 10)
  };
}

export function pileEntry(
  card: Card,
  player: PlayerId = 'p1'
): PeggingPileEntry {
  return { card, player };
}

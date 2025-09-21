import { Card, Suit } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = Array.from({ length: 13 }, (_, index) => index + 1);

function cardValue(rank: number): number {
  return Math.min(rank, 10);
}

export function createStandardDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${suit}-${rank}`,
      rank,
      suit,
      value: cardValue(rank)
    }))
  );
}

type RandomFunction = () => number;

function mulberry32(seed: number): RandomFunction {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ShuffleOptions {
  seed: number;
}

export function shuffleDeck({ seed }: ShuffleOptions): Card[] {
  const rng = mulberry32(seed);
  const deck = createStandardDeck();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

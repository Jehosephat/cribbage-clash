export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type PlayerId = 'p1' | 'p2';

export interface Card {
  id: string;
  rank: number;
  suit: Suit;
  value: number;
}

export interface PlayerHand {
  p1: Card[];
  p2: Card[];
}

export interface HitPointTrack {
  p1: number;
  p2: number;
}

export interface GameState {
  seed: number;
  round: number;
  dealer: PlayerId;
  count: number;
  pile: Card[];
  turn: PlayerId;
  hands: PlayerHand;
  cribOwner: PlayerId;
  crib: Card[];
  starter: Card | null;
  hp: HitPointTrack;
  shield: HitPointTrack;
  phase: 'deal' | 'discard' | 'cut' | 'pegging' | 'resolution' | 'results';
}

const DEFAULT_HP = 61;

export const STANDARD_DECK: ReadonlyArray<Card> = (() => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = Array.from({ length: 13 }, (_, index) => index + 1);
  return suits.flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${suit}-${rank}`,
      rank,
      suit,
      value: Math.min(rank, 10)
    }))
  );
})();

export function createInitialState(seed = Date.now()): GameState {
  return {
    seed,
    round: 0,
    dealer: 'p1',
    count: 0,
    pile: [],
    turn: 'p1',
    hands: { p1: [], p2: [] },
    cribOwner: 'p1',
    crib: [],
    starter: null,
    hp: { p1: DEFAULT_HP, p2: DEFAULT_HP },
    shield: { p1: 0, p2: 0 },
    phase: 'deal'
  };
}

export function getCardValue(card: Card): number {
  return Math.min(card.rank, 10);
}

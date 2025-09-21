import { createStandardDeck } from './deck';
import { Card, GameState, HitPointTrack, PlayerHands } from './types';

export * from './types';
export * from './deck';
export * from './count';
export * from './turn_manager';
export * from './combos_pegging';
export * from './score_resolution';
export * from './damage';

export const DEFAULT_HP = 61;

export const STANDARD_DECK: ReadonlyArray<Card> = Object.freeze(
  createStandardDeck()
);

export function createInitialState(seed = Date.now()): GameState {
  return {
    seed,
    round: 0,
    dealer: 'p1',
    count: 0,
    pile: [],
    turn: 'p1',
    hands: emptyHands(),
    cribOwner: 'p1',
    crib: [],
    starter: null,
    hp: defaultHpTrack(),
    shield: { p1: 0, p2: 0 },
    phase: 'deal'
  };
}

function emptyHands(): PlayerHands {
  return { p1: [], p2: [] };
}

function defaultHpTrack(): HitPointTrack {
  return { p1: DEFAULT_HP, p2: DEFAULT_HP };
}

export function getCardValue(card: Card): number {
  return card.value;
}

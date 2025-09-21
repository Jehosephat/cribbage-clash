import { createStandardDeck } from './deck';
import { Card, GameState } from './types';
import { createGameState } from './game_state';

export * from './types';
export * from './deck';
export * from './count';
export * from './turn_manager';
export * from './combos_pegging';
export * from './score_resolution';
export * from './damage';
export * from './constants';
export * from './game_state';

export const STANDARD_DECK: ReadonlyArray<Card> = Object.freeze(
  createStandardDeck()
);

export function createInitialState(seed = Date.now()): GameState {
  return createGameState({ seed });
}

export function getCardValue(card: Card): number {
  return card.value;
}


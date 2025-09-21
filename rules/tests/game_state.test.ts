import { describe, expect, it } from 'vitest';

import {
  Card,
  createGameState,
  createInitialState,
  cutStarter,
  declareGo,
  discardToCrib,
  playCard,
  resolveRound
} from '../src';
import { makeCard } from './helpers';

describe('game state lifecycle', () => {
  it('creates an initial state with shuffled deck, hands, and hp totals', () => {
    const seed = 1234;
    const state = createGameState({ seed, dealer: 'p2' });

    expect(state.seed).toBe(seed);
    expect(state.round).toBe(1);
    expect(state.dealer).toBe('p2');
    expect(state.phase).toBe('discard');
    expect(state.hands.p1).toHaveLength(6);
    expect(state.hands.p2).toHaveLength(6);
    expect(state.deck.length).toBe(52 - 12);
    expect(state.hp.p1).toBe(61);
    expect(state.hp.p2).toBe(61);
    expect(state.shield.p1).toBe(0);
    expect(state.shield.p2).toBe(0);
    expect(state.cribOwner).toBe('p2');
    expect(state.turn).toBe('p1');
  });

  it('transitions through discard and cut phases before pegging', () => {
    const deck = buildOrderedDeck();
    const state = createGameState({ deck, dealer: 'p1' });

    discardToCrib(state, 'p1', [state.hands.p1[0].id, state.hands.p1[1].id]);
    discardToCrib(state, 'p2', [state.hands.p2[0].id, state.hands.p2[1].id]);

    expect(state.phase).toBe('cut');
    const starter = cutStarter(state);
    expect(starter).toEqual(state.starter);
    expect(state.phase).toBe('pegging');
    expect(state.deck.length).toBe(deck.length - 12 - 1);
  });

  it('applies pegging combos, damage, and go bonuses', () => {
    const state = createInitialState();
    state.phase = 'pegging';
    state.turn = 'p1';
    state.count = 10;
    state.pile = [{ card: makeCard(10, 'clubs'), player: 'p2' }];
    state.hands.p1 = [makeCard(5, 'hearts')];
    state.hands.p2 = [];

    const result = playCard(state, 'p1', state.hands.p1[0].id);
    expect(result.combos.map((combo) => combo.kind)).toContain('fifteen');
    expect(result.damageEvent?.amount).toBe(3);
    expect(state.hp.p2).toBe(58);
    expect(state.comboLog).toHaveLength(1);
    expect(state.turn).toBe('p2');

    state.turn = 'p2';
    state.hands.p2 = [];
    state.pegging.lastPlayedBy = 'p1';
    const goResult = declareGo(state, 'p2');
    expect(goResult.reset).toBe(false);

    state.turn = 'p1';
    state.hands.p1 = [];
    const awarded = declareGo(state, 'p1');
    expect(awarded.reset).toBe(true);
    expect(awarded.awardedTo).toBe('p1');
    expect(awarded.damageEvent?.amount).toBe(1);
    expect(state.hp.p2).toBe(57);
    expect(state.phase).toBe('resolution');
  });

  it('resolves hands, crib, dealer swap, and initiative from nobs', () => {
    const state = createGameState({ deck: buildOrderedDeck(), dealer: 'p1' });
    state.phase = 'resolution';
    state.starter = makeCard(7, 'clubs');
    state.hands.p1 = [makeCard(5, 'hearts'), makeCard(10, 'hearts'), makeCard(6, 'hearts'), makeCard(7, 'hearts')];
    state.hands.p2 = [makeCard(5, 'diamonds'), makeCard(5, 'spades'), makeCard(9, 'hearts'), makeCard(11, 'clubs')];
    state.crib = [makeCard(2, 'clubs'), makeCard(3, 'diamonds'), makeCard(4, 'spades'), makeCard(6, 'clubs')];
    state.cribOwner = 'p1';

    const summary = resolveRound(state);
    expect(summary.handResults.p1.damage).toBeGreaterThan(0);
    expect(summary.handResults.p1.shield).toBe(4);
    expect(summary.handResults.p2.damage).toBe(6);
    expect(summary.cribResult?.damage).toBe(7);
    expect(state.shield.p1).toBe(4);
    expect(state.hp.p2).toBe(44);
    expect(state.hp.p1).toBe(55);
    expect(state.round).toBe(2);
    expect(state.dealer).toBe('p2');
    expect(state.phase).toBe('discard');
    expect(state.turn).toBe('p2');
    expect(state.initiative).toBeNull();
  });
});

function buildOrderedDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const deck: Card[] = [];
  let id = 0;
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `${suit}-${rank}-ordered-${id++}`,
        rank,
        suit,
        value: Math.min(rank, 10)
      });
    }
  }
  return deck;
}

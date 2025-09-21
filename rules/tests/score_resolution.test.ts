import { describe, expect, it } from 'vitest';

import { scoreHand } from '../src';
import { makeCard } from './helpers';

describe('scoreHand', () => {
  it('matches golden vector for four fives and a jack starter', () => {
    const hand = [
      makeCard(5, 'hearts'),
      makeCard(5, 'clubs'),
      makeCard(5, 'diamonds'),
      makeCard(11, 'spades')
    ];
    const starter = makeCard(5, 'spades');
    const result = scoreHand({ hand, starter });
    expect(result.damage).toBe(28);
    expect(result.shield).toBe(0);
    expect(result.initiative).toBe(true);
    expect(result.details.filter((detail) => detail.kind === 'fifteen')).toHaveLength(8);
    const quad = result.details.find((detail) => detail.kind === 'pair4');
    expect(quad?.points).toBe(12);
    expect(result.details.some((detail) => detail.kind === 'nobs')).toBe(true);
  });

  it('scores flush shields for hands and cribs correctly', () => {
    const handFlush = [
      makeCard(2, 'clubs'),
      makeCard(4, 'clubs'),
      makeCard(7, 'clubs'),
      makeCard(9, 'clubs')
    ];
    const starterOffSuit = makeCard(12, 'diamonds');
    const starterMatching = makeCard(8, 'clubs');

    const handResult = scoreHand({ hand: handFlush, starter: starterOffSuit });
    expect(handResult.shield).toBe(4);

    const cribResult = scoreHand({
      hand: handFlush,
      starter: starterMatching,
      isCrib: true
    });
    expect(cribResult.shield).toBe(5);

    const noCribFlush = scoreHand({
      hand: handFlush,
      starter: starterOffSuit,
      isCrib: true
    });
    expect(noCribFlush.shield).toBe(0);
  });

  it('tallies runs, pairs, and fifteens together', () => {
    const hand = [
      makeCard(3, 'hearts'),
      makeCard(4, 'clubs'),
      makeCard(5, 'diamonds'),
      makeCard(5, 'spades')
    ];
    const starter = makeCard(6, 'hearts');
    const result = scoreHand({ hand, starter });
    expect(result.damage).toBe(14);
    const runDetails = result.details.filter((detail) => detail.kind === 'run');
    expect(runDetails).toHaveLength(2);
    expect(runDetails[0]?.length).toBe(4);
    expect(result.details.filter((detail) => detail.kind === 'fifteen')).toHaveLength(2);
    expect(result.details.filter((detail) => detail.kind === 'pair')).toHaveLength(1);
  });

  it('recognises nobs when the jack matches the starter suit', () => {
    const hand = [
      makeCard(11, 'hearts'),
      makeCard(2, 'clubs'),
      makeCard(7, 'diamonds'),
      makeCard(9, 'spades')
    ];
    const starter = makeCard(5, 'hearts');
    const result = scoreHand({ hand, starter });
    expect(result.initiative).toBe(true);
    expect(result.details.some((detail) => detail.kind === 'nobs')).toBe(true);
  });
});

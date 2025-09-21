import { describe, expect, it } from 'vitest';

import { detectPeggingCombos } from '../src';
import { makeCard, pileEntry } from './helpers';

describe('detectPeggingCombos', () => {
  it('detects a fifteen combo', () => {
    const pile = [pileEntry(makeCard(5)), pileEntry(makeCard(10, 'clubs'), 'p2')];
    const combos = detectPeggingCombos(pile, 15);
    expect(combos).toEqual([{ kind: 'fifteen', damage: 3 }]);
  });

  it('detects thirty-one', () => {
    const pile = [
      pileEntry(makeCard(10)),
      pileEntry(makeCard(5, 'clubs'), 'p2'),
      pileEntry(makeCard(6, 'diamonds')),
      pileEntry(makeCard(10, 'spades'), 'p2')
    ];
    const combos = detectPeggingCombos(pile, 31);
    expect(combos).toContainEqual({ kind: 'thirtyone', damage: 6 });
  });

  it('detects contiguous pairs, trips, and quads', () => {
    const base = [pileEntry(makeCard(7)), pileEntry(makeCard(7, 'clubs'), 'p2')];
    expect(detectPeggingCombos(base, 14)).toContainEqual({
      kind: 'pair',
      damage: 2,
      length: 2
    });

    const trips = [...base, pileEntry(makeCard(7, 'diamonds'))];
    expect(detectPeggingCombos(trips, 21)).toContainEqual({
      kind: 'pair3',
      damage: 6,
      length: 3
    });

    const quads = [...trips, pileEntry(makeCard(7, 'spades'), 'p2')];
    expect(detectPeggingCombos(quads, 28)).toContainEqual({
      kind: 'pair4',
      damage: 12,
      length: 4
    });
  });

  it('requires pairs to be contiguous', () => {
    const pile = [
      pileEntry(makeCard(7)),
      pileEntry(makeCard(5, 'clubs'), 'p2'),
      pileEntry(makeCard(7, 'diamonds'))
    ];
    const combos = detectPeggingCombos(pile, 19);
    expect(combos.find((combo) => combo.kind.startsWith('pair'))).toBeUndefined();
  });

  it('detects the longest run only', () => {
    const pile = [
      pileEntry(makeCard(2)),
      pileEntry(makeCard(3, 'clubs'), 'p2'),
      pileEntry(makeCard(4, 'diamonds')),
      pileEntry(makeCard(5, 'spades'), 'p2')
    ];
    const combos = detectPeggingCombos(pile, 14);
    expect(combos).toContainEqual({ kind: 'run', damage: 4, length: 4 });
    expect(combos.filter((combo) => combo.kind === 'run')).toHaveLength(1);
  });

  it('can report simultaneous fifteen and run combos', () => {
    const pile = [
      pileEntry(makeCard(4)),
      pileEntry(makeCard(6, 'clubs'), 'p2'),
      pileEntry(makeCard(5, 'diamonds'))
    ];
    const combos = detectPeggingCombos(pile, 15);
    expect(combos).toContainEqual({ kind: 'fifteen', damage: 3 });
    expect(combos).toContainEqual({ kind: 'run', damage: 3, length: 3 });
  });
});

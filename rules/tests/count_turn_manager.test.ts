import { describe, expect, it } from 'vitest';

import { CountMeter, PeggingTurnManager } from '../src';
import { makeCard } from './helpers';

describe('CountMeter', () => {
  it('prevents plays that exceed 31', () => {
    const meter = new CountMeter();
    meter.add(makeCard(10));
    meter.add(makeCard(10));
    expect(() => meter.add(12)).toThrowError('Cannot exceed 31');
  });
});

describe('PeggingTurnManager', () => {
  it('resets after reaching 31', () => {
    const manager = new PeggingTurnManager('p1');
    manager.playCard('p1', makeCard(10));
    manager.playCard('p2', makeCard(5, 'clubs'));
    manager.playCard('p1', makeCard(6, 'diamonds'));
    manager.playCard('p2', makeCard(5, 'spades'));
    const result = manager.playCard('p1', makeCard(5, 'hearts'));
    expect(result.count).toBe(31);
    expect(result.resetRequired).toBe(true);
    manager.resetAfterThirtyOne();
    expect(manager.count).toBe(0);
    expect(manager.orderedPile).toHaveLength(0);
    expect(manager.turn).toBe('p2');
  });

  it('awards go to the last player able to act and resets the volley', () => {
    const manager = new PeggingTurnManager('p1');
    manager.playCard('p1', makeCard(4));
    manager.playCard('p2', makeCard(5, 'clubs'));
    manager.playCard('p1', makeCard(10, 'diamonds'));
    manager.playCard('p2', makeCard(9, 'spades'));

    const goResult = manager.declareGo('p1', [makeCard(4, 'diamonds')]);
    expect(goResult.awardedTo).toBeUndefined();
    expect(manager.turn).toBe('p2');
    expect(manager.count).toBe(28);

    const secondGo = manager.declareGo('p2', [makeCard(4, 'spades')]);
    expect(secondGo.awardedTo).toBe('p2');
    expect(manager.count).toBe(0);
    expect(manager.orderedPile).toHaveLength(0);
    expect(manager.turn).toBe('p1');
  });

  it('prevents players from calling go when they have a legal play', () => {
    const manager = new PeggingTurnManager('p1');
    manager.playCard('p1', makeCard(10));
    expect(() => manager.declareGo('p2', [makeCard(5)])).toThrow(
      'Player has a legal play and cannot call go'
    );
  });
});

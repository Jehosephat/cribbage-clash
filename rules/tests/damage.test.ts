import { describe, expect, it } from 'vitest';

import { applyDamage, ComboEvent, HitPointTrack } from '../src';

describe('applyDamage', () => {
  it('applies shield before HP and logs the event', () => {
    const hp: HitPointTrack = { p1: 61, p2: 61 };
    const shield: HitPointTrack = { p1: 5, p2: 0 };
    const combo: ComboEvent = { kind: 'fifteen', damage: 3 };
    const event = applyDamage(hp, shield, 'p1', 7, {
      source: 'pegging',
      combo,
      description: 'Fifteen damage'
    });
    expect(event.absorbed).toBe(5);
    expect(event.hpDamage).toBe(2);
    expect(event.hpAfter).toBe(59);
    expect(event.shieldAfter).toBe(0);
    expect(event.combo).toEqual(combo);
    expect(event.description).toBe('Fifteen damage');
    expect(event.timestamp).toBeTypeOf('number');
  });
});

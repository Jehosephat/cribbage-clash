import { ComboEvent, DamageEvent, DamageSource, HitPointTrack, PlayerId } from './types';

export interface DamageContext {
  source: DamageSource;
  combo?: ComboEvent;
  description?: string;
  timestamp?: number;
}

export function applyDamage(
  hp: HitPointTrack,
  shield: HitPointTrack,
  target: PlayerId,
  amount: number,
  context: DamageContext
): DamageEvent {
  const shieldBefore = shield[target];
  const hpBefore = hp[target];
  const absorbed = Math.min(shieldBefore, amount);
  const remaining = amount - absorbed;
  shield[target] = shieldBefore - absorbed;
  hp[target] = Math.max(0, hpBefore - remaining);

  const event: DamageEvent = {
    target,
    amount,
    absorbed,
    hpDamage: remaining,
    shieldBefore,
    hpBefore,
    shieldAfter: shield[target],
    hpAfter: hp[target],
    source: context.source,
    combo: context.combo,
    description: context.description,
    timestamp: context.timestamp ?? Date.now()
  };

  return event;
}

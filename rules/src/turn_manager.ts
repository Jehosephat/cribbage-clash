import { Card, GoResolution, PeggingPileEntry, PlayerId } from './types';
import { CountMeter } from './count';

export interface PlayCardResult {
  count: number;
  pile: PeggingPileEntry[];
  resetRequired: boolean;
}

export class PeggingTurnManager {
  private readonly countMeter = new CountMeter();
  private readonly pile: PeggingPileEntry[] = [];
  private readonly passed: Record<PlayerId, boolean> = { p1: false, p2: false };
  private lastPlayerToPlay: PlayerId | null = null;

  constructor(private currentTurn: PlayerId) {}

  get turn(): PlayerId {
    return this.currentTurn;
  }

  get count(): number {
    return this.countMeter.value;
  }

  get orderedPile(): PeggingPileEntry[] {
    return [...this.pile];
  }

  private otherPlayer(player: PlayerId): PlayerId {
    return player === 'p1' ? 'p2' : 'p1';
  }

  canPlayCard(card: Card): boolean {
    return this.countMeter.canPlay(card);
  }

  canPlayerPlay(hand: Card[]): boolean {
    return hand.some((card) => this.canPlayCard(card));
  }

  playCard(player: PlayerId, card: Card): PlayCardResult {
    if (player !== this.currentTurn) {
      throw new Error('Not this player\'s turn');
    }
    if (!this.countMeter.canPlay(card)) {
      throw new Error('Play exceeds 31');
    }
    const count = this.countMeter.add(card);
    this.pile.push({ card, player });
    this.lastPlayerToPlay = player;
    this.passed.p1 = false;
    this.passed.p2 = false;
    const resetRequired = count === 31;
    this.currentTurn = this.otherPlayer(player);
    return {
      count,
      pile: this.orderedPile,
      resetRequired
    };
  }

  declareGo(player: PlayerId, hand: Card[]): GoResolution {
    if (player !== this.currentTurn) {
      throw new Error('Not this player\'s turn');
    }
    if (this.canPlayerPlay(hand)) {
      throw new Error('Player has a legal play and cannot call go');
    }
    this.passed[player] = true;
    const opponent = this.otherPlayer(player);
    this.currentTurn = opponent;
    if (this.passed[opponent]) {
      const awardedTo = this.lastPlayerToPlay ?? opponent;
      this.resetVolley(awardedTo);
      return { awardedTo, reset: true };
    }
    return { reset: false };
  }

  resetAfterThirtyOne(): void {
    if (!this.lastPlayerToPlay) {
      return;
    }
    const next = this.otherPlayer(this.lastPlayerToPlay);
    this.resetCounts();
    this.currentTurn = next;
  }

  resetVolley(lastScoringPlayer: PlayerId): void {
    const next = this.otherPlayer(lastScoringPlayer);
    this.resetCounts();
    this.currentTurn = next;
  }

  private resetCounts(): void {
    this.countMeter.reset();
    this.pile.splice(0, this.pile.length);
    this.passed.p1 = false;
    this.passed.p2 = false;
    this.lastPlayerToPlay = null;
  }
}

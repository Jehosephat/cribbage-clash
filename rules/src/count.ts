import { Card } from './types';

export class CountMeter {
  private total = 0;

  get value(): number {
    return this.total;
  }

  canPlay(card: Card | number): boolean {
    const value = typeof card === 'number' ? card : card.value;
    return this.total + value <= 31;
  }

  add(card: Card | number): number {
    const value = typeof card === 'number' ? card : card.value;
    if (!this.canPlay(value)) {
      throw new Error('Cannot exceed 31');
    }
    this.total += value;
    return this.total;
  }

  reset(): void {
    this.total = 0;
  }
}

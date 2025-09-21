import type { Card } from '@cribbage-clash/rules';
import type { AccessibilitySettings } from '../src/settings/types';

const SUIT_SYMBOL: Record<Card['suit'], string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const SUIT_LABEL: Record<Card['suit'], string> = {
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
  spades: 'Spades'
};

const SUIT_COLOR: Record<Card['suit'], number> = {
  hearts: 0xf87171,
  diamonds: 0xfbbf24,
  clubs: 0x38bdf8,
  spades: 0x94a3b8
};

export function rankToString(rank: number): string {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return `${rank}`;
}

export function formatCardLabel(card: Card, settings: AccessibilitySettings): string {
  const rank = rankToString(card.rank);
  if (!settings.colorSafeSuits) {
    return `${rank}${SUIT_SYMBOL[card.suit]}`;
  }
  return `${rank}${SUIT_SYMBOL[card.suit]} ${SUIT_LABEL[card.suit][0]}`;
}

export function suitColor(card: Card, highContrast: boolean): number {
  if (highContrast) {
    return 0xffffff;
  }
  return SUIT_COLOR[card.suit];
}

export function suitLabel(card: Card, settings: AccessibilitySettings): string {
  if (!settings.colorSafeSuits) {
    return SUIT_SYMBOL[card.suit];
  }
  return `${SUIT_LABEL[card.suit]} (${SUIT_SYMBOL[card.suit]})`;
}

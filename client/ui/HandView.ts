import Phaser from 'phaser';
import type { Card } from '@cribbage-clash/rules';
import type { AccessibilitySettings } from '../src/settings/types';
import { getFontScale } from '../src/settings/types';
import { formatCardLabel, suitLabel, suitColor } from './cardFormatting';

export interface HandViewConfig {
  settings: AccessibilitySettings;
  onCardSelected?: (card: Card) => void;
}

export interface HandRenderOptions {
  cards: Card[];
  selectedIds: Set<string>;
  playable: (card: Card) => boolean;
  canAct: boolean;
  phase: 'discard' | 'pegging' | 'other';
  settings: AccessibilitySettings;
}

export class HandView extends Phaser.GameObjects.Container {
  private config: HandViewConfig;

  constructor(scene: Phaser.Scene, x: number, y: number, config: HandViewConfig) {
    super(scene, x, y);
    this.config = config;
  }

  setHand(options: HandRenderOptions): void {
    this.removeAll(true);
    const hand = options.cards;
    const cardWidth = 96;
    const startX = hand.length > 0 ? -((hand.length - 1) * cardWidth) / 2 : 0;
    const fontScale = getFontScale(options.settings);

    hand.forEach((card, index) => {
      const isSelected = options.selectedIds.has(card.id);
      const isPlayable = options.playable(card);
      const disabled = !options.canAct || (options.phase === 'pegging' && !isPlayable);
      const cardContainer = this.createCard({
        card,
        x: startX + index * cardWidth,
        isSelected,
        disabled,
        settings: options.settings,
        fontScale
      });
      const background = cardContainer.getData('background') as Phaser.GameObjects.Rectangle | undefined;
      if (background && options.canAct) {
        background.setInteractive({ useHandCursor: !disabled });
        background.on('pointerdown', () => {
          this.config.onCardSelected?.(card);
        });
      }
      this.add(cardContainer);
    });
  }

  private createCard(config: {
    card: Card;
    x: number;
    isSelected: boolean;
    disabled: boolean;
    settings: AccessibilitySettings;
    fontScale: number;
  }): Phaser.GameObjects.Container {
    const container = new Phaser.GameObjects.Container(this.scene, config.x, 0);
    const background = this.scene.add.rectangle(0, 0, 88, 128, 0x111c31, 0.92);
    background.setOrigin(0.5, 0.5);
    const baseStroke = config.isSelected ? 0xf97316 : 0x38bdf8;
    background.setStrokeStyle(2, baseStroke, 1);

    if (config.settings.highContrast) {
      background.setFillStyle(0x020617, 0.95);
      background.setStrokeStyle(2, config.isSelected ? 0xfacc15 : 0xffffff, 1);
    }

    if (config.disabled) {
      background.setAlpha(0.55);
    }

    const label = this.scene.add.text(0, -26, formatCardLabel(config.card, config.settings), {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(26 * config.fontScale)}px`,
      fontStyle: 'bold',
      color: '#f8fafc'
    });
    label.setOrigin(0.5, 0.5);
    if (config.disabled) {
      label.setAlpha(0.7);
    }

    const suitText = this.scene.add.text(0, 12, suitLabel(config.card, config.settings), {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(18 * config.fontScale)}px`,
      color: Phaser.Display.Color.IntegerToColor(suitColor(config.card, config.settings.highContrast)).rgba
    });
    suitText.setOrigin(0.5, 0.5);
    if (config.disabled) {
      suitText.setAlpha(0.7);
    }

    const valueText = this.scene.add.text(0, 44, `Value ${config.card.value}`, {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(14 * config.fontScale)}px`,
      color: '#94a3b8'
    });
    valueText.setOrigin(0.5, 0.5);
    if (config.disabled) {
      valueText.setAlpha(0.7);
    }

    container.add([background, label, suitText, valueText]);
    container.setData('background', background);
    container.setData('card', config.card);
    container.setData('disabled', config.disabled);
    return container;
  }
}

export default HandView;

import Phaser from 'phaser';
import type { PeggingPileEntry } from '@cribbage-clash/rules';
import type { AccessibilitySettings } from '../src/settings/types';
import { getFontScale } from '../src/settings/types';
import { formatCardLabel, suitLabel, suitColor } from './cardFormatting';

export interface PileViewConfig {
  maxVisible?: number;
  settings: AccessibilitySettings;
}

export class PileView extends Phaser.GameObjects.Container {
  private maxVisible: number;

  private settings: AccessibilitySettings;

  constructor(scene: Phaser.Scene, x: number, y: number, config: PileViewConfig) {
    super(scene, x, y);
    this.maxVisible = config.maxVisible ?? 7;
    this.settings = config.settings;
  }

  setSettings(settings: AccessibilitySettings): void {
    this.settings = settings;
    // redraw using cached data by forcing re-render when next entries set.
  }

  setEntries(entries: PeggingPileEntry[]): void {
    this.removeAll(true);
    const slice = entries.slice(-this.maxVisible);
    const cardWidth = 84;
    const startX = -((slice.length - 1) * cardWidth) / 2;
    slice.forEach((entry, index) => {
      const card = this.createCard(entry, startX + index * cardWidth);
      this.add(card);
    });
  }

  private createCard(entry: PeggingPileEntry, x: number): Phaser.GameObjects.Container {
    const container = new Phaser.GameObjects.Container(this.scene, x, 0);
    const fontScale = getFontScale(this.settings);
    const background = this.scene.add.rectangle(0, 0, 76, 108, 0x111c31, 0.92);
    background.setStrokeStyle(2, entry.player === 'p1' ? 0x38bdf8 : 0xf472b6, 1);
    background.setOrigin(0.5, 0.5);

    if (this.settings.highContrast) {
      background.setFillStyle(0x020617, 0.95);
      background.setStrokeStyle(2, 0xffffff, 1);
    }

    const label = this.scene.add.text(0, -24, formatCardLabel(entry.card, this.settings), {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(22 * fontScale)}px`,
      fontStyle: 'bold',
      color: '#f8fafc'
    });
    label.setOrigin(0.5, 0.5);

    const suit = this.scene.add.text(0, 10, suitLabel(entry.card, this.settings), {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(16 * fontScale)}px`,
      color: Phaser.Display.Color.IntegerToColor(suitColor(entry.card, this.settings.highContrast)).rgba
    });
    suit.setOrigin(0.5, 0.5);

    const owner = this.scene.add.text(0, 36, entry.player.toUpperCase(), {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(14 * fontScale)}px`,
      color: '#94a3b8'
    });
    owner.setOrigin(0.5, 0.5);

    container.add([background, label, suit, owner]);
    return container;
  }
}

export default PileView;

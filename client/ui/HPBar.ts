import Phaser from 'phaser';
import type { AccessibilitySettings } from '../src/settings/types';
import { getFontScale } from '../src/settings/types';

export interface HPBarConfig {
  width: number;
  height: number;
  label: string;
  maxHp: number;
  align?: 'left' | 'right' | 'center';
  settings: AccessibilitySettings;
}

export class HPBar extends Phaser.GameObjects.Container {
  private readonly fill: Phaser.GameObjects.Rectangle;

  private readonly background: Phaser.GameObjects.Rectangle;

  private readonly labelText: Phaser.GameObjects.Text;

  private readonly hpText: Phaser.GameObjects.Text;

  private readonly barWidth: number;

  private maxHp: number;

  private currentHp = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, config: HPBarConfig) {
    super(scene, x, y);
    this.maxHp = config.maxHp;
    this.barWidth = config.width;
    const align = config.align ?? 'left';

    const background = scene.add.rectangle(0, 0, config.width, config.height, 0x0f172a, 0.85);
    background.setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
    background.setStrokeStyle(2, 0x1d4ed8, 0.9);
    this.background = background;

    const fill = scene.add.rectangle(0, 0, config.width, config.height - 6, 0x22d3ee, 1);
    fill.setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
    fill.setMask(background.createGeometryMask());
    this.fill = fill;

    const label = scene.add.text(0, -config.height / 2 - 18, config.label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(18 * getFontScale(config.settings))}px`,
      fontStyle: 'bold',
      color: '#e2e8f0'
    });
    label.setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
    this.labelText = label;

    const hpText = scene.add.text(0, 0, '0 / 0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(18 * getFontScale(config.settings))}px`,
      color: '#f8fafc'
    });
    hpText.setOrigin(align === 'left' ? 0.02 : align === 'right' ? 0.98 : 0.5, 0.5);
    this.hpText = hpText;

    this.add([background, fill, label, hpText]);
    this.applySettings(config.settings);
  }

  setHp(value: number, maxHp?: number): void {
    if (maxHp !== undefined) {
      this.maxHp = maxHp;
    }
    this.currentHp = Phaser.Math.Clamp(value, 0, this.maxHp);
    const ratio = this.maxHp > 0 ? this.currentHp / this.maxHp : 0;
    this.fill.displayWidth = this.barWidth * ratio;
    this.hpText.setText(`${Math.round(this.currentHp)} / ${this.maxHp}`);
  }

  applySettings(settings: AccessibilitySettings): void {
    const fontScale = getFontScale(settings);
    this.labelText.setFontSize(18 * fontScale);
    this.hpText.setFontSize(18 * fontScale);
    if (settings.highContrast) {
      this.background.setFillStyle(0x0b0f1a, 0.95);
      this.background.setStrokeStyle(2, 0xffffff, 1);
      this.fill.setFillStyle(0x22d3ee, 1);
      this.hpText.setColor('#ffffff');
      this.labelText.setColor('#ffffff');
    } else {
      this.background.setFillStyle(0x0f172a, 0.85);
      this.background.setStrokeStyle(2, 0x1d4ed8, 0.9);
      this.fill.setFillStyle(0x38bdf8, 1);
      this.hpText.setColor('#f8fafc');
      this.labelText.setColor('#e2e8f0');
    }
    this.setHp(this.currentHp);
  }
}

export default HPBar;

import Phaser from 'phaser';
import type { AccessibilitySettings } from '../src/settings/types';
import { getFontScale } from '../src/settings/types';

export interface ShieldOverlayConfig {
  width: number;
  settings: AccessibilitySettings;
}

export class ShieldOverlay extends Phaser.GameObjects.Container {
  private readonly badge: Phaser.GameObjects.Rectangle;

  private readonly valueText: Phaser.GameObjects.Text;

  private readonly width: number;

  private currentValue = 0;

  private absorbTween?: Phaser.Tweens.Tween;

  private settings: AccessibilitySettings;

  constructor(scene: Phaser.Scene, x: number, y: number, config: ShieldOverlayConfig) {
    super(scene, x, y);
    this.width = config.width;
    this.settings = config.settings;

    const badge = scene.add.rectangle(0, 0, config.width, 36, 0x1e293b, 0.85);
    badge.setOrigin(0.5, 0.5);
    badge.setStrokeStyle(2, 0x38bdf8, 0.9);
    badge.setVisible(false);
    this.badge = badge;

    const valueText = scene.add.text(0, 0, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(18 * getFontScale(config.settings))}px`,
      fontStyle: 'bold',
      color: '#38bdf8'
    });
    valueText.setOrigin(0.5, 0.5);
    valueText.setVisible(false);
    this.valueText = valueText;

    this.add([badge, valueText]);
    this.applySettings(config.settings);
  }

  setShield(value: number, previous?: number): void {
    const clamped = Math.max(0, Math.round(value));
    const changed = clamped !== this.currentValue;
    this.currentValue = clamped;
    if (clamped <= 0) {
      this.badge.setVisible(false);
      this.valueText.setVisible(false);
      return;
    }
    this.badge.setVisible(true);
    this.valueText.setVisible(true);
    this.valueText.setText(`SHIELD +${clamped}`);

    if (previous !== undefined && previous > clamped && changed) {
      this.playAbsorbAnimation(previous - clamped);
    } else if (previous !== undefined && clamped > previous && changed) {
      this.playGainAnimation(clamped - previous);
    }
  }

  applySettings(settings: AccessibilitySettings): void {
    this.settings = settings;
    const fontScale = getFontScale(settings);
    this.valueText.setFontSize(18 * fontScale);
    if (settings.highContrast) {
      this.badge.setFillStyle(0x081229, 0.95);
      this.badge.setStrokeStyle(2, 0xffffff, 1);
      this.valueText.setColor('#60a5fa');
    } else {
      this.badge.setFillStyle(0x1e293b, 0.85);
      this.badge.setStrokeStyle(2, 0x38bdf8, 0.9);
      this.valueText.setColor('#38bdf8');
    }
  }

  private playAbsorbAnimation(absorbed: number): void {
    this.absorbTween?.remove();
    this.badge.setAlpha(1);
    this.valueText.setAlpha(1);
    const flash = this.scene.add.rectangle(0, 0, this.width, 40, 0x22d3ee, 0.4);
    flash.setOrigin(0.5, 0.5);
    this.addAt(flash, 0);
    const description = this.scene.add.text(0, 32, `Absorbed ${absorbed}`, {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(14 * getFontScale(this.settings))}px`,
      color: '#e0f2fe'
    });
    description.setOrigin(0.5, 0.5);
    this.add(description);
    this.absorbTween = this.scene.tweens.add({
      targets: [flash, description],
      alpha: 0,
      duration: 600,
      onComplete: () => {
        flash.destroy();
        description.destroy();
      }
    });
  }

  private playGainAnimation(amount: number): void {
    this.absorbTween?.remove();
    const pulse = this.scene.add.rectangle(0, 0, this.width + 10, 44, 0x22c55e, 0.25);
    pulse.setOrigin(0.5, 0.5);
    this.addAt(pulse, 0);
    const gainText = this.scene.add.text(0, 34, `+${amount} shield`, {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(14 * getFontScale(this.settings))}px`,
      color: '#bbf7d0'
    });
    gainText.setOrigin(0.5, 0.5);
    this.add(gainText);
    this.absorbTween = this.scene.tweens.add({
      targets: [pulse, gainText],
      alpha: 0,
      y: '+=12',
      duration: 700,
      onComplete: () => {
        pulse.destroy();
        gainText.destroy();
      }
    });
  }
}

export default ShieldOverlay;

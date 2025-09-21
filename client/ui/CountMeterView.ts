import Phaser from 'phaser';
import type { AccessibilitySettings } from '../src/settings/types';
import { getFontScale } from '../src/settings/types';

interface CountMeterConfig {
  width: number;
  height: number;
  settings: AccessibilitySettings;
}

export class CountMeterView extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Rectangle;

  private readonly progress: Phaser.GameObjects.Rectangle;

  private readonly label: Phaser.GameObjects.Text;

  private readonly glow15: Phaser.GameObjects.Ellipse;

  private readonly glow31: Phaser.GameObjects.Ellipse;

  private readonly tick15: Phaser.GameObjects.Rectangle;

  private readonly tick31: Phaser.GameObjects.Rectangle;

  private lastCount = 0;

  private width: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: CountMeterConfig) {
    super(scene, x, y);
    this.width = config.width;

    const track = scene.add.rectangle(0, 0, config.width, config.height, 0x0f172a, 0.9);
    track.setOrigin(0.5, 0.5);
    track.setStrokeStyle(2, 0x38bdf8, 0.8);
    this.track = track;

    const progress = scene.add.rectangle(-config.width / 2, 0, config.width, config.height - 4, 0x22c55e, 1);
    progress.setOrigin(0, 0.5);
    progress.setMask(track.createGeometryMask());
    this.progress = progress;

    const label = scene.add.text(0, -config.height, 'Count 0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(20 * getFontScale(config.settings))}px`,
      color: '#f8fafc'
    });
    label.setOrigin(0.5, 1);
    this.label = label;

    const glow15 = scene.add.ellipse(-config.width / 2 + (config.width * 15) / 31, 0, 70, 70, 0xfacc15, 0.18);
    glow15.setVisible(false);
    this.glow15 = glow15;

    const glow31 = scene.add.ellipse(config.width / 2, 0, 90, 90, 0xf87171, 0.18);
    glow31.setVisible(false);
    this.glow31 = glow31;

    const tick15 = scene.add.rectangle(-config.width / 2 + (config.width * 15) / 31, 0, 4, config.height + 8, 0xfacc15, 1);
    this.tick15 = tick15;

    const tick31 = scene.add.rectangle(config.width / 2, 0, 4, config.height + 8, 0xf87171, 1);
    this.tick31 = tick31;

    this.add([glow15, glow31, track, progress, tick15, tick31, label]);
    this.applySettings(config.settings);
  }

  setCount(value: number): void {
    const clamped = Phaser.Math.Clamp(value, 0, 31);
    const ratio = clamped / 31;
    this.progress.displayWidth = this.width * ratio;
    this.label.setText(`Count ${clamped}`);
    this.animateGlow(clamped);
    this.lastCount = clamped;
  }

  applySettings(settings: AccessibilitySettings): void {
    const fontScale = getFontScale(settings);
    this.label.setFontSize(20 * fontScale);
    if (settings.highContrast) {
      this.track.setFillStyle(0x020617, 0.95);
      this.track.setStrokeStyle(2, 0xffffff, 1);
      this.progress.setFillStyle(0xfacc15, 1);
      this.label.setColor('#ffffff');
      this.tick15.setFillStyle(0xffffff, 1);
      this.tick31.setFillStyle(0xffffff, 1);
    } else {
      this.track.setFillStyle(0x0f172a, 0.9);
      this.track.setStrokeStyle(2, 0x38bdf8, 0.8);
      this.progress.setFillStyle(0x22c55e, 1);
      this.label.setColor('#f8fafc');
      this.tick15.setFillStyle(0xfacc15, 1);
      this.tick31.setFillStyle(0xf87171, 1);
    }
  }

  private animateGlow(count: number): void {
    if (count === 15 && this.lastCount < 15) {
      this.pulseGlow(this.glow15);
    }
    if (count === 31 && this.lastCount < 31) {
      this.pulseGlow(this.glow31);
    }
    this.glow15.setVisible(count >= 15);
    this.glow31.setVisible(count >= 31);
  }

  private pulseGlow(target: Phaser.GameObjects.Ellipse): void {
    target.setVisible(true);
    target.setAlpha(0.2);
    target.setScale(1);
    this.scene.tweens.add({
      targets: target,
      alpha: 0,
      scale: 1.4,
      duration: 600,
      ease: 'Sine.easeOut'
    });
  }
}

export default CountMeterView;

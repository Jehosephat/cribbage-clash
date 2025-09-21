import Phaser from 'phaser';
import type { AccessibilitySettings } from '../src/settings/types';
import { getFontScale } from '../src/settings/types';

export type ToastKind = 'combo' | 'info' | 'error' | 'damage';

export interface ToastConfig {
  kind: ToastKind;
  message: string;
  settings: AccessibilitySettings;
  duration?: number;
}

const KIND_COLOR: Record<ToastKind, number> = {
  combo: 0x22d3ee,
  info: 0xa5b4fc,
  error: 0xf87171,
  damage: 0xfbbf24
};

export class Toast extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Rectangle;

  private readonly label: Phaser.GameObjects.Text;

  private readonly duration: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: ToastConfig) {
    super(scene, x, y);

    const fontScale = getFontScale(config.settings);
    const background = scene.add.rectangle(0, 0, 520, 48, 0x020617, 0.85);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, KIND_COLOR[config.kind], 0.9);
    this.background = background;

    const label = scene.add.text(0, 0, config.message, {
      fontFamily: 'Inter, sans-serif',
      fontSize: `${Math.round(20 * fontScale)}px`,
      fontStyle: 'bold',
      color: '#f8fafc',
      align: 'center'
    });
    label.setOrigin(0.5, 0.5);
    this.label = label;

    this.duration = config.duration ?? 2000;
    this.add([background, label]);
    this.applySettings(config.settings, config.kind);
    this.layout();
  }

  play(onComplete: () => void): void {
    this.alpha = 0;
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        this.scene.time.delayedCall(this.duration, () => {
          this.scene.tweens.add({
            targets: this,
            alpha: 0,
            y: this.y - 20,
            duration: 300,
            onComplete: () => {
              onComplete();
              this.destroy();
            }
          });
        });
      }
    });
  }

  applySettings(settings: AccessibilitySettings, kind: ToastKind): void {
    const fontScale = getFontScale(settings);
    this.label.setFontSize(20 * fontScale);
    if (settings.highContrast) {
      this.background.setFillStyle(0x000000, 0.9);
      this.background.setStrokeStyle(2, 0xffffff, 1);
      this.label.setColor('#ffffff');
    } else {
      this.background.setFillStyle(0x020617, 0.85);
      this.background.setStrokeStyle(2, KIND_COLOR[kind], 0.9);
      this.label.setColor('#f8fafc');
    }
    this.layout();
  }

  private layout(): void {
    const width = Math.max(260, this.label.width + 60);
    this.background.displayWidth = width;
  }
}

export default Toast;

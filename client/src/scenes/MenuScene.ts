import type { PlayerId } from '@cribbage-clash/rules';
import Phaser from 'phaser';
import {
  getAccessibilitySettings,
  updateAccessibilitySettings
} from '../settings/accessibility';
import type { AccessibilitySettings } from '../settings/types';

interface MenuSceneData {
  returnToLobby?: boolean;
}

export default class MenuScene extends Phaser.Scene {
  private settingsPanel?: Phaser.GameObjects.Container;

  private accessibility: AccessibilitySettings = getAccessibilitySettings();

  private backgroundRect?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('MenuScene');
  }

  create(data?: MenuSceneData): void {
    this.accessibility = getAccessibilitySettings();
    const backgroundColor = this.accessibility.highContrast ? 0x000000 : 0x0f172a;
    this.cameras.main.setBackgroundColor(backgroundColor);
    this.backgroundRect = this.add.rectangle(0, 0, this.scale.width, this.scale.height, backgroundColor).setOrigin(0, 0);

    const title = this.add.text(this.scale.width / 2, 120, 'Cribbage Clash', {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.accessibility.largeText ? '76px' : '64px',
      fontStyle: 'bold',
      color: this.accessibility.highContrast ? '#ffffff' : '#f8fafc'
    });
    title.setOrigin(0.5, 0.5);
    title.setDepth(1);

    const subtitle = this.add.text(
      this.scale.width / 2,
      180,
      'Pegging. Combos. Shields. To 61 HP and beyond.',
      {
        fontFamily: 'Inter, sans-serif',
      fontSize: this.accessibility.largeText ? '24px' : '20px',
      color: this.accessibility.highContrast ? '#d1d5db' : '#cbd5f5'
      }
    );
    subtitle.setOrigin(0.5, 0.5);

    const startY = 260;
    const spacing = 70;
    this.createButton('Hotseat', startY, () => this.beginMatch('hotseat'));
    this.createButton('vs Bot', startY + spacing, () => this.beginMatch('bot'));
    this.createButton('Online', startY + spacing * 2, () => this.goToLobby());
    this.createButton('Settings', startY + spacing * 3, () => this.toggleSettings());

    if (data?.returnToLobby) {
      this.showInfoToast('Returned to menu');
    }
  }

  private beginMatch(mode: 'hotseat' | 'bot'): void {
    const localSeat: PlayerId = 'p1';
    this.scene.start('MatchScene', { mode, localSeat });
  }

  private goToLobby(): void {
    this.scene.start('LobbyScene');
  }

  private toggleSettings(): void {
    if (this.settingsPanel) {
      this.settingsPanel.destroy(true);
      this.settingsPanel = undefined;
      return;
    }

    this.settingsPanel = this.buildSettingsPanel();
  }

  private rebuildSettingsPanel(): void {
    if (!this.settingsPanel) {
      return;
    }
    this.settingsPanel.destroy(true);
    this.settingsPanel = this.buildSettingsPanel();
  }

  private buildSettingsPanel(): Phaser.GameObjects.Container {
    const panelWidth = 400;
    const panelHeight = 320;
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2);
    const backdropColor = this.accessibility.highContrast ? 0x000000 : 0x020617;
    const strokeColor = this.accessibility.highContrast ? 0xffffff : 0x38bdf8;
    const backdrop = this.add.rectangle(0, 0, panelWidth, panelHeight, backdropColor, 0.95);
    backdrop.setStrokeStyle(2, strokeColor, 0.8);
    backdrop.setOrigin(0.5, 0.5);

    const header = this.add.text(0, -panelHeight / 2 + 40, 'Settings', {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.accessibility.largeText ? '34px' : '28px',
      fontStyle: 'bold',
      color: this.accessibility.highContrast ? '#ffffff' : '#f8fafc'
    });
    header.setOrigin(0.5, 0.5);

    const rows = [
      this.createToggleRow(panelWidth, -80, 'High contrast UI', this.accessibility.highContrast, (value) => {
        updateAccessibilitySettings({ highContrast: value });
        this.accessibility = getAccessibilitySettings();
        this.scene.restart();
      }),
      this.createToggleRow(panelWidth, -10, 'Large fonts', this.accessibility.largeText, (value) => {
        updateAccessibilitySettings({ largeText: value });
        this.accessibility = getAccessibilitySettings();
        this.scene.restart();
      }),
      this.createToggleRow(
        panelWidth,
        60,
        'Color-safe suits',
        this.accessibility.colorSafeSuits,
        (value) => {
          updateAccessibilitySettings({ colorSafeSuits: value });
          this.accessibility = getAccessibilitySettings();
          this.rebuildSettingsPanel();
        }
      )
    ];

    const closeButton = this.createTextButton('Close', panelWidth / 2 - 60, panelHeight / 2 - 40, () => {
      this.toggleSettings();
    });

    panel.add([backdrop, header, ...rows, closeButton]);
    return panel;
  }

  private createToggleRow(
    panelWidth: number,
    y: number,
    label: string,
    value: boolean,
    onToggle: (value: boolean) => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, y);
    const labelText = this.add.text(-panelWidth / 2 + 30, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.accessibility.largeText ? '22px' : '20px',
      color: this.accessibility.highContrast ? '#f8fafc' : '#e2e8f0'
    });
    labelText.setOrigin(0, 0.5);

    const toggle = this.add.rectangle(panelWidth / 2 - 70, 0, 90, 36, value ? 0x22c55e : 0x1f2937, 0.85);
    toggle.setOrigin(0.5, 0.5);
    toggle.setStrokeStyle(2, this.accessibility.highContrast ? 0xffffff : 0x38bdf8, 0.9);
    toggle.setData('value', value);
    const stateText = this.add.text(panelWidth / 2 - 70, 0, value ? 'ON' : 'OFF', {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.accessibility.largeText ? '18px' : '16px',
      color: this.accessibility.highContrast ? '#000000' : '#f8fafc'
    });
    stateText.setOrigin(0.5, 0.5);

    toggle.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      const current = toggle.getData('value') as boolean;
      const next = !current;
      toggle.setData('value', next);
      toggle.setFillStyle(next ? 0x22c55e : 0x1f2937, 0.85);
      stateText.setText(next ? 'ON' : 'OFF');
      onToggle(next);
    });

    container.add([labelText, toggle, stateText]);
    return container;
  }

  private createButton(label: string, y: number, handler: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(this.scale.width / 2, y);
    const baseFill = this.accessibility.highContrast ? 0xffffff : 0x1d4ed8;
    const hoverFill = this.accessibility.highContrast ? 0xfacc15 : 0x2563eb;
    const strokeColor = this.accessibility.highContrast ? 0xffffff : 0x38bdf8;
    const background = this.add.rectangle(0, 0, 320, 54, baseFill, this.accessibility.highContrast ? 1 : 0.92);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, strokeColor, 1);
    background.setInteractive({ useHandCursor: true });

    const text = this.add.text(0, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.accessibility.largeText ? '28px' : '24px',
      fontStyle: 'bold',
      color: this.accessibility.highContrast ? '#000000' : '#f8fafc'
    });
    text.setOrigin(0.5, 0.5);

    background.on('pointerdown', () => {
      if (this.sound && this.sound.get('ui-click')) {
        this.sound.play('ui-click', { volume: 0.15 });
      }
      handler();
    });

    background.on('pointerover', () => {
      background.setFillStyle(hoverFill, this.accessibility.highContrast ? 1 : 1);
    });
    background.on('pointerout', () => {
      background.setFillStyle(baseFill, this.accessibility.highContrast ? 1 : 0.92);
    });

    container.add([background, text]);
    return container;
  }

  private createTextButton(
    label: string,
    x: number,
    y: number,
    handler: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const baseFill = this.accessibility.highContrast ? 0xffffff : 0x334155;
    const hoverFill = this.accessibility.highContrast ? 0xfacc15 : 0x1f2937;
    const strokeColor = this.accessibility.highContrast ? 0xffffff : 0x38bdf8;
    const background = this.add.rectangle(0, 0, 120, 42, baseFill, this.accessibility.highContrast ? 1 : 0.92);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, strokeColor, 1);
    background.setInteractive({ useHandCursor: true }).on('pointerdown', handler);

    const text = this.add.text(0, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.accessibility.largeText ? '22px' : '20px',
      color: this.accessibility.highContrast ? '#000000' : '#f8fafc'
    });
    text.setOrigin(0.5, 0.5);

    background.on('pointerover', () => background.setFillStyle(hoverFill, this.accessibility.highContrast ? 1 : 0.92));
    background.on('pointerout', () => background.setFillStyle(baseFill, this.accessibility.highContrast ? 1 : 0.92));

    container.add([background, text]);
    return container;
  }

  private showInfoToast(message: string): void {
    const toast = this.add.text(this.scale.width / 2, this.scale.height - 60, message, {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.accessibility.largeText ? '20px' : '18px',
      color: this.accessibility.highContrast ? '#000000' : '#f8fafc',
      backgroundColor: this.accessibility.highContrast ? '#ffffffdd' : '#334155cc',
      padding: { x: 16, y: 10 },
      align: 'center'
    });
    toast.setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      duration: 1500,
      delay: 1200,
      onComplete: () => toast.destroy()
    });
  }
}

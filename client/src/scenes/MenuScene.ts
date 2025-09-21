import type { PlayerId } from '@cribbage-clash/rules';
import Phaser from 'phaser';

interface MenuSceneData {
  returnToLobby?: boolean;
}

export default class MenuScene extends Phaser.Scene {
  private settingsPanel?: Phaser.GameObjects.Container;

  constructor() {
    super('MenuScene');
  }

  create(data?: MenuSceneData): void {
    this.cameras.main.setBackgroundColor('#0f172a');
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a).setOrigin(0, 0);

    const title = this.add.text(this.scale.width / 2, 120, 'Cribbage Clash', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#f8fafc'
    });
    title.setOrigin(0.5, 0.5);
    title.setDepth(1);

    const subtitle = this.add.text(
      this.scale.width / 2,
      180,
      'Pegging. Combos. Shields. To 61 HP and beyond.',
      {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: '#cbd5f5'
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

    const panelWidth = 360;
    const panelHeight = 260;
    const panel = this.add.container(this.scale.width / 2, this.scale.height / 2);
    const backdrop = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x020617, 0.95);
    backdrop.setStrokeStyle(2, 0x38bdf8, 0.8);
    backdrop.setOrigin(0.5, 0.5);

    const header = this.add.text(0, -panelHeight / 2 + 40, 'Settings', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#f8fafc'
    });
    header.setOrigin(0.5, 0.5);

    const highContrast = this.add.text(-panelWidth / 2 + 30, -40, 'High contrast UI', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#e2e8f0'
    });
    highContrast.setOrigin(0, 0.5);

    const toggle = this.add.rectangle(panelWidth / 2 - 70, -40, 80, 34, 0x1f2937, 0.8);
    toggle.setOrigin(0.5, 0.5);
    toggle.setStrokeStyle(2, 0x38bdf8, 0.8);
    toggle.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      toggle.setFillStyle(toggle.fillColor === 0x1f2937 ? 0x22c55e : 0x1f2937, 0.8);
    });

    const closeButton = this.createTextButton('Close', panelWidth / 2 - 60, panelHeight / 2 - 40, () => {
      this.toggleSettings();
    });

    panel.add([backdrop, header, highContrast, toggle, closeButton]);
    this.settingsPanel = panel;
  }

  private createButton(label: string, y: number, handler: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(this.scale.width / 2, y);
    const background = this.add.rectangle(0, 0, 320, 54, 0x1d4ed8, 0.92);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, 0x38bdf8, 1);
    background.setInteractive({ useHandCursor: true });

    const text = this.add.text(0, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#f8fafc'
    });
    text.setOrigin(0.5, 0.5);

    background.on('pointerdown', () => {
      if (this.sound && this.sound.get('ui-click')) {
        this.sound.play('ui-click', { volume: 0.15 });
      }
      handler();
    });

    background.on('pointerover', () => {
      background.setFillStyle(0x2563eb, 1);
    });
    background.on('pointerout', () => {
      background.setFillStyle(0x1d4ed8, 0.92);
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
    const background = this.add.rectangle(0, 0, 120, 42, 0x334155, 0.92);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, 0x38bdf8, 1);
    background.setInteractive({ useHandCursor: true }).on('pointerdown', handler);

    const text = this.add.text(0, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#f8fafc'
    });
    text.setOrigin(0.5, 0.5);

    background.on('pointerover', () => background.setFillStyle(0x1f2937, 0.92));
    background.on('pointerout', () => background.setFillStyle(0x334155, 0.92));

    container.add([background, text]);
    return container;
  }

  private showInfoToast(message: string): void {
    const toast = this.add.text(this.scale.width / 2, this.scale.height - 60, message, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#f8fafc',
      backgroundColor: '#334155cc',
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

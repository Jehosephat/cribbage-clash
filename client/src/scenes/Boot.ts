import Phaser from 'phaser';

const CARD_BACK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axKpV8AAAAASUVORK5CYII=';

export default class Boot extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#020617');
    const loadingText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Loading…', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#f8fafc'
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.image('card-back', CARD_BACK);
    this.load.image('board-bg', CARD_BACK);
    this.load.on('complete', () => {
      this.time.delayedCall(50, () => this.startMenu());
    });
  }

  create(): void {
    if (this.load.totalToLoad === 0) {
      this.startMenu();
    }
  }

  private async startMenu(): Promise<void> {
    await this.ensureFonts();
    this.scene.start('MenuScene');
  }

  private ensureFonts(): Promise<void> {
    if (!document?.fonts?.ready) {
      return Promise.resolve();
    }
    const families = ['600 20px "Inter"', '400 18px "Inter"'];
    return Promise.all(families.map((font) => document.fonts.load(font))).then(() => undefined);
  }
}

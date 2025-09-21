import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.setBaseURL('/');
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}

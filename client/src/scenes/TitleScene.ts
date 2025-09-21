import Phaser from 'phaser';
import { gameState } from '../main';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    const { round, dealer } = gameState;

    const title = this.add.text(480, 220, 'Cribbage Clash', {
      fontFamily: 'sans-serif',
      fontSize: '48px',
      color: '#f1f5f9'
    });
    title.setOrigin(0.5, 0.5);

    const subtitle = this.add.text(
      480,
      300,
      `Round ${round + 1} — Dealer: ${dealer.toUpperCase()}`,
      {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#cbd5f5'
      }
    );
    subtitle.setOrigin(0.5, 0.5);
  }
}

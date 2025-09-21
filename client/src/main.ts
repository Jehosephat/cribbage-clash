import { createInitialState } from '@cribbage-clash/rules';
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import TitleScene from './scenes/TitleScene';

const state = createInitialState();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0f172a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540
  },
  fps: {
    target: 60,
    forceSetTimeOut: true
  },
  render: {
    antialias: true,
    pixelArt: false
  },
  scene: [BootScene, TitleScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  }
};

export const gameState = state;

export const game = new Phaser.Game(config);
